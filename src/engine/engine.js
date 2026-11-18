/*!
 * BI selection engine. Dependency-free; works in the browser (global `BIEngine`) and in Node (`require`).
 *
 * It reproduces scripts/bi_model.py exactly (the executable specification). The cross-language parity test in
 * tests/parity.test.js fails if the two ever disagree. See docs/scoring-method.md for why it is built this way.
 *
 * DESIGN GOAL: NO PLATFORM BIAS. The ranking comes only from the client's answers:
 *   - tools are scored with a z-score against a per-question reference, not by a raw sum of fit scores
 *   - ties are broken only by the client's answers (meta.tieBreak) and otherwise SHARE a rank
 *   - tool order in the data never matters; ties are listed alphabetically
 *   - Pareto guard: a tool can never outrank one that is at least as good on every answered question
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BIEngine = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCORE_MAX = 4;
  var NEUTRAL_SCORE = 2;
  var EPS = 1e-9;
  /*
   * Result-confidence thresholds, in z. DERIVED FROM DATA, not chosen: scripts/calibrate_thresholds.py measures how often the
   * leader (and the top-three set) survives +-1 noise on every weight. With the provisional weights the #1 platform stays #1
   * 64% of the time below 0.3, 87% between 0.3 and 0.5, and 98% from 0.5 (top-three set: 83% at 0.3-0.5, 97% from 0.5).
   * Re-run the script after the weighting session: the thresholds depend on the weights.
   */
  var TOO_CLOSE_Z = 0.3;   // a gap below this is "too close to call"
  var CLEAR_LEAD_Z = 0.5;  // a gap at or above this is a "clear" lead; in between is "narrow"

  /**
   * Share of the visible question weight that must be answered before a ranking counts as "near complete".
   * Measured by scripts/calibrate_thresholds.py (section C): below it the partial leader matched the final one in at most 61% of
   * simulated clients, at or above it in 85%. Simulated clients answer at random, so real clients may differ.
   */
  var NEAR_COMPLETE_COVERAGE = 0.8;

  /** 'clear' | 'narrow' | 'tooClose' for a gap in z (the lead of #1 over #2, or of 3rd over 4th). */
  function classifyGap(gap) {
    if (gap >= CLEAR_LEAD_Z) return 'clear';
    if (gap >= TOO_CLOSE_Z) return 'narrow';
    return 'tooClose';
  }

  /** Quantise to 1e-9 with floor(x*1e9 + 0.5): the same IEEE operations as bi_model._q, so ties agree across languages. */
  function q9(x) { return Math.floor(x * 1e9 + 0.5); }

  function intersects(a, b) {
    for (var i = 0; i < a.length; i++) if (b.indexOf(a[i]) !== -1) return true;
    return false;
  }

  function compareKeys(ka, kb) {
    for (var i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
    return 0;
  }

  function sameKey(ka, kb) { return compareKeys(ka, kb) === 0; }

  /** Average premium over the neutral score on the requirement questions, per tool. Mirrors bi_model.requirement_premium. */
  function requirementPremium(model) {
    var tools = model.tools.map(function (t) { return t.id; });
    var num = {}, den = 0;
    tools.forEach(function (t) { num[t] = 0; });
    model.questions.forEach(function (q) {
      var known = q.options.filter(function (o) { return !o.unknown; });
      if (q.reference !== 'neutral' || !q.weight || !known.length) return;
      var share = known.length / q.options.length;
      den += q.weight * share;
      tools.forEach(function (t) {
        num[t] += q.weight * share * (known.reduce(function (a, o) { return a + (o.scores[t] - NEUTRAL_SCORE); }, 0) / known.length);
      });
    });
    var out = {};
    tools.forEach(function (t) { out[t] = den ? num[t] / den : 0; });
    return out;
  }

  /** Recompute the calibration from the scores: {qid: {mean: {tool: x}, var: {tool: x}}}. Mirrors bi_model.calibration. */
  function calibration(model) {
    var tools = model.tools.map(function (t) { return t.id; });
    var prem = requirementPremium(model);
    var out = {};
    model.questions.forEach(function (q) {
      var known = q.options.filter(function (o) { return !o.unknown; });
      if (!known.length) return;
      var mean = {}, vari = {};
      tools.forEach(function (t) {
        var cs;
        if (q.reference === 'neutral') {
          mean[t] = NEUTRAL_SCORE + prem[t];
          cs = known.map(function (o) { return o.scores[t] - mean[t]; });
          for (var i = 0; i < q.options.length - known.length; i++) cs.push(0);
        } else {
          var m = known.reduce(function (a, o) { return a + o.scores[t]; }, 0) / known.length;
          mean[t] = m;
          cs = known.map(function (o) { return o.scores[t] - m; });
        }
        var cm = cs.reduce(function (a, c) { return a + c; }, 0) / cs.length;
        vari[t] = cs.reduce(function (a, c) { return a + (c - cm) * (c - cm); }, 0) / cs.length;
      });
      out[q.id] = { mean: mean, var: vari };
    });
    return out;
  }

  /**
   * @param {object} model parsed data/questions.json
   * @returns engine with score(), visibleQuestions(), verifyCalibration()
   */
  function createEngine(model) {
    var questions = model.questions.slice().sort(function (a, b) { return a.order - b.order; });
    var qmap = {};
    questions.forEach(function (q) {
      qmap[q.id] = q;
      q.omap = {};
      q.options.forEach(function (o) { q.omap[o.id] = o; });
    });
    var tools = model.tools.map(function (t) { return t.id; });
    // Use the calibration shipped in the JSON (written by excel_to_json.py), exactly as the Python reference does.
    var cal = {};
    questions.forEach(function (q) {
      if (q.baseline && q.variance) cal[q.id] = { mean: q.baseline, var: q.variance };
    });
    var fallback = null;
    questions.forEach(function (q) {
      if (!cal[q.id] && q.options.some(function (o) { return !o.unknown; })) {
        fallback = fallback || calibration(model);
        cal[q.id] = fallback[q.id];
      }
    });
    var tieBreak = ((model.meta && model.meta.tieBreak) || []).map(function (g) { return { name: g.name, questions: g.questions }; });

    function isVisible(q, live) {
      for (var i = 0; i < q.showIf.length; i++) {
        var cl = q.showIf[i];
        if (!intersects(live[cl.q] || [], cl.in)) return false;
      }
      return true;
    }

    /** Visible questions in asking order. A hidden parent's answers are ignored (stale-answer protection). */
    function visibleQuestions(answers) {
      var live = {}, vis = [];
      questions.forEach(function (q) {
        if (isVisible(q, live)) {
          vis.push(q);
          if (Object.prototype.hasOwnProperty.call(answers, q.id)) live[q.id] = answers[q.id];
        }
      });
      return { visible: vis, live: live };
    }

    /** True if tool b is >= tool a on every counted question (raw scores) and > on at least one. */
    function dominates(b, a, perQ) {
      var ge = true, gt = false;
      for (var qid in perQ) {
        var r = perQ[qid].r;
        if (r[b] < r[a] - EPS) ge = false;
        if (r[b] > r[a] + EPS) gt = true;
      }
      return ge && gt;
    }

    /**
     * @param {Object<string,string[]>} answers {questionId: [optionId, ...]}
     * @param {{weights?: Object<string,number>, mode?: 'neutral'|'raw'}} [opts]
     */
    function score(answers, opts) {
      opts = opts || {};
      var weights = opts.weights || {};
      var mode = opts.mode || 'neutral';
      var vl = visibleQuestions(answers || {});
      var F = {}, S2 = {}, rawTot = {}, sub = {};
      tools.forEach(function (t) { F[t] = 0; S2[t] = 0; rawTot[t] = 0; });
      tieBreak.forEach(function (g) { sub[g.name] = {}; tools.forEach(function (t) { sub[g.name][t] = 0; }); });
      var perQ = {}, counted = [], excluded = {}, excludedBy = {}, denom = 0;

      vl.visible.forEach(function (q) {
        var picked = (vl.live[q.id] || []).filter(function (id) { return q.omap[id]; }).map(function (id) { return q.omap[id]; });
        picked.forEach(function (o) {
          o.excludes.forEach(function (t) {
            excluded[t] = true;
            (excludedBy[t] = excludedBy[t] || []).push({ questionId: q.id, optionId: o.id });
          });
        });
        var known = picked.filter(function (o) { return !o.unknown; });
        var w = Object.prototype.hasOwnProperty.call(weights, q.id) ? weights[q.id] : q.weight;
        if (!known.length || w === 0 || !cal[q.id]) return;
        var r = {}, contribution = {};
        tools.forEach(function (t) {
          var s = 0;
          for (var i = 0; i < known.length; i++) s += known[i].scores[t];
          r[t] = s / known.length;
        });
        counted.push(q.id);
        denom += w * SCORE_MAX;
        tools.forEach(function (t) {
          var c = w * (r[t] - cal[q.id].mean[t]);
          contribution[t] = c;
          F[t] += c;
          S2[t] += w * w * cal[q.id].var[t];
          rawTot[t] += w * r[t];
          tieBreak.forEach(function (g) { if (g.questions.indexOf(q.id) !== -1) sub[g.name][t] += c; });
        });
        perQ[q.id] = { weight: w, r: r, contribution: contribution, selected: known.map(function (o) { return o.id; }) };
      });

      var z = {}, rawFit = {};
      tools.forEach(function (t) {
        z[t] = S2[t] > EPS ? F[t] / Math.sqrt(S2[t]) : 0;
        rawFit[t] = denom ? rawTot[t] / denom : 0;
      });
      var primary = mode === 'neutral' ? z : rawFit;
      var eligible = tools.filter(function (t) { return !excluded[t]; });

      var keys = {};
      eligible.forEach(function (t) {
        keys[t] = [q9(-primary[t])].concat(tieBreak.map(function (g) { return q9(-sub[g.name][t]); }));
      });
      // name only fixes the LIST order of equal keys (alphabetical); ranks below never depend on it
      var byKey = eligible.slice().sort(function (a, b) {
        var c = compareKeys(keys[a], keys[b]);
        return c !== 0 ? c : (a < b ? -1 : a > b ? 1 : 0);
      });
      // Pareto guard: take the best-scoring tool that no REMAINING tool dominates (strict partial order, so it terminates)
      var order = [], remaining = byKey.slice();
      while (remaining.length) {
        var pick = -1;
        for (var i = 0; i < remaining.length && pick < 0; i++) {
          var blocked = false;
          for (var j = 0; j < remaining.length; j++) {
            if (j !== i && dominates(remaining[j], remaining[i], perQ)) { blocked = true; break; }
          }
          if (!blocked) pick = i;
        }
        order.push(remaining[pick]);
        remaining.splice(pick, 1);
      }
      var rank = {};
      order.forEach(function (t, i) {
        var prev = order[i - 1];
        if (i && sameKey(keys[t], keys[prev]) && !dominates(prev, t, perQ) && !dominates(t, prev, perQ)) rank[t] = rank[prev];
        else rank[t] = i + 1;
      });
      var margin = order.length > 1 ? Math.max(0, primary[order[0]] - primary[order[1]]) : 0;
      return {
        z: z, rawFit: rawFit, rank: rank, ranked: order,
        excluded: Object.keys(excluded).sort(), excludedBy: excludedBy,
        counted: counted, denominator: denom, margin: margin,
        visible: vl.visible.map(function (q) { return q.id; }),
        tiedLeaders: order.filter(function (t) { return rank[t] === 1; }),
        perQuestion: perQ
      };
    }

    /** Differences between the JSON's baseline/variance and what the scores imply (empty = consistent). */
    function verifyCalibration(tol) {
      tol = tol || 1e-6;
      var fresh = calibration(model), drift = [];
      questions.forEach(function (q) {
        if (!q.baseline || !fresh[q.id]) return;
        tools.forEach(function (t) {
          if (Math.abs(q.baseline[t] - fresh[q.id].mean[t]) > tol || Math.abs(q.variance[t] - fresh[q.id].var[t]) > tol) {
            drift.push(q.id + '/' + t);
          }
        });
      });
      return drift;
    }

    return {
      model: model, tools: tools, questions: questions, qmap: qmap,
      visibleQuestions: visibleQuestions, score: score, verifyCalibration: verifyCalibration
    };
  }

  return {
    createEngine: createEngine, calibration: calibration, requirementPremium: requirementPremium, classifyGap: classifyGap,
    TOO_CLOSE_Z: TOO_CLOSE_Z, CLEAR_LEAD_Z: CLEAR_LEAD_Z, NEAR_COMPLETE_COVERAGE: NEAR_COMPLETE_COVERAGE, SCORE_MAX: SCORE_MAX
  };
}));
