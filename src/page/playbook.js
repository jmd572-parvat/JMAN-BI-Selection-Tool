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

  var TABS = [
    { id: 'overview', label: 'Overview' }, { id: 'purpose', label: 'Purpose' }, { id: 'principles', label: 'Guiding principles' },
    { id: 'discovery', label: 'Client discovery' }, { id: 'shortlist', label: 'Shortlist' }, { id: 'migration', label: 'Migration analysis' },
    { id: 'tools', label: 'Tool details' }, { id: 'final', label: 'Final recommendation' }, { id: 'reference', label: 'Reference' }
  ];

  var SECTIONS = [
    { id: '1', title: 'Business context and goals', blurb: 'What the client wants from BI, who uses it, which ecosystem they live in, and what matters most: polish, AI, cost, number of users.' },
    { id: '2', title: 'Data, security and governance', blurb: 'Compliance, security and access, whether a vendor-hosted tool is acceptable, semantic layer, governance maturity, AI governance.' },
    { id: '3', title: 'Skills and change readiness', blurb: 'Who builds the reports, their skill, how much training the client can support, talent availability.' },
    { id: '4', title: 'Existing reporting', blurb: 'Whether the client has BI today, which tools, how much.' },
    { id: '5', title: 'Data landscape and delivery', blurb: 'Data estate, complexity of existing content, refresh and performance, embedded or external reporting, migration constraints.' }
  ];
  function sectionOf(q) {
    if (q.section === 'S1') return '1';
    if (q.section === 'S2') return '2';
    if (q.section === 'S3') return '3';
    return ['Q13', 'Q14', 'Q15'].indexOf(q.id) !== -1 ? '4' : '5';
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

  function today() { return new Date().toISOString().slice(0, 10); }

  /**
   * @param {{container: Element, rail: Element, toc?: Element, model: object, deck: object, config?: object, onTab?: Function}} o
   */
  function mount(o) {
    var config = o.config || {};
    var D = o.deck;
    var fullModel = o.model;
    var storageKey = config.storageKey || 'bi-playbook-v1';
    var preview = !!config.preview;
    var showDrafts = config.showDrafts !== false;
    var names = {};
    fullModel.tools.forEach(function (t) { names[t.id] = t.name; });
    var toolIds = fullModel.tools.map(function (t) { return t.id; });   // alphabetical (the converter writes them that way)
    var profileOf = {};
    D.profiles.tools.forEach(function (p) { profileOf[p.id] = p; });

    var store = loadStore();
    var model, session;
    var ui = { tab: 'overview', notice: null, openNotes: {}, compare: { a: null, b: '__all__' }, toolTab: null, clientName: '' };

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
    function previewTag(text) { return preview ? ' <span class="pb-tag pb-tag-preview" title="Preview only">' + esc(text) + '</span>' : ''; }

    // ------------------------------------------------------------------ OVERVIEW
    function renderOverview() {
      return '<section class="pb-sec"><h2>BI Tools Selection Playbook</h2>' +
        '<h3>Start here</h3><ol class="pb-start">' +
        startCard(1, 'Playbook Purpose', 'A short read.', 'purpose') + startCard(2, 'General Guiding Principles', 'A short read.', 'principles') +
        startCard(3, 'Client Requirement Discovery', 'Questions with preset answers.', 'discovery') + '</ol>' +
        '<h3>How the recommendation flow works</h3>' +
        '<ol class="pb-flow">' +
        flowCard(1, 'Playbook purpose', 'Guide consistent BI tool selection. Support sales and delivery decisions.') +
        flowCard(2, 'Guiding principles', 'Business problem first. Client-specific, evidence-led decisions.') +
        flowCard(3, 'Client discovery', 'Apply weighted questions across business, governance and readiness.') +
        flowCard(4, 'Top 3 shortlist', 'Rank all six tools. Deep-dive the three highest scores.') + '</ol>' +
        '<div class="pb-decision"><div class="pb-decision-q"><strong>Existing BI tool and migration required?</strong></div>' +
        '<div class="pb-branches"><div class="pb-card pb-branch"><span class="pb-tag">Yes</span><h4>Migration analysis</h4><p>Assess data model and dashboard rebuild, historical content and parallel run, retraining, cutover and migration risk.</p></div>' +
        '<div class="pb-card pb-branch"><span class="pb-tag">No</span><h4>Use discovery result</h4><p>Retain the top-ranked recommendation from the weighted assessment.</p></div></div>' +
        '<div class="pb-final-bar">BI tool finalisation: best-fit recommendation</div></div>' +
        '<div class="pb-card"><h4>Decision inputs</h4><ul class="pb-chips"><li>Business fit</li><li>Governance fit</li><li>Technology fit</li><li>Commercial fit</li></ul></div>' +
        '<p class="pb-note"><em>The shortlist is a starting point. Migration effort only changes the answer when the cost, risk or lost investment outweighs the incremental fit.</em> ' +
        'In this tool, migration effort is shown next to the fit. You weigh it; it does not change the ranking on its own.' + previewTag('Proposed') + '</p>' +
        '<p><button class="pb-btn" data-action="go" data-tab="discovery">Start client discovery</button></p></section>';
    }
    function startCard(n, title, sub, tab) {
      return '<li><button class="pb-card pb-startcard" data-action="go" data-tab="' + tab + '"><span class="pb-num">' + n + '</span><span><strong>' + esc(title) + '</strong><br><small>' + esc(sub) + '</small></span></button></li>';
    }
    function flowCard(n, title, text) {
      return '<li class="pb-card pb-flowcard"><span class="pb-num">' + n + '</span><h4>' + esc(title) + '</h4><p>' + esc(text) + '</p></li>';
    }

    // ------------------------------------------------------------------ PURPOSE
    function renderPurpose() {
      return '<section class="pb-sec"><h2>Purpose <span class="pb-badge">Internal purposes only</span></h2>' +
        '<p class="pb-lead">A guide for BI tool selection, helping delivery teams choose and justify the right platform for each client engagement.</p>' +
        '<div class="pb-grid2">' +
        card('Audience: who should use this', 'Sales, pre-sales and delivery teams scoping or pitching a BI implementation. It is written for the consultant making the recommendation, not for the client to read end to end.') +
        card('When to use it', 'During discovery and solution design, before a tool is shortlisted and before scope or pricing is finalised. Revisit it at renewal, expansion or migration conversations.') +
        card('What decisions it supports', 'Which BI tool or tools to shortlist or recommend for a specific client, and how to justify that recommendation with a clear, criteria-based comparison rather than a sales pitch.') +
        card('What it does not replace', 'A hands-on technical proof of concept, a licensing or contract negotiation, or a formal RFP response. It is a starting point for judgment, not a substitute for it.') + '</div>' +
        '<div class="pb-callout"><strong>Platform facts and pricing.</strong> Feature sets and pricing change frequently. Verify current details before quoting a client, and flag anything you find out of date.</div></section>';
    }
    function card(title, text) { return '<div class="pb-card"><h4>' + esc(title) + '</h4><p>' + esc(text) + '</p></div>'; }

    // ------------------------------------------------------------------ PRINCIPLES
    function renderPrinciples() {
      var dos = ['Start with the business problem, not the preferred technology.', 'Assess the client’s existing ecosystem before recommending change.',
        'Separate mandatory requirements from preferences.', 'Validate vendor product claims against the client’s actual requirements.',
        'Use a proof of concept for high-risk assumptions.', 'Document trade-offs and the rationale behind the decision.'];
      var li = function (t) { return '<li>' + esc(t) + '</li>'; };
      return '<section class="pb-sec"><h2>Guiding principles</h2>' +
        '<p class="pb-lead">The mindset behind every recommendation in this playbook. Read this before the discovery questions.</p>' +
        '<div class="pb-grid2"><div class="pb-card pb-do"><h4><span aria-hidden="true">✓</span> Do</h4><ul>' + dos.map(li).join('') + '</ul></div>' +
        '<div class="pb-card pb-dont"><h4><span aria-hidden="true">✗</span> Don’t</h4><ul>' +
        li('Avoid declaring a universal “best BI tool.” The right answer is always client-specific.') +
        '<li>Don’t hand the questions or the result to the client to read end to end. They are internal working material.' + previewTag('Proposed: owner to confirm') + '</li>' +
        '<li>Don’t quote pricing or feature claims without checking they are current.' + previewTag('Proposed: owner to confirm') + '</li></ul></div></div>' +
        '<div class="pb-card pb-neutral"><h4>How this tool keeps the recommendation neutral</h4>' +
        '<p>The ranking comes only from the answers you give. Each tool is measured against a neutral starting point on every question, so a tool that scores well everywhere gains no automatic advantage. ' +
        'Ties are broken by your answers and otherwise shared, never by list order. Tools are always listed by rank, then alphabetically. The principle above applies to the tool too: it never declares a universal best.</p>' +
        '<p><button class="pb-link" data-action="go" data-tab="reference" data-anchor="ref-scoring">How scoring works</button></p></div></section>';
    }

    // ------------------------------------------------------------------ DISCOVERY
    function visibleBySection() {
      var by = {};
      session.visible().forEach(function (q) { (by[sectionOf(q)] = by[sectionOf(q)] || []).push(q); });
      return by;
    }
    function counts(qs) { return { done: (qs || []).filter(function (q) { return q.answered; }).length, total: (qs || []).length }; }

    function renderDiscovery() {
      var by = visibleBySection();
      var all = session.visible();
      var idx = {};
      all.forEach(function (q, i) { idx[q.id] = i + 1; });
      var jump = SECTIONS.map(function (s) {
        var c = counts(by[s.id]);
        var done = c.total > 0 && c.done === c.total;
        return '<li><button class="pb-chev' + (done ? ' is-done' : '') + '" data-action="section" data-section="' + s.id + '"><span class="pb-chev-n">' + (done ? '✓' : s.id) + '</span><span class="pb-chev-t">' + esc(s.title) + '</span>' +
          (c.total ? '<span class="pb-chev-c">' + c.done + '/' + c.total + '</span>' : '') + '</button></li>';
      }).join('');
      var sections = SECTIONS.map(function (s) {
        var qs = by[s.id] || [];
        var c = counts(qs);
        var pct = c.total ? Math.round(c.done / c.total * 100) : 0;
        return '<section class="pb-dsec" id="disc-' + s.id + '" aria-labelledby="disc-h-' + s.id + '"><header class="pb-dhead"><span class="pb-dnum" aria-hidden="true">' + s.id + '</span>' +
          '<div class="pb-dtitle"><h3 id="disc-h-' + s.id + '">' + esc(s.title) + '</h3><p class="pb-blurb">' + esc(s.blurb) + '</p></div>' +
          (c.total ? '<div class="pb-dcount"><strong>' + c.done + ' of ' + c.total + '</strong> answered<span class="pb-minibar" aria-hidden="true"><span style="width:' + pct + '%"></span></span></div>' : '') + '</header>' +
          (qs.length ? qs.map(function (q) { return questionCard(q, idx[q.id], all.length); }).join('') : '<p class="pb-empty">No questions here yet. They appear when earlier answers call for them.</p>') + '</section>';
      }).join('');
      var notice = '';
      if (ui.notice) {
        notice = '<div class="pb-notice" role="status"><span>' + esc(ui.notice.text) + '</span> ' +
          (ui.notice.undo ? '<button class="pb-link" data-action="undo">Undo</button> ' : '') + '<button class="pb-link" data-action="dismiss">Dismiss</button></div>';
      }
      var step = function (n, t, x) { return '<li><span class="pb-num">' + n + '</span><div><strong>' + t + '</strong><p>' + x + '</p></div></li>'; };
      return '<section class="pb-sec"><h2>Client discovery</h2>' +
        '<p class="pb-lead">For internal use during discovery calls and account planning, not a document to hand to the client. Ask these to understand the client well enough to compare the tools fairly.</p>' +
        '<ol class="pb-steps3">' + step(1, 'Ask', 'Work through the questions with the client, or from what you already know about the account.') +
        step(2, 'Review', 'Check your answers and what is still open in the panel on the right, and see the shortlist update below.') +
        step(3, 'Decide', 'Use the ranking, the lead strength and the reasons. Where it is close, run a proof of concept.') + '</ol>' +
        (preview ? '<p class="pb-fine">' + previewTag('Proposed') + ' The one-line guidance under each question is proposed wording, awaiting owner review.</p>' : '') +
        (showDrafts && model.questions.some(function (q) { return q.status === 'draft'; }) ? '<div class="pb-banner pb-banner-draft">Questions tagged <strong>Draft</strong> have scores that are awaiting review.</div>' : '') +
        '<ol class="pb-chevs" aria-label="Jump to a question section">' + jump + '</ol>' + sections +
        '<p class="pb-nav"><button class="pb-btn" data-action="go" data-tab="shortlist">See the shortlist</button></p>' + notice + '</section>';
    }

    function optionTile(q, opt, type, checked) {
      var parts = L.splitLabel(opt.label);
      return '<label class="pb-opt' + (opt.unknown ? ' pb-quiet' : '') + '"><input type="' + type + '" name="a-' + q.id + '" id="o-' + q.id + '-' + opt.id + '" data-qid="' + q.id + '" value="' + esc(opt.id) + '"' + (checked ? ' checked' : '') + '>' +
        '<span class="pb-tile"><span class="pb-mark" aria-hidden="true"></span><span class="pb-opt-label"><span class="pb-opt-title' + (parts.detail ? ' has-sub' : '') + '">' + esc(parts.title) + '</span>' +
        (parts.detail ? '<span class="pb-opt-sub">' + esc(parts.detail) + '</span>' : '') + (opt.unknown ? '<span class="pb-opt-flag">Not scored</span>' : '') + '</span></span></label>';
    }

    function questionCard(q, n, total) {
      var full = qOf(q.id);
      var opts = L.orderOptions(full);
      var multi = q.type === 'multi';
      var type = multi ? 'checkbox' : 'radio';
      var scored = opts.filter(function (x) { return !x.unknown; }).length;
      var layout = L.optionLayout(scored);
      var hasUnknown = opts.some(function (x) { return x.unknown; });
      var guide = GUIDE[q.id], help = HELP[q.id];
      var note = store.notes[q.id] || '';
      var noteOpen = ui.openNotes[q.id] || !!note;
      return '<fieldset class="pb-q' + (q.answered ? ' is-answered' : '') + '" id="q-' + q.id + '" data-qid="' + q.id + '">' +
        '<legend><span class="pb-qkicker"><span class="pb-qno">Question ' + n + ' of ' + total + '</span>' +
        (q.status === 'draft' ? '<span class="pb-tag pb-tag-draft" title="Scores for this question are awaiting review">Draft</span>' : '') +
        '<span class="pb-qkind">' + (multi ? 'Choose all that apply' : 'Choose one') + '</span></span>' +
        '<span class="pb-qtext">' + esc(q.text) + '</span></legend>' +
        '<div class="pb-qbody">' + (guide ? '<p class="pb-help">' + esc(guide) + '</p>' : '') + (help ? '<p class="pb-help pb-help-note">' + esc(help) + '</p>' : '') +
        '<div class="pb-options pb-opts-' + layout + '" style="--n:' + scored + '">' +
        opts.map(function (opt) { return optionTile(q, opt, type, q.answer.indexOf(opt.id) !== -1); }).join('') + '</div>' +
        (hasUnknown ? '<p class="pb-fine pb-fine-tight">Answers marked “Not scored” do not help or hurt any tool.</p>' : '') +
        '<div class="pb-qfoot">' + (q.answered ? '<button class="pb-link" data-action="clear" data-qid="' + q.id + '">Clear answer</button>' : '') +
        '<button class="pb-link" data-action="note" data-qid="' + q.id + '" aria-expanded="' + (noteOpen ? 'true' : 'false') + '">' + (noteOpen ? 'Hide note' : '+ Add a note for this client') + '</button></div>' +
        (noteOpen ? '<label class="pb-notelabel">Note (kept on this device, included in the summary)<textarea class="pb-note-in" data-note="' + q.id + '" rows="2">' + esc(note) + '</textarea></label>' : '') +
        '</div></fieldset>';
    }

    // ------------------------------------------------------------------ SHORTLIST
    function shortlistRows(r) { return r.shortlist.slice(); }

    function reasonHtml(row) {
      var tier = L.fitTier(row.absoluteFit);
      return '<li>' + pill('tier-' + tier.key, tier.label) + ' <strong>' + esc(row.answer.map(function (a) { return a.label; }).join(', ')) + '</strong> ' +
        '<span class="pb-qsmall">in answer to “' + esc(row.text) + '”</span>' +
        (row.why.length ? '<br><span class="pb-why">' + esc(row.why.join(' ')) + '</span>' : '') + '</li>';
    }

    function toolCard(r, row) {
      var id = row.tool.id;
      var ex = session.explain(id, 3);
      var bar = L.barGeometry(row.z);
      var below = r.adjustedByDominance.filter(function (a) { return a.tool === id; })[0];
      var rankLabel = row.tied ? '=' + row.rank : String(row.rank);
      return '<article class="pb-card pb-tool" data-tool="' + id + '"><header><span class="pb-rank" aria-label="Rank ' + rankLabel + '">' + rankLabel + '</span><h3>' + esc(row.tool.name) + '</h3></header>' +
        '<div class="pb-fit"><div class="pb-fitbar" role="img" aria-label="Relative fit: ' + (bar.side === 'right' ? 'above' : bar.side === 'left' ? 'below' : 'at') + ' the neutral starting point"><span class="pb-fitmid"></span>' +
        (bar.side !== 'none' ? '<span class="pb-fitfill ' + bar.side + '" style="width:' + bar.pct + '%"></span>' : '') + '</div>' +
        '<p class="pb-fitcap">Relative fit. Compared with a neutral starting point.</p></div>' +
        '<h4>Strongest reasons</h4><p class="pb-fine">Answers that count in this tool’s favour. The word shows how well it fits that answer on its own.</p>' + (ex.strengths.length ? '<ul class="pb-reasons">' + ex.strengths.map(reasonHtml).join('') + '</ul>' : '<p class="pb-fine">No answer favours this tool yet.</p>') +
        '<h4>Watch-outs</h4><p class="pb-fine">Answers that count against this tool, even where it still fits reasonably.</p>' + (ex.concerns.length ? '<ul class="pb-reasons">' + ex.concerns.map(reasonHtml).join('') + '</ul>' : '<p class="pb-fine">No answer holds this tool back yet.</p>') +
        (below ? '<p class="pb-ranknote">Ranked below ' + esc(listTools(below.rankedBelow)) + ' because ' + (below.rankedBelow.length > 1 ? 'each fits' : esc(names[below.rankedBelow[0]]) + ' fits') + ' at least as well on every answer you gave.</p>' : '') +
        '<details class="pb-details"><summary>Details</summary><p>Fit index (the engine’s z): <strong>' + row.z.toFixed(2) + '</strong>. Weighted average fit on your answers: <strong>' + (row.absoluteFit * 4).toFixed(2) + '</strong> of 4. ' +
        'The fit index ranks the tools; the average is supporting evidence only.</p></details></article>';
    }

    function renderShortlist() {
      var r = session.result();
      var prog = session.progress();
      var head = '<section class="pb-sec"><h2>Top 3 shortlist</h2><p class="pb-lead">Based on your answers, here is how the six tools compare for this client.</p>';
      if (!r.informative) {
        var open = session.openQuestions().slice(0, 6);
        return head + '<div class="pb-card"><p><strong>Answer a few questions to see how the tools compare.</strong></p>' + openList(open) + '<p><button class="pb-btn" data-action="go" data-tab="discovery">Go to client discovery</button></p></div></section>';
      }
      var tag = '<span class="pb-state pb-state-' + r.state + '">' + esc(L.STATE_LABEL[r.state]) + '</span>';
      var scale = { tooClose: 0, narrow: 1, clear: 2 }[r.leadStrength];
      var steps = ['Too close to call', 'Narrow lead', 'Clear lead'].map(function (t, i) { return '<li' + (i === scale ? ' class="on" aria-current="true"' : '') + '>' + t + '</li>'; }).join('');
      var rows = shortlistRows(r);
      var boundary = L.boundaryMessage(r);
      var out = head + '<div class="pb-statusline">' + tag + ' <span>' + esc(L.stateLine(r.state, prog.answered, prog.visible)) + '</span></div>' +
        '<div aria-live="polite" class="pb-live"><p class="pb-leadsentence">' + esc(L.leadSentence(r, names)) + '</p>' + (boundary ? '<p class="pb-boundary">' + esc(boundary) + '</p>' : '') + '</div>' +
        (r.usesDraftQuestions.length ? '<div class="pb-banner pb-banner-draft">This result uses draft questions (' + esc(r.usesDraftQuestions.join(', ')) + '). Their scores are awaiting review.</div>' : '') +
        '<div class="pb-tools">' + rows.map(function (row) { return toolCard(r, row); }).join('') + '</div>' +
        '<ol class="pb-scale" aria-label="Lead strength">' + steps + '</ol>';
      if (r.excluded.length) {
        out += '<h3>Ruled out by your answers</h3>' + r.excluded.map(function (e) {
          var dep = deploymentFacts(e.tool.id);
          return '<div class="pb-card pb-out"><h4>' + esc(e.tool.name) + '</h4>' + (dep ? '<p>' + esc(dep) + '</p>' : '') + e.because.map(function (b) {
            return '<p>“' + esc(b.questionText) + '” is answered “' + esc(b.optionLabel) + '”.' + (b.rationale ? '<br><span class="pb-why">' + esc(b.rationale) + '</span>' : '') + '</p>';
          }).join('') + '</div>';
        }).join('');
      }
      var others = r.ranking.filter(function (x) { return x.rank > 3; });
      if (others.length) {
        out += '<details class="pb-details pb-others"><summary>Other tools (' + others.length + ')</summary><ul>' + others.map(function (x) {
          var c = session.explain(x.tool.id, 1).concerns[0];
          return '<li><strong>' + esc(x.tool.name) + '</strong> <small>rank ' + x.rank + '</small>' + (c ? ': ' + esc(c.text + ' ' + c.answer.map(function (a) { return a.label; }).join(', ')) : '') + '</li>';
        }).join('') + '</ul></details>';
      }
      out += '<div class="pb-banner">Verify current platform details and pricing before quoting a client.</div>' +
        '<p class="pb-actions"><button class="pb-btn pb-btn-ghost" data-action="go" data-tab="discovery">Review answers</button> <button class="pb-btn pb-btn-ghost" data-action="go" data-tab="tools">Compare tools</button> ' +
        '<button class="pb-btn" data-action="go" data-tab="final">Copy summary</button> <button class="pb-btn pb-btn-ghost" data-action="reset">Start over</button></p></section>';
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
      var out = head + '<p class="pb-lead">Basic effort rating (Low, Medium, High) across six migration dimensions. Use this to scope the effort, not just to pick the destination tool.</p>' +
        '<p class="pb-note">Migration feasibility already shapes the ranking through the “tools in use” answer. This section explains it and adds effort detail; it is never counted twice.</p>';
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

    function renderTools() {
      var r = session.result();
      var head = '<section class="pb-sec"><h2>The tools on your shortlist</h2><p class="pb-lead">A closer look at each tool on your shortlist, in rank order. Equal ranks are shown alphabetically.</p>';
      var shortlist = r.informative ? r.shortlist.map(function (x) { return x.tool.id; }) : [];
      var out = head;
      if (!shortlist.length) {
        out += '<div class="pb-card"><p>The tools on your shortlist appear here once you have answered enough questions. You can still compare any tools below.</p></div>';
      } else {
        if (!ui.toolTab || shortlist.indexOf(ui.toolTab) === -1) ui.toolTab = shortlist[0];
        out += '<div class="pb-tabs2" role="tablist">' + shortlist.map(function (id) {
          return '<button role="tab" class="pb-tab2' + (id === ui.toolTab ? ' on' : '') + '" aria-selected="' + (id === ui.toolTab ? 'true' : 'false') + '" id="tt-' + id + '" data-action="tooltab" data-tool="' + id + '">' + esc(names[id]) + '</button>';
        }).join('') + '</div>' + profileHtml(ui.toolTab);
      }
      out += '<h3 id="compare">Compare tools</h3>' + compareHtml(shortlist) + '</section>';
      return out;
    }
    function ul(items) { return '<ul>' + items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; }
    function profileHtml(id) {
      var p = profileOf[id];
      var parts = [['Typical features', p.typicalFeatures], ['Unique features', p.uniqueFeatures], ['Benefits', p.benefits], ['AI capabilities', p.aiCapabilities], ['Cost tier', p.costTier]];
      return '<div class="pb-profile" role="tabpanel"><p>' + esc(p.intro) + '</p><div class="pb-grid2">' +
        parts.map(function (x) {
          if (!x[1].length) return '<div class="pb-card pb-withheld"><h4>' + x[0] + '</h4><p class="pb-fine">Not shown yet. The source slide repeats another tool’s list and is awaiting correction.</p></div>';
          return '<div class="pb-card"><h4>' + x[0] + '</h4>' + ul(x[1]) + '</div>';
        }).join('') + '</div><p class="pb-bestsuited"><strong>Best suited for:</strong> ' + esc(p.bestSuited.replace(/^.*? is best suited for /i, '').replace(/^\w/, function (c) { return c.toUpperCase(); })) + '</p>' +
        '<p class="pb-fine">Source: deck, ' + esc(p.source) + '. A last-verified date has not been recorded yet: verify current details before quoting a client.</p></div>';
    }
    function compareHtml(shortlist) {
      var a = ui.compare.a || shortlist[0] || toolIds[0];
      ui.compare.a = a;
      var b = ui.compare.b;
      var opt = function (id, sel) { return '<option value="' + id + '"' + (id === sel ? ' selected' : '') + '>' + esc(names[id]) + '</option>'; };
      var cols = b === '__all__' ? toolIds.slice() : L.sortNames([a, b].map(function (i) { return names[i]; })).map(function (n) { return toolIds.filter(function (i) { return names[i] === n; })[0]; });
      var groups = D.matrix.groups;
      var rows = [];
      groups.forEach(function (g) { g.criteria.forEach(function (c) { rows.push({ group: g.name, c: c, rel: relevantCriterion(c.name) }); }); });
      rows.sort(function (x, y) { return (y.rel ? 1 : 0) - (x.rel ? 1 : 0); });          // stable: relevant first, deck order kept inside
      var anyRel = rows.some(function (x) { return x.rel; });
      return '<div class="pb-pickers"><label>Tool <select id="cmp-a" data-action="cmp-a">' + toolIds.map(function (i) { return opt(i, a); }).join('') + '</select></label>' +
        '<label>against <select id="cmp-b" data-action="cmp-b"><option value="__all__"' + (b === '__all__' ? ' selected' : '') + '>all the other tools</option>' + toolIds.filter(function (i) { return i !== a; }).map(function (i) { return opt(i, b); }).join('') + '</select></label></div>' +
        (anyRel ? '<p class="pb-fine">Criteria marked <em>Relevant to your answers</em> come first.</p>' : '') +
        '<div class="pb-tablewrap"><table class="pb-table pb-matrix"><caption class="pb-sr">Tool comparison across 14 criteria</caption><thead><tr><th scope="col">Criterion</th>' + cols.map(function (id) { return '<th scope="col"' + (id === a ? ' class="sel"' : '') + '>' + esc(names[id]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rows.map(function (x) {
          return '<tr><th scope="row"><small>' + esc(x.group) + '</small><br>' + esc(x.c.name) + (x.rel ? '<br>' + pill('rel', 'Relevant to your answers') : '') + '</th>' + cols.map(function (id) {
            var cell = x.c.cells[id];
            return '<td' + (id === a ? ' class="sel"' : '') + '><strong>' + esc(cell.headline) + '</strong>' + (cell.detail ? '<br>' + esc(cell.detail) : '') + (cell.leads ? '<br>' + pill('leads', 'Leads (deck)') : '') + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div><p class="pb-fine">Source: deck, slides 7 and 9. “Leads (deck)” is the deck’s own marker; ties are marked on every tied tool.</p>';
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
      return '<section class="pb-sec"><h2>BI tool finalisation: best-fit recommendation</h2>' +
        '<p class="pb-lead">A copyable, printable summary of the recommendation, built from your answers. Recommended tool, rationale, trade-offs, migration implications and the next validation step.</p>' +
        '<div class="pb-card" id="pb-summary"><label class="pb-notelabel">Client name (for the printout only; not stored)<input class="pb-input" data-action="client" value="' + esc(ui.clientName) + '" autocomplete="off"></label>' +
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
      var dep = '<p class="pb-fine">Cells marked <em>Corrected</em> differ from the deck and cite the vendor. Every other cell is the deck’s own text and has not been re-verified.</p><div class="pb-tablewrap"><table class="pb-table"><caption class="pb-sr">Deployment considerations</caption><thead><tr><th scope="col">Consideration</th>' + tools.map(function (t) { return '<th scope="col">' + esc(t) + '</th>'; }).join('') + '</tr></thead><tbody>' +
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
      var matrix = '<div class="pb-tablewrap"><table class="pb-table pb-matrix"><caption class="pb-sr">Decision matrix, 14 criteria</caption><thead><tr><th scope="col">Criterion</th>' + toolIds.map(function (i) { return '<th scope="col">' + esc(names[i]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        D.matrix.groups.map(function (g) { return g.criteria.map(function (c) { return '<tr><th scope="row"><small>' + esc(g.name) + '</small><br>' + esc(c.name) + '</th>' + toolIds.map(function (i) { var x = c.cells[i]; return '<td><strong>' + esc(x.headline) + '</strong>' + (x.detail ? '<br>' + esc(x.detail) : '') + (x.leads ? '<br>' + pill('leads', 'Leads (deck)') : '') + '</td>'; }).join('') + '</tr>'; }).join(''); }).join('') + '</tbody></table></div><p class="pb-fine">Source: deck, slides 7 and 9.</p>';
      var why = '<div class="pb-card"><p><strong>Pending update.</strong> The deck’s “why these tools” slide was written for four tools and cites Gartner. It must be rewritten for all six, and its Gartner wording re-checked, before it is shown here.</p></div>';
      var scoring = scoringHtml();
      var sec = function (id, title, body, open) { return '<details class="pb-details pb-ref" id="' + id + '"' + (open ? ' open' : '') + '><summary>' + esc(title) + '</summary>' + body + '</details>'; };
      return '<section class="pb-sec"><h2>Reference</h2><p class="pb-lead">Background for people who want depth. Nothing here changes the recommendation.</p>' +
        sec('ref-scoring', 'How scoring works', scoring, false) + sec('ref-patterns', 'Patterns we see', scen) + sec('ref-fast', 'Fast path by ecosystem', fastT) + sec('ref-deploy', 'Deployment considerations', dep) +
        sec('ref-integ', 'Technology integration', integT) + sec('ref-matrix', 'Decision matrix', matrix) + sec('ref-why', 'Why these six tools', why) + '</section>';
    }
    function scoringHtml() {
      return '<div class="pb-prose">' +
        '<p><strong>What is measured.</strong> Every answer has a fit score for each tool, set by our subject-matter experts from 1 (possible but not ideal) to 4 (strong fit). The tool does not add those scores up, because a tool that scores a little higher on average would win whatever the client says.</p>' +
        '<p><strong>The neutral starting point.</strong> On every question each tool is measured against a neutral reference: its own average across the possible answers or, for “how much does this matter” questions, the case where it does not matter. Only the difference counts, so a tool that tends to score well everywhere gains no automatic advantage. A client who tells us nothing sees every tool tied.</p>' +
        '<p><strong>Relative fit.</strong> The differences are weighted by how much each question matters, added up, and divided by how much that tool’s score can swing, so a tool with more extreme scores does not win more often by chance. The result is the fit index that ranks the tools.</p>' +
        '<p><strong>Ties and fairness.</strong> Ties are broken by your answers (ecosystem fit, then governance and security fit, then delivery risk and cost) and otherwise shared. A tool never outranks one that fits at least as well on every answer you gave. Tool order in the data never matters.</p>' +
        '<p><strong>Ruling tools out.</strong> Some answers rule a tool out before ranking. Today one does: a client that cannot use a vendor-hosted tool rules out Sigma.</p>' +
        '<p><strong>How sure to be.</strong> The page says whether the lead is clear, narrow or too close to call, and whether the third tool is clearly ahead of the first one left out. The lines are set from simulations in which the weights are nudged, and will be set again after the weighting session. The ranking is provisional until most of the questions are answered.</p>' +
        '<p><strong>Limits.</strong> Question weights and the scores for questions marked Draft are provisional and awaiting expert review. The tool supports judgment; it does not replace a proof of concept.</p></div>';
    }

    // ------------------------------------------------------------------ RAIL ("Your answers") and TOC
    function renderRail() {
      var p = session.progress();
      var r = session.result();
      var open = session.openQuestions().slice(0, 5);
      var pct = Math.round(p.coverage * 100);
      // on small screens the panel starts collapsed, with a one-line summary that stays visible; the choice survives re-renders
      var small = !!(root.matchMedia && root.matchMedia('(max-width: 980px)').matches);
      var isOpen = ui.railOpen === undefined ? !small : ui.railOpen;
      o.rail.innerHTML = '<details class="pb-rail-card pb-raildetails"' + (isOpen ? ' open' : '') + '><summary><span class="pb-rail-h">Your answers</span> ' +
        '<span class="pb-rail-sum">' + p.answered + ' of ' + p.visible + ' · ' + esc(L.STATE_LABEL[r.state]) + '</span></summary>' +
        '<p class="pb-rail-count"><strong>' + p.answered + ' of ' + p.visible + '</strong> questions answered</p>' +
        '<div class="pb-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="Questions answered, weighted"><span style="width:' + pct + '%"></span></div>' +
        '<p><span class="pb-state pb-state-' + r.state + '">' + esc(L.STATE_LABEL[r.state]) + '</span></p>' +
        (r.informative ? '<p class="pb-rail-lead">' + esc(L.leadSentence(r, names)) + ' <button class="pb-link" data-action="go" data-tab="shortlist">See the shortlist</button></p>' : '') +
        (r.state === 'none' || r.state === 'provisional' ? '<p class="pb-fine">The order is likely to change as you answer more.</p>' : '') +
        (open.length ? '<h3 class="pb-rail-h2">Matters most, still open</h3><ul class="pb-open">' + open.map(function (q) { return '<li><button class="pb-link" data-action="goq" data-qid="' + q.id + '">' + esc(q.text) + '</button></li>'; }).join('') + '</ul>' : '') +
        '<p class="pb-rail-foot"><button class="pb-link" data-action="reset">Start over</button><br><small>Saved on this device.</small></p></details>';
    }
    /** "On this page": the nine sections, with the question sections under client discovery. Built from data, not from the DOM. */
    function tocItems() {
      var by = visibleBySection();
      var items = [];
      TABS.forEach(function (t) {
        items.push({ id: 'sec-' + t.id, label: t.label, sub: false, tab: t.id });
        if (t.id === 'discovery') SECTIONS.forEach(function (s) { if ((by[s.id] || []).length) items.push({ id: 'disc-' + s.id, label: s.id + '. ' + s.title, sub: true, tab: 'discovery' }); });
      });
      return items;
    }
    function renderToc() {
      if (!o.toc) return;
      o.toc.innerHTML = '<h2 class="pb-rail-h">On this page</h2><ul>' + tocItems().map(function (i) {
        return '<li class="' + (i.sub ? 'sub' : '') + '"><a href="#' + i.id + '" data-toc="' + i.id + '"' + (!i.sub && i.tab === ui.tab ? ' aria-current="location"' : '') + '>' + esc(i.label) + '</a></li>';
      }).join('') + '</ul>';
    }

    // ------------------------------------------------------------------ one page: scrolling and "where am I"
    function setActive(tab, force) {
      if (ui.tab === tab && !force) return;
      ui.tab = tab;
      renderToc();
      if (o.onTab) o.onTab(tab);
    }
    function focusFirst(el) { var f = el && el.querySelector ? el.querySelector('input,button,textarea,select') : null; if (f && f.focus) f.focus({ preventScroll: true }); }
    /** Scroll to a section (or to an element inside it). The page is one scroll: this never swaps content. */
    function go(tab, anchor) {
      var el = anchor ? o.container.querySelector('#' + anchor) : o.container.querySelector('#sec-' + tab);
      ui.lockUntil = Date.now() + 1000;          // the scroll watcher stays quiet while a jump is in flight
      setActive(tab, true);
      if (el) { if (el.tagName === 'DETAILS') el.open = true; if (el.scrollIntoView) el.scrollIntoView({ block: 'start' }); }
    }
    function goQuestion(qid) {
      var el = o.container.querySelector('#q-' + qid);
      ui.lockUntil = Date.now() + 1000;
      setActive('discovery', true);
      if (el) { if (el.scrollIntoView) el.scrollIntoView({ block: 'center' }); focusFirst(el); }
    }
    var spy = null;
    function observe() {
      if (!root.IntersectionObserver || !o.container.querySelectorAll) return;
      if (spy) spy.disconnect();
      spy = new root.IntersectionObserver(function (entries) {
        if (Date.now() < (ui.lockUntil || 0)) return;
        entries.forEach(function (en) { if (en.isIntersecting) setActive(en.target.getAttribute('data-sec')); });
      }, { rootMargin: '-20% 0px -70% 0px' });
      Array.prototype.forEach.call(o.container.querySelectorAll('.pb-block'), function (b) { spy.observe(b); });
    }

    // ------------------------------------------------------------------ render and events
    var RENDER = { overview: renderOverview, purpose: renderPurpose, principles: renderPrinciples, discovery: renderDiscovery, shortlist: renderShortlist, migration: renderMigration, tools: renderTools, final: renderFinal, reference: renderReference };
    /** The sections whose content depends on the answers. Everything else is static and is not redrawn when an answer changes. */
    var DYNAMIC = ['discovery', 'shortlist', 'migration', 'tools', 'final'];
    function blockHtml(id) { return '<div class="pb-block" id="sec-' + id + '" data-sec="' + id + '">' + RENDER[id]() + '</div>'; }
    function activeId() { var a = o.container.ownerDocument && o.container.ownerDocument.activeElement; return a && a.id && o.container.contains(a) ? a.id : null; }
    function restoreFocus(focusId) {
      if (!focusId) return;
      var f = o.container.querySelector('#' + (root.CSS && root.CSS.escape ? root.CSS.escape(focusId) : focusId));
      if (f && f.focus) f.focus({ preventScroll: true });
    }
    function render() {
      var focusId = activeId();
      o.container.innerHTML = TABS.map(function (t) { return blockHtml(t.id); }).join('');
      renderRail(); renderToc(); observe(); restoreFocus(focusId);
    }
    /** Redraw only the sections that depend on the answers, in place, so the reader keeps their scroll position. */
    function update(ids) {
      ids = ids || DYNAMIC;
      var els = ids.map(function (id) { return o.container.querySelector('#sec-' + id); });
      if (els.some(function (e) { return !e; })) { render(); return; }
      var focusId = activeId();
      ids.forEach(function (id, i) { els[i].innerHTML = RENDER[id](); });
      renderRail(); renderToc(); restoreFocus(focusId);
    }

    function checkedFor(qid) {
      return Array.prototype.map.call(o.container.querySelectorAll('input[data-qid="' + qid + '"]:checked'), function (i) { return i.value; });
    }
    function applyAnswer(qid, ids) {
      var before = JSON.parse(JSON.stringify(session.answers));
      var res;
      try { res = session.answer(qid, ids); } catch (e) { ui.notice = { text: e.message }; update(); return; }
      if (res.pruned.length) {
        ui.notice = { text: 'Your answers to ' + res.pruned.map(function (id) { return '“' + qOf(id).text + '”'; }).join(' and ') + ' were cleared because that part of the questionnaire no longer applies.', undo: before };
      } else if (ui.notice && !ui.notice.undo) { ui.notice = null; }
      persist();
      update();
    }

    o.container.addEventListener('change', function (e) {
      var t = e.target;
      if (t.matches && t.matches('input[data-qid]')) { applyAnswer(t.getAttribute('data-qid'), checkedFor(t.getAttribute('data-qid'))); return; }
      var act = t.getAttribute && t.getAttribute('data-action');
      if (act === 'cmp-a') { ui.compare.a = t.value; if (ui.compare.b === t.value) ui.compare.b = '__all__'; update(['tools']); }
      else if (act === 'cmp-b') { ui.compare.b = t.value; update(['tools']); }
      else if (act === 'restore' && t.files && t.files[0]) {
        var rd = new root.FileReader();
        rd.onload = function () { try { var d = JSON.parse(rd.result); buildSession(d.answers || {}); store.notes = d.notes || store.notes; persist(); ui.notice = null; render(); flash('Answers restored.'); } catch (err) { flash('That file could not be read.'); } };
        rd.readAsText(t.files[0]);
      }
    });
    o.container.addEventListener('input', function (e) {
      var t = e.target;
      if (t.matches && t.matches('textarea[data-note]')) { store.notes[t.getAttribute('data-note')] = t.value; if (!t.value) delete store.notes[t.getAttribute('data-note')]; saveStore(); }
      else if (t.getAttribute && t.getAttribute('data-action') === 'client') { ui.clientName = t.value; var pre = o.container.querySelector('#pb-summary-text'); if (pre) pre.textContent = L.buildSummary(summaryContext()); }
    });
    function flash(msg) { var el = o.container.querySelector('#pb-flash'); if (el) el.textContent = msg; }
    function summaryText() { return L.buildSummary(summaryContext()); }
    function copy() {
      var text = summaryText();
      if (root.navigator && root.navigator.clipboard) { root.navigator.clipboard.writeText(text).then(function () { flash('Copied.'); }, function () { fallbackCopy(text); }); } else fallbackCopy(text);
    }
    function fallbackCopy(text) {
      var ta = o.container.ownerDocument.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      o.container.ownerDocument.body.appendChild(ta); ta.select();
      try { flash(o.container.ownerDocument.execCommand('copy') ? 'Copied.' : 'Select the text and copy it.'); } catch (e) { flash('Select the text and copy it.'); }
      o.container.ownerDocument.body.removeChild(ta);
    }
    function download() {
      var blob = new root.Blob([JSON.stringify({ app: 'bi-playbook', version: 1, answers: session.answers, notes: store.notes }, null, 2)], { type: 'application/json' });
      var a = o.container.ownerDocument.createElement('a'); a.href = root.URL.createObjectURL(blob); a.download = 'bi-playbook-answers.json'; a.click(); root.URL.revokeObjectURL(a.href);
    }

    o.container.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT' || b.tagName === 'OPTION') return;
      var act = b.getAttribute('data-action');
      if (act === 'go') go(b.getAttribute('data-tab'), b.getAttribute('data-anchor'));
      else if (act === 'goq') goQuestion(b.getAttribute('data-qid'));
      else if (act === 'section') { ui.lockUntil = Date.now() + 1000; setActive('discovery', true); var s = o.container.querySelector('#disc-' + b.getAttribute('data-section')); if (s && s.scrollIntoView) s.scrollIntoView({ block: 'start' }); }
      else if (act === 'clear') applyAnswer(b.getAttribute('data-qid'), []);
      else if (act === 'note') { var id = b.getAttribute('data-qid'); ui.openNotes[id] = !(ui.openNotes[id] || store.notes[id]); update(['discovery']); var ta = o.container.querySelector('textarea[data-note="' + id + '"]'); if (ta) ta.focus({ preventScroll: true }); }
      else if (act === 'undo') { if (ui.notice && ui.notice.undo) { var prev = ui.notice.undo; ui.notice = null; buildSession(prev); persist(); update(); } }
      else if (act === 'dismiss') { ui.notice = null; update(['discovery']); }
      else if (act === 'tooltab') { ui.toolTab = b.getAttribute('data-tool'); update(['tools']); }
      else if (act === 'copy') copy();
      else if (act === 'print') { var html = o.container.ownerDocument.documentElement; html.setAttribute('data-print', 'summary'); root.print(); html.removeAttribute('data-print'); }
      else if (act === 'download') download();
      else if (act === 'reset') api.reset();
    });
    o.rail.addEventListener('toggle', function (e) { if (e.target && e.target.classList && e.target.classList.contains('pb-raildetails')) ui.railOpen = e.target.open; }, true);
    o.rail.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!b) return;
      var act = b.getAttribute('data-action');
      if (act === 'goq') goQuestion(b.getAttribute('data-qid'));
      else if (act === 'go') go(b.getAttribute('data-tab'));
      else if (act === 'reset') api.reset();
    });

    var api = {
      tabs: TABS,
      /** The section currently in view. */
      get tab() { return ui.tab; },
      /** Scroll to a section. The whole playbook is one page. */
      go: function (tab) { if (RENDER[tab]) go(tab); },
      /** Programmatic equivalent of picking answers in the page (used by tests and by anything embedding the module). */
      answer: function (qid, optionIds) { applyAnswer(qid, optionIds); },
      setNote: function (qid, text) { if (text) store.notes[qid] = text; else delete store.notes[qid]; saveStore(); },
      session: function () { return session; },
      reset: function () {
        if (root.confirm && !root.confirm('Clear all answers and notes on this device?')) return;
        store = { answers: {}, notes: {} }; saveStore(); buildSession({}); ui.notice = null; ui.openNotes = {}; ui.clientName = ''; render();
      },
      setShowDrafts: function (v) { persist(); showDrafts = !!v; buildSession(store.answers); render(); },
      get showDrafts() { return showDrafts; },
      summary: summaryText
    };
    render();
    return api;
  }

  return { mount: mount, TABS: TABS, SECTIONS: SECTIONS };
}));
