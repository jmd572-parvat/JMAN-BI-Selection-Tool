/*!
 * BI Tools Selection Playbook: content module.
 * Renders the nine sections of docs/page-design.md, all on ONE scrolling page, from a BISession and the extracted deck data (data/deck/*.json).
 * The hero band, tab row, "On this page" and feedback footer are the marketplace shell's job (docs/page-design.md, A1);
 * src/page/index.html is only a stand-in for local preview. Plain script, no build step: browser global `Playbook`.
 *
 * Rules this module must never break (tested in tests/page-lib.test.js, verified in the browser):
 *   - tools are ordered by rank, then alphabetically; static lists of tools are alphabetical
 *   - tied leaders are shown as co-leaders, never as a single winner
 *   - the engine's absolute fit is supporting evidence only, never a rank
 *   - answers and notes stay in the browser; the client name is never stored
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../engine/engine.js'), require('../engine/session.js'), require('./lib.js'));
  else root.Playbook = factory(root.BIEngine, root.BISession, root.PageLib);
}(typeof self !== 'undefined' ? self : this, function (BIEngine, BISessionNS, L) {
  'use strict';

  // the wrapper's `root` is not in scope here, so name the global object explicitly (browser: window, Node: globalThis)
  var root = typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : {});
  var Session = BISessionNS.Session;
  var esc = L.escapeHtml;
  /** An own property of a plain lookup table: an address such as #/constructor must not find Object's inherited members. */
  function has(table, key) { return Object.prototype.hasOwnProperty.call(table, key); }
  function isPlain(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

  /**
   * The playbook's pages: the tab row. There are two, told as a story: first we get to know the tools (purpose, our principles, the
   * tool dictionary, the comparison matrix), then we work out which one fits this client (the questions, then the recommendation).
   */
  var PAGES = [
    { id: 'home', label: 'Tools overview' }, { id: 'discovery', label: 'Client discovery' }
  ];
  var PAGE_IDS = PAGES.map(function (p) { return p.id; });
  /** Where each section of the playbook lives. go('shortlist') opens Client discovery at its recommendation. The old page ids still work. */
  var SECTION_PAGE = {
    overview: 'home', navigate: 'home', principles: 'home', dictionary: 'home', matrix: 'home', cta: 'home',
    discovery: 'discovery', scoring: 'discovery', shortlist: 'discovery', migration: 'discovery', final: 'discovery',
    compare: 'home', comparehome: 'home', versus: 'home', recommendation: 'discovery'
  };
  /** Where go() scrolls to when the section it names is not simply `sec-<id>`. */
  var ANCHOR = { compare: 'sec-dictionary', comparehome: 'sec-dictionary', versus: 'sec-matrix', recommendation: 'sec-reco', shortlist: 'sec-reco', migration: 'sec-reco', final: 'sec-reco' };
  /**
   * One short line for each tool in each matrix group, for the closed row. Each only restates the deck's own headlines for that group
   * (data/deck/matrix.json): it adds no claim. Proposed wording, awaiting owner review (docs/page-design.md A23).
   */
  var GROUP_SUMMARY = {
    'Business Adoption': { looker: 'Slowest to onboard, most IT-dependent', powerbi: 'Fast to adopt, low IT effort, visuals need DAX', qlik: 'Slower to learn, moderate IT, visuals less flexible', sigma: 'Fastest for spreadsheet teams, easy to edit', tableau: 'Quick to learn, most flexible visuals, more IT-dependent', thoughtspot: 'Fastest overall, least IT effort, less polished storytelling' },
    'AI & Analytics': { looker: 'Narrower AI, forecasting needs extra', powerbi: 'Most integrated AI, strong forecasting', qlik: 'Solid AI, most turnkey predictive', sigma: 'Lighter AI, no native forecasting', tableau: 'Strong AI and forecasting', thoughtspot: 'AI is the core, not built for forecasting' },
    'Enterprise Readiness': { looker: 'Purpose-built semantic layer, needs the data team', powerbi: 'Fastest row-level security, capped by Fabric limits', qlik: 'Enterprise-grade scaling, complex security', sigma: 'Simplest security, relies on the warehouse', tableau: 'More security setup, less central metrics', thoughtspot: 'Built for concurrency, less mature row-level security' },
    'Technology & Integration': { looker: 'Best for Google Cloud, built for embedding', powerbi: 'Best for Microsoft shops', qlik: 'Fits hybrid IT, strong APIs', sigma: 'Cloud warehouse only, simple embeds', tableau: 'Fits almost any stack, broadest platforms', thoughtspot: 'Cloud-first only, low-code embedding' },
    'Commercial & Business Value': { looker: 'Enterprise-only pricing, smaller talent pool', powerbi: 'Lowest entry cost, largest talent pool', qlik: 'Flexible licensing, established ecosystem', sigma: 'Low overhead, newest and smallest talent pool', tableau: 'Premium pricing, mature community', thoughtspot: 'Premium pricing, fastest path to an answer, smaller community' }
  };

  /** The five areas of the questionnaire, in the order they are asked. The migration-related questions come last. */
  var SECTIONS = [
    { id: '1', title: 'Business context and goals', blurb: 'What the client wants from BI, who uses it, which ecosystem they live in, and what matters most: polish, AI, cost, number of users.' },
    { id: '2', title: 'Data, security and governance', blurb: 'Compliance, security and access, whether a vendor-hosted tool is acceptable, semantic layer, governance maturity, AI governance.' },
    { id: '3', title: 'Skills and change readiness', blurb: 'Who builds the reports, their skill, how much training the client can support, talent availability.' },
    { id: '4', title: 'Data landscape and delivery', blurb: 'Where the data lives and how fast it grows, how fresh it must be, and whether reports are shared outside the team.' },
    { id: '5', title: 'Existing reporting and migration', blurb: 'Whether the client has reporting today, which tools it uses and how much, how complex the content is, and what limits a move.' }
  ];
  function sectionOf(q) {
    if (q.section === 'S1') return '1';
    if (q.section === 'S2') return '2';
    if (q.section === 'S3') return '3';
    return ['Q16', 'Q18', 'Q19'].indexOf(q.id) !== -1 ? '4' : '5';
  }

  /** "Why we ask" text that exists in the Flow sheet. The remaining questions have none yet (docs/page-design.md, B6): nothing is shown for them. */
  var HELP = {
    Q06: 'Ask this for every client, whatever the answer to the compliance question.',
    Q10: 'If JMAN builds the reports, the two questions about the client team’s skills and training are skipped.'
  };
  /**
   * One line under each question saying what it is asking. It only restates the question and its answers: it makes no claim about any
   * tool and never mentions scoring. Proposed wording, awaiting owner review (docs/page-design.md A17).
   */
  var GUIDE = {
    Q01: 'Pick every outcome the client wants BI to deliver. Several usually apply.',
    Q02: 'Who opens the reports and dashboards? Pick every group that does.',
    Q03: 'Think about what the client says about reporting today: late numbers, figures nobody trusts, data that is hard to get.',
    Q04: 'The platform family the client’s data and tools mostly live in. Pick the closest one.',
    Q21: 'How much the client cares about how the dashboards look, not only what they show.',
    Q22: 'Whether people should be able to ask questions of the data in plain English.',
    Q23: 'How much price should count when choosing between tools.',
    Q25: 'An estimate is fine. Choose “To be confirmed” if it is not known yet.',
    Q05: 'Whether regulation or internal policy limits how data may be stored, shared or accessed.',
    Q06: 'Pick everything the client needs, including any concern about how AI features use their data.',
    Q26: 'Whether the client is able to use a tool that the vendor hosts in the cloud. Answering No rules out any tool that is only offered that way.',
    Q07: 'Whether the business definitions, such as metrics and how tables relate, are already modelled in one place.',
    Q08: 'How consistently reporting is controlled today: who can publish, and who checks the numbers.',
    Q10: 'Who does the hands-on report building during this engagement.',
    Q11: 'The skill of the people who will build and maintain the reports on the client side.',
    Q12: 'How much time and support the client can give to training people and to the change.',
    Q24: 'How much it matters that people skilled in the chosen platform are easy to find.',
    Q13: 'Whether the client has reports or dashboards live today. This decides whether the migration questions follow.',
    Q14: 'Pick every tool in use today, including Excel.',
    Q15: 'The size of the content that would have to move.',
    Q16: 'Where the client’s data sits and how quickly it is growing. Pick all that apply.',
    Q17: 'What the existing dashboards contain. Pick all that apply.',
    Q18: 'How fresh the data must be and how many people query it at once. Pick all that apply.',
    Q19: 'Who sees the reporting outside the client’s own team, if anyone. Pick all that apply.',
    Q20: 'What limits how the work can be done. Pick all that apply.'
  };
  /** Questions whose answers are the client’s own constraints (listed in the final summary). Proposal, docs/page-design.md A15. */
  var CONSTRAINT_QS = ['Q05', 'Q06', 'Q20', 'Q26'];
  /**
   * Which questions bear on which matrix criterion, for "Relevant to your answers". Proposal, docs/page-design.md A14.
   * 'Q06:ai_governance_concerns' means that one answer of Q06 only (any other answer to Q06 says nothing about AI).
   */
  var CRITERION_QS = [
    ['Ease of Adoption', ['Q10', 'Q11', 'Q12']], ['Self-Service Analytics', ['Q01', 'Q11']], ['Visualization', ['Q21', 'Q17']],
    ['AI-Assisted', ['Q22', 'Q06:ai_governance_concerns']], ['Predictive', ['Q01']], ['Governance & Security', ['Q03', 'Q05', 'Q06', 'Q08', 'Q26']],
    ['Semantic Layer', ['Q07']], ['Scalability', ['Q16', 'Q18', 'Q25']], ['Technology Ecosystem', ['Q04']], ['Cloud Data Platform', ['Q04', 'Q16']],
    ['Embedded', ['Q19']], ['Licensing', ['Q23']], ['Business Value', ['Q01']], ['Community', ['Q24']]
  ];
  /** Corrections to deck slide 22, each with a vendor source. Every other cell is the deck’s own text. */
  var LOOKER_URL = 'https://docs.cloud.google.com/looker/docs/choosing-hosting-option';
  var TS_URL = 'https://docs.thoughtspot.com/cloud/latest/cloud-and-software-support';
  var DEPLOY_FIX = {
    'Primary deployment': {
      looker: { text: 'Looker (Google Cloud core) is hosted by Google. Looker (original) can be hosted by Looker or by the customer.', url: LOOKER_URL },
      thoughtspot: { text: 'ThoughtSpot Cloud is vendor-hosted. ThoughtSpot Software is customer-managed.', url: TS_URL }
    },
    'On-premises option': {
      looker: { text: 'Looker (Google Cloud core): no. Looker (original): yes, customer-hosted.', url: LOOKER_URL },
      thoughtspot: { text: 'ThoughtSpot Cloud: no. ThoughtSpot Software: customer-managed.', url: TS_URL }
    }
  };

  /** Where each tool's own documentation starts. Every address was opened on 2026-11-21. */
  var DOCS = {
    looker: 'https://docs.cloud.google.com/looker/docs', powerbi: 'https://learn.microsoft.com/en-us/power-bi/', qlik: 'https://help.qlik.com/',
    sigma: 'https://help.sigmacomputing.com/', tableau: 'https://help.tableau.com/', thoughtspot: 'https://docs.thoughtspot.com/'
  };
  /** One correction to a matrix cell, checked against the vendor's own pages on 2026-11-20. `from` is the original text: it only applies to that exact text. */
  var MATRIX_FIX = { sigma: { 'AI-Assisted & Conversational Analytics': { from: 'Ask Sigma covers the basics', to: 'Sigma Assistant (successor to Ask Sigma) covers the basics' } } };

  /** Line icons (24 px grid, drawn with the text colour): used for every arrow, close and tick so they centre exactly. */
  var ICON_PATHS = { left: '<path d="M14.5 6 8.5 12l6 6"/>', right: '<path d="m9.5 6 6 6-6 6"/>', close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', menu: '<path d="M4.5 7h15M4.5 12h15M4.5 17h15"/>', up: '<path d="m6 14.5 6-6 6 6"/>', down: '<path d="m6 9.5 6 6 6-6"/>', expand: '<path d="M14 5h5v5M10 19H5v-5M19 5l-6 6M5 19l-6 6"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', check: '<path d="m5.5 12.5 4.2 4.2 8.8-9.4"/>', top: '<path d="M12 19V6M6.5 11.5 12 6l5.5 5.5"/>', download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>', external: '<path d="M8 16 16 8M9.5 8H16v6.5"/>' };
  function icon(name) {
    return '<svg class="pb-ico pb-ico-' + name + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICON_PATHS[name] + '</svg>';
  }

  /** Today's date where the reader is (not the UTC date, which is the wrong day for part of the day away from Greenwich). */
  function today() {
    var d = new Date(), two = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
  }

  /** Answers saved before a question moved: Q09 (AI governance concerns) became an option of Q06. */
  var MOVED_ANSWERS = [{ from: 'Q09', when: 'yes', to: 'Q06', option: 'ai_governance_concerns' }];

  /**
   * @param {{container: Element, rail: Element, toc?: Element, overlay?: Element, mini?: Element, model: object, deck: object, config?: object, onTab?: Function}} o
   */
  function mount(o) {
    var config = o.config || {};
    var D = o.deck;
    var fullModel = o.model;
    var storageKey = config.storageKey || 'bi-playbook-v1';
    var showDrafts = config.showDrafts !== false;
    var names = {};
    fullModel.tools.forEach(function (t) { names[t.id] = t.name; });
    var toolIds = fullModel.tools.map(function (t) { return t.id; });   // alphabetical (the converter writes them that way)
    var profileOf = {};
    D.profiles.tools.forEach(function (p) { profileOf[p.id] = p; });

    var loadNote = '';                                   // what was changed in the answers saved on this device, said once to the reader
    var store = loadStore();
    var model, session;
    var ui = { matrixOpen: {}, page: 'home', rec: 'shortlist', shortSel: null, overlay: false, step: null, popup: null, followShown: {}, notice: null, openNotes: {}, mtools: null, dtool: null, clientName: '' };
    if (loadNote) ui.notice = { text: loadNote };

    /** The ids of the questions and options this model has: saved or restored answers are checked against them. */
    function knownOptions() {
      var qs = {};
      fullModel.questions.forEach(function (q) { var m = {}; q.options.forEach(function (op) { m[op.id] = true; }); qs[q.id] = m; });
      return qs;
    }
    /**
     * Answers from storage or from a back-up file, made safe: a list of text for each question the model still has, and only options it
     * still has. An answer to a question that moved is carried over (MOVED_ANSWERS); anything else that no longer fits is dropped and counted.
     */
    function cleanAnswers(raw) {
      var out = {}, dropped = 0, moved = [], qs = knownOptions();
      if (!isPlain(raw)) return { answers: out, message: raw == null ? '' : 'The saved answers could not be read, so they were not kept.' };
      Object.keys(raw).forEach(function (id) {
        var v = raw[id];
        if (!Array.isArray(v) || !v.every(function (x) { return typeof x === 'string'; })) { dropped++; return; }
        if (has(qs, id)) {
          var kept = v.filter(function (x, i) { return has(qs[id], x) && v.indexOf(x) === i; });
          if (kept.length) out[id] = kept;
          if (kept.length < v.length) dropped++;
          return;
        }
        var mv = MOVED_ANSWERS.filter(function (m) { return m.from === id; })[0];
        if (mv && has(qs, mv.to) && has(qs[mv.to], mv.option)) { if (v.indexOf(mv.when) !== -1) moved.push(mv); } else dropped++;
      });
      moved.forEach(function (mv) { var cur = out[mv.to] || []; if (cur.indexOf(mv.option) === -1) out[mv.to] = cur.concat([mv.option]); });
      var parts = [];
      if (moved.length) parts.push('An earlier answer about AI governance now sits under the security and access question.');
      if (dropped) parts.push(dropped + (dropped === 1 ? ' saved answer' : ' saved answers') + ' no longer matched the questions, so ' + (dropped === 1 ? 'it was' : 'they were') + ' removed.');
      return { answers: out, message: parts.join(' ') };
    }
    /** Notes from storage or a back-up file: text for a question the model has. */
    function cleanNotes(raw) {
      var out = {}, qs = knownOptions();
      if (isPlain(raw)) Object.keys(raw).forEach(function (id) { if (has(qs, id) && typeof raw[id] === 'string' && raw[id]) out[id] = raw[id]; });
      return out;
    }
    function loadStore() {
      var raw = null;
      try { var txt = root.localStorage && root.localStorage.getItem(storageKey); if (txt) raw = JSON.parse(txt); } catch (e) { /* storage unavailable or damaged: carry on without it */ }
      if (!isPlain(raw)) return { answers: {}, notes: {} };
      var c = cleanAnswers(raw.answers);
      loadNote = c.message;
      return { answers: c.answers, notes: cleanNotes(raw.notes) };
    }
    function saveStore() { try { root.localStorage && root.localStorage.setItem(storageKey, JSON.stringify(store)); } catch (e) { /* ignore */ } }
    function buildSession(answers) {
      model = showDrafts ? fullModel : Object.assign({}, fullModel, { questions: fullModel.questions.filter(function (q) { return q.status !== 'draft'; }) });
      session = Session.fromJSON(model, { answers: answers || {} });
    }
    function persist() {
      var inModel = {};
      model.questions.forEach(function (q) { inModel[q.id] = true; });
      var keep = {};
      Object.keys(store.answers).forEach(function (id) { if (!inModel[id]) keep[id] = store.answers[id]; });   // e.g. drafts hidden by the toggle
      store.answers = Object.assign(keep, session.answers);
      saveStore();
    }
    buildSession(store.answers);
    if (loadNote) saveStore();                           // the cleaned answers replace the old ones on this device

    // ------------------------------------------------------------------ small helpers
    var qOf = function (id) { return session.engine.qmap[id]; };
    var labelsOf = function (qid, ids) { var q = qOf(qid); return (ids || []).map(function (i) { return q && q.omap[i] ? q.omap[i].label : i; }); };
    function answerText(qid) { return labelsOf(qid, session.answers[qid]).join(', '); }
    function listTools(ids) { return L.listJoin(L.sortNames(ids.map(function (i) { return names[i]; }))); }
    function pill(cls, text) { return '<span class="pb-pill ' + cls + '">' + esc(text) + '</span>'; }

    // ------------------------------------------------------------------ PAGE 1: purpose, contents, principles, dictionary, matrix, then the way to page 2
    function renderOverview() {
      var toolList = L.listJoin(L.sortNames(toolIds.map(function (i) { return names[i]; })));
      var row = function (label, text) { return '<div><dt>' + esc(label) + '</dt><dd>' + esc(text) + '</dd></div>'; };
      return '<section class="pb-sec pb-home"><h2>Purpose</h2>' +
        '<p class="pb-lead">When a client asks us which BI tool to choose, we do not start with a favourite. We start with what they are trying to do.</p>' +
        '<dl class="pb-purpose">' +
        row('Who it is for', 'Sales and pre-sales, delivery teams and consultants.') +
        row('What it does', 'Compares ' + toolList + ', and gives us reasons we can stand behind.') +
        row('When we use it', 'In discovery and solution design, before we recommend a tool and before scope or pricing is final.') +
        row('What it does not replace', 'A proof of concept, a licensing negotiation or a formal RFP response.') + '</dl></section>';
    }

    /** The contents: where the rest of the page goes, in the order we work. The way into client discovery is the button at the very end. */
    function renderNavigate() {
      var chapter = function (n, title, text, meta, anchor) {
        return '<li><button class="pb-chapter" data-action="go" data-tab="home" data-anchor="' + anchor + '"><span class="pb-chapter-ico" aria-hidden="true">' + n + '</span>' +
          '<span class="pb-chapter-t"><span class="pb-chapter-meta">' + esc(meta) + '</span><strong>' + esc(title) + '</strong><span class="pb-chapter-d">' + esc(text) + '</span></span>' +
          '<span class="pb-chapter-go" aria-hidden="true">' + icon('right') + '</span></button></li>';
      };
      return '<section class="pb-sec"><h2>Contents</h2>' +
        '<ol class="pb-chapters">' +
        chapter(1, 'Do’s and Don’ts', 'The principles we hold ourselves to on every recommendation.', 'HOW WE WORK', 'sec-principles') +
        chapter(2, 'Tools dictionary', 'A one-line summary of each tool, with a link to its official documentation.', toolIds.length + ' TOOLS · A TO Z', 'sec-dictionary') +
        chapter(3, 'Comparison matrix', 'All six side by side, a group of criteria at a time. Choose the tools to show, or put any two head to head.', '14 CRITERIA · ' + toolIds.length + ' TOOLS', 'sec-matrix') +
        '</ol></section>';
    }

    function card(title, text) { return '<div class="pb-card"><h4>' + esc(title) + '</h4><p>' + esc(text) + '</p></div>'; }

    function renderPrinciples() {
      var dos = ['We start with the business problem, not the preferred technology.', 'We assess the client’s existing ecosystem before recommending a change.',
        'We separate mandatory requirements from preferences.', 'We check vendor claims against the client’s actual requirements.',
        'We use a proof of concept for high-risk assumptions.', 'We write down the trade-offs and the reasons for the decision.'];
      var donts = ['We never declare a universal “best BI tool”. The right answer depends on the client.',
        'We do not hand the questions or the result to the client. They are internal working material.',
        'We do not quote pricing or feature claims without checking they are current.'];
      var list = function (items) { return '<ul class="pb-bullets pb-dd-list">' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'; };
      var head = function (kind, text) { return '<h4><span class="pb-mk pb-mk-' + kind + ' pb-mk-lg" aria-hidden="true">' + icon(kind === 'do' ? 'check' : 'close') + '</span>' + text + '</h4>'; };
      return '<section class="pb-sec"><h2>Do’s and Don’ts</h2>' +
        '<p class="pb-lead">The habits behind every recommendation we make.</p>' +
        '<div class="pb-grid2 pb-dd"><div class="pb-card pb-do">' + head('do', 'What We Do') + list(dos) + '</div>' +
        '<div class="pb-card pb-dont">' + head('dont', 'What We Don’t Do') + list(donts) + '</div></div></section>';
    }

    /** The close of page 1: for the client who still cannot be placed, the way into the questions. */
    function renderCta() {
      return '<section class="pb-sec"><div class="pb-card pb-cta"><h2>Still unable to pick a BI tool?</h2>' +
        '<p class="pb-lead">Spend just 5 to 10 minutes on a few questions about the client. We turn their answers into the best-fit BI tool for their situation, with the reasons to back it up.</p>' +
        '<p><button class="pb-btn pb-btn-lg" data-action="go" data-tab="discovery">Start client discovery</button></p></div></section>';
    }

    /** How the ranking is made, as a closed disclosure at the foot of the discovery page. */
    function renderScoring() {
      return '<section class="pb-sec"><details class="pb-details pb-ref"><summary>How the recommendation is made</summary>' +
        '<div class="pb-card">' + scoringHtml() + '</div></details></section>';
    }

    // ------------------------------------------------------------------ CLIENT DISCOVERY (the page, and the question carousel)
    function visibleBySection() {
      var by = {};
      session.visible().forEach(function (q) { (by[sectionOf(q)] = by[sectionOf(q)] || []).push(q); });
      return by;
    }
    function counts(qs) { return { done: (qs || []).filter(function (q) { return q.answered; }).length, total: (qs || []).length }; }
    /** The question that opens this one, or null: follow-up questions are shown inside their parent's card. */
    function parentOf(q) { var full = qOf(q.id); return full && full.showIf && full.showIf.length ? full.showIf[0].q : null; }
    function childrenOf(pid) { return session.visible().filter(function (c) { return parentOf(c) === pid; }); }
    function sectionById(id) { return SECTIONS.filter(function (s) { return s.id === id; })[0]; }

    // ---- sections, and the queue of open questions
    /** The top-level questions of one area that are asked now, in order. Follow-ups sit inside their parent's card. */
    function sectionTops(sid) { return (visibleBySection()[sid] || []).filter(function (q) { return !parentOf(q); }); }
    /** A top-level question is open while it, or a follow-up it opened, has no answer. */
    function isOpenTop(q) { return !q.answered || childrenOf(q.id).some(function (c) { return !c.answered; }); }
    function sectionHasOpen(sid) { var c = counts(visibleBySection()[sid]); return c.total > 0 && c.done < c.total; }
    /** The next area after `after` (or from the top) that still has an unanswered question; it wraps round once. Null when everything is answered. */
    function nextOpenSection(after) {
      var ids = SECTIONS.map(function (x) { return x.id; }), i = after ? ids.indexOf(after) : -1;
      return ids.slice(i + 1).concat(i >= 0 ? ids.slice(0, i + 1) : []).filter(sectionHasOpen)[0] || null;
    }
    /** The step that shows one top-level question (or the one a follow-up belongs to), with its place in its area. */
    function qStep(qid) {
      var q = qOf(qid);
      if (!q) return null;
      var top = parentOf(q) || qid, sid = sectionOf(qOf(top)), tops = sectionTops(sid), i = -1;
      tops.forEach(function (t, k) { if (t.id === top) i = k; });
      return i < 0 ? null : { kind: 'q', section: sid, qid: top, pos: i + 1, count: tops.length };
    }
    /** Where an area opens: its first open question, or its first question when none is open. */
    function firstOpenStep(sid) {
      var tops = sectionTops(sid), q = tops.filter(isOpenTop)[0] || tops[0];
      return q ? qStep(q.id) : null;
    }
    /** The step being shown, checked against the questions asked now (an answer can close a branch). */
    function currentStep() {
      var st = ui.step;
      if (st && st.kind === 'end') return st;
      if (st && st.kind === 'review' && sectionTops(st.section).length) return st;
      if (st && st.kind === 'q') { var fresh = qStep(st.qid); if (fresh) return fresh; }
      var sid = st && st.section && sectionTops(st.section).length ? st.section : (nextOpenSection(null) || SECTIONS.filter(function (x) { return sectionTops(x.id).length; })[0].id);
      return firstOpenStep(sid);
    }

    function renderDiscovery() {
      var by = visibleBySection();
      var prog = session.progress();
      var allDone = prog.visible > 0 && prog.remaining === 0;
      var started = prog.answered > 0;
      var nextSid = allDone ? null : nextOpenSection(null);
      var cards = SECTIONS.map(function (x) {
        var c = counts(by[x.id]);
        var done = c.total > 0 && c.done === c.total;
        var act = !c.total ? '' : done ? 'Review' : c.done ? 'Continue' : 'Start';
        var meta = !c.total ? '' : done ? 'All ' + c.total + ' answered' : c.done ? c.done + ' of ' + c.total + ' answered' : c.total + ' question' + (c.total === 1 ? '' : 's');
        return '<li><button class="pb-area' + (done ? ' is-done' : '') + (x.id === nextSid ? ' is-next' : '') + '" data-action="openq" data-section="' + x.id + '">' +
          '<span class="pb-area-top"><span class="pb-area-n" aria-hidden="true">' + (done ? icon('check') : x.id) + '</span>' + (x.id === nextSid ? '<span class="pb-area-tag">' + (started ? 'Up next' : 'Start here') + '</span>' : '') + '</span>' +
          '<strong class="pb-area-title">' + esc(x.title) + '</strong><span class="pb-area-d">' + esc(x.blurb) + '</span>' +
          '<span class="pb-area-foot"><span class="pb-area-meta">' + meta + '</span><span class="pb-area-act">' + act + icon('right') + '</span></span></button></li>';
      }).join('');
      var download = '<li><div class="pb-area pb-area-dl">' +
        '<span class="pb-area-top"><span class="pb-area-n" aria-hidden="true">' + icon('download') + '</span></span>' +
        '<strong class="pb-area-title">Save your answers</strong><span class="pb-area-d">A document with the recommendation, the reasons and every answer and note. It stays on your device.</span>' +
        '<span class="pb-area-foot pb-dl-actions"><button class="pb-btn pb-btn-ghost" data-action="mdsave">Markdown</button><button class="pb-btn pb-btn-ghost" data-action="pdf"' + (lockedNow() ? ' disabled title="The PDF holds the recommendation, which opens once every question is answered. Markdown is always available."' : '') + '>PDF</button></span></div></li>';
      return '<section class="pb-sec"><p class="pb-backrow"><button class="pb-link pb-back" data-action="go" data-tab="home">' + icon('left') + '<span>Tools overview</span></button></p>' +
        '<h2 id="disc-about">Client discovery</h2>' +
        '<p class="pb-lead">The client’s answers decide the tool, not our preferences. We ask about five areas of their situation, and the recommendation further down follows from what they tell us. It takes about 5 to 10 minutes.</p>' +
        '<h3 id="disc-areas">Areas we ask about</h3>' +
        '<ol class="pb-areas">' + cards + download + '</ol>' +
        '<div class="pb-startrow"><button class="pb-btn pb-btn-lg" data-action="openq">' + (allDone ? 'See the recommendation' : started ? 'Continue the questions' : 'Start the questions') + '</button>' +
        (started ? '<span class="pb-startmeta">' + prog.answered + ' of ' + prog.visible + ' answered</span> <button class="pb-link" data-action="reset">Start over</button>' : '') + '</div></section>';
    }

    // ---- question tiles
    function optionTile(q, opt, type, checked) {
      var parts = L.splitLabel(opt.label);
      return '<label class="pb-opt' + (opt.unknown ? ' pb-quiet' : '') + '"' + (opt.unknown ? ' title="This answer is not scored: it does not help or hurt any tool."' : '') + '><input type="' + type + '" name="a-' + q.id + '" id="o-' + q.id + '-' + opt.id + '" data-qid="' + q.id + '" value="' + esc(opt.id) + '"' + (checked ? ' checked' : '') + '>' +
        '<span class="pb-tile"><span class="pb-mark" aria-hidden="true"></span><span class="pb-opt-label"><span class="pb-opt-title' + (parts.detail ? ' has-sub' : '') + '">' + esc(parts.title) + '</span>' +
        (parts.detail ? '<span class="pb-opt-sub">' + esc(parts.detail) + '</span>' : '') + (opt.unknown ? '<span class="pb-opt-flag">Not scored</span>' : '') + '</span></span></label>';
    }

    /** One question as a card. `kicker` is "Question 2 of 6" for a top-level question and "Follow-up" for a nested one. */
    function questionCard(q, kicker, nested) {
      var full = qOf(q.id);
      var opts = L.orderOptions(full);
      var multi = q.type === 'multi';
      var type = multi ? 'checkbox' : 'radio';
      var layout = L.optionLayout(opts.length);
      var guide = GUIDE[q.id], help = HELP[q.id];
      var note = store.notes[q.id] || '';
      var noteOpen = ui.openNotes[q.id] || !!note;
      var kids = nested ? [] : childrenOf(q.id);
      var follow = '';
      if (kids.length) {
        var fresh = !ui.followShown[q.id];
        ui.followShown[q.id] = true;
        follow = '<div class="pb-follow' + (fresh ? ' is-new' : '') + '"><p class="pb-follow-h">Follow-up questions</p>' +
          kids.map(function (c) { return questionCard(c, 'Follow-up', true); }).join('') + '</div>';
      } else if (!nested) ui.followShown[q.id] = false;
      return '<fieldset class="pb-q' + (nested ? ' pb-q-nested' : '') + (q.answered ? ' is-answered' : '') + '" id="q-' + q.id + '" data-qid="' + q.id + '">' +
        '<legend><span class="pb-qkicker"><span class="pb-qno">' + esc(kicker) + '</span>' +
        (q.status === 'draft' ? '<span class="pb-tag pb-tag-draft" title="Scores for this question are awaiting review">Draft</span>' : '') +
        '<span class="pb-qkind">' + (multi ? 'Choose all that apply' : 'Choose one') + '</span></span>' +
        '<span class="pb-qtext">' + esc(q.text) + '</span></legend>' +
        '<div class="pb-qbody">' + (guide ? '<p class="pb-help">' + esc(guide) + (help ? ' ' + esc(help) : '') + '</p>' : (help ? '<p class="pb-help">' + esc(help) + '</p>' : '')) +
        '<div class="pb-options pb-opts-' + layout + '" style="--n:' + opts.length + ';--cols:' + L.optionColumns(opts.length) + '">' +
        opts.map(function (opt) { return optionTile(q, opt, type, q.answer.indexOf(opt.id) !== -1); }).join('') + '</div>' +
        '<div class="pb-qfoot">' + (q.answered ? '<button class="pb-link" data-action="clear" data-qid="' + q.id + '">Clear</button>' : '<span></span>') +
        '<button class="pb-link pb-link-quiet" data-action="note" data-qid="' + q.id + '" aria-expanded="' + (noteOpen ? 'true' : 'false') + '">' + (noteOpen ? 'Hide note' : 'Add note') + '</button></div>' +
        (noteOpen ? '<label class="pb-notelabel">Note: kept on this device and included in the summary<textarea class="pb-note-in" data-note="' + q.id + '" rows="2">' + esc(note) + '</textarea></label>' : '') +
        follow + '</div></fieldset>';
    }

    // ---- the question container

    function logoHtml(id, cls) {
      var src = config.logos && config.logos[id];
      if (src) return '<img class="pb-logo ' + (cls || '') + '" src="' + esc(src) + '" alt="" draggable="false">';
      var words = names[id].split(/\s+/);
      var mono = (words.length > 1 ? words.map(function (w) { return w.charAt(0); }).join('') : names[id].charAt(0)).toUpperCase();
      return '<span class="pb-logo pb-mono ' + (cls || '') + '" aria-hidden="true">' + esc(mono) + '</span>';
    }

    /** The live top three, as a dock: no background, the leader in full colour and the others slightly greyed, each growing on hover. */
    function top3Html() {
      var r = session.result();
      if (!r.informative) return '<div class="pb-foot-row"><span class="pb-foot-empty">Your top three tools will appear here after your first scored answer.</span></div>';
      var rows = r.shortlist.slice(0, 5);
      if (ui.winnerAway) rows = rows.filter(function (row) { return row.rank > 1; });         // the winner has left the dock: no second copy of it
      return '<div class="pb-foot-row"><ol class="pb-top3 pb-dock" aria-label="Current top three tools">' + rows.map(function (row) {
        var rank = Math.min(row.rank, 3);
        var rl = row.tied ? '=' + row.rank : String(row.rank);
        return '<li><button class="pb-logo-btn pb-r' + rank + '" data-action="tool" data-tool="' + row.tool.id + '" aria-label="Rank ' + rl + ': ' + esc(row.tool.name) + '. Show why.">' +
          logoHtml(row.tool.id) + '<span class="pb-tip" role="tooltip">' + esc(row.tool.name) + '</span></button></li>';
      }).join('') + '</ol></div>';
    }

    function popupHtml() {
      var id = ui.popup;
      if (!id) return '';
      var r = session.result();
      var rows = r.informative ? r.shortlist : [];
      var i = -1;
      rows.forEach(function (row, k) { if (row.tool.id === id) i = k; });
      if (i < 0) { ui.popup = null; return ''; }
      var row = rows[i], prev = rows[i - 1], next = rows[i + 1];
      var ex = session.explain(id, 3);
      var nav = function (target, dir) {
        if (!target) return '<span class="pb-pop-nav is-off" aria-hidden="true"></span>';
        return '<button class="pb-pop-nav pb-pop-nav-' + (dir < 0 ? 'prev' : 'next') + '" data-action="poptool" data-tool="' + target.tool.id + '" aria-label="' + (dir < 0 ? 'Previous ranked' : 'Next ranked') + ': ' + esc(target.tool.name) + '">' +
          (dir < 0 ? icon('left') : '') + logoHtml(target.tool.id, 'pb-logo-sm') + (dir > 0 ? icon('right') : '') + '</button>';
      };
      var rl = row.tied ? '=' + row.rank : String(row.rank);
      return '<div class="pb-pop-wrap"><div class="pb-pop-back" data-action="popclose"></div><div class="pb-pop-row">' + nav(prev, -1) +
        '<div class="pb-pop" role="dialog" aria-labelledby="pb-pop-title">' +
        '<header class="pb-pop-head"><div class="pb-pop-title"><span class="pb-rank" aria-label="Rank ' + rl + '">' + rl + '</span>' + logoHtml(id, 'pb-logo-md') + '<h3 id="pb-pop-title">' + esc(row.tool.name) + '</h3></div>' +
        '<button class="pb-pop-close" data-action="popclose" aria-label="Close">' + icon('close') + '</button></header>' +
        '<div class="pb-pop-body"><h4>Why it fits</h4>' + (ex.strengths.length ? '<ul class="pb-reasons">' + ex.strengths.map(reasonHtml).join('') + '</ul>' : '<p class="pb-fine">No answer favours this tool yet.</p>') +
        (ex.concerns.length ? '<h4>Watch-outs</h4><ul class="pb-reasons">' + ex.concerns.slice(0, 2).map(reasonHtml).join('') + '</ul>' : '') +
        '<p class="pb-fine">Provisional until most questions are answered.</p></div></div>' + nav(next, 1) + '</div></div>';
    }

    /** The drawer: every area and every question, with what is answered and where the reader is. Follow-ups that are open sit under their parent. */
    function menuHtml(st) {
      var by = visibleBySection();
      var cur = st && st.kind === 'q' ? st.qid : null;
      var curQ = cur ? qOf(cur) : null;
      var curTop = curQ && parentOf(curQ) ? parentOf(curQ) : cur;
      var item = function (q, nested) {
        var here = !!cur && (q.id === cur || (!nested && q.id === curTop));
        return '<li' + (nested ? ' class="is-nested"' : '') + '><button class="pb-menu-q' + (q.answered ? ' is-answered' : '') + (here ? ' is-here' : '') + '" data-action="jump" data-qid="' + q.id + '"' + (here ? ' aria-current="step"' : '') + '>' +
          '<span class="pb-menu-mark" aria-hidden="true">' + (q.answered ? icon('check') : '') + '</span><span class="pb-menu-t">' + esc(q.text) + '</span>' + (q.status === 'draft' ? '<span class="pb-tag pb-tag-draft">Draft</span>' : '') + '</button></li>';
      };
      return '<div class="pb-menu-wrap"><div class="pb-menu-back" data-action="menuclose"></div><nav class="pb-menu" id="pb-menu" aria-label="All areas and questions">' +
        '<header class="pb-menu-head"><h3>All questions</h3><button class="pb-ovl-close" data-action="menuclose" aria-label="Close the list">' + icon('close') + '</button></header>' +
        '<div class="pb-menu-body">' + SECTIONS.map(function (s) {
          var qs = by[s.id] || [], c = counts(qs);
          if (!qs.length) return '';
          var tops = qs.filter(function (q) { return !parentOf(q); });
          return '<section class="pb-menu-sec' + (st && st.section === s.id ? ' is-here' : '') + '"><button class="pb-menu-area" data-action="jumpsec" data-section="' + s.id + '"><span class="pb-menu-n" aria-hidden="true">' + s.id + '</span><span class="pb-menu-at">' + esc(s.title) + '</span><span class="pb-menu-c">' + c.done + '/' + c.total + '</span></button>' +
            '<ul class="pb-menu-list">' + tops.map(function (q) { return item(q, false) + childrenOf(q.id).map(function (k) { return item(k, true); }).join(''); }).join('') + '</ul></section>';
        }).join('') + '</div></nav></div>';
    }

    function noticeHtml() {
      return ui.notice ? '<div class="pb-notice" role="status"><span>' + esc(ui.notice.text) + '</span> ' + (ui.notice.undo ? '<button class="pb-link" data-action="undo">Undo</button> ' : '') + '<button class="pb-link" data-action="dismiss">Dismiss</button></div>' : '';
    }
    /** One question at a time, with how to move on. */
    function questionBody(st) {
      var q = session.visible().filter(function (v) { return v.id === st.qid; })[0];
      var pending = q && q.answered && childrenOf(st.qid).some(function (c) { return !c.answered; });
      var hint = ui.hint ? '<p class="pb-hint-follow" role="status">' + esc(ui.hint) + '</p>' : (pending ? '<p class="pb-hint-follow">Answer the follow-up questions, or press Enter to skip them.</p>' : '');
      return noticeHtml() + questionCard(q, 'Question ' + st.pos + ' of ' + st.count, false) + hint;
    }
    /** Reviewing an area: every question of it together, answers editable in place. */
    function reviewBody(st) {
      var tops = sectionTops(st.section);
      return noticeHtml() + '<p class="pb-review-lead">Every question in this area. Change any answer here.</p>' +
        tops.map(function (q, i) { return questionCard(q, 'Question ' + (i + 1) + ' of ' + tops.length, false); }).join('') +
        '<p class="pb-review-foot"><button class="pb-btn" data-action="close">Done</button></p>';
    }
    /** After the last open question: the winner alone in the middle (it flies up from the dock). */
    function endBody() {
      var prog = session.progress();
      var res = session.result();
      if (lockedNow()) {
        var open = session.openQuestions();
        return '<div class="pb-done"><span class="pb-done-check is-open" aria-hidden="true">' + icon('lock') + '</span><h3 tabindex="-1">' + open.length + ' question' + (open.length === 1 ? ' is' : 's are') + ' still open</h3>' +
          '<p>The recommendation opens once every question has an answer.</p>' +
          '<ul class="pb-open pb-open-center">' + open.slice(0, 4).map(function (q) { return '<li><button class="pb-link" data-action="jump" data-qid="' + q.id + '">' + esc(q.text) + '</button></li>'; }).join('') + (open.length > 4 ? '<li class="pb-fine">and ' + (open.length - 4) + ' more</li>' : '') + '</ul>' +
          '<p class="pb-done-actions"><button class="pb-btn" data-action="jump" data-qid="' + open[0].id + '">Go to the first open question</button></p></div>';
      }
      if (res.informative) {
        var lead = res.coLeaders.length ? res.coLeaders : [res.ranking[0].tool];
        var tie = lead.length > 1;
        var nm = L.listJoin(L.sortNames(lead.map(function (t) { return t.name; })));
        return '<div class="pb-winner"><p class="pb-winner-sub">All areas are complete · ' + prog.answered + ' of ' + prog.visible + ' questions answered</p>' +
          '<p class="pb-winner-kicker">' + (tie ? 'Too close to call' : res.state === 'complete' ? 'Best fit' : 'Best fit so far') + '</p>' +
          '<div class="pb-winner-logos">' + lead.map(function (t) { return '<span class="pb-winner-logo" data-tool="' + t.id + '">' + logoHtml(t.id, tie ? 'pb-logo-xl pb-logo-xl-tie' : 'pb-logo-xl') + '</span>'; }).join('') + '</div>' +
          '<h3 tabindex="-1">' + esc(nm) + '</h3><p class="pb-winner-line">' + esc(L.leadSentence(res, names)) + '</p>' +
          '<p class="pb-done-actions"><button class="pb-btn" data-action="finish">See the recommendation</button></p>' +
          '<p class="pb-keys"><kbd>Enter</kbd> to continue</p></div>';
      }
      return '<div class="pb-done"><span class="pb-done-check" aria-hidden="true">' + icon('check') + '</span><h3 tabindex="-1">All areas are complete</h3>' +
        '<p>' + prog.answered + ' of ' + prog.visible + ' questions answered.</p>' +
        '<p class="pb-done-actions"><button class="pb-btn" data-action="finish">See the recommendation</button></p>' +
        '<p class="pb-keys"><kbd>Enter</kbd> to continue</p></div>';
    }

    function overlayHtml() {
      var st = ui.step = currentStep();
      var sec = sectionById(st.section), run = st.kind === 'q', end = st.kind === 'end';
      var pct = run ? Math.round(st.pos / st.count * 100) : 100;
      var kicker = end ? 'Finished' : (st.kind === 'review' ? 'Review · ' : '') + 'Area ' + sec.id + ' of ' + SECTIONS.length;
      var title = end ? 'Client discovery' : sec.title;
      var body = run ? questionBody(st) : end ? endBody() : reviewBody(st);
      return '<div class="pb-ovl-backdrop' + (ui.opening ? ' is-opening' : '') + '" data-action="close"></div>' +
        '<div class="pb-ovl' + (ui.opening ? ' is-opening' : '') + '" role="dialog" aria-modal="true" aria-labelledby="pb-ovl-title">' +
        '<header class="pb-ovl-head"><button class="pb-ovl-burger" data-action="menu" aria-label="Show all areas and questions" aria-expanded="' + (ui.menu ? 'true' : 'false') + '" aria-controls="pb-menu">' + icon('menu') + '</button><div class="pb-ovl-titlebox"><span class="pb-ovl-kicker">' + esc(kicker) + '</span><h2 id="pb-ovl-title">' + esc(title) + '</h2></div>' +
        '<button class="pb-ovl-close" data-action="close" aria-label="Close and go back to client discovery">' + icon('close') + '</button></header>' +
        '<div class="pb-ovl-progress' + (run ? '' : ' is-complete') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="Progress in this area"><span class="pb-prog-base" style="width:' + pct + '%"></span></div>' +
        '<button class="pb-arrow pb-arrow-prev" data-action="prev" aria-label="Previous question"' + (!run || st.pos === 1 ? ' disabled' : '') + '>' + icon('left') + '</button>' +
        '<div class="pb-ovl-stage"><div class="pb-card-q' + (run ? '' : ' is-done') + (st.kind === 'review' ? ' is-review' : '') + (ui.animate ? ' is-in' : '') + '" tabindex="-1">' + body + '</div></div>' +
        '<button class="pb-arrow pb-arrow-next" data-action="next" aria-label="Next question"' + (!run ? ' disabled' : '') + '>' + icon('right') + '</button>' +
        (run ? '<p class="pb-keys pb-keys-bar"><kbd>Enter</kbd> next question <span aria-hidden="true">·</span> <kbd>←</kbd> <kbd>→</kbd> move between questions</p>' : '') +
        (ui.menu ? menuHtml(st) : '') + popupHtml() + '</div>' +
        '<footer class="pb-ovl-foot">' + top3Html() + '</footer>';       // outside the container, so it can be pinned to the screen
    }

    // ------------------------------------------------------------------ SHORTLIST
    function shortlistRows(r) { return r.shortlist.slice(); }

    /** One reason or watch-out: the answer given, the fit word for that answer, the question it answered, and the experts' note. */
    function reasonHtml(row) {
      var tier = L.fitTier(row.absoluteFit);
      return '<li class="pb-reason"><div class="pb-reason-top"><strong class="pb-ans">' + esc(row.answer.map(function (a) { return a.label; }).join(', ')) + '</strong> ' + pill('tier-' + tier.key, tier.label) + '</div>' +
        '<div class="pb-reason-q">' + esc(row.text) + '</div>' +
        (row.why.length ? '<p class="pb-why">' + esc(row.why.join(' ')) + '</p>' : '') + '</li>';
    }

    function toolCard(r, row, best) {
      var id = row.tool.id;
      var ex = session.explain(id, 3);
      var bar = L.barGeometry(row.z);
      var below = r.adjustedByDominance.filter(function (a) { return a.tool === id; })[0];
      var rankLabel = row.tied ? '=' + row.rank : String(row.rank);
      var side = bar.side === 'right' ? 'above' : bar.side === 'left' ? 'below' : 'at';
      return '<article class="pb-card pb-tool' + (best ? ' is-best' : '') + '" data-tool="' + id + '"><header><span class="pb-rank" aria-label="Rank ' + rankLabel + '">' + rankLabel + '</span><span class="pb-card-logo">' + logoHtml(id) + '</span><h3>' + esc(row.tool.name) + '</h3>' +
        (best ? '<span class="pb-bestflag">Best fit</span>' : '') + '</header>' +
        '<div class="pb-fit"><div class="pb-fitbar" role="img" aria-label="Fit for this client: ' + side + ' average"><span class="pb-fitmid"></span>' +
        (bar.side !== 'none' ? '<span class="pb-fitfill ' + bar.side + '" style="width:' + bar.pct + '%"></span>' : '') + '</div>' +
        '<p class="pb-fitcap"><span>Weaker</span><span>Average</span><span>Stronger</span></p></div>' +
        '<h4>Why it fits</h4>' + (ex.strengths.length ? '<ul class="pb-reasons">' + ex.strengths.map(reasonHtml).join('') + '</ul>' : '<p class="pb-fine">No answer favours this tool yet.</p>') +
        '<h4>Watch-outs</h4>' + (ex.concerns.length ? '<ul class="pb-reasons">' + ex.concerns.map(reasonHtml).join('') + '</ul>' : '<p class="pb-fine">No answer holds this tool back yet.</p>') +
        (below ? '<p class="pb-ranknote">Ranked below ' + esc(listTools(below.rankedBelow)) + ' because ' + (below.rankedBelow.length > 1 ? 'each fits' : esc(names[below.rankedBelow[0]]) + ' fits') + ' at least as well on every answer you gave.</p>' : '') +
        (DOCS[id] ? '<p class="pb-doclink"><a href="' + DOCS[id] + '" target="_blank" rel="noopener">Official documentation' + icon('external') + '</a></p>' : '') +
        '</article>';
    }

    /** Shown in place of the whole Recommendation page until every question has an answer. */
    function lockedHtml() {
      var prog = session.progress(), open = session.openQuestions();
      return '<div class="pb-block" id="sec-locked" data-sec="locked"><section class="pb-sec"><h2>Recommendation</h2>' +
        '<p class="pb-lead">The recommendation opens once every question has an answer, so it rests on the whole picture. “To be confirmed” counts as an answer.</p>' +
        '<div class="pb-card pb-locked"><span class="pb-lock-ico" aria-hidden="true">' + icon('lock') + '</span><div><p class="pb-locked-n"><strong>' + prog.answered + ' of ' + prog.visible + '</strong> questions answered. ' + open.length + ' to go.</p>' +
        (open.length ? '<ul class="pb-open">' + open.slice(0, 6).map(function (q) { return '<li><button class="pb-link" data-action="goq" data-qid="' + q.id + '">' + esc(q.text) + '</button></li>'; }).join('') + (open.length > 6 ? '<li class="pb-fine">and ' + (open.length - 6) + ' more</li>' : '') + '</ul>' : '') +
        '<p><button class="pb-btn" data-action="openq">Continue the questions</button></p></div></div></section></div>';
    }

    function renderShortlist() {
      var r = session.result();
      var prog = session.progress();
      var head = '<section class="pb-sec"><h2>Best fit</h2><p class="pb-lead">How the six tools compare for this client. The best fit is shown in full; pick any other tool to see its reasons.</p>';
      if (!r.informative) {
        var open = session.openQuestions().slice(0, 4);
        return head + '<div class="pb-card"><p><strong>Answer a few questions to see how the tools compare.</strong> Start with the ones that matter most:</p>' + openList(open) + '<p><button class="pb-btn" data-action="openq">Go to the questions</button></p></div></section>';
      }
      var tag = '<span class="pb-state pb-state-' + r.state + '">' + esc(L.STATE_LABEL[r.state]) + '</span>';
      var scale = { tooClose: 0, narrow: 1, clear: 2 }[r.leadStrength];
      var steps = ['Too close to call', 'Narrow lead', 'Clear lead'].map(function (t, i) { return '<li' + (i === scale ? ' class="on" aria-current="true"' : '') + '>' + t + '</li>'; }).join('');
      var rows = r.ranking;                                   // every tool that is not ruled out, in rank order (ties alphabetical)
      var best = rows[0];
      var sel = rows.filter(function (x) { return x.tool.id === ui.shortSel; })[0] || best;
      var boundary = L.boundaryMessage(r);
      var out = head + '<div class="pb-verdict"><div class="pb-statusline">' + tag + ' <span>' + esc(L.stateLine(r.state, prog.answered, prog.visible)) + '</span></div>' +
        '<div aria-live="polite" class="pb-live"><p class="pb-leadsentence">' + esc(L.leadSentence(r, names)) + '</p>' + (boundary ? '<p class="pb-boundary">' + esc(boundary) + '</p>' : '') + '</div>' +
        '<ol class="pb-scale" aria-label="Lead strength">' + steps + '</ol></div>' +
        (r.usesDraftQuestions.length ? '<p class="pb-fine">This result uses questions marked Draft (' + esc(r.usesDraftQuestions.join(', ')) + '). Their scores are awaiting review.</p>' : '') +
        '<div class="pb-short"><div class="pb-short-main">' + (sel !== best ? '<p class="pb-short-back">Showing ' + esc(sel.tool.name) + '. <button class="pb-link" data-action="short" data-tool="' + best.tool.id + '">Back to the best fit</button></p>' : '') + toolCard(r, sel, sel === best) + '</div>' +
        '<ol class="pb-side" aria-label="The other tools">' + rows.filter(function (x) { return x !== sel; }).map(function (x) {
          var rl = x.tied ? '=' + x.rank : String(x.rank);
          return '<li><button class="pb-side-logo" data-action="short" data-tool="' + x.tool.id + '" aria-label="' + (x === best ? 'Best fit' : 'Rank ' + rl) + ': ' + esc(x.tool.name) + '. Show its reasons.">' + logoHtml(x.tool.id) + '<span class="pb-tip" role="tooltip">' + esc(x.tool.name) + ' · ' + (x === best ? 'best fit' : 'rank ' + rl) + '</span></button></li>';
        }).join('') + '</ol></div>' +
        '<p class="pb-fine">The word beside each answer says how well that tool fits that answer on its own. Watch-outs are the answers that pull a tool down, even where it still fits reasonably well.</p>';
      if (r.excluded.length) {
        out += '<h3>Ruled out by your answers</h3>' + r.excluded.map(function (e) {
          var dep = deploymentFacts(e.tool.id);
          return '<div class="pb-card pb-out"><h4>' + esc(e.tool.name) + '</h4>' + (dep ? '<p>' + esc(dep) + '</p>' : '') + e.because.map(function (b) {
            return '<p>You answered “' + esc(b.optionLabel) + '” to “' + esc(b.questionText) + '”.' + (b.rationale ? '<br><span class="pb-why">' + esc(b.rationale) + '</span>' : '') + '</p>';
          }).join('') + '</div>';
        }).join('');
      }
      out += '<p class="pb-actions"><button class="pb-btn" data-action="subtab" data-sub="final">Write the summary</button> <button class="pb-btn pb-btn-ghost" data-action="openq">Change answers</button> <button class="pb-btn pb-btn-ghost" data-action="reset">Start over</button></p></section>';
      return out;
    }
    /** Deployment facts for a tool from the deck's slide 22 (with the vendor-sourced corrections), used to explain an exclusion. */
    function deploymentFacts(id) {
      var rows = {};
      D.reference.deployment.forEach(function (r) { rows[r.consideration] = r.cells[id]; });
      var fix = function (k) { return DEPLOY_FIX[k] && DEPLOY_FIX[k][id] ? DEPLOY_FIX[k][id].text : rows[k]; };
      var prim = fix('Primary deployment'), onprem = fix('On-premises option');
      if (!prim || !onprem) return '';
      return names[id] + ' deployment: ' + prim.replace(/\.$/, '') + '. On-premises option: ' + onprem.replace(/\.$/, '') + '.';
    }
    function openList(open) {
      if (!open.length) return '';
      return '<p class="pb-fine">Matters most, still open:</p><ul class="pb-open">' + open.map(function (q) {
        return '<li><button class="pb-link" data-action="goq" data-qid="' + q.id + '">' + esc(q.text) + '</button></li>';
      }).join('') + '</ul>';
    }

    // ------------------------------------------------------------------ MIGRATION
    function renderMigration() {
      var M = D.migration;
      var r = session.result();
      var q13 = session.answers.Q13 || [];
      var head = '<section class="pb-sec"><h2>Migration analysis</h2>';
      if (!q13.length) return head + '<div class="pb-card"><p>Answer “Does the client have an active reporting suite?” in client discovery to see whether migration applies.</p><p><button class="pb-btn" data-action="goq" data-qid="Q13">Go to the question</button></p></div></section>';
      if (q13.indexOf('no') !== -1) return head + '<div class="pb-card"><p><strong>No existing reporting to migrate.</strong> The discovery result stands.</p></div></section>';
      var shortlist = r.informative ? r.shortlist.map(function (x) { return x.tool.id; }) : [];
      var inUse = (session.answers.Q14 || []).filter(function (id) { var o = qOf('Q14') && qOf('Q14').omap[id]; return o && !o.unknown; });
      var out = head + '<p class="pb-lead">How hard is the move from the tools the client uses today to each shortlisted tool? Effort is rated Low, Medium or High across six dimensions, so you can scope the work, not only pick the destination.</p>' +
        '<p class="pb-note">Migration is already part of the ranking through the question about tools in use. This section explains that and adds detail; it is never counted twice.</p>';
      if (!inUse.length) out += '<div class="pb-card"><p>Answer “Which BI tools and licences are currently in use?” to see feasibility from your current tools.</p><p><button class="pb-btn" data-action="goq" data-qid="Q14">Go to the question</button></p></div>';
      if (!shortlist.length) out += '<div class="pb-card"><p>The shortlist appears once enough questions are answered. Effort detail for each shortlisted tool will show here.</p></div>';
      if (inUse.length && shortlist.length) {
        out += '<h3>From your answers</h3><p>Tools currently in use: ' + esc(L.listJoin(L.sortNames(inUse.map(function (id) { return qOf('Q14').omap[id].label; })))) + '.</p>';
        out += '<div class="pb-tools">' + shortlist.map(function (to) {
          var items = inUse.map(function (from) {
            if (from === to) return '<li><strong>From ' + esc(names[from]) + '</strong> ' + pill('r-retain', 'Retain') + ' You already use it: nothing to migrate.</li>';
            var cell = from === 'excel_other' ? M.grid.excel[to] : (M.feasibility[from] && M.feasibility[from][to]);
            var fromName = from === 'excel_other' ? 'Excel' : names[from];
            if (!cell) return '<li><strong>From ' + esc(fromName) + '</strong> No rating yet.</li>';
            var reasons = cell.reasons || cell.notes || [];
            return '<li><strong>From ' + esc(fromName) + '</strong> ' + pill('r-' + cell.rating.toLowerCase(), cell.rating) + (reasons.length ? '<ul>' + reasons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</li>';
          }).join('');
          return '<article class="pb-card"><h4>Moving to ' + esc(names[to]) + '</h4><ul class="pb-feas">' + items + '</ul></article>';
        }).join('') + '</div>';
      }
      if (shortlist.length) {
        out += '<h3>Effort by dimension</h3>' + effortTable(shortlist) + '<h3>Typical challenges</h3><div class="pb-grid2">' + shortlist.map(function (id) { return '<div class="pb-card"><h4>' + esc(names[id]) + '</h4><p>' + esc(M.challenges[id]) + '</p></div>'; }).join('') + '</div>';
      }
      out += '<details class="pb-details"><summary>Full feasibility grid</summary>' + gridTable() + '</details>' + '</section>';
      return out;
    }
    function effortTable(ids) {
      var M = D.migration;
      var ordered = ids.slice();
      return '<div class="pb-tablewrap"><table class="pb-table"><caption class="pb-sr">Migration effort by dimension</caption><thead><tr><th scope="col">Dimension</th>' + ordered.map(function (id) { return '<th scope="col">' + esc(names[id]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        M.dimensions.map(function (d) {
          return '<tr><th scope="row">' + esc(d.name) + (d.note ? '<br><small>' + esc(d.note) + '</small>' : '') + '</th>' + ordered.map(function (id) { var v = M.effort[id][d.name]; return '<td>' + pill('e-' + v.toLowerCase(), v + ' effort') + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
    }
    function gridTable() {
      var M = D.migration;
      var cols = L.sortNames(toolIds.map(function (i) { return names[i]; }));
      var idOf = {}; toolIds.forEach(function (i) { idOf[names[i]] = i; });
      var rowsIds = toolIds.slice().concat(['excel']);
      return '<div class="pb-tablewrap"><table class="pb-table"><caption class="pb-sr">Tool-to-tool migration feasibility</caption><thead><tr><th scope="col">From ↓ To →</th>' + cols.map(function (c) { return '<th scope="col">' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rowsIds.map(function (from) {
          return '<tr><th scope="row">' + esc(from === 'excel' ? 'Excel' : names[from]) + '</th>' + cols.map(function (c) {
            var cell = M.grid[from][idOf[c]];
            return '<td>' + (cell ? pill('r-' + cell.rating.toLowerCase(), cell.rating) : '<span class="pb-fine">same tool</span>') + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
    }

    // ------------------------------------------------------------------ TOOL DETAILS
    function relevantCriterion(name) {
      var entry = CRITERION_QS.filter(function (e) { return name.indexOf(e[0]) === 0; })[0];
      if (!entry) return false;
      return entry[1].some(function (ref) {
        var parts = ref.split(':'), qid = parts[0], only = parts[1];       // 'Q06:ai_governance_concerns' = that answer only
        var q = qOf(qid); var a = session.answers[qid] || [];
        return q && a.some(function (id) { return q.omap[id] && !q.omap[id].unknown && (!only || id === only); });
      });
    }

    /** One tool in the dictionary: a single sentence on what it is best suited for, and a link to its official documentation. */
    function dictEntry(id) {
      var p = profileOf[id];
      var rest = p.bestSuited.replace(/^.*? is best suited for /i, '').replace(/\.$/, '');
      return '<article class="pb-dict" id="dict-' + id + '"><header class="pb-dict-head">' + logoHtml(id, 'pb-logo-lg') + '<h3>' + esc(names[id]) + '</h3></header>' +
        '<p class="pb-dict-main">' + esc(names[id]) + ' is best suited for ' + esc(rest) + '.</p>' +
        '<p class="pb-dict-link"><a class="pb-btn pb-btn-ghost" href="' + DOCS[id] + '" target="_blank" rel="noopener">Read the official documentation' + icon('external') + '</a></p></article>';
    }

    /** The tool dictionary: one container with a tab for each tool; the tool chosen is shown in full. */
    function renderDictionary() {
      var cur = ui.dtool && toolIds.indexOf(ui.dtool) !== -1 ? ui.dtool : toolIds[0];
      ui.dtool = cur;
      return '<section class="pb-sec"><h2>Tools dictionary</h2>' +
        '<p class="pb-lead">Before we compare the tools, we get to know them. Choose a tool for a one-line summary and a link to its own documentation.</p>' +
        '<div class="pb-dbox"><div class="pb-dtabs" role="tablist" aria-label="Tools">' + toolIds.map(function (id) {
          var on = id === cur;
          return '<button type="button" class="pb-dtab' + (on ? ' on' : '') + '" role="tab" id="dtab-' + id + '" aria-selected="' + on + '" aria-controls="dpanel" tabindex="' + (on ? '0' : '-1') + '" data-action="dtab" data-tool="' + id + '">' + logoHtml(id, 'pb-logo-xs') + '<span>' + esc(names[id]) + '</span></button>';
        }).join('') + '</div><div class="pb-dpanel" id="dpanel" role="tabpanel" aria-labelledby="dtab-' + cur + '">' + dictEntry(cur) + '</div></div></section>';
    }

    /** True while the recommendation must stay closed: until every question that is asked now has an answer. */
    function lockedNow() { var p = session.progress(); return config.lockUntilComplete !== false && (p.visible === 0 || p.remaining > 0); }

    function colHead(id, cls) { return '<th scope="col"' + (cls ? ' class="' + cls + '"' : '') + '><span class="pb-colhead">' + logoHtml(id, 'pb-logo-xs') + '<span>' + esc(names[id]) + '</span></span></th>'; }
    function relPill(name) { return relevantCriterion(name) ? '<br>' + pill('rel', 'Relevant to your answers') : ''; }

    /** The tools the matrix shows: the ones chosen (at least two), always in alphabetical order. */
    function shownTools() {
      var sel = (ui.mtools || []).filter(function (id) { return toolIds.indexOf(id) !== -1; });
      if (sel.length < 2) return toolIds.slice();
      return toolIds.filter(function (id) { return sel.indexOf(id) !== -1; });
    }
    function toolPicker(cols) {
      var two = cols.length === 2;
      return '<div class="pb-picker" role="group" aria-label="Tools shown in the matrix"><span class="pb-picker-l">Tools shown</span>' + toolIds.map(function (id) {
        var on = cols.indexOf(id) !== -1, keep = on && cols.length <= 2;
        return '<button type="button" class="pb-chip' + (on ? ' on' : '') + '" data-action="mtool" data-tool="' + id + '" aria-pressed="' + on + '"' + (keep ? ' aria-disabled="true" title="Keep at least two tools to compare"' : '') + '>' + logoHtml(id, 'pb-logo-xs') + '<span>' + esc(names[id]) + '</span></button>';
      }).join('') + (cols.length < toolIds.length ? '<button type="button" class="pb-link" data-action="mall-tools">Show all ' + toolIds.length + '</button>' : '') + '</div>';
    }

    /**
     * The comparison matrix: the deck's 14 criteria in their groups, for the tools chosen. A closed group is one row with a short line for
     * each tool; opening it shows its criteria as children. A tinted cell leads: in a group row, the tool with the most leading criteria
     * among those shown; in a criterion row, a tool the deck marks as leading. This is the old 1 v 1 view too: pick two tools.
     */
    function renderMatrix() {
      var cols = shownTools(), groups = D.matrix.groups, detail = cols.length <= 3;
      var allOpen = groups.every(function (g, i) { return ui.matrixOpen[i]; });
      var body = groups.map(function (g, i) {
        var open = !!ui.matrixOpen[i];
        var rel = g.criteria.filter(function (c) { return relevantCriterion(c.name); }).length;
        var leads = {}, best = 0;
        cols.forEach(function (id) { leads[id] = g.criteria.filter(function (c) { return c.cells[id].leads; }).length; if (leads[id] > best) best = leads[id]; });
        var winners = best ? cols.filter(function (id) { return leads[id] === best; }) : [];
        var sums = GROUP_SUMMARY[g.name] || {};
        var head = '<tr class="pb-grouprow' + (open ? ' is-open' : '') + '"><th scope="row"><button class="pb-groupbtn" data-action="mgroup" data-group="' + i + '" aria-expanded="' + open + '">' +
          '<span class="pb-groupico" aria-hidden="true">' + icon(open ? 'up' : 'down') + '</span><span class="pb-groupt"><span class="pb-groupname">' + esc(g.name) + '</span>' +
          '<span class="pb-groupmeta">' + g.criteria.length + ' criteria' + (rel ? ' · ' + rel + ' relevant to your answers' : '') + '</span></span></button></th>' +
          cols.map(function (id) {
            var win = winners.indexOf(id) !== -1;
            return '<td class="pb-groupcell' + (win ? ' is-win' : '') + '">' + (win ? '<span class="pb-sr">Leads this group. </span>' : '') + esc(sums[id] || leads[id] + ' of ' + g.criteria.length + ' criteria led') + '</td>';
          }).join('') + '</tr>';
        return head + (open ? g.criteria.map(function (c, k) {
          return '<tr class="pb-childrow' + (k === g.criteria.length - 1 ? ' is-last' : '') + '"><th scope="row"><span class="pb-childname">' + esc(c.name) + '</span>' + relPill(c.name) + '</th>' + cols.map(function (id) {
            var x = c.cells[id], mf = MATRIX_FIX[id] && MATRIX_FIX[id][c.name];
            if (mf && x.detail === mf.from) x = { headline: x.headline, detail: mf.to, leads: x.leads };
            return '<td class="' + (x.leads ? 'is-lead' : '') + '">' + (x.leads ? '<span class="pb-sr">Leads. </span>' : '') + '<strong>' + esc(x.headline) + '</strong>' + (detail && x.detail ? '<span class="pb-cell-d">' + esc(x.detail) + '</span>' : '') + '</td>';
          }).join('') + '</tr>';
        }).join('') : '');
      }).join('');
      return '<section class="pb-sec"><h2>Comparison matrix</h2><p class="pb-lead">Now we put the tools side by side. Each row sums up a group of criteria; open a row to see the criteria inside it. To compare tools head to head, choose which to show.</p>' +
        toolPicker(cols) +
        '<p class="pb-matrix-tools"><span class="pb-legend"><span class="pb-swatch" aria-hidden="true"></span>Leads</span> <button class="pb-link" data-action="mall" data-open="' + (allOpen ? '0' : '1') + '">' + (allOpen ? 'Collapse all groups' : 'Expand all groups') + '</button></p>' +
        '<div class="pb-tablewrap"><table class="pb-table pb-matrix"><caption class="pb-sr">Tool matrix across 14 criteria, ' + cols.length + ' tools shown</caption><thead><tr><th scope="col">Group and criterion</th>' + cols.map(function (id) { return colHead(id); }).join('') + '</tr></thead><tbody>' + body + '</tbody></table></div></section>';
    }

    // ------------------------------------------------------------------ FINAL RECOMMENDATION
    function summaryContext() {
      var r = session.result();
      var prog = session.progress();
      var leadTools = r.informative ? (r.coLeaders.length > 1 ? r.coLeaders : [r.shortlist[0].tool]) : [];
      var winners = leadTools.map(function (t) { return { id: t.id, name: t.name, docUrl: DOCS[t.id] || '' }; });
      var reasons = leadTools.map(function (t) {
        var ex = session.explain(t.id, 3);
        var map = function (x) { return { answer: x.answer.map(function (a) { return a.label; }).join(', '), question: x.text, why: x.why.join(' ') }; };
        return { tool: t.name, strengths: ex.strengths.map(map), concerns: ex.concerns.map(map) };
      });
      var constraints = CONSTRAINT_QS.filter(function (id) { return (session.answers[id] || []).some(function (o) { var q = qOf(id); return q && q.omap[o] && !q.omap[o].unknown; }); })
        .map(function (id) { return qOf(id).text + ' ' + answerText(id); });
      var migration = [];
      var q13 = session.answers.Q13 || [];
      if (r.informative && q13.length && q13.indexOf('no') === -1) {
        leadTools.forEach(function (lead) {                // every leader: when the answers do not separate tools, each one gets its own lines
          var to = lead.id;
          (session.answers.Q14 || []).forEach(function (from) {
            var o = qOf('Q14') && qOf('Q14').omap[from]; if (!o || o.unknown || from === to) return;
            var cell = from === 'excel_other' ? D.migration.grid.excel[to] : D.migration.feasibility[from][to];
            if (cell) migration.push('From ' + (from === 'excel_other' ? 'Excel' : names[from]) + ' to ' + names[to] + ': ' + cell.rating + '.' + ((cell.reasons || cell.notes || []).length ? ' ' + (cell.reasons || cell.notes).join('; ') + '.' : ''));
          });
        });
      }
      var steps = [];
      var second = r.informative && r.ranking[1] ? r.ranking[1].tool.name : '';
      if (winners.length > 1) steps.push('The answers do not separate ' + L.listJoin(L.sortNames(winners.map(function (w) { return w.name; }))) + '. Compare them on a real use case before you choose.');
      else if (r.informative && r.leadStrength === 'narrow' && second) steps.push('The lead over ' + second + ' is narrow. Compare the two on a real use case before you commit.');
      if (reasons.some(function (rs) { return rs.concerns.length; })) steps.push('Go through the watch-outs with the client and confirm they can live with them.');
      if (migration.length) steps.push('List the reports and data sources to be moved before you scope the migration.');
      if (r.informative) steps.push('Run a proof of concept on the riskiest assumption.', 'Check current pricing and licensing with the vendor before you quote.');
      if (r.informative && r.state === 'provisional') steps.unshift('Answer the remaining questions: the order may still change.');
      var secTitle = {}; SECTIONS.forEach(function (x) { secTitle[x.id] = x.title; });
      var answers = session.visible().filter(function (q) { return q.answered; }).map(function (q) { return { section: secTitle[sectionOf(q)], question: q.text, answer: answerText(q.id), note: store.notes[q.id] || '' }; });
      var winIds = winners.map(function (w) { return w.id; });
      return {
        date: today(), clientName: ui.clientName, state: r.state, answered: prog.answered, visible: prog.visible, informative: r.informative,
        winners: winners, leadSentence: r.informative ? L.leadSentence(r, names) : '', leadStrength: r.leadStrength, boundaryMessage: L.boundaryMessage(r),
        others: r.informative ? r.ranking.filter(function (x) { return winIds.indexOf(x.tool.id) === -1; }).map(function (x) { return { name: x.tool.name, rank: x.rank, tied: !!x.tied }; }) : [],
        excluded: r.excluded.map(function (e) { return { name: e.tool.name, because: '“' + e.because[0].questionText + '” was answered “' + e.because[0].optionLabel + '”.' }; }),
        reasons: reasons, constraints: constraints, migration: migration, nextSteps: steps, usesDraft: r.usesDraftQuestions, answers: answers
      };
    }

    /** The final recommendation as a page: the headline, why, watch-outs, the other tools, what to do next and the answers behind it. */
    function finalHtml(c) {
      var list = function (items) { return '<ul class="pb-rep-list">' + items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'; };
      var reasonLi = function (x) { return '<strong>' + esc(x.answer) + '</strong><span class="pb-rep-q">' + esc(x.question) + '</span>' + (x.why ? '<span class="pb-rep-why">' + esc(x.why) + '</span>' : ''); };
      var status = c.state === 'complete' ? 'Complete: all ' + c.visible + ' questions answered' : (L.STATE_LABEL[c.state] || c.state) + ': ' + c.answered + ' of ' + c.visible + ' questions answered';
      var out = '<header class="pb-rep-head"><p class="pb-rep-kicker">Internal use only · ' + esc(c.date) + ' · ' + esc(status) + '</p>' +
        '<h3 class="pb-rep-title" id="pb-rep-title">BI tool recommendation' + (c.clientName ? ' for ' + esc(c.clientName) : '') + '</h3></header>';
      if (!c.informative) return out + '<p>No scored answers yet, so there is nothing to recommend.</p>';
      var tie = c.winners.length > 1;
      var nm = L.listJoin(L.sortNames(c.winners.map(function (w) { return w.name; })));
      out += '<div class="pb-rep-hero"><span class="pb-rep-logos">' + c.winners.map(function (w) { return logoHtml(w.id, 'pb-logo-lg'); }).join('') + '</span><div>' +
        '<p class="pb-rep-kicker">' + (tie ? 'Too close to call' : c.state === 'provisional' ? 'Best fit so far' : 'Best fit') + '</p><h3>' + esc(nm) + '</h3><p class="pb-rep-lead">' + esc(c.leadSentence) + '</p>' +
        (c.boundaryMessage ? '<p class="pb-rep-fine">' + esc(c.boundaryMessage) + '</p>' : '') + '</div></div>';
      c.reasons.forEach(function (rs) {
        out += '<section class="pb-rep-sec"><h4>Why ' + esc(rs.tool) + ' fits</h4>' + (rs.strengths.length ? list(rs.strengths.map(reasonLi)) : '<p class="pb-fine">No answer favours it yet.</p>') + '</section>' +
          '<section class="pb-rep-sec"><h4>Watch-outs for ' + esc(rs.tool) + '</h4>' + (rs.concerns.length ? list(rs.concerns.map(reasonLi)) : '<p class="pb-fine">None flagged by the answers given.</p>') + '</section>';
      });
      if (c.others.length || c.excluded.length) {
        out += '<section class="pb-rep-sec"><h4>The other tools</h4>' + list(c.others.map(function (t) { return '<strong>Rank ' + (t.tied ? '=' : '') + t.rank + '</strong> ' + esc(t.name); })
          .concat(c.excluded.map(function (e) { return '<strong>' + esc(e.name) + '</strong> is ruled out: ' + esc(e.because); }))) + '</section>';
      }
      if (c.usesDraft && c.usesDraft.length) out += '<p class="pb-rep-fine">This result uses questions marked as draft (' + esc(c.usesDraft.join(', ')) + '); their scores are awaiting review.</p>';
      if (c.constraints.length) out += '<section class="pb-rep-sec"><h4>What the client told us they need</h4>' + list(c.constraints.map(esc)) + '</section>';
      if (c.migration.length) out += '<section class="pb-rep-sec"><h4>Migration</h4>' + list(c.migration.map(esc)) + '</section>';
      out += '<section class="pb-rep-sec"><h4>Next steps</h4>' + list(c.nextSteps.map(esc).concat(c.winners.filter(function (w) { return w.docUrl; }).map(function (w) {
        return 'Official documentation for ' + esc(w.name) + ': <a href="' + esc(w.docUrl) + '" target="_blank" rel="noopener">' + esc(w.docUrl.replace(/^https:\/\//, '')) + '</a>';
      }))) + '</section>';
      var secs = [];
      c.answers.forEach(function (a) { var last = secs[secs.length - 1]; if (!last || last.title !== a.section) secs.push(last = { title: a.section, rows: [] }); last.rows.push(a); });
      out += '<section class="pb-rep-sec pb-rep-answers"><h4>Answers and notes</h4>' + (secs.length ? secs.map(function (x) {
        return '<h5>' + esc(x.title) + '</h5>' + list(x.rows.map(function (a) { return '<strong>' + esc(a.question) + '</strong> ' + esc(a.answer) + (a.note ? ' <em>(' + esc(a.note) + ')</em>' : ''); }));
      }).join('') : '<p class="pb-fine">None yet.</p>') + '</section>';
      return out;
    }
    function renderFinal() {
      return '<section class="pb-sec"><h2>Final recommendation</h2>' +
        '<p class="pb-lead">The best fit and the reasons for it, written so you can hand it over. Copy it, save it as Markdown, or save it as a PDF.</p>' +
        '<label class="pb-notelabel pb-rep-client">Client name (shown on the document, never saved)<input class="pb-input" data-action="client" value="' + esc(ui.clientName) + '" autocomplete="off"></label>' +
        '<article class="pb-card pb-report" id="pb-summary">' + finalHtml(summaryContext()) + '</article>' +
        '<p class="pb-actions"><button class="pb-btn" data-action="copy">Copy as Markdown</button> <button class="pb-btn pb-btn-ghost" data-action="mdsave">Save as Markdown</button> <button class="pb-btn pb-btn-ghost" data-action="print">Save as PDF</button> ' +
        '<button class="pb-btn pb-btn-ghost" data-action="download">Back up the answers</button> <label class="pb-btn pb-btn-ghost pb-file">Restore answers<input type="file" accept="application/json" data-action="restore"></label></p>' +
        '<p class="pb-fine" id="pb-flash" role="status"></p></section>';
    }

    function scoringHtml() {
      return '<div class="pb-prose">' +
        '<p>Every answer a client can give has been rated for each tool, from 1 (possible but not ideal) to 4 (strong fit). Most of those ratings come from our experts. For the questions about polish, AI, cost, users and talent we took them from our comparison table, and three answers are our own proposals. Those are all still waiting for an expert to confirm them.</p>' +
        '<p>We don’t just add the ratings up. Some tools score well on almost everything, so a plain total would pick the same tool whatever the client said. Instead each tool is measured against how it normally scores, and only the difference this client’s answers make counts. Questions that matter more count for more. A client who tells us nothing gets a tie.</p>' +
        '<p>When two tools finish level, we look at the answers about ecosystem first, then security and governance, then delivery risk and cost. If that doesn’t separate them, we call it a tie. One answer can rule a tool out outright: a client who can’t use a vendor-hosted tool rules out Sigma.</p>' +
        '<p>Treat the order as provisional until most of the questions are answered, and as a starting point for your own judgement, not a verdict. The ratings and weights may change as the experts finish reviewing them.</p></div>';
    }

    // ------------------------------------------------------------------ pages, navigation, rail
    var SUBTABS = {
      recommendation: { key: 'rec', items: [['shortlist', 'Best fit'], ['migration', 'Migration analysis'], ['final', 'Final recommendation']] }
    };
    function subTabsHtml(page) {
      var d = SUBTABS[page];
      return '<div class="pb-subtabs" role="tablist" aria-label="Recommendation sections">' + d.items.map(function (it) {
        var on = ui[d.key] === it[0];
        return '<button class="pb-subtab' + (on ? ' on' : '') + '" role="tab" aria-selected="' + on + '" data-action="subtab" data-sub="' + it[0] + '">' + esc(it[1]) + '</button>';
      }).join('') + '</div>';
    }
    function blockHtml(id) { return '<div class="pb-block" id="sec-' + id + '" data-sec="' + id + '">' + RENDER[id]() + '</div>'; }
    /** The recommendation, below the questions on the same page: closed until every question is answered, then one tab at a time. */
    function recoHtml() { return '<div id="sec-reco">' + (lockedNow() ? lockedHtml() : subTabsHtml('recommendation') + blockHtml(ui.rec)) + '</div>'; }
    var PAGE_BLOCKS = {
      home: function () { return blockHtml('overview') + blockHtml('navigate') + blockHtml('principles') + blockHtml('dictionary') + blockHtml('matrix') + blockHtml('cta'); },
      discovery: function () { return blockHtml('discovery') + recoHtml() + blockHtml('scoring'); }
    };
    /** The disclaimers, once, at the bottom of every page. */
    function noticesHtml() {
      return '<aside class="pb-notices" aria-label="Notices"><p>Internal use only.</p><p>Check before you quote pricing.</p></aside>';
    }
    function pageHtml() { return '<div class="pb-page" data-page="' + ui.page + '">' + PAGE_BLOCKS[ui.page]() + noticesHtml() + '</div>'; }

    function renderRail() { o.rail.innerHTML = ''; }          // progress now lives in the floating mini window
    /** "On this page": built from data, in the order of the story. */
    function tocItems() {
      if (ui.page === 'home') return [['sec-overview', 'Purpose'], ['sec-navigate', 'Contents'], ['sec-principles', 'Do’s and Don’ts'], ['sec-dictionary', 'Tools dictionary'], ['sec-matrix', 'Comparison matrix'], ['sec-cta', 'Still unable to pick?']];
      if (ui.page === 'discovery') return [['disc-about', 'Client discovery'], ['disc-areas', 'Areas we ask about'], ['sec-reco', 'Recommendation'], ['sec-scoring', 'How it is made']];
      return [];
    }
    function renderToc() {
      if (!o.toc) return;
      var items = tocItems();
      o.toc.innerHTML = items.length ? '<h2 class="pb-rail-h">On this page</h2><ul>' + items.map(function (i) {
        return '<li><a href="#' + i[0] + '" data-toc="' + i[0] + '">' + esc(i[1]) + '</a></li>';
      }).join('') + '</ul>' : '';
      if (o.toc.hidden !== undefined) o.toc.hidden = !items.length;
    }

    /** Show a page, or a section of a page: go('shortlist') opens Client discovery at the recommendation, on its Shortlist tab. */
    function go(id, anchor, instant) {
      var page = PAGE_IDS.indexOf(id) !== -1 ? id : (has(SECTION_PAGE, id) ? SECTION_PAGE[id] : null);
      if (!page) return;
      var changed = page !== ui.page;
      if (SUBTABS.recommendation.items.some(function (it) { return it[0] === id; }) && ui.rec !== id) { ui.rec = id; changed = true; }
      ui.page = page;
      var where = has(ANCHOR, id) ? ANCHOR[id] : null;
      if (changed) { render(); if (root.scrollTo && !anchor && !where) { try { root.scrollTo(0, 0); } catch (e) { /* not available */ } } }
      if (o.onTab) o.onTab(page);
      var target = anchor || where || (PAGE_IDS.indexOf(id) === -1 ? 'sec-' + id : null);
      var el = target ? o.container.querySelector('#' + target) : null;
      if (el) { if (el.tagName === 'DETAILS') el.open = true; if (el.scrollIntoView) el.scrollIntoView(instant ? { block: 'start', behavior: 'instant' } : { block: 'start' }); }
    }

    // ------------------------------------------------------------------ the "back to top" button
    var topBtn = null;
    /** Shown once the reader has scrolled a screen or so. Hidden by the stylesheet while the questions are open (html.pb-lock) and lifted above the corner window. */
    function updateTop() {
      if (!topBtn) return;
      var d = doc(), y = root.pageYOffset || (d && d.documentElement && d.documentElement.scrollTop) || 0;
      topBtn.classList.toggle('is-on', y > 500);
    }
    function ensureTopButton() {
      if (topBtn) return topBtn;
      var d = doc();
      if (!(d && d.createElement && d.body)) return null;
      topBtn = d.createElement('button');
      topBtn.type = 'button'; topBtn.className = 'pb-top'; topBtn.setAttribute('aria-label', 'Back to top'); topBtn.innerHTML = icon('top');
      topBtn.addEventListener('click', function () {
        if (root.scrollTo) { try { root.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' }); } catch (e) { root.scrollTo(0, 0); } }
        if (o.container.focus) o.container.focus({ preventScroll: true });          // the button hides itself at the top: keep keyboard focus on the page
      });
      d.body.appendChild(topBtn);
      if (root.addEventListener) root.addEventListener('scroll', updateTop, { passive: true });
      updateTop();
      return topBtn;
    }

    // ------------------------------------------------------------------ the question carousel: open, move, close
    var overlayHost = o.overlay || null;
    var miniHost = o.mini || null;
    function ensureMiniHost() {
      if (miniHost) return miniHost;
      var d = doc();
      if (d && d.createElement && d.body) { miniHost = d.createElement('div'); miniHost.className = 'pb-mini'; miniHost.hidden = true; d.body.appendChild(miniHost); wire(miniHost, false); }
      return miniHost;
    }
    /** The questions, minimised: a small window in the corner that stays until every question is answered, and reopens them where they were left. */
    function renderMini() {
      var host = ensureMiniHost();
      if (!host) return;
      var p = session.progress();
      var show = ui.minimized && !ui.overlay && p.visible > 0 && p.remaining > 0;
      if (!show) { host.hidden = true; host.innerHTML = ''; return; }
      var pct = Math.round(p.answered / p.visible * 100);
      var st = ui.step && ui.step.kind !== 'end' ? sectionById(ui.step.section) : null;
      host.innerHTML = '<button class="pb-mini-card' + (ui.miniFresh ? ' is-in' : '') + '" data-action="resume" aria-label="Resume the questions: ' + p.answered + ' of ' + p.visible + ' answered">' +
        '<span class="pb-mini-ring" style="--p:' + pct + '%" aria-hidden="true"><span>' + p.answered + '</span></span>' +
        '<span class="pb-mini-t"><strong>Client discovery</strong><span>' + p.answered + ' of ' + p.visible + ' answered' + (st ? ' · ' + esc(st.title) : '') + '</span></span>' +
        '<span class="pb-mini-open" aria-hidden="true">' + icon('expand') + '</span><span class="pb-mini-bar" aria-hidden="true"><span style="width:' + pct + '%"></span></span></button>';
      host.hidden = false;
      ui.miniFresh = false;
    }
    /** The container shrinks into the corner window. */
    function minimize() {
      var host = overlayHost, ovl = host && host.querySelector ? host.querySelector('.pb-ovl') : null;
      ui.overlay = false; ui.popup = null; ui.menu = false; ui.notice = null; ui.minimized = true; ui.miniFresh = false;
      renderPage(); renderRail(); renderToc(); renderMini();
      var mini = miniHost && miniHost.querySelector ? miniHost.querySelector('.pb-mini-card') : null;
      if (!(ovl && mini && ovl.animate && ovl.getBoundingClientRect && !reduceMotion())) { renderOverlay(); return; }
      var a = ovl.getBoundingClientRect(), b = mini.getBoundingClientRect();
      var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
      mini.style.opacity = '0';
      var back = host.querySelector('.pb-ovl-backdrop'), foot = host.querySelector('.pb-ovl-foot');
      if (back) back.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, fill: 'forwards' });
      if (foot) foot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
      var anim = ovl.animate([{ transform: 'none', opacity: 1, borderRadius: '28px' }, { opacity: .9, offset: .65 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + b.width / a.width + ',' + b.height / a.height + ')', opacity: 0, borderRadius: '90px' }],
        { duration: 560, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' });
      var done = function () { if (!ui.overlay) { host.hidden = true; host.innerHTML = ''; lockPage(false); } mini.style.opacity = ''; mini.classList.add('is-in'); };
      anim.onfinish = done; anim.oncancel = done;
    }
    /** The container grows out of a rectangle (an area card, or the corner window). */
    function growFrom(from) {
      var ovl = overlayHost && overlayHost.querySelector ? overlayHost.querySelector('.pb-ovl') : null;
      if (!(from && ovl && ovl.animate && ovl.getBoundingClientRect && !reduceMotion())) return;
      var b = ovl.getBoundingClientRect();
      var dx = from.left + from.width / 2 - (b.left + b.width / 2), dy = from.top + from.height / 2 - (b.top + b.height / 2);
      ovl.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + from.width / b.width + ',' + from.height / b.height + ')', opacity: 0, borderRadius: '24px' }, { opacity: 1, offset: .35 }, { transform: 'none', opacity: 1, borderRadius: '28px' }],
        { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    }
    /** Open the questions again where they were left, growing out of the corner window. */
    function resumeDiscovery() {
      var mini = miniHost && miniHost.querySelector ? miniHost.querySelector('.pb-mini-card') : null;
      var from = mini && mini.getBoundingClientRect ? mini.getBoundingClientRect() : null;
      var st = (ui.step && ui.step.kind === 'q' ? qStep(ui.step.qid) : null) || firstOpenStep(nextOpenSection(null) || '1');
      ui.minimized = false; ui.page = 'discovery'; ui.overlay = true; ui.opening = !from; ui.popup = null; ui.menu = false; ui.followShown = {};
      if (o.onTab) o.onTab('discovery');
      renderPage(); renderRail(); renderToc(); renderMini();
      setStep(st);
      growFrom(from);
    }
    function doc() { return o.container.ownerDocument; }
    function ensureOverlayHost() {
      if (overlayHost) return overlayHost;
      var d = doc();
      if (d && d.createElement && d.body) { overlayHost = d.createElement('div'); overlayHost.className = 'pb-overlay'; overlayHost.hidden = true; d.body.appendChild(overlayHost); wire(overlayHost, true); }
      return overlayHost;
    }
    function reduceMotion() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    function lockPage(on) { var d = doc(); var h = d && d.documentElement; if (h && h.classList) h.classList[on ? 'add' : 'remove']('pb-lock'); }

    function renderOverlay() {
      var host = ensureOverlayHost();
      if (!host) return;
      if (!ui.overlay) { host.hidden = true; host.innerHTML = ''; lockPage(false); return; }
      var d = doc(), active = d && d.activeElement, focusId = active && active.id && host.contains && host.contains(active) ? active.id : null;
      var stage = host.querySelector ? host.querySelector('.pb-ovl-stage') : null, scrollTop = stage ? stage.scrollTop : 0;
      var mb = host.querySelector ? host.querySelector('.pb-menu-body') : null, menuTop = mb ? mb.scrollTop : 0;
      host.innerHTML = overlayHtml();
      host.hidden = false;
      lockPage(true);
      var stage2 = host.querySelector ? host.querySelector('.pb-ovl-stage') : null;
      if (ui.animate) {
        var card = host.querySelector('.pb-card-q');
        var h = card && card.querySelector('h3[tabindex]');
        (h || card) && (h || card).focus && (h || card).focus({ preventScroll: true });
      } else {
        if (stage2) stage2.scrollTop = scrollTop;
        if (focusId) { var f = host.querySelector('#' + (root.CSS && root.CSS.escape ? root.CSS.escape(focusId) : focusId)); if (f && f.focus) f.focus({ preventScroll: true }); }
      }
      flyWinner(host);
      var fresh = host.querySelector ? host.querySelector('.pb-follow.is-new') : null;
      if (fresh && fresh.scrollIntoView) fresh.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });   // bring a newly opened follow-up into view
      var mb2 = host.querySelector ? host.querySelector('.pb-menu-body') : null;
      if (mb2) { if (menuTop) mb2.scrollTop = menuTop; else { var here = mb2.querySelector('.is-here'); if (here && here.scrollIntoView) here.scrollIntoView({ block: 'center' }); } }
      ui.animate = false;
      ui.opening = false;
    }

    /** The winner's logo travels from its place in the dock up to the middle of the container, growing as it goes. */
    function flyWinner(host) {
      if (!ui.animate || !ui.step || ui.step.kind !== 'end' || !host.querySelectorAll) return;
      var leave = function (src) { if (src) src.parentNode && (src.parentNode.style.display = 'none'); ui.winnerAway = true; };     // the dock keeps no copy of the winner
      if (reduceMotion()) { Array.prototype.forEach.call(host.querySelectorAll('.pb-winner-logo'), function (el) { leave(host.querySelector('.pb-logo-btn[data-tool="' + el.getAttribute('data-tool') + '"]')); }); return; }
      Array.prototype.forEach.call(host.querySelectorAll('.pb-winner-logo'), function (el) {
        var src = host.querySelector('.pb-logo-btn[data-tool="' + el.getAttribute('data-tool') + '"]');
        if (!src || !el.animate || !el.getBoundingClientRect) return;
        var a = src.getBoundingClientRect(), b = el.getBoundingClientRect();
        if (!b.width) return;
        var dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2), k = a.width / b.width;
        src.style.visibility = 'hidden';
        var anim = el.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + k + ')', opacity: 1 }, { transform: 'translate(' + dx * 0.15 + 'px,' + dy * 0.15 + 'px) scale(' + (1 + k) / 2 * 0.6 + ')', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 1100, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
        var back = function () { leave(src); };
        anim.onfinish = back; anim.oncancel = back;
      });
    }

    function setStep(st) {
      ui.step = st; ui.animate = true; ui.followShown = {}; ui.popup = null; ui.winnerAway = false; ui.hint = ''; ui.leaving = false; ui.busy = false;
      renderOverlay();
    }
    /** Show another question of the same area, with a short fade. */
    function goQuestion(qid) {
      var to = qStep(qid);
      if (!to || ui.leaving) return;
      var host = overlayHost, card = host && host.querySelector ? host.querySelector('.pb-card-q') : null;
      var apply = function () { if (ui.overlay) setStep(to); ui.leaving = false; };
      if (card && root.setTimeout && !reduceMotion()) { ui.leaving = true; card.classList.add('is-leaving'); root.setTimeout(apply, 170); } else apply();
    }
    /** Arrow keys and the arrow buttons: the previous or next question in order. Past the last one it behaves like Enter. */
    function stepBy(dir) {
      var st = ui.step;
      if (!ui.overlay || ui.busy || !st || st.kind !== 'q') return;
      var tops = sectionTops(st.section), i = -1;
      tops.forEach(function (q, k) { if (q.id === st.qid) i = k; });
      var to = tops[i + dir];
      if (to) goQuestion(to.id); else if (dir > 0) advance();
    }
    /**
     * Enter: on to the next open question, wrapping round the area to any that were skipped; when none is open the area is finished.
     * On the winner it opens the recommendation, and on a review it closes it.
     */
    function advance() {
      var st = ui.step;
      if (!ui.overlay || ui.busy || !st) return;
      if (st.kind === 'end') { finish(); return; }
      if (st.kind === 'review') { closeDiscovery(); return; }
      var tops = sectionTops(st.section), i = -1;
      tops.forEach(function (q, k) { if (q.id === st.qid) i = k; });
      var queue = tops.slice(i + 1).concat(tops.slice(0, Math.max(i, 0))).filter(isOpenTop);
      if (queue.length) { goQuestion(queue[0].id); return; }
      var cur = tops[i];
      if (cur && isOpenTop(cur)) {                       // the only open question is this one
        ui.hint = cur.answered ? 'Answer the follow-up questions to finish this area.' : 'This is the last open question in this area. Answer it to finish the area.';
        renderOverlay();
        return;
      }
      completeSection();
    }
    /** The area is done: if another area has open questions the container shrinks into its card and the next card opens; if not, the winner. */
    function completeSection() {
      var sid = ui.step.section, next = nextOpenSection(sid);
      ui.busy = true;                                    // keys do nothing until the next area (or the winner) is open
      if (!next) { setStep({ kind: 'end', section: sid }); return; }
      contractToCard(sid, function (animated) {
        if (animated && root.setTimeout) root.setTimeout(function () { expandSection(next, 'run'); }, 220); else expandSection(next, 'run');
      });
    }
    function cardEl(sid) { return sid && o.container.querySelector ? o.container.querySelector('.pb-area[data-section="' + sid + '"]') : null; }
    /** An area opens: its card grows into the container. A finished area opens as a review of all its questions. */
    function expandSection(sid, mode, qid) {
      var card = cardEl(sid);
      if (card && card.scrollIntoView) { try { card.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (e) { card.scrollIntoView(); } }
      var from = card && card.getBoundingClientRect ? card.getBoundingClientRect() : null;
      var st = mode === 'review' ? { kind: 'review', section: sid } : (qid ? qStep(qid) : firstOpenStep(sid));
      if (!st) { ui.busy = false; return; }
      ui.page = 'discovery'; ui.overlay = true; ui.opening = !from; ui.menu = false; ui.minimized = false; ui.popup = null; ui.followShown = {}; ui.hint = '';
      if (o.onTab) o.onTab('discovery');
      renderPage(); renderRail(); renderToc(); renderMini();
      setStep(st);
      growFrom(from);
    }
    /** The container shrinks back into the card it came from, then `then(animated)` runs. */
    function contractToCard(sid, then) {
      var host = overlayHost, ovl = host && host.querySelector ? host.querySelector('.pb-ovl') : null;
      var card = cardEl(sid), to = card && card.getBoundingClientRect ? card.getBoundingClientRect() : null;
      var vh = root.innerHeight || 800;
      var animated = !!(ovl && to && ovl.animate && ovl.getBoundingClientRect && !reduceMotion() && to.bottom > 0 && to.top < vh);
      var done = function () { closeNow(); if (then) then(animated); };
      if (!animated) { done(); return; }
      var a = ovl.getBoundingClientRect();
      var dx = to.left + to.width / 2 - (a.left + a.width / 2), dy = to.top + to.height / 2 - (a.top + a.height / 2);
      var back = host.querySelector('.pb-ovl-backdrop'), foot = host.querySelector('.pb-ovl-foot');
      if (back) back.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, fill: 'forwards' });
      if (foot) foot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
      var anim = ovl.animate([{ transform: 'none', opacity: 1, borderRadius: '28px' }, { opacity: .9, offset: .7 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + to.width / a.width + ',' + to.height / a.height + ')', opacity: 0, borderRadius: '24px' }],
        { duration: 520, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' });
      var fired = false, fin = function () { if (!fired) { fired = true; done(); } };
      anim.onfinish = fin; anim.oncancel = fin;
    }
    /** Jump straight to a question (or to the question a follow-up belongs to), or to an area's first open question, from the drawer. */
    function jumpTo(qid, sectionId) {
      var st = qid ? qStep(qid) : (sectionId ? firstOpenStep(sectionId) : null);
      if (!st) return;
      ui.menu = false;
      setStep(st);
    }
    /** Open the questions: no argument = the first area that still has an open question (all answered: straight to the recommendation); an area number = that area (a finished one opens as a review); a question id = that question. */
    function openDiscovery(arg) {
      if (arg && /^Q\d+$/.test(arg)) { var st0 = qStep(arg); if (st0) expandSection(st0.section, 'run', st0.qid); return; }
      var sid = arg || nextOpenSection(null);
      if (!sid) { go('recommendation', null, true); return; }
      if (!sectionTops(sid).length) return;
      expandSection(sid, sectionHasOpen(sid) ? 'run' : 'review');
    }
    /** Close at once, without the animation. */
    function closeNow() {
      ui.overlay = false; ui.popup = null; ui.notice = null; ui.minimized = false; ui.menu = false; ui.hint = '';
      renderOverlay(); renderPage(); renderRail(); renderToc(); renderMini();
    }
    function closeDiscovery() {
      if (!ui.overlay || ui.busy) return;
      var st = ui.step, p = session.progress();
      if (st && st.kind === 'q' && p.visible > 0 && p.remaining > 0) { minimize(); return; }      // unfinished: it shrinks into the corner and waits
      contractToCard(st ? st.section : null, null);
    }
    function finish() {
      if (lockedNow()) return;
      var flights = captureFlights();
      closeNow(); go('recommendation', null, true);
      playFlights(flights);
    }
    /** The logos on screen (the dock, or the winner in the middle) are copied before the carousel closes, so they can travel to the shortlist. */
    function captureFlights() {
      var host = overlayHost, d = doc();
      if (!host || !host.querySelectorAll || !d || !d.body || !d.createElement || reduceMotion()) return [];
      var out = [];
      var ids = [];
      Array.prototype.forEach.call(host.querySelectorAll('.pb-winner-logo, .pb-logo-btn'), function (el) { var id = el.getAttribute('data-tool'); if (ids.indexOf(id) === -1) ids.push(id); });
      ids.forEach(function (id) {
        var src = host.querySelector('.pb-winner-logo[data-tool="' + id + '"]') || host.querySelector('.pb-logo-btn[data-tool="' + id + '"]');
        var logo = src.querySelector('.pb-logo');
        var r = logo && logo.getBoundingClientRect();
        if (!r || !r.width) return;
        var c = logo.cloneNode(true);
        c.className = (logo.classList.contains('pb-mono') ? 'pb-logo pb-mono' : 'pb-logo') + ' pb-flight';
        c.style.cssText = 'position:fixed;z-index:400;margin:0;pointer-events:none;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;font-size:' + (root.getComputedStyle ? root.getComputedStyle(logo).fontSize : '16px');
        d.body.appendChild(c);
        out.push({ id: id, clone: c, rect: r });
      });
      return out;
    }
    function playFlights(list) {
      if (!list.length) return;
      // the page stays at the top where it opened; a logo only flies if its destination is on screen, otherwise it simply fades out
      list.forEach(function (f) {
        var target = o.container.querySelector('.pb-tool[data-tool="' + f.id + '"] .pb-card-logo .pb-logo') || o.container.querySelector('.pb-side-logo[data-tool="' + f.id + '"] .pb-logo');
        if (!target || !f.clone.animate) { f.clone.remove(); return; }
        var t = target.getBoundingClientRect();
        var vh = root.innerHeight || 800;
        if (t.top < 0 || t.bottom > vh) { var fade = f.clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }); fade.onfinish = function () { f.clone.remove(); }; return; }
        target.style.opacity = '0';
        f.clone.style.transformOrigin = '0 0';
        var a = f.clone.animate([{ transform: 'none' }, { transform: 'translate(' + (t.left - f.rect.left) + 'px,' + (t.top - f.rect.top) + 'px) scale(' + t.width / f.rect.width + ')' }], { duration: 950, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
        var done = function () { target.style.opacity = ''; f.clone.remove(); };
        a.onfinish = done; a.oncancel = done;
      });
    }

    // ------------------------------------------------------------------ render and answers
    var RENDER = { dictionary: renderDictionary, overview: renderOverview, navigate: renderNavigate, principles: renderPrinciples, scoring: renderScoring, cta: renderCta, matrix: renderMatrix, discovery: renderDiscovery, shortlist: renderShortlist, migration: renderMigration, final: renderFinal };
    function renderPage() { o.container.innerHTML = pageHtml(); }
    function render() { renderPage(); renderRail(); renderToc(); renderOverlay(); renderMini(); }
    /** An answer changed: redraw the page behind, the progress panel and the carousel. */
    function refresh() { renderPage(); renderRail(); renderToc(); renderOverlay(); renderMini(); }

    function checkedFor(host, qid) {
      return Array.prototype.map.call(host.querySelectorAll('input[data-qid="' + qid + '"]:checked'), function (i) { return i.value; });
    }
    function applyAnswer(qid, ids) {
      var before = JSON.parse(JSON.stringify(session.answers));
      var res;
      try { res = session.answer(qid, ids); } catch (e) { ui.notice = { text: e.message }; refresh(); return; }
      if (res.pruned.length) {
        ui.notice = { text: 'Your answers to ' + res.pruned.map(function (id) { return '“' + qOf(id).text + '”'; }).join(' and ') + ' were cleared because that part of the questionnaire no longer applies.', undo: before };
      } else if (ui.notice && !ui.notice.undo) { ui.notice = null; }
      persist();
      ui.hint = '';
      refresh();
    }
    function clearOption(qid, optionId) {
      var cur = session.answers[qid] || [];
      if (cur.indexOf(optionId) === -1) return;          // not selected: nothing to clear
      applyAnswer(qid, cur.filter(function (id) { return id !== optionId; }));
    }
    // A double-click on an answer clears it (on a phone, use Clear). Three paths cover the browsers' differences: a radio that is
    // clicked twice produces no second change event, a checkbox produces two changes, and where the page was not redrawn in
    // between the browser's own dblclick event arrives.
    function isDouble(id) {
      var now = Date.now(), last = ui.lastToggle;
      var again = !!(last && last.id === id && now - last.t < 450);
      ui.lastToggle = again ? null : { id: id, t: now };
      return again;
    }

    function flash(msg) { var el = o.container.querySelector('#pb-flash'); if (el) el.textContent = msg; }
    function summaryText() { return L.buildSummary(summaryContext()); }
    function copy() {
      var text = summaryText();
      if (root.navigator && root.navigator.clipboard) { root.navigator.clipboard.writeText(text).then(function () { flash('Copied.'); }, function () { fallbackCopy(text); }); } else fallbackCopy(text);
    }
    function fallbackCopy(text) {
      var ta = doc().createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      doc().body.appendChild(ta); ta.select();
      try { flash(doc().execCommand('copy') ? 'Copied.' : 'Select the text and copy it.'); } catch (e) { flash('Select the text and copy it.'); }
      doc().body.removeChild(ta);
    }
    function saveFile(name, text, type) {
      var blob = new root.Blob([text], { type: type });
      var url = root.URL.createObjectURL(blob);
      var a = doc().createElement('a'); a.href = url; a.download = name; a.style.display = 'none';
      doc().body.appendChild(a); a.click();
      // some browsers start the download after click() returns: the address and the link stay until then
      var clean = function () { root.URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); };
      if (root.setTimeout) root.setTimeout(clean, 1000); else clean();
    }
    /** A backup of the answers and notes that can be restored on another device. */
    function download() { saveFile('bi-playbook-answers.json', JSON.stringify({ app: 'bi-playbook', version: 1, answers: session.answers, notes: store.notes }, null, 2), 'application/json'); }
    function saveMarkdown() { saveFile('bi-tool-recommendation.md', summaryText(), 'text/markdown'); }
    /** Print only the final recommendation: the browser's print dialog offers "Save as PDF". */
    function printSummary() {
      var html = doc().documentElement; html.setAttribute('data-print', 'summary'); root.print(); html.removeAttribute('data-print');
    }
    function savePdf() {
      if (lockedNow()) return;
      ui.rec = 'final'; ui.page = 'discovery'; render();
      printSummary();
    }

    /** Attach the page's handlers to a host element: the content area and the carousel share them. */
    function wire(host, isOverlay) {
      host.addEventListener('change', function (e) {
        var t = e.target;
        if (t.matches && t.matches('input[data-qid]')) {
          var qid = t.getAttribute('data-qid');
          // The page redraws after every change, so the browser does not report a double-click on a checkbox. A second change on the
          // same answer within a moment is read as a double-click: the answer is cleared.
          var again = isDouble(t.id);
          if (again && t.type === 'checkbox') { applyAnswer(qid, checkedFor(host, qid).filter(function (v) { return v !== t.value; })); return; }
          applyAnswer(qid, checkedFor(host, qid));
          return;
        }
        var act = t.getAttribute && t.getAttribute('data-action');
        if (act === 'restore' && t.files && t.files[0]) {
          var rd = new root.FileReader(), file = t.files[0];
          rd.onload = function () {
            try {
              var d = JSON.parse(rd.result);
              if (!isPlain(d) || d.app !== 'bi-playbook' || !isPlain(d.answers)) throw new Error('not a back-up of this playbook');
              if (Object.keys(session.answers).length && root.confirm && !root.confirm('Replace the answers and notes on this page with the ones in this file?')) { flash('Nothing was changed.'); return; }
              var c = cleanAnswers(d.answers);
              buildSession(c.answers); store.notes = cleanNotes(d.notes); persist(); ui.notice = null; render();
              flash('Answers restored.' + (c.message ? ' ' + c.message : ''));
            } catch (err) { flash('That file could not be read as a back-up of this playbook.'); }
          };
          t.value = '';                                  // so the same file can be chosen again
          rd.readAsText(file);
        }
      });
      host.addEventListener('input', function (e) {
        var t = e.target;
        if (t.matches && t.matches('textarea[data-note]')) { store.notes[t.getAttribute('data-note')] = t.value; if (!t.value) delete store.notes[t.getAttribute('data-note')]; saveStore(); }
        else if (t.getAttribute && t.getAttribute('data-action') === 'client') { ui.clientName = t.value; var ti = o.container.querySelector('#pb-rep-title'); if (ti) ti.textContent = 'BI tool recommendation' + (t.value ? ' for ' + t.value : ''); }
      });
      host.addEventListener('click', function (e) {          // a radio clicked twice quickly
        var t = e.target;
        if (!t || t.tagName !== 'INPUT' || t.type !== 'radio' || !t.checked) return;
        var last = ui.lastToggle;
        if (last && last.id === t.id && Date.now() - last.t < 450) { ui.lastToggle = null; clearOption(t.getAttribute('data-qid'), t.value); }
      });
      host.addEventListener('dblclick', function (e) {
        var tile = e.target.closest ? e.target.closest('.pb-opt') : null;
        var input = tile && tile.querySelector ? tile.querySelector('input[data-qid]') : null;
        if (input) clearOption(input.getAttribute('data-qid'), input.value);
      });
      host.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-action]') : null;
        if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT' || b.tagName === 'OPTION') return;
        var act = b.getAttribute('data-action');
        if (act === 'go') go(b.getAttribute('data-tab'), b.getAttribute('data-anchor'));
        else if (act === 'subtab') go(b.getAttribute('data-sub'));
        else if (act === 'mgroup') { var gi = b.getAttribute('data-group'); ui.matrixOpen[gi] = !ui.matrixOpen[gi]; render(); }
        else if (act === 'mall') { var openAll = b.getAttribute('data-open') === '1'; D.matrix.groups.forEach(function (g, i) { ui.matrixOpen[i] = openAll; }); render(); }
        else if (act === 'dtab') { ui.dtool = b.getAttribute('data-tool'); render(); var nb = o.container.querySelector('#dtab-' + ui.dtool); if (nb && nb.focus) nb.focus({ preventScroll: true }); }
        else if (act === 'mtool') {
          var tid = b.getAttribute('data-tool'), cur = shownTools(), on = cur.indexOf(tid) !== -1;
          if (on && cur.length <= 2) return;                       // at least two stay on
          ui.mtools = on ? cur.filter(function (x) { return x !== tid; }) : cur.concat([tid]);
          render();
          var cb = o.container.querySelector('.pb-chip[data-tool="' + tid + '"]'); if (cb && cb.focus) cb.focus({ preventScroll: true });
        }
        else if (act === 'mall-tools') { ui.mtools = null; render(); }
        else if (act === 'short') { ui.shortSel = b.getAttribute('data-tool'); render(); }
        else if (act === 'openq') openDiscovery(b.getAttribute('data-section') || null);
        else if (act === 'goq') openDiscovery(b.getAttribute('data-qid'));
        else if (act === 'close') closeDiscovery();
        else if (act === 'menu') { ui.menu = !ui.menu; ui.popup = null; renderOverlay(); }
        else if (act === 'menuclose') { ui.menu = false; renderOverlay(); }
        else if (act === 'jump') jumpTo(b.getAttribute('data-qid'), null);
        else if (act === 'jumpsec') jumpTo(null, b.getAttribute('data-section'));
        else if (act === 'prev') stepBy(-1);
        else if (act === 'next') stepBy(1);
        else if (act === 'finish') finish();
        else if (act === 'resume') resumeDiscovery();
        else if (act === 'tool') { ui.popup = ui.popup === b.getAttribute('data-tool') ? null : b.getAttribute('data-tool'); renderOverlay(); }
        else if (act === 'poptool') { ui.popup = b.getAttribute('data-tool'); renderOverlay(); }
        else if (act === 'popclose') { ui.popup = null; renderOverlay(); }
        else if (act === 'clear') applyAnswer(b.getAttribute('data-qid'), []);
        else if (act === 'note') { var id = b.getAttribute('data-qid'); ui.openNotes[id] = !(ui.openNotes[id] || store.notes[id]); refresh(); var ta = host.querySelector('textarea[data-note="' + id + '"]'); if (ta) ta.focus({ preventScroll: true }); }
        else if (act === 'undo') { if (ui.notice && ui.notice.undo) { var prev = ui.notice.undo; ui.notice = null; buildSession(prev); persist(); refresh(); } }
        else if (act === 'dismiss') { ui.notice = null; refresh(); }
        else if (act === 'copy') copy();
        else if (act === 'print') printSummary();
        else if (act === 'mdsave') saveMarkdown();
        else if (act === 'pdf') savePdf();
        else if (act === 'download') download();
        else if (act === 'reset') api.reset();
      });
      if (!isOverlay) host.addEventListener('keydown', function (e) {          // the dictionary's tabs: arrow keys move between tools
        var tab = e.target && e.target.closest ? e.target.closest('.pb-dtab') : null;
        if (!tab) return;
        var i = toolIds.indexOf(tab.getAttribute('data-tool')), k = e.key;
        var j = k === 'ArrowRight' ? (i + 1) % toolIds.length : k === 'ArrowLeft' ? (i + toolIds.length - 1) % toolIds.length : k === 'Home' ? 0 : k === 'End' ? toolIds.length - 1 : -1;
        if (j < 0) return;
        ui.dtool = toolIds[j]; render();
        var nb = o.container.querySelector('#dtab-' + ui.dtool); if (nb && nb.focus) nb.focus({ preventScroll: true });
        if (e.preventDefault) e.preventDefault();
      });
      if (isOverlay) host.addEventListener('keydown', function (e) {
        var k = e.key, t = e.target || {};
        if (k === 'Escape') { if (ui.popup) { ui.popup = null; renderOverlay(); } else if (ui.menu) { ui.menu = false; renderOverlay(); } else closeDiscovery(); e.preventDefault && e.preventDefault(); return; }
        if (k === 'Tab' && host.querySelectorAll) {       // keep keyboard focus inside the open carousel
          var f = Array.prototype.filter.call(host.querySelectorAll('button:not([disabled]), input, textarea, [tabindex="-1"].pb-card-q'), function (n) { return n.offsetParent !== null || n === (doc() && doc().activeElement); });
          if (!f.length) return;
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && (t === first || !host.contains(t))) { last.focus(); e.preventDefault(); }
          else if (!e.shiftKey && t === last) { first.focus(); e.preventDefault(); }
          return;
        }
        var tag = t.tagName, kind = t.type;
        var field = tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && kind !== 'radio' && kind !== 'checkbox' && kind !== 'button');
        if (field) return;
        if (k === 'Enter') {
          if (tag === 'BUTTON' || tag === 'A') return;            // a focused button does its own job
          if (ui.step && ui.step.kind === 'review' && tag === 'INPUT') return;      // editing a review: Enter must not close it
          advance(); e.preventDefault && e.preventDefault(); return;
        }
        if (k === 'ArrowLeft' || k === 'ArrowRight') { stepBy(k === 'ArrowRight' ? 1 : -1); e.preventDefault && e.preventDefault(); }
      });
    }
    wire(o.container, false);
    if (overlayHost) wire(overlayHost, true);
    if (miniHost) wire(miniHost, false);               // a corner window the embedder supplied needs the same handlers as the one the module makes
    o.rail.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!b) return;
      var act = b.getAttribute('data-action');
      if (act === 'openq') openDiscovery(null);
      else if (act === 'reset') api.reset();
    });

    var api = {
      /** The playbook's pages, in order (the tab row). */
      tabs: PAGES,
      /** The page being shown. */
      get tab() { return ui.page; },
      /** Show a page, or a section of a page ('shortlist' opens the Recommendation page on its Shortlist tab). */
      go: function (id) { go(id); },
      /** True for a page or section id go() understands, including the ids of the earlier four-page layout (so old links still land). */
      knows: function (id) { return PAGE_IDS.indexOf(id) !== -1 || has(SECTION_PAGE, id); },
      /** Programmatic equivalent of picking answers in the page (used by tests and by anything embedding the module). */
      answer: function (qid, optionIds) { applyAnswer(qid, optionIds); },
      /** What a double-click on an answer does: take that answer out of the selection (a single answer becomes unanswered). */
      clearOption: function (qid, optionId) { clearOption(qid, optionId); },
      setNote: function (qid, text) { if (text) store.notes[qid] = text; else delete store.notes[qid]; saveStore(); },
      session: function () { return session; },
      /** The question carousel: open (no argument, a section number or a question id), move, close, inspect. */
      openDiscovery: function (arg) { openDiscovery(arg); },
      closeDiscovery: function () { closeDiscovery(); },
      move: function (dir) { stepBy(dir); },
      /** What Enter does: on to the next open question, finish the area, or open the recommendation. */
      advance: function () { advance(); },
      step: function () { return ui.step ? JSON.parse(JSON.stringify(ui.step)) : null; },
      overlayOpen: function () { return !!ui.overlay; },
      minimized: function () { return !!ui.minimized && !ui.overlay && session.progress().remaining > 0; },
      resume: function () { resumeDiscovery(); },
      menu: function (open) { ui.menu = !!open; if (ui.overlay) renderOverlay(); },
      jump: function (qid) { jumpTo(qid, null); },
      overlayHtml: function () { return ui.overlay ? overlayHtml() : ''; },
      showTool: function (id) { ui.popup = id; renderOverlay(); },
      reset: function () {
        if (root.confirm && !root.confirm('Clear all answers and notes on this device?')) return;
        ui.overlay = false; ui.popup = null; ui.menu = false; ui.minimized = false;
        store = { answers: {}, notes: {} }; saveStore(); buildSession({}); ui.notice = null; ui.openNotes = {}; ui.clientName = ''; render();
      },
      setShowDrafts: function (v) { persist(); showDrafts = !!v; buildSession(store.answers); render(); },
      get showDrafts() { return showDrafts; },
      summary: summaryText
    };
    (function () { var p = session.progress(); ui.minimized = p.answered > 0 && p.remaining > 0; ui.miniFresh = false; })();     // a started, unfinished questionnaire keeps its corner window
    render();
    ensureTopButton();
    return api;
  }

  return { mount: mount, TABS: PAGES, PAGES: PAGES, SECTIONS: SECTIONS, SECTION_PAGE: SECTION_PAGE };
}));
