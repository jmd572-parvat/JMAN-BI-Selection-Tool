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
  /**
   * The recommendation as Markdown. `c` is built by the page (summaryContext); nothing in here knows about tools or scores:
   * winners, reasons, ranking, constraints, next steps and answers arrive ready to print.
   */
  function buildSummary(c) {
    var M = [];
    var item = function (x) { return '- **' + x.answer + '** (' + x.question + ')' + (x.why ? ': ' + x.why : ''); };
    var status = c.state === 'complete' ? 'Complete: all ' + c.visible + ' questions answered'
      : (STATE_LABEL[c.state] || c.state) + ': ' + c.answered + ' of ' + c.visible + ' questions answered';
    M.push('# BI tool recommendation' + (c.clientName ? ' for ' + c.clientName : ''), '');
    M.push('*Internal use only · ' + c.date + ' · ' + status + '*', '');
    if (!c.informative) {
      M.push('No scored answers yet, so there is nothing to recommend.', '');
    } else {
      var winners = c.winners || [], tie = winners.length > 1;
      M.push('## ' + (tie ? 'Too close to call: ' : c.state === 'provisional' ? 'Best fit so far: ' : 'Best fit: ') + listJoin(sortNames(winners.map(function (w) { return w.name; }))), '');
      if (c.leadSentence) M.push(c.leadSentence, '');
      if (c.boundaryMessage) M.push(c.boundaryMessage, '');
      (c.reasons || []).forEach(function (rs) {
        M.push('## Why ' + rs.tool + ' fits', '');
        if (rs.strengths.length) rs.strengths.forEach(function (x) { M.push(item(x)); }); else M.push('- No answer favours it yet.');
        M.push('', '## Watch-outs for ' + rs.tool, '');
        if (rs.concerns.length) rs.concerns.forEach(function (x) { M.push(item(x)); }); else M.push('- None flagged by the answers given.');
        M.push('');
      });
      if ((c.others || []).length || (c.excluded || []).length) {
        M.push('## The other tools', '');
        (c.others || []).forEach(function (t) { M.push('- Rank ' + (t.tied ? '=' : '') + t.rank + ': ' + t.name); });
        (c.excluded || []).forEach(function (e) { M.push('- **' + e.name + '** is ruled out: ' + e.because); });
        M.push('');
      }
      if ((c.constraints || []).length) { M.push('## What the client told us they need', ''); c.constraints.forEach(function (r) { M.push('- ' + r); }); M.push(''); }
      if ((c.migration || []).length) { M.push('## Migration', ''); c.migration.forEach(function (r) { M.push('- ' + r); }); M.push(''); }
      M.push('## Next steps', '');
      (c.nextSteps || []).forEach(function (r) { M.push('- ' + r); });
      winners.forEach(function (w) { if (w.docUrl) M.push('- Official documentation for ' + w.name + ': [' + w.docUrl + '](' + w.docUrl + ')'); });
      M.push('');
    }
    if (c.usesDraft && c.usesDraft.length) M.push('*This result uses questions marked as draft (' + c.usesDraft.join(', ') + '); their scores are awaiting review.*', '');
    M.push('## Answers and notes', '');
    if (!c.answers.length) M.push('- None yet.');
    var section = null;
    c.answers.forEach(function (a) {
      if (a.section !== section) { section = a.section; M.push('', '### ' + section, ''); }
      M.push('- **' + a.question + '**: ' + a.answer + (a.note ? ' *(' + a.note + ')*' : ''));
    });
    return M.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
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
