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
    overview: 'home', navigate: 'home', principles: 'home', dictionary: 'home', matrix: 'home', reference: 'home', cta: 'home',
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
    Q06: 'Pick every kind of access control the client needs.',
    Q26: 'Whether the client is able to use a tool that the vendor hosts in the cloud. Answering No rules out any tool that is only offered that way.',
    Q07: 'Whether the business definitions, such as metrics and how tables relate, are already modelled in one place.',
    Q08: 'How consistently reporting is controlled today: who can publish, and who checks the numbers.',
    Q09: 'Whether the client has concerns about AI features working with their data.',
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
  /** Which questions bear on which matrix criterion, for "Relevant to your answers". Proposal, docs/page-design.md A14. */
  var CRITERION_QS = [
    ['Ease of Adoption', ['Q10', 'Q11', 'Q12']], ['Self-Service Analytics', ['Q01', 'Q11']], ['Visualization', ['Q21', 'Q17']],
    ['AI-Assisted', ['Q22', 'Q09']], ['Predictive', ['Q01']], ['Governance & Security', ['Q03', 'Q05', 'Q06', 'Q08', 'Q09', 'Q26']],
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

  /**
   * Corrections to the tool profiles (deck slides 10 to 15) and one matrix cell, each checked against the vendor's own pages on 2026-11-20.
   * `from` is the deck's exact text: a test fails if the deck changes, so a correction never lands on text it was not written for.
   */
  var TS_PRICING = 'https://www.thoughtspot.com/pricing';
  var SIGMA_ASSISTANT = 'https://www.sigmacomputing.com/blog/introducing-sigma-assistant';
  var PROFILE_FIX = {
    thoughtspot: { costTier: [{ from: 'Team, Pro, Enterprise (custom pricing)', to: 'Essentials, Pro and Enterprise plans; Enterprise is custom-priced', url: TS_PRICING }] },
    sigma: {
      uniqueFeatures: [{ from: 'Ask Sigma enables natural language querying and AI-assisted data exploration', to: 'Sigma Assistant (the successor to Ask Sigma and AI Builder) enables natural language querying and AI-assisted data exploration', url: SIGMA_ASSISTANT }],
      aiCapabilities: [{ from: 'Ask Sigma for conversational analytics and natural language querying', to: 'Sigma Assistant (the successor to Ask Sigma and AI Builder) for conversational analytics and natural language querying', url: SIGMA_ASSISTANT }]
    }
  };
  var MATRIX_FIX = { sigma: { 'AI-Assisted & Conversational Analytics': { from: 'Ask Sigma covers the basics', to: 'Sigma Assistant (successor to Ask Sigma) covers the basics' } } };

  /** Line icons (24 px grid, drawn with the text colour): used for every arrow, close and tick so they centre exactly. */
  var ICON_PATHS = { left: '<path d="M14.5 6 8.5 12l6 6"/>', right: '<path d="m9.5 6 6 6-6 6"/>', close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', menu: '<path d="M4.5 7h15M4.5 12h15M4.5 17h15"/>', up: '<path d="m6 14.5 6-6 6 6"/>', down: '<path d="m6 9.5 6 6 6-6"/>', expand: '<path d="M14 5h5v5M10 19H5v-5M19 5l-6 6M5 19l-6 6"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', check: '<path d="m5.5 12.5 4.2 4.2 8.8-9.4"/>', top: '<path d="M12 19V6M6.5 11.5 12 6l5.5 5.5"/>' };
  function icon(name) {
    return '<svg class="pb-ico pb-ico-' + name + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICON_PATHS[name] + '</svg>';
  }

  function today() { return new Date().toISOString().slice(0, 10); }

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

    var store = loadStore();
    var model, session;
    var ui = { matrixOpen: {}, page: 'home', rec: 'shortlist', shortSel: null, overlay: false, step: null, popup: null, timer: null, hold: false, followShown: {}, notice: null, openNotes: {}, mtools: null, dtool: null, clientName: '' };

    function loadStore() {
      try { var raw = root.localStorage && root.localStorage.getItem(storageKey); if (raw) { var s = JSON.parse(raw); return { answers: s.answers || {}, notes: s.notes || {} }; } } catch (e) { /* storage unavailable: carry on without it */ }
      return { answers: {}, notes: {} };
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

    /** The contents: where the rest of the page goes, in the order we work. */
    function renderNavigate() {
      var total = fullModel.questions.length, base = fullModel.questions.filter(function (q) { return !(q.showIf && q.showIf.length); }).length;
      var chapter = function (n, title, text, meta, tab, anchor) {
        return '<li><button class="pb-chapter" data-action="go" data-tab="' + tab + '"' + (anchor ? ' data-anchor="' + anchor + '"' : '') + '><span class="pb-chapter-ico" aria-hidden="true">' + n + '</span>' +
          '<span class="pb-chapter-t"><span class="pb-chapter-meta">' + esc(meta) + '</span><strong>' + esc(title) + '</strong><span class="pb-chapter-d">' + esc(text) + '</span></span>' +
          '<span class="pb-chapter-go" aria-hidden="true">' + icon('right') + '</span></button></li>';
      };
      return '<section class="pb-sec"><h2>Contents</h2>' +
        '<ol class="pb-chapters">' +
        chapter(1, 'Do’s and Don’ts', 'The principles we hold ourselves to on every recommendation.', 'HOW WE WORK', 'home', 'sec-principles') +
        chapter(2, 'Tools dictionary', 'What each tool is, what it does best and what it costs. One tool at a time.', toolIds.length + ' TOOLS · A TO Z', 'home', 'sec-dictionary') +
        chapter(3, 'Comparison matrix', 'All six side by side, a group of criteria at a time. Choose the tools to show, or put any two head to head.', '14 CRITERIA · ' + toolIds.length + ' TOOLS', 'home', 'sec-matrix') +
        chapter(4, 'Client discovery', 'Still deciding? Answer questions about the client and we recommend the best fit, with our reasons.', 'NEXT PAGE · ' + SECTIONS.length + ' AREAS · ' + base + ' TO ' + total + ' QUESTIONS', 'discovery') +
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
        '<p class="pb-lead">The ranking comes only from the answers you give. No tool is favoured, and list order never matters.</p>' +
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

    /** Everything the carousel moves through, in order: each top-level question, then an "area complete" card, and a final card. */
    function steps() {
      var by = visibleBySection(), out = [];
      SECTIONS.forEach(function (s) {
        var tops = (by[s.id] || []).filter(function (q) { return !parentOf(q); });
        tops.forEach(function (q, i) { out.push({ kind: 'q', section: s.id, qid: q.id, pos: i + 1, count: tops.length }); });
        if (tops.length) out.push({ kind: 'done', section: s.id });
      });
      out.push({ kind: 'end' });
      return out;
    }
    function stepIndex(list, st) {
      for (var i = 0; i < list.length; i++) if (st && list[i].kind === st.kind && list[i].section === st.section && list[i].qid === st.qid) return i;
      return -1;
    }

    function renderDiscovery() {
      var by = visibleBySection();
      var prog = session.progress();
      var allDone = prog.visible > 0 && prog.remaining === 0;
      var started = prog.answered > 0;
      var areas = SECTIONS.map(function (s) {
        var c = counts(by[s.id]);
        var state = !c.total ? '' : c.done === c.total ? '<span class="pb-area-state is-done">Complete</span>' : c.done ? '<span class="pb-area-state">' + c.done + ' of ' + c.total + ' answered</span>' : '<span class="pb-area-state">Not started</span>';
        return '<li><button class="pb-area' + (c.total && c.done === c.total ? ' is-done' : '') + '" data-action="openq" data-section="' + s.id + '"><span class="pb-area-n" aria-hidden="true">' + (c.total && c.done === c.total ? icon('check') : s.id) + '</span>' +
          '<span class="pb-area-t"><strong>' + esc(s.title) + '</strong><span class="pb-area-d">' + esc(s.blurb) + '</span>' +
          '<span class="pb-area-meta">' + c.total + ' question' + (c.total === 1 ? '' : 's') + ' ' + state + '</span></span><span class="pb-chapter-go" aria-hidden="true">' + icon('right') + '</span></button></li>';
      }).join('');
      return '<section class="pb-sec"><h2 id="disc-about">Client discovery</h2>' +
        '<p class="pb-lead">The client’s answers decide the tool, not our preferences. We ask about five areas of their situation, and the recommendation further down follows from what they tell us.</p>' +
        '<h3 id="disc-areas">Areas we ask about</h3>' +
        '<p class="pb-intro-sm">Open any area, or start from the top. You can skip a question and come back to it.</p>' +
        '<ol class="pb-areas">' + areas + '</ol>' +
        '<h3 id="disc-start">Start the questions</h3>' +
        '<p class="pb-intro-sm">It takes about 5 to 10 minutes.</p>' +
        '<div class="pb-startrow"><button class="pb-btn pb-btn-lg" data-action="openq">' + (allDone ? 'Review the questions' : started ? 'Continue the questions' : 'Start the questions') + '</button>' +
        (started ? '<span class="pb-startmeta">' + prog.answered + ' of ' + prog.visible + ' answered</span> <button class="pb-link" data-action="reset">Start over</button>' : '') + '</div>' +
        '<ul class="pb-tips"><li>One question at a time. After you choose, it moves on by itself after ' + QUESTION_SECONDS + ' seconds without a click.</li>' +
        '<li>Double-click an answer to clear it.</li><li>Follow-up questions open inside the question that triggers them.</li>' +
        '<li>If you close the questions before the end, they shrink into the corner of the screen and wait there until every question is answered.</li>' +
        '<li>The top three tools update as you answer. They stay provisional until most questions are answered.</li></ul>' +
        (allDone ? '<p><button class="pb-btn pb-btn-ghost" data-action="go" data-tab="recommendation">See the recommendation</button></p>' : '') + '</section>';
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

    // ---- the carousel
    var QUESTION_SECONDS = 3.2;    // no click for this long after an answer: move to the next question
    var WINNER_SECONDS = 7;        // how long the winner stays on screen before the recommendation opens
    var SECTION_SECONDS = 3.2;     // how long the "area complete" card waits before moving to the next area

    function logoHtml(id, cls) {
      var src = config.logos && config.logos[id];
      if (src) return '<img class="pb-logo ' + (cls || '') + '" src="' + esc(src) + '" alt="" draggable="false">';
      var words = names[id].split(/\s+/);
      var mono = (words.length > 1 ? words.map(function (w) { return w.charAt(0); }).join('') : names[id].charAt(0)).toUpperCase();
      return '<span class="pb-logo pb-mono ' + (cls || '') + '" aria-hidden="true">' + esc(mono) + '</span>';
    }

    /** The sleek bar under the area title doubles as the countdown: a lighter fill runs ahead to the next question's position. No text. */
    function sweepHtml(from, to) {
      var t = ui.timer;
      if (!t) return '';
      var elapsed = Math.max(0, (Date.now() - t.started) / 1000);
      return '<span class="pb-prog-sweep" style="--a:' + from + '%;--b:' + to + '%;animation-duration:' + t.secs + 's;animation-delay:-' + elapsed.toFixed(2) + 's"></span>';
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

    function stepBody(st, list, idx) {
      if (st.kind === 'q') {
        var q = session.visible().filter(function (v) { return v.id === st.qid; })[0];
        var notice = ui.notice ? '<div class="pb-notice" role="status"><span>' + esc(ui.notice.text) + '</span> ' + (ui.notice.undo ? '<button class="pb-link" data-action="undo">Undo</button> ' : '') + '<button class="pb-link" data-action="dismiss">Dismiss</button></div>' : '';
        var pending = childrenOf(st.qid).some(function (c) { return !c.answered; }) && q && q.answered;
        return notice + questionCard(q, 'Question ' + st.pos + ' of ' + st.count, false) +
          (pending ? '<p class="pb-hint-follow">Answer the follow-up questions, or press next to skip them.</p>' : '');
      }
      var next = list[idx + 1];
      if (st.kind === 'done') {
        var s = sectionById(st.section), c = counts(visibleBySection()[st.section]);
        var nextSec = next && next.kind === 'q' ? sectionById(next.section) : null;
        return '<div class="pb-done"><span class="pb-done-check" aria-hidden="true">' + icon('check') + '</span><h3 tabindex="-1">' + esc(s.title) + ' is complete</h3>' +
          '<p>' + c.done + ' of ' + c.total + ' questions answered.</p>' +
          '<p class="pb-done-next">' + (nextSec ? 'Next: <strong>' + esc(nextSec.title) + '</strong>' : 'Next: <strong>your shortlist</strong>') + '</p>' +
          '<p class="pb-done-actions"><button class="pb-btn" data-action="next">' + (nextSec ? 'Go to the next area' : 'Continue') + '</button> <button class="pb-btn pb-btn-ghost" data-action="prev">Review this area</button></p></div>';
      }
      var prog = session.progress();
      var res = session.result();
      if (lockedNow()) {
        var open = session.openQuestions();
        return '<div class="pb-done"><span class="pb-done-check is-open" aria-hidden="true">' + icon('lock') + '</span><h3 tabindex="-1">' + open.length + ' question' + (open.length === 1 ? ' is' : 's are') + ' still open</h3>' +
          '<p>The recommendation opens once every question has an answer.</p>' +
          '<ul class="pb-open pb-open-center">' + open.slice(0, 4).map(function (q) { return '<li><button class="pb-link" data-action="jump" data-qid="' + q.id + '">' + esc(q.text) + '</button></li>'; }).join('') + (open.length > 4 ? '<li class="pb-fine">and ' + (open.length - 4) + ' more</li>' : '') + '</ul>' +
          '<p class="pb-done-actions"><button class="pb-btn" data-action="jump" data-qid="' + open[0].id + '">Go to the first open question</button> <button class="pb-btn pb-btn-ghost" data-action="prev">Review answers</button></p></div>';
      }
      if (res.informative) {          // the winner, alone, in the middle (it flies up from the dock)
        var lead = res.coLeaders.length ? res.coLeaders : [res.ranking[0].tool];
        var tie = lead.length > 1;
        var nm = L.listJoin(L.sortNames(lead.map(function (t) { return t.name; })));
        return '<div class="pb-winner"><p class="pb-winner-sub">All areas are complete · ' + prog.answered + ' of ' + prog.visible + ' questions answered</p>' +
          '<p class="pb-winner-kicker">' + (tie ? 'Too close to call' : res.state === 'complete' ? 'Best fit' : 'Best fit so far') + '</p>' +
          '<div class="pb-winner-logos">' + lead.map(function (t) { return '<span class="pb-winner-logo" data-tool="' + t.id + '">' + logoHtml(t.id, tie ? 'pb-logo-xl pb-logo-xl-tie' : 'pb-logo-xl') + '</span>'; }).join('') + '</div>' +
          '<h3 tabindex="-1">' + esc(nm) + '</h3><p class="pb-winner-line">' + esc(L.leadSentence(res, names)) + '</p>' +
          '<p class="pb-done-actions"><button class="pb-btn" data-action="finish">See the recommendation</button> <button class="pb-btn pb-btn-ghost" data-action="prev">Review answers</button></p></div>';
      }
      return '<div class="pb-done"><span class="pb-done-check" aria-hidden="true">' + icon('check') + '</span><h3 tabindex="-1">All areas are complete</h3>' +
        '<p>' + prog.answered + ' of ' + prog.visible + ' questions answered. Your shortlist is ready.</p>' +
        '<p class="pb-done-actions"><button class="pb-btn" data-action="finish">See the recommendation</button> <button class="pb-btn pb-btn-ghost" data-action="prev">Review answers</button></p></div>';
    }

    function overlayHtml() {
      var list = steps(), idx = stepIndex(list, ui.step);
      if (idx < 0) { ui.step = { kind: list[0].kind, section: list[0].section, qid: list[0].qid }; idx = 0; }
      var st = list[idx], nx = list[idx + 1];
      var sec = st.kind === 'end' ? null : sectionById(st.section);
      var pct = st.kind === 'q' ? Math.round(st.pos / st.count * 100) : 100;
      var title = sec ? sec.title : 'Client discovery';
      var kicker = sec ? 'Area ' + sec.id + ' of ' + SECTIONS.length : 'Finished';
      // the countdown runs inside the progress bar: ahead to the next question's position, or across the whole bar on a "complete" card
      var sweepFrom = st.kind === 'q' ? pct : 0;
      var sweepTo = st.kind === 'q' ? (nx && nx.kind === 'q' && nx.section === st.section ? Math.round(nx.pos / nx.count * 100) : 100) : 100;
      return '<div class="pb-ovl-backdrop' + (ui.opening ? ' is-opening' : '') + '" data-action="close"></div>' +
        '<div class="pb-ovl' + (ui.opening ? ' is-opening' : '') + '" role="dialog" aria-modal="true" aria-labelledby="pb-ovl-title">' +
        '<header class="pb-ovl-head"><button class="pb-ovl-burger" data-action="menu" aria-label="Show all areas and questions" aria-expanded="' + (ui.menu ? 'true' : 'false') + '" aria-controls="pb-menu">' + icon('menu') + '</button><div class="pb-ovl-titlebox"><span class="pb-ovl-kicker">' + esc(kicker) + '</span><h2 id="pb-ovl-title">' + esc(title) + '</h2></div>' +
        '<button class="pb-ovl-close" data-action="close" aria-label="Close and go back to client discovery">' + icon('close') + '</button></header>' +
        '<div class="pb-ovl-progress' + (st.kind === 'q' ? '' : ' is-complete') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="Progress in this area"><span class="pb-prog-base" style="width:' + pct + '%"></span>' + sweepHtml(sweepFrom, sweepTo) + '</div>' +
        '<button class="pb-arrow pb-arrow-prev" data-action="prev" aria-label="Previous"' + (idx === 0 ? ' disabled' : '') + '>' + icon('left') + '</button>' +
        '<div class="pb-ovl-stage"><div class="pb-card-q' + (st.kind === 'q' ? '' : ' is-done') + (ui.animate ? ' is-in' : '') + '" tabindex="-1">' + stepBody(st, list, idx) + '</div></div>' +
        '<button class="pb-arrow pb-arrow-next" data-action="next" aria-label="Next"' + (st.kind === 'end' ? ' disabled' : '') + '>' + icon('right') + '</button>' +
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
      return names[id] + ' deployment (deck, slide 22): ' + prim.replace(/\.$/, '') + '. On-premises option: ' + onprem.replace(/\.$/, '') + '.';
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
            if (!cell) return '<li><strong>From ' + esc(fromName) + '</strong> No rating in the deck.</li>';
            var reasons = cell.reasons || cell.notes || [];
            return '<li><strong>From ' + esc(fromName) + '</strong> ' + pill('r-' + cell.rating.toLowerCase(), cell.rating) + (reasons.length ? '<ul>' + reasons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</li>';
          }).join('');
          return '<article class="pb-card"><h4>Moving to ' + esc(names[to]) + '</h4><ul class="pb-feas">' + items + '</ul></article>';
        }).join('') + '</div>';
      }
      if (shortlist.length) {
        out += '<h3>Effort by dimension</h3>' + effortTable(shortlist) + '<h3>Typical challenges</h3><div class="pb-grid2">' + shortlist.map(function (id) { return '<div class="pb-card"><h4>' + esc(names[id]) + '</h4><p>' + esc(M.challenges[id]) + '</p></div>'; }).join('') + '</div>';
      }
      out += '<details class="pb-details"><summary>Full feasibility grid</summary>' + gridTable() + '</details>' +
        '<p class="pb-fine">Source: ' + esc(M.source) + '. The deck’s Easy, Moderate and Hard ratings are shown as written.</p></section>';
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
      return entry[1].some(function (qid) {
        var q = qOf(qid); var a = session.answers[qid] || [];
        return q && a.some(function (id) { return q.omap[id] && !q.omap[id].unknown; });
      });
    }

    function ul(items, fixes) {
      return '<ul>' + items.map(function (x) {
        var f = (fixes || []).filter(function (c) { return c.from === x; })[0];
        return '<li>' + (f ? esc(f.to) + ' ' + pill('corr', 'Corrected') + ' <a href="' + f.url + '" rel="noopener" target="_blank">Source</a>' : esc(x)) + '</li>';
      }).join('') + '</ul>';
    }

    var DEPLOY_ROWS = ['Primary deployment', 'On-premises option', 'Data residency control'];
    function deployVal(k, id) {
      var cells = {};
      D.reference.deployment.forEach(function (row) { if (row.consideration === k) cells = row.cells; });
      return DEPLOY_FIX[k] && DEPLOY_FIX[k][id] ? DEPLOY_FIX[k][id].text : cells[id];
    }

    /** One tool's entry in the dictionary: everything the deck says about it, in one place. */
    function dictEntry(id) {
      var p = profileOf[id], M = D.migration;
      var fx = PROFILE_FIX[id] || {};
      var parts = [['Typical features', p.typicalFeatures, fx.typicalFeatures], ['Unique features', p.uniqueFeatures, fx.uniqueFeatures], ['Benefits', p.benefits, fx.benefits], ['AI capabilities', p.aiCapabilities, fx.aiCapabilities], ['Cost tier', p.costTier, fx.costTier]];
      var integ = D.reference.integration;
      var integRows = integ.tools.indexOf(id) !== -1 ? integ.rows.filter(function (row) { return row.cells[id]; }).map(function (row) { return '<li><strong>' + esc(row.platform) + ':</strong> ' + esc(row.cells[id]) + '</li>'; }).join('') : '';
      return '<article class="pb-dict" id="dict-' + id + '"><header class="pb-dict-head">' + logoHtml(id, 'pb-logo-lg') + '<h3>' + esc(names[id]) + '</h3></header>' +
        '<p class="pb-bestsuited"><strong>Best suited for</strong> ' + esc(p.bestSuited.replace(/^.*? is best suited for /i, '').replace(/^\w/, function (c) { return c.toUpperCase(); })) + '</p>' +
        '<p class="pb-dict-intro">' + esc(p.intro) + '</p>' +
        '<div class="pb-dict-grid">' + parts.map(function (x) {
          if (!x[1].length) return '<div class="pb-card pb-withheld"><h4>' + x[0] + '</h4><p class="pb-fine">Not shown yet. The source slide repeats another tool’s list and is awaiting correction.</p></div>';
          return '<div class="pb-card"><h4>' + x[0] + '</h4>' + ul(x[1], x[2]) + '</div>';
        }).join('') +
        '<div class="pb-card"><h4>Deployment</h4><ul>' + DEPLOY_ROWS.map(function (k) { return '<li><strong>' + esc(k) + ':</strong> ' + esc(deployVal(k, id)) + '</li>'; }).join('') + '</ul></div>' +
        '<div class="pb-card"><h4>Integration</h4>' + (integRows ? '<ul>' + integRows + '</ul>' : '<p class="pb-fine">The deck’s integration table does not cover this tool yet.</p>') + '</div>' +
        (M.challenges && M.challenges[id] ? '<div class="pb-card"><h4>Moving to it</h4><p>' + esc(M.challenges[id]) + '</p></div>' : '') +
        '</div></article>';
    }

    /** The tool dictionary: one container with a tab for each tool; the tool chosen is shown in full. */
    function renderDictionary() {
      var cur = ui.dtool && toolIds.indexOf(ui.dtool) !== -1 ? ui.dtool : toolIds[0];
      ui.dtool = cur;
      return '<section class="pb-sec"><h2>Tools dictionary</h2>' +
        '<p class="pb-lead">Before we compare the tools, we get to know them. Choose a tool to read what it is, what it does best and what it costs.</p>' +
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
        '<div class="pb-tablewrap"><table class="pb-table pb-matrix"><caption class="pb-sr">Tool matrix across 14 criteria, ' + cols.length + ' tools shown</caption><thead><tr><th scope="col">Group and criterion</th>' + cols.map(function (id) { return colHead(id); }).join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
        '<p class="pb-fine">A tinted cell leads. In a group row, it is the tool that leads the most of the group’s criteria among the tools shown (tools that tie are all tinted). In a criterion row, it is a tool the deck marks as leading. The one-line summaries in the group rows restate the deck’s own headlines. With three tools or fewer, each cell also gives the deck’s detail line (one, Sigma’s AI, is corrected: its assistant is now called Sigma Assistant). Source: deck, slides 7 and 9. Criteria marked <em>Relevant to your answers</em> are the ones your answers bear on.</p></section>';
    }

    // ------------------------------------------------------------------ FINAL RECOMMENDATION
    function summaryContext() {
      var r = session.result();
      var prog = session.progress();
      var shortlistNames = r.shortlist.map(function (x) { return { name: x.tool.name, rank: x.rank }; });
      var leaders = r.informative ? (r.coLeaders.length > 1 ? r.coLeaders.map(function (t) { return t.name; }) : []) : [];
      var leadTools = r.informative ? (r.coLeaders.length > 1 ? r.coLeaders : [r.shortlist[0].tool]) : [];
      var reasons = leadTools.map(function (t) {
        var ex = session.explain(t.id, 3);
        var fmt = function (x) { return x.text + ' ' + x.answer.map(function (a) { return a.label; }).join(', ') + '.' + (x.why.length ? ' ' + x.why.join(' ') : ''); };
        return { tool: t.name, strengths: ex.strengths.map(fmt), concerns: ex.concerns.map(fmt) };
      });
      var constraints = CONSTRAINT_QS.filter(function (id) { return (session.answers[id] || []).some(function (o) { var q = qOf(id); return q && q.omap[o] && !q.omap[o].unknown; }); })
        .map(function (id) { return qOf(id).text + ' ' + answerText(id); });
      var migration = [];
      var q13 = session.answers.Q13 || [];
      if (r.informative && q13.length && q13.indexOf('no') === -1 && leadTools.length) {
        var to = leadTools[0].id;
        (session.answers.Q14 || []).forEach(function (from) {
          var o = qOf('Q14') && qOf('Q14').omap[from]; if (!o || o.unknown || from === to) return;
          var cell = from === 'excel_other' ? D.migration.grid.excel[to] : D.migration.feasibility[from][to];
          if (cell) migration.push('From ' + (from === 'excel_other' ? 'Excel' : names[from]) + ' to ' + names[to] + ': ' + cell.rating + '.' + ((cell.reasons || cell.notes || []).length ? ' ' + (cell.reasons || cell.notes).join('; ') + '.' : ''));
        });
      }
      var secTitle = {}; SECTIONS.forEach(function (s) { secTitle[s.id] = s.title; });
      var answers = session.visible().filter(function (q) { return q.answered; }).map(function (q) { return { section: secTitle[sectionOf(q)], question: q.text, answer: answerText(q.id), note: store.notes[q.id] || '' }; });
      return {
        date: today(), clientName: ui.clientName, state: r.state, answered: prog.answered, visible: prog.visible, informative: r.informative,
        coLeaders: leaders, shortlist: shortlistNames, leadStrength: r.leadStrength, boundaryMessage: L.boundaryMessage(r),
        excluded: r.excluded.map(function (e) { return { name: e.tool.name, because: '“' + e.because[0].questionText + '” answered “' + e.because[0].optionLabel + '”' }; }),
        reasons: reasons, constraints: constraints, migration: migration, usesDraft: r.usesDraftQuestions, answers: answers
      };
    }
    function renderFinal() {
      var text = L.buildSummary(summaryContext());
      return '<section class="pb-sec"><h2>Final recommendation</h2>' +
        '<p class="pb-lead">A plain-text summary you can copy, print or save: the best fit, the reasons and watch-outs, migration notes, and what to validate next.</p>' +
        '<div class="pb-card" id="pb-summary"><label class="pb-notelabel">Client name (shown on the printout, never saved)<input class="pb-input" data-action="client" value="' + esc(ui.clientName) + '" autocomplete="off"></label>' +
        '<pre class="pb-pre" id="pb-summary-text">' + esc(text) + '</pre></div>' +
        '<p class="pb-actions"><button class="pb-btn" data-action="copy">Copy as text</button> <button class="pb-btn pb-btn-ghost" data-action="print">Print or save as PDF</button> ' +
        '<button class="pb-btn pb-btn-ghost" data-action="download">Download answers</button> <label class="pb-btn pb-btn-ghost pb-file">Restore answers<input type="file" accept="application/json" data-action="restore"></label></p>' +
        '<p class="pb-fine" id="pb-flash" role="status"></p></section>';
    }

    // ------------------------------------------------------------------ REFERENCE
    function renderReference() {
      var R = D.reference;
      var tools = L.sortNames(toolIds.map(function (i) { return names[i]; }));
      var idOf = {}; toolIds.forEach(function (i) { idOf[names[i]] = i; });
      var scen = '<div class="pb-tablewrap"><table class="pb-table"><caption class="pb-sr">Client scenarios</caption><thead><tr><th scope="col">Client scenario</th><th scope="col">Typical starting point</th><th scope="col">Why</th></tr></thead><tbody>' +
        R.scenarios.map(function (s) { return '<tr><th scope="row">' + esc(s.scenario) + '</th><td>' + esc(s.tool) + '</td><td>' + esc(s.why) + '</td></tr>'; }).join('') + '</tbody></table></div><p class="pb-fine">These are starting points. The questionnaire result takes precedence. Source: deck, slide 20.</p>';
      var fast = R.fastPath.slice().sort(function (a, b) { return a.tool.toLowerCase() < b.tool.toLowerCase() ? -1 : 1; });
      var fastT = '<p>Where the client’s main ecosystem points. This is a reference table, not a ranking: a client can fit more than one row, and the questionnaire result takes precedence.</p><div class="pb-tablewrap"><table class="pb-table"><caption class="pb-sr">Fast path by ecosystem</caption><thead><tr><th scope="col">Tool</th><th scope="col">When the client is…</th></tr></thead><tbody>' +
        fast.map(function (f) { return '<tr><th scope="row">' + esc(f.tool) + '</th><td>' + esc(f.condition.replace(/^./, function (c) { return c.toLowerCase(); }).replace(/\?$/, '')) + (f.note ? ' <small>(' + esc(f.note) + ')</small>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div><p class="pb-fine">Source: deck, slide 19 (reorganised: the deck lists these as an ordered stop-at-the-first-Yes tree).</p>';
      var dep = '<p class="pb-fine">Cells marked <em>Corrected</em> differ from the deck and cite the vendor. Every other cell is the deck’s own text.</p><div class="pb-tablewrap"><table class="pb-table"><caption class="pb-sr">Deployment considerations</caption><thead><tr><th scope="col">Consideration</th>' + tools.map(function (t) { return '<th scope="col">' + esc(t) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        R.deployment.map(function (row) {
          return '<tr><th scope="row">' + esc(row.consideration) + '</th>' + tools.map(function (t) {
            var id = idOf[t]; var fix = DEPLOY_FIX[row.consideration] && DEPLOY_FIX[row.consideration][id];
            return '<td>' + (fix ? pill('corr', 'Corrected') + ' ' + esc(fix.text) + ' <a href="' + fix.url + '" rel="noopener" target="_blank">Source</a>' : esc(row.cells[id])) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div><p class="pb-fine">Source: deck, slide 22.</p>';
      var integ = R.integration;
      var itools = integ.tools.map(function (i) { return names[i]; });
      var itoolsSorted = L.sortNames(itools);
      var integT = '<p class="pb-fine">The deck covers four tools here. ' + esc(L.listJoin(L.sortNames(toolIds.filter(function (i) { return integ.tools.indexOf(i) === -1; }).map(function (i) { return names[i]; })))) + ' are not covered yet. The deck’s colour markers contradict its own legend in ' + integ.markerConflicts.length + ' cells, so only the text is shown.</p>' +
        '<div class="pb-tablewrap"><table class="pb-table"><caption class="pb-sr">Technology integration</caption><thead><tr><th scope="col">Platform</th>' + itoolsSorted.map(function (t) { return '<th scope="col">' + esc(t) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        integ.rows.map(function (row) { return '<tr><th scope="row">' + esc(row.platform) + '</th>' + itoolsSorted.map(function (t) { return '<td>' + esc(row.cells[idOf[t]]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div><p class="pb-fine">Source: deck, slide 21.</p>';
      var why = '<div class="pb-card"><p><strong>Pending update.</strong> The deck’s “why these tools” slide was written for four tools and cites Gartner. It must be rewritten for all six, and its Gartner wording re-checked, before it is shown here.</p></div>';
      var sec = function (id, title, body, open) { return '<details class="pb-details pb-ref" id="' + id + '"' + (open ? ' open' : '') + '><summary>' + esc(title) + '</summary>' + body + '</details>'; };
      return '<section class="pb-sec"><details class="pb-details pb-refs"><summary>More reference: scenarios, deployment and integration</summary><p class="pb-lead">Background for anyone who wants more depth. Nothing here changes the recommendation.</p>' +
        sec('ref-patterns', 'Typical client scenarios', scen) + sec('ref-fast', 'Fast path by ecosystem', fastT) + sec('ref-deploy', 'Deployment considerations', dep) +
        sec('ref-integ', 'Technology integration', integT) + sec('ref-why', 'Why these six tools', why) + '</details></section>';
    }
    function scoringHtml() {
      return '<ul class="pb-bullets pb-scoring">' +
        '<li><strong>Where the scores come from.</strong> For most answers, subject-matter experts rated how well each tool fits, from 1 (possible but not ideal) to 4 (strong fit). For the priority questions (dashboard polish, AI, cost, users, talent) the scores were derived from the deck’s heatmap, and for three answers they are proposals; all of these await expert confirmation.</li>' +
        '<li><strong>Why the scores are not simply added up.</strong> Some tools score well on almost everything, so adding scores would put the same tool first whatever the client says. Instead each tool is compared with its own typical score. Only the difference an answer makes counts, so a tool gets no head start for being good in general.</li>' +
        '<li><strong>Stating a requirement.</strong> Questions about priorities (dashboard polish, AI, cost, users, talent, hosting) work the same way: a tool gains when it meets what you stated better than it usually meets such requirements. Answering more of them does not favour broad tools.</li>' +
        '<li><strong>The ranking score.</strong> The differences are weighted by how much each question matters, added up, and divided by how much that tool’s score can swing. A client who tells us nothing sees every tool tied.</li>' +
        '<li><strong>Ties and fairness.</strong> Ties are broken only by your answers (ecosystem fit, then governance and security, then delivery risk and cost) and otherwise shared. A tool never ranks above one that fits at least as well on every answer you gave. List order never matters.</li>' +
        '<li><strong>Ruling a tool out.</strong> Some answers rule a tool out before ranking. Today one does: a client that cannot use a vendor-hosted tool rules out Sigma.</li>' +
        '<li><strong>How sure to be.</strong> The page says whether the lead is clear, narrow or too close to call. Those lines come from simulations of the current weights. Treat the order as provisional until most questions are answered.</li>' +
        '<li><strong>Limits.</strong> The scores and weights are the current set and may be refined as expert review finishes and as the playbook is used. The tool supports judgment; it does not replace a proof of concept.</li>' + '</ul>';
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
      home: function () { return blockHtml('overview') + blockHtml('navigate') + blockHtml('principles') + blockHtml('dictionary') + blockHtml('matrix') + blockHtml('reference') + blockHtml('cta'); },
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
      if (ui.page === 'discovery') return [['disc-about', 'Client discovery'], ['disc-areas', 'Areas we ask about'], ['disc-start', 'Start the questions'], ['sec-reco', 'Recommendation'], ['sec-scoring', 'How it is made']];
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
      var page = PAGE_IDS.indexOf(id) !== -1 ? id : SECTION_PAGE[id];
      if (!page) return;
      var changed = page !== ui.page;
      if (SUBTABS.recommendation.items.some(function (it) { return it[0] === id; }) && ui.rec !== id) { ui.rec = id; changed = true; }
      ui.page = page;
      if (changed) { render(); if (root.scrollTo && !anchor && !ANCHOR[id]) { try { root.scrollTo(0, 0); } catch (e) { /* not available */ } } }
      if (o.onTab) o.onTab(page);
      var target = anchor || ANCHOR[id] || (PAGE_IDS.indexOf(id) === -1 ? 'sec-' + id : null);
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
      clearTimer(); ui.overlay = false; ui.popup = null; ui.menu = false; ui.notice = null; ui.minimized = true; ui.miniFresh = false;
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
    /** Open the questions again where they were left, growing out of the corner window. */
    function resumeDiscovery() {
      var mini = miniHost && miniHost.querySelector ? miniHost.querySelector('.pb-mini-card') : null;
      var from = mini && mini.getBoundingClientRect ? mini.getBoundingClientRect() : null;
      var st = ui.step && stepIndex(steps(), ui.step) >= 0 ? ui.step : firstUnanswered(null);
      ui.minimized = false; ui.page = 'discovery'; ui.overlay = true; ui.opening = !from; ui.popup = null; ui.menu = false; ui.followShown = {}; ui.hold = false;
      if (o.onTab) o.onTab('discovery');
      renderPage(); renderRail(); renderToc(); renderMini();
      setStep({ kind: st.kind, section: st.section, qid: st.qid });
      var ovl = overlayHost && overlayHost.querySelector ? overlayHost.querySelector('.pb-ovl') : null;
      if (from && ovl && ovl.animate && ovl.getBoundingClientRect && !reduceMotion()) {
        var b = ovl.getBoundingClientRect();
        var dx = from.left + from.width / 2 - (b.left + b.width / 2), dy = from.top + from.height / 2 - (b.top + b.height / 2);
        ovl.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + from.width / b.width + ',' + from.height / b.height + ')', opacity: 0, borderRadius: '90px' }, { opacity: 1, offset: .35 }, { transform: 'none', opacity: 1, borderRadius: '28px' }],
          { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      }
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

    function clearTimer() { if (ui.timer && ui.timer.h && root.clearTimeout) root.clearTimeout(ui.timer.h); ui.timer = null; }
    function startTimer(kind, secs, fn) {
      clearTimer();
      ui.timer = { kind: kind, secs: secs, started: Date.now(), h: root.setTimeout ? root.setTimeout(function () { ui.timer = null; fn(); }, secs * 1000) : null };
    }
    /** After a click on an answer: if this question (and any follow-ups it opened) is answered, move on after QUESTION_SECONDS without another click. */
    function armQuestionTimer() {
      var st = ui.step, q = st && st.kind === 'q' ? session.visible().filter(function (v) { return v.id === st.qid; })[0] : null;
      var ready = q && q.answered && !childrenOf(q.id).some(function (c) { return !c.answered; });
      if (!ui.overlay || !ready || ui.hold) { clearTimer(); return; }
      startTimer('q', QUESTION_SECONDS, function () { move(1); });
    }
    function afterStep() {
      ui.hold = false;
      var st = ui.step;
      if (st && st.kind === 'done') startTimer('done', SECTION_SECONDS, function () { move(1); });
      else if (st && st.kind === 'end') { if (lockedNow()) clearTimer(); else startTimer('done', session.result().informative ? WINNER_SECONDS : SECTION_SECONDS, function () { finish(); }); }
      else clearTimer();
    }

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
      ui.step = st; ui.animate = true; ui.followShown = {}; ui.popup = null; ui.winnerAway = false;
      afterStep();            // starts the countdown on the "complete" cards first, so the first drawing already shows it
      renderOverlay();
    }
    /** Move one step with a short fade. Moving past the final card opens the recommendation. */
    function move(dir) {
      var list = steps(), idx = stepIndex(list, ui.step);
      var to = list[idx + dir];
      if (!to) { if (dir > 0) finish(); return; }
      clearTimer();
      var host = overlayHost, card = host && host.querySelector ? host.querySelector('.pb-card-q') : null;
      var apply = function () { if (ui.overlay) setStep({ kind: to.kind, section: to.section, qid: to.qid }); };
      if (card && root.setTimeout && !reduceMotion()) { card.classList.add('is-leaving'); root.setTimeout(apply, 170); } else apply();
    }
    /** Jump straight to a question (or to the question a follow-up belongs to), from the drawer. */
    function jumpTo(qid, sectionId) {
      var list = steps(), st;
      if (qid) { var q = qOf(qid), top = q && parentOf(q) ? parentOf(q) : qid; st = list.filter(function (s) { return s.kind === 'q' && s.qid === top; })[0]; }
      else st = list.filter(function (s) { return s.kind === 'q' && s.section === sectionId; })[0];
      if (!st) return;
      clearTimer(); ui.menu = false;
      setStep({ kind: 'q', section: st.section, qid: st.qid });
    }
    function firstUnanswered(sectionId) {
      var list = steps().filter(function (s) { return s.kind === 'q' && (!sectionId || s.section === sectionId); });
      var vis = session.visible();
      var open = list.filter(function (s) { var q = vis.filter(function (v) { return v.id === s.qid; })[0]; return q && (!q.answered || childrenOf(q.id).some(function (c) { return !c.answered; })); })[0];
      return open || list[0];
    }
    /** Open the carousel: no argument = the first unanswered question; a section number = that area; a question id = that question. */
    function openDiscovery(arg) {
      var list = steps(), st;
      if (arg && /^Q\d+$/.test(arg)) {
        var q = qOf(arg), pid = q ? parentOf(q) : null, top = pid || arg;
        st = list.filter(function (s) { return s.kind === 'q' && s.qid === top; })[0];
      } else st = firstUnanswered(arg || null);
      if (!st) return;
      ui.page = 'discovery'; ui.overlay = true; ui.opening = true; ui.menu = false; ui.minimized = false; ui.popup = null; ui.followShown = {}; ui.hold = false;
      if (o.onTab) o.onTab('discovery');
      renderPage(); renderRail(); renderToc();
      setStep({ kind: 'q', section: st.section, qid: st.qid });
    }
    function closeDiscovery() {
      var p = session.progress();
      if (ui.overlay && p.visible > 0 && p.remaining > 0) { minimize(); return; }      // unfinished: it shrinks into the corner and waits
      clearTimer(); ui.overlay = false; ui.popup = null; ui.notice = null; ui.minimized = false;
      renderOverlay(); renderPage(); renderRail(); renderToc(); renderMini();
    }
    function finish() {
      if (lockedNow()) return;
      var flights = captureFlights();
      closeDiscovery(); go('recommendation', null, true);
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
    var RENDER = { dictionary: renderDictionary, overview: renderOverview, navigate: renderNavigate, principles: renderPrinciples, scoring: renderScoring, cta: renderCta, matrix: renderMatrix, discovery: renderDiscovery, shortlist: renderShortlist, migration: renderMigration, final: renderFinal, reference: renderReference };
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
      ui.hold = false;
      armQuestionTimer();
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
    function download() {
      var blob = new root.Blob([JSON.stringify({ app: 'bi-playbook', version: 1, answers: session.answers, notes: store.notes }, null, 2)], { type: 'application/json' });
      var a = doc().createElement('a'); a.href = root.URL.createObjectURL(blob); a.download = 'bi-playbook-answers.json'; a.click(); root.URL.revokeObjectURL(a.href);
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
          var rd = new root.FileReader();
          rd.onload = function () { try { var d = JSON.parse(rd.result); buildSession(d.answers || {}); store.notes = d.notes || store.notes; persist(); ui.notice = null; render(); flash('Answers restored.'); } catch (err) { flash('That file could not be read.'); } };
          rd.readAsText(t.files[0]);
        }
      });
      host.addEventListener('input', function (e) {
        var t = e.target;
        if (t.matches && t.matches('textarea[data-note]')) { store.notes[t.getAttribute('data-note')] = t.value; if (!t.value) delete store.notes[t.getAttribute('data-note')]; saveStore(); clearTimer(); ui.hold = true; }
        else if (t.getAttribute && t.getAttribute('data-action') === 'client') { ui.clientName = t.value; var pre = o.container.querySelector('#pb-summary-text'); if (pre) pre.textContent = L.buildSummary(summaryContext()); }
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
        else if (act === 'menu') { ui.menu = !ui.menu; ui.popup = null; clearTimer(); ui.hold = true; renderOverlay(); }
        else if (act === 'menuclose') { ui.menu = false; renderOverlay(); }
        else if (act === 'jump') jumpTo(b.getAttribute('data-qid'), null);
        else if (act === 'jumpsec') jumpTo(null, b.getAttribute('data-section'));
        else if (act === 'prev') move(-1);
        else if (act === 'next') move(1);
        else if (act === 'finish') finish();
        else if (act === 'resume') resumeDiscovery();
        else if (act === 'tool') { ui.popup = ui.popup === b.getAttribute('data-tool') ? null : b.getAttribute('data-tool'); renderOverlay(); }
        else if (act === 'poptool') { ui.popup = b.getAttribute('data-tool'); renderOverlay(); }
        else if (act === 'popclose') { ui.popup = null; renderOverlay(); }
        else if (act === 'clear') applyAnswer(b.getAttribute('data-qid'), []);
        else if (act === 'note') { var id = b.getAttribute('data-qid'); ui.openNotes[id] = !(ui.openNotes[id] || store.notes[id]); clearTimer(); ui.hold = true; refresh(); var ta = host.querySelector('textarea[data-note="' + id + '"]'); if (ta) ta.focus({ preventScroll: true }); }
        else if (act === 'undo') { if (ui.notice && ui.notice.undo) { var prev = ui.notice.undo; ui.notice = null; buildSession(prev); persist(); refresh(); } }
        else if (act === 'dismiss') { ui.notice = null; refresh(); }
        else if (act === 'copy') copy();
        else if (act === 'print') { var html = doc().documentElement; html.setAttribute('data-print', 'summary'); root.print(); html.removeAttribute('data-print'); }
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
        var typing = t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && t.type !== 'button');
        if (!typing && (k === 'ArrowLeft' || k === 'ArrowRight')) { move(k === 'ArrowRight' ? 1 : -1); e.preventDefault && e.preventDefault(); }
      });
      // any click or key in the carousel counts as an interaction: a pending auto-advance is cancelled and re-armed by the answer itself
    }
    wire(o.container, false);
    if (overlayHost) wire(overlayHost, true);
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
      knows: function (id) { return PAGE_IDS.indexOf(id) !== -1 || !!SECTION_PAGE[id]; },
      /** Programmatic equivalent of picking answers in the page (used by tests and by anything embedding the module). */
      answer: function (qid, optionIds) { applyAnswer(qid, optionIds); },
      /** What a double-click on an answer does: take that answer out of the selection (a single answer becomes unanswered). */
      clearOption: function (qid, optionId) { clearOption(qid, optionId); },
      setNote: function (qid, text) { if (text) store.notes[qid] = text; else delete store.notes[qid]; saveStore(); },
      session: function () { return session; },
      /** The question carousel: open (no argument, a section number or a question id), move, close, inspect. */
      openDiscovery: function (arg) { openDiscovery(arg); },
      closeDiscovery: function () { closeDiscovery(); },
      move: function (dir) { move(dir); },
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
        clearTimer(); ui.overlay = false; ui.popup = null; ui.menu = false; ui.minimized = false;
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
