/*!
 * Pure page logic: no DOM, so it is unit-tested in Node (tests/page-lib.test.js).
 * Browser global `PageLib`, or Node `require`. Everything that decides what the user is TOLD lives here, so the rules in
 * docs/page-design.md (neutral ordering, fit words, lead sentences, the summary) are testable.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PageLib = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Questions whose answers name tools or ecosystems: shown alphabetically so list position cannot prime a choice. */
  var ALPHABETICAL_QUESTIONS = ['Q04', 'Q14'];
  /** Catch-all answers that always go last, in this order. */
  var TAIL = [/^excel/i, /^hybrid/i, /^none/i, /^other/i, /^not sure/i, /^to be confirmed/i];

  function byName(a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0; }

  /** Tool names in alphabetical order. Static copy must always list tools through this. */
  function sortNames(names) { return names.slice().sort(byName); }

  /** "A, B and C" */
  function listJoin(items) {
    if (items.length <= 1) return items.join('');
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  /**
   * Options in display order. Tool/ecosystem questions: alphabetical, then the catch-all answers, then not-scored answers.
   * Every other question keeps the workbook order (small to large, low to high, ...).
   */
  function orderOptions(question) {
    var opts = question.options.slice();
    if (ALPHABETICAL_QUESTIONS.indexOf(question.id) === -1) return opts;
    var tail = [], unknown = [], head = [];
    opts.forEach(function (o) {
      if (o.unknown) { unknown.push(o); return; }
      var t = -1;
      for (var i = 0; i < TAIL.length; i++) if (TAIL[i].test(o.label)) { t = i; break; }
      if (t >= 0) tail.push({ o: o, t: t }); else head.push(o);
    });
    head.sort(function (a, b) { return byName(a.label, b.label); });
    tail.sort(function (a, b) { return a.t - b.t; });
    return head.concat(tail.map(function (x) { return x.o; }), unknown);
  }

  /**
   * Splits an answer such as "Critical: executive or board-grade bespoke visuals" or "Small — up to 25 reports" into a short title and
   * a descriptive line, so a tile can show them separately. Only the workbook's own separators are used (": " and " — "); a label
   * without one is returned whole. Nothing is added to the wording.
   */
  function splitLabel(label) {
    var m = /^(.{2,48}?)(?::\s+|\s—\s)(.+)$/.exec(String(label));
    if (!m) return { title: String(label), detail: '' };
    return { title: m[1], detail: m[2].charAt(0).toUpperCase() + m[2].slice(1) };
  }

  /** Tiles for a question: up to three answers sit side by side as one choice bar, more than that fill a grid. */
  /** Columns for the tile grid, chosen so the rows come out even where they can: 4 answers make a 2 x 2, 6 make 3 x 2, 8 make 4 x 2. */
  function optionColumns(n) { return n <= 3 ? Math.max(n, 1) : n === 4 ? 2 : n <= 6 ? 3 : n <= 8 ? 4 : n === 9 ? 3 : 4; }
  function optionLayout(optionCount) { return optionCount <= 3 ? 'seg' : 'grid'; }

  var TIERS = [
    { min: 3.5, key: 'strong', label: 'Strong fit' },
    { min: 2.5, key: 'good', label: 'Good fit' },
    { min: 1.5, key: 'suitable', label: 'Suitable' },
    { min: -Infinity, key: 'possible', label: 'Possible but not ideal' }
  ];
  /** The fit word for one answer, from its absolute fit (1 to 4, averaged for multi-select). Cut-offs: docs/page-design.md A11. */
  function fitTier(absoluteFit) {
    for (var i = 0; i < TIERS.length; i++) if (absoluteFit >= TIERS[i].min) return TIERS[i];
    return TIERS[TIERS.length - 1];
  }

  /** Geometry of the diverging fit bar. z is clipped to +-cap; 0 sits in the middle. Returns {side, pct} with pct of the FULL bar width. */
  function barGeometry(z, cap) {
    cap = cap || 3;
    var c = Math.max(-cap, Math.min(cap, z));
    if (Math.abs(c) < 0.005) return { side: 'none', pct: 0 };
    return { side: c > 0 ? 'right' : 'left', pct: Math.abs(c) / cap * 50 };
  }

  /**
   * The sentence above the shortlist. `names` = {toolId: display name}. While the result is provisional it is prefixed with
   * "So far," so that a headline never sounds surer than the answers given so far can justify.
   */
  function leadSentence(result, names) {
    if (!result.informative) return 'Answer a few questions to see how the tools compare.';
    var leaders = (result.coLeaders.length ? result.coLeaders : [result.ranking[0].tool]).map(function (t) { return t.name; });
    var second = result.ranking.filter(function (r) { return r.rank > result.ranking[0].rank; })[0];
    var secondName = second ? second.tool.name : null;
    var core;
    if (result.leadStrength === 'tooClose' && leaders.length > 1) {
      core = listJoin(sortNames(leaders)) + ' fit equally well on these answers. Use a proof of concept to separate them.';
    } else if (result.leadStrength === 'clear') {
      core = leaders[0] + ' fits this client best, with a clear lead over ' + secondName + '.';
    } else if (result.leadStrength === 'narrow') {
      core = leaders[0] + ' fits best, but only narrowly ahead of ' + secondName + '. Treat the top two as a pair.';
    } else {
      core = leaders[0] + ' leads, but ' + secondName + ' is too close to call. Use a proof of concept to separate them.';
    }
    return (result.state === 'provisional' ? 'So far, ' : '') + core;
  }

  /** Message about the edge of the shortlist (null when the third tool is clearly ahead, or nothing is left out). */
  function boundaryMessage(result) {
    var b = result.shortlistBoundary;
    if (!b || b.strength === 'clear') return null;
    var last = result.shortlist[result.shortlist.length - 1].tool.name;
    return b.strength === 'tooClose'
      ? b.firstLeftOut.name + ' is almost level with ' + last + '. Consider it as well.'
      : b.firstLeftOut.name + ' is close behind ' + last + '. Keep it in mind.';
  }

  /** The "Based on ..." line for each result state. */
  function stateLine(state, answered, visible) {
    var base = 'Based on ' + answered + ' of ' + visible + ' questions.';
    if (state === 'provisional') return base + ' The order is likely to change as you answer more.';
    if (state === 'near') return base + ' The order can still change.';
    if (state === 'complete') return 'Based on all ' + visible + ' questions.';
    return '';
  }
  var STATE_LABEL = { none: 'Nothing scored yet', provisional: 'Provisional', near: 'Near complete', complete: 'Complete' };

  /** Plain-text summary for copy and print. All inputs are plain data (see tests/page-lib.test.js for the shape). */
  function buildSummary(c) {
    var L = [];
    L.push('BI tool recommendation          INTERNAL USE ONLY            ' + c.date);
    L.push('Client: ' + (c.clientName || '(not entered)'));
    L.push('Status: ' + (c.state === 'complete' ? 'Complete, all ' + c.visible + ' questions'
      : (STATE_LABEL[c.state] || c.state) + ', based on ' + c.answered + ' of ' + c.visible + ' questions'));
    L.push('');
    if (!c.informative) {
      L.push('No scored answers yet, so there is nothing to recommend.');
    } else {
      var lead = c.coLeaders.length > 1 ? listJoin(sortNames(c.coLeaders)) + ' fit equally on these answers' : c.shortlist[0].name;
      L.push((c.state === 'provisional' ? 'Best fit so far: ' : 'Best fit: ') + lead);
      L.push('Lead: ' + ({ clear: 'clear', narrow: 'narrow', tooClose: 'too close to call' }[c.leadStrength] || c.leadStrength));
      var others = c.shortlist.filter(function (t) { return c.coLeaders.length > 1 ? c.coLeaders.indexOf(t.name) === -1 : t.rank > 1; });
      if (others.length) L.push('Also on the shortlist: ' + others.map(function (t) { return t.name; }).join(', ') + (c.boundaryMessage ? '   (' + c.boundaryMessage + ')' : ''));
      else if (c.boundaryMessage) L.push(c.boundaryMessage);
      if (c.excluded.length) c.excluded.forEach(function (e) { L.push('Ruled out: ' + e.name + ': ' + e.because); });
      L.push('');
      (c.reasons || []).forEach(function (rs) {
        L.push('Why ' + rs.tool);
        rs.strengths.forEach(function (r) { L.push('- ' + r); });
        L.push('Watch-outs for ' + rs.tool);
        if (rs.concerns.length) rs.concerns.forEach(function (r) { L.push('- ' + r); }); else L.push('- none flagged by the answers given');
        L.push('');
      });
      if (c.constraints && c.constraints.length) {
        L.push('Constraints you told us about');
        c.constraints.forEach(function (r) { L.push('- ' + r); });
        L.push('');
      }
      if (c.migration && c.migration.length) {
        L.push('Migration implications');
        c.migration.forEach(function (r) { L.push('- ' + r); });
        L.push('');
      }
      L.push('Next validation step');
      L.push('- Run a proof of concept on the highest-risk assumption. Verify pricing and licensing before quoting.');
      L.push('');
    }
    if (c.usesDraft && c.usesDraft.length) L.push('Note: this result uses draft questions (' + c.usesDraft.join(', ') + '); their scores are awaiting review.');
    L.push('Answers and notes');
    c.answers.forEach(function (a) { L.push('- ' + a.section + ': ' + a.question + ' - ' + a.answer + (a.note ? '  (' + a.note + ')' : '')); });
    if (!c.answers.length) L.push('- none yet');
    return L.join('\n');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; });
  }

  return {
    ALPHABETICAL_QUESTIONS: ALPHABETICAL_QUESTIONS, sortNames: sortNames, listJoin: listJoin, orderOptions: orderOptions, splitLabel: splitLabel, optionLayout: optionLayout, optionColumns: optionColumns,
    fitTier: fitTier, barGeometry: barGeometry, leadSentence: leadSentence, boundaryMessage: boundaryMessage,
    stateLine: stateLine, STATE_LABEL: STATE_LABEL, buildSummary: buildSummary, escapeHtml: escapeHtml
  };
}));
