/*!
 * Questionnaire session: the state the playbook page needs on top of the scoring engine.
 *   answers with validation, branching with stale-answer pruning, progress,
 *   and a result object that follows the UI contract in docs/scoring-method.md.
 * Dependency-free; browser global `BISession` (needs `BIEngine` loaded first) or Node `require`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.BISession = factory(root.BIEngine);
}(typeof self !== 'undefined' ? self : this, function (BIEngine) {
  'use strict';

  var EPS = 1e-9;

  function Session(model, opts) {
    opts = opts || {};
    this.model = model;
    this.engine = BIEngine.createEngine(model);
    this.weights = opts.weights || {};
    this.answers = {};
    this.toolName = {};
    var self = this;
    model.tools.forEach(function (t) { self.toolName[t.id] = t.name; });
  }

  Session.prototype._isVisible = function (qid) {
    return this.engine.visibleQuestions(this.answers).visible.some(function (q) { return q.id === qid; });
  };

  /** Remove answers to questions that are no longer asked. Returns the ids that were cleared. */
  Session.prototype._prune = function () {
    var pruned = [];
    for (;;) {
      var vis = {};
      this.engine.visibleQuestions(this.answers).visible.forEach(function (q) { vis[q.id] = true; });
      var stale = Object.keys(this.answers).filter(function (id) { return !vis[id]; });
      if (!stale.length) return pruned;
      for (var i = 0; i < stale.length; i++) { delete this.answers[stale[i]]; pruned.push(stale[i]); }
    }
  };

  /** The questions currently asked, in asking order, with the client's answer on each. */
  Session.prototype.visible = function () {
    var answers = this.answers;
    return this.engine.visibleQuestions(answers).visible.map(function (q) {
      var a = answers[q.id] || [];
      return {
        id: q.id, order: q.order, section: q.section, text: q.text, type: q.type, stage: q.stage, status: q.status,
        options: q.options.map(function (o) { return { id: o.id, label: o.label, unknown: o.unknown }; }),
        answer: a.slice(), answered: a.length > 0
      };
    });
  };

  /**
   * Set the answer to a question. Single-select takes exactly one option, multi-select one or more.
   * An empty list clears the answer. Throws on an unknown question/option or a question that is not asked.
   * @returns {{pruned: string[]}} questions whose answers were cleared because their branch closed
   */
  Session.prototype.answer = function (qid, optionIds) {
    var q = this.engine.qmap[qid];
    if (!q) throw new Error('Unknown question ' + qid);
    if (!this._isVisible(qid)) throw new Error('Question ' + qid + ' is not asked for the current answers');
    var ids = [];
    (optionIds || []).forEach(function (id) { if (ids.indexOf(id) === -1) ids.push(id); });
    for (var i = 0; i < ids.length; i++) {
      if (!q.omap[ids[i]]) throw new Error('Unknown option ' + ids[i] + ' for ' + qid);
    }
    if (q.type === 'single' && ids.length > 1) throw new Error(qid + ' is single-select: choose one option');
    if (ids.length === 0) delete this.answers[qid];
    else this.answers[qid] = ids;
    return { pruned: this._prune() };
  };

  Session.prototype.clear = function (qid) { return this.answer(qid, []); };

  /**
   * Counts and coverage. `coverage` is the share of the visible question WEIGHT that has an answer (any answer, including
   * "not sure yet"), 0 to 1. Weights are provisional until the weighting session, and are never shown to the client.
   */
  Session.prototype.progress = function () {
    var vis = this.engine.visibleQuestions(this.answers).visible, answers = this.answers, weights = this.weights;
    var wOf = function (q) { return Object.prototype.hasOwnProperty.call(weights, q.id) ? weights[q.id] : q.weight; };
    var answered = vis.filter(function (q) { return (answers[q.id] || []).length > 0; });
    var wAll = vis.reduce(function (a, q) { return a + wOf(q); }, 0);
    var wDone = answered.reduce(function (a, q) { return a + wOf(q); }, 0);
    return {
      visible: vis.length, answered: answered.length, remaining: vis.length - answered.length,
      weightVisible: wAll, weightAnswered: wDone, coverage: wAll ? wDone / wAll : 0
    };
  };

  /** Unanswered visible questions, the ones that would move the result most first (by weight, then asking order). */
  Session.prototype.openQuestions = function () {
    var answers = this.answers, weights = this.weights;
    var wOf = function (q) { return Object.prototype.hasOwnProperty.call(weights, q.id) ? weights[q.id] : q.weight; };
    return this.engine.visibleQuestions(answers).visible
      .filter(function (q) { return !(answers[q.id] || []).length; })
      .sort(function (a, b) { return wOf(b) - wOf(a) || a.order - b.order; })
      .map(function (q) { return { id: q.id, text: q.text, section: q.section, order: q.order }; });
  };

  Session.prototype.toJSON = function () { return { version: 1, answers: JSON.parse(JSON.stringify(this.answers)) }; };

  /** Restore saved answers; anything invalid or no longer asked is dropped silently. */
  Session.fromJSON = function (model, data, opts) {
    var s = new Session(model, opts);
    var saved = (data && data.answers) || {};
    s.engine.questions.forEach(function (q) {            // in asking order, so parents are restored before children
      var ids = saved[q.id];
      if (!ids || !s._isVisible(q.id)) return;
      try { s.answer(q.id, ids); } catch (e) { /* ignore a stale or invalid saved answer */ }
    });
    return s;
  };

  /** Tools that fit at least as well as `t` on every counted question (used to explain Pareto reordering). */
  function dominators(perQ, tools, t) {
    return tools.filter(function (v) {
      if (v === t) return false;
      var ge = true, gt = false;
      for (var qid in perQ) {
        var r = perQ[qid].r;
        if (r[v] < r[t] - EPS) ge = false;
        if (r[v] > r[t] + EPS) gt = true;
      }
      return ge && gt;
    });
  }

  Session.prototype.result = function () {
    var self = this, e = this.engine;
    var r = e.score(this.answers, { weights: this.weights });
    var informative = r.counted.length > 0;
    var ranking = r.ranked.map(function (id) {
      var tied = r.ranked.filter(function (u) { return r.rank[u] === r.rank[id]; });
      return {
        tool: { id: id, name: self.toolName[id] }, rank: r.rank[id], z: r.z[id], absoluteFit: r.rawFit[id],
        tied: tied.length > 1, tiedWith: tied.filter(function (u) { return u !== id; })
      };
    }).sort(function (a, b) {            // equal ranks are listed alphabetically, never by data order
      return a.rank - b.rank || (a.tool.name.toLowerCase() < b.tool.name.toLowerCase() ? -1 : 1);
    });
    var adjusted = [];
    ranking.forEach(function (row) {
      var above = dominators(r.perQuestion, r.ranked, row.tool.id).filter(function (v) {
        return r.rank[v] < r.rank[row.tool.id] && r.z[v] < r.z[row.tool.id] - EPS;
      });
      if (above.length) adjusted.push({ tool: row.tool.id, rankedBelow: above });
    });
    var excluded = r.excluded.map(function (t) {
      var seen = {}, because = [];
      (r.excludedBy[t] || []).forEach(function (x) {
        var k = x.questionId + '/' + x.optionId;
        if (seen[k]) return;
        seen[k] = true;
        var q = e.qmap[x.questionId];
        var opt = q.omap[x.optionId];
        because.push({
          questionId: x.questionId, questionText: q.text, optionId: x.optionId, optionLabel: opt.label,
          rationale: opt.rationale && opt.rationale.tools ? opt.rationale.tools[t] || '' : ''
        });
      });
      return { tool: { id: t, name: self.toolName[t] }, because: because };
    });
    var coLeaders = informative ? r.tiedLeaders.map(function (id) { return { id: id, name: self.toolName[id] }; }) : [];
    // lead strength: ties are always "too close"; otherwise classify the lead of #1 over #2
    var leadStrength = !informative ? 'none' : (r.tiedLeaders.length > 1 ? 'tooClose' : BIEngine.classifyGap(r.margin));
    // shortlist boundary: how far the last shortlisted platform is ahead of the first one left out
    var shortlistRows = informative ? ranking.filter(function (row) { return row.rank <= 3; }) : [];
    var nextRow = informative ? ranking.filter(function (row) { return row.rank > 3; })[0] : null;
    var boundary = null;
    if (shortlistRows.length && nextRow) {
      var last = shortlistRows[shortlistRows.length - 1];
      var gap = Math.max(0, last.z - nextRow.z);
      boundary = { gap: gap, strength: BIEngine.classifyGap(gap), firstLeftOut: nextRow.tool };
    }
    var prog = this.progress();
    // result state: none (nothing scored) | provisional | near (coverage at or above the calibrated line) | complete (everything answered)
    var state = !informative ? 'none' : (prog.remaining === 0 ? 'complete' : (prog.coverage >= BIEngine.NEAR_COMPLETE_COVERAGE ? 'near' : 'provisional'));
    return {
      informative: informative,
      state: state,
      coverage: prog.coverage,
      ranking: ranking,
      shortlist: shortlistRows,
      shortlistBoundary: boundary,
      margin: r.margin,
      leadStrength: leadStrength,
      tooCloseToCall: leadStrength === 'tooClose',
      coLeaders: coLeaders.length > 1 ? coLeaders : [],
      adjustedByDominance: adjusted,
      excluded: excluded,
      countedQuestions: r.counted.length,
      visibleQuestions: r.visible.length,
      usesDraftQuestions: r.counted.filter(function (id) { return e.qmap[id].status === 'draft'; }),
      raw: r
    };
  };

  /**
   * Why a tool scored as it did: the questions that moved it most, with the SME rationale for the answers given.
   * @param {string} toolId
   * @param {number} [n=3] how many drivers to return on each side
   */
  Session.prototype.explain = function (toolId, n) {
    n = n || 3;
    var e = this.engine, r = e.score(this.answers, { weights: this.weights });
    var rows = Object.keys(r.perQuestion).map(function (qid) {
      var q = e.qmap[qid], pq = r.perQuestion[qid];
      var chosen = pq.selected.map(function (id) { return q.omap[id]; });
      return {
        questionId: qid, text: q.text, section: q.section, weight: pq.weight,
        contribution: pq.contribution[toolId], absoluteFit: pq.r[toolId],
        answer: chosen.map(function (o) { return { id: o.id, label: o.label }; }),
        why: chosen.map(function (o) { return o.rationale && o.rationale.tools ? o.rationale.tools[toolId] : ''; }).filter(Boolean)
      };
    });
    var byContribution = rows.slice().sort(function (a, b) { return b.contribution - a.contribution; });
    return {
      tool: { id: toolId, name: this.toolName[toolId] },
      strengths: byContribution.filter(function (x) { return x.contribution > EPS; }).slice(0, n),
      concerns: byContribution.filter(function (x) { return x.contribution < -EPS; }).reverse().slice(0, n)
    };
  };

  return { Session: Session };
}));
