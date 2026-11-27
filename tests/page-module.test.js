'use strict';
/*
 * Smoke test for the content module: runs src/page/*.js as classic scripts in a browser-like context (no module system) with a
 * stub DOM and storage, renders every section and the question carousel at several answer states, and checks what is rendered
 * and what is stored. It exists because a scope bug once hid behind try/catch (storage silently never saved) and was only found
 * in the browser.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const json = (p) => JSON.parse(read(p));

function load(storage, opts, modelOverride, docExtra, ctxExtra) {
  const timers = [];
  const ctx = { console, JSON, Date, Math, Object, Array, String, Number, Promise };
  ctx.self = ctx;
  Object.assign(ctx, ctxExtra || {});
  ctx.localStorage = storage;
  ctx.confirm = () => true;
  ctx.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };      // the test decides when time passes
  ctx.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1] = null; };
  vm.createContext(ctx);
  for (const f of ['src/engine/engine.js', 'src/engine/session.js', 'src/page/lib.js', 'src/page/playbook.js']) vm.runInContext(read(f), ctx, { filename: f });
  // stand-ins for the page and for the carousel's host element
  const listeners = {};
  let ctxChecked = [];
  const mkHost = () => ({ innerHTML: '', hidden: true, contains: () => true, querySelectorAll: () => ctxChecked, querySelector: () => null, addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); } });
  const container = Object.assign(mkHost(), { ownerDocument: Object.assign({ activeElement: { id: 'o-Q04-microsoft' }, documentElement: { setAttribute() {}, removeAttribute() {} } }, docExtra) });
  const overlay = mkHost();
  const mini = mkHost();
  const rail = { innerHTML: '', addEventListener() {} };
  const toc = { innerHTML: '', hidden: false, addEventListener() {} };
  const deck = { profiles: json('data/deck/profiles.json'), matrix: json('data/deck/matrix.json'), migration: json('data/deck/migration.json'), reference: json('data/deck/reference.json') };
  const api = ctx.Playbook.mount({ container, rail, toc, overlay, mini, model: modelOverride || json('data/questions.json'), deck, config: Object.assign({ preview: true, showDrafts: true, lockUntilComplete: false }, opts || {}) });   // most tests look at results after one answer; the lock has its own tests
  return { api, container, overlay, mini, rail, toc, ctx, timers, listeners, setChecked: (inputs) => { ctxChecked = inputs; } };
}
const memoryStorage = () => { const m = {}; return { m, getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; };
const PAGES = ['home', 'discovery'];
const SECTIONS = ['overview', 'navigate', 'principles', 'dictionary', 'matrix', 'cta', 'discovery', 'scoring', 'shortlist', 'migration', 'final'];
const BAD = /undefined|NaN|\[object|null</;
/** Answer every question that is asked now (the first scored option of each), except the ids listed. */
const answerAll = (h, except = []) => {
  for (let i = 0; i < 80; i++) {
    const q = h.api.session().visible().find((v) => !v.answered && !except.includes(v.id));
    if (!q) break;
    h.api.answer(q.id, [q.options.find((o) => !o.unknown).id]);
  }
};
const press = (h, k, target) => h.listeners.keydown.forEach((fn) => fn({ key: k, target: target || { tagName: 'DIV' }, preventDefault() {} }));

/** The html of one section: goes to it first (a section lives on a page, and a page shows only itself). */
function sec(h, id) {
  h.api.go(id);
  const html = h.container.innerHTML;
  const start = html.indexOf(`<div class="pb-block" id="sec-${id}"`);
  assert.ok(start >= 0, `section ${id} is on its page`);
  const next = html.indexOf('<div class="pb-block" id="sec-', start + 10);
  return html.slice(start, next < 0 ? html.length : next);
}
function renderAll(h) {
  const out = {};
  for (const t of SECTIONS) out[t] = sec(h, t);
  out.overlay = h.overlay.innerHTML;
  return out;
}
/** The whole fieldset of one question inside the carousel html, with any fieldsets nested in it. */
function fieldset(html, id) {
  const a = html.indexOf(`id="q-${id}"`);
  assert.ok(a >= 0, `${id} is in the carousel`);
  let depth = 1, i = a;
  const re = /<fieldset|<\/fieldset>/g;
  re.lastIndex = a;
  for (let m; (m = re.exec(html)); ) { depth += m[0] === '</fieldset>' ? -1 : 1; i = m.index; if (!depth) break; }
  return html.slice(a, i);
}

test('every section renders at every answer state without broken output', () => {
  const h = load(memoryStorage());
  let all = renderAll(h);
  for (const t of SECTIONS) assert.ok(all[t].length > 150, `${t} rendered`);
  const steps = [
    [['Q04', ['microsoft']], ['Q01', ['self_service_analytics_and_reporting']]],
    [['Q13', ['yes']], ['Q14', ['looker', 'excel_other']], ['Q10', ['client_team']], ['Q11', ['beginner']], ['Q22', ['ai_first']], ['Q26', ['no_self_hosted']]]
  ];
  for (const step of [[], ...steps]) {
    step.forEach(([q, a]) => h.api.answer(q, a));
    h.api.openDiscovery('1');
    all = renderAll(h);
    for (const t of [...SECTIONS, 'overlay']) assert.ok(!BAD.test(all[t]), `${t} after ${step.length} answers: ${(all[t].match(BAD) || [])[0]}`);
    h.api.closeDiscovery();
    assert.ok(!BAD.test(h.rail.innerHTML), 'rail');
  }
});

test('the module runs on the production data (no draft questions) at every answer state', () => {
  const { execFileSync } = require('node:child_process');
  const os = require('node:os');
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pb-prod-')), 'q.json');
  execFileSync('python', ['-X', 'utf8', 'scripts/excel_to_json.py', '--exclude-draft', '--out', out], { cwd: root, stdio: 'pipe' });
  const prod = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(prod.questions.length, 25, 'no draft is left to leave out');
  const h = load(memoryStorage(), { showDrafts: false, preview: false }, prod);
  let all = renderAll(h);
  for (const t of SECTIONS) assert.ok(!BAD.test(all[t]), `${t} (no answers): ${(all[t].match(BAD) || [])[0]}`);
  [['Q04', ['microsoft']], ['Q05', ['yes']], ['Q06', ['enterprise_security']], ['Q13', ['yes']], ['Q14', ['tableau']], ['Q10', ['joint_delivery']], ['Q11', ['advanced']]]
    .forEach(([q, a]) => h.api.answer(q, a));
  h.api.openDiscovery('1');
  all = renderAll(h);
  for (const t of [...SECTIONS, 'overlay']) assert.ok(!BAD.test(all[t]), `${t} (answered): ${(all[t].match(BAD) || [])[0]}`);
  assert.ok(!/Draft/.test(all.overlay) && !/Draft/.test(all.discovery) && !/draft questions/i.test(all.shortlist), 'no draft wording in production');
  assert.match(all.overlay, /Question 1 of 8/);
  assert.match(all.final, /Internal use only/);
});

test('answers are stored, restored by a fresh load, and cleared by Start over', () => {
  const store = memoryStorage();
  const a = load(store);
  a.api.answer('Q04', ['salesforce']);
  a.api.setNote('Q04', 'board wants Salesforce');
  const saved = JSON.parse(store.m['bi-playbook-v1']);
  assert.deepEqual(saved.answers.Q04, ['salesforce']);
  assert.equal(saved.notes.Q04, 'board wants Salesforce');
  const b = load(store);
  assert.equal(JSON.stringify(b.api.session().answers.Q04), '["salesforce"]', 'a fresh page load restores the answer');
  assert.match(sec(b, 'final'), /board wants Salesforce/, 'the note reaches the summary');
  b.api.reset();
  assert.deepEqual(JSON.parse(store.m['bi-playbook-v1']), { answers: {}, notes: {} });
  assert.equal(JSON.stringify(b.api.session().answers), '{}');
});

test('the shortlist lists tools by rank, then alphabetically, and shows ties as co-leaders', () => {
  const h = load(memoryStorage());
  h.api.answer('Q03', ['no']);          // scores every tool the same; Sigma and Tableau share a baseline, so they tie
  const html = sec(h, 'shortlist');
  assert.match(html, /Sigma and Tableau fit equally well/);
  const cards = [...html.matchAll(/data-tool="([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(cards.indexOf('sigma') < cards.indexOf('tableau'), 'equal ranks are alphabetical');
  assert.match(html, /aria-label="Rank =1"/, 'a tie is shown as =1');
  assert.match(html, /Too close to call/);
});

test('a clear answer produces one clear leader with reasons and fit words', () => {
  const h = load(memoryStorage());
  h.api.answer('Q04', ['salesforce']);
  const html = sec(h, 'shortlist');
  assert.match(html, /Tableau fits this client best, with a clear lead over/);
  assert.match(html, /Why it fits/);
  assert.match(html, /pb-pill tier-(strong|good)/, 'fit words are shown beside each reason');
  assert.match(html, /Provisional/);
  assert.match(html, /Based on 1 of 19 questions/);
});

test('a ruled-out tool is explained with the answer, the deployment facts and the expert rationale', () => {
  const h = load(memoryStorage());
  h.api.answer('Q26', ['no_self_hosted']);
  h.api.answer('Q04', ['snowflake']);
  const html = sec(h, 'shortlist');
  assert.match(html, /Ruled out by your answers/);
  assert.match(html, /Sigma deployment: Cloud-only \(SaaS\)\. On-premises option: No\./);
  assert.match(html, /Is a vendor-hosted \(SaaS\) BI platform acceptable\?/);
  assert.ok(!/data-tool="sigma"/.test(html), 'a ruled-out tool is not ranked');
});

test('the migration section follows the answers: gate, none, tools in use', () => {
  const h = load(memoryStorage());
  assert.match(sec(h, 'migration'), /Answer .*active reporting suite/);
  h.api.answer('Q13', ['no']);
  assert.match(sec(h, 'migration'), /No existing reporting to migrate/);
  h.api.answer('Q13', ['yes']);
  h.api.answer('Q14', ['looker']);
  h.api.answer('Q04', ['microsoft']);
  h.api.answer('Q05', ['yes']);
  assert.match(sec(h, 'migration'), /From Looker/);
  assert.match(sec(h, 'migration'), /Effort by dimension/);
});

test('the dictionary is one container with a tab for each tool, A to Z, and each tool is one sentence and a link to its official documentation', () => {
  const h = load(memoryStorage());
  let html = sec(h, 'dictionary');
  assert.match(html, /Tools dictionary/);
  const tabs = [...html.matchAll(/role="tab" id="dtab-(\w+)" aria-selected="(\w+)"/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(tabs.map((t) => t[0]), ['looker', 'powerbi', 'qlik', 'sigma', 'tableau', 'thoughtspot'], 'alphabetical');
  assert.deepEqual(tabs.filter((t) => t[1] === 'true').map((t) => t[0]), ['looker'], 'the first tool is shown to start with');
  assert.equal((html.match(/<article class="pb-dict"/g) || []).length, 1, 'one tool at a time');
  assert.match(html, /id="dpanel" role="tabpanel" aria-labelledby="dtab-looker"/);
  const docs = { looker: 'https://docs.cloud.google.com/looker/docs', powerbi: 'https://learn.microsoft.com/en-us/power-bi/', qlik: 'https://help.qlik.com/', sigma: 'https://help.sigmacomputing.com/', tableau: 'https://help.tableau.com/', thoughtspot: 'https://docs.thoughtspot.com/' };
  const click = (attrs) => h.listeners.click[1]({ target: { closest: () => ({ tagName: 'BUTTON', getAttribute: (k) => attrs[k] }) } });
  const names = { looker: 'Looker', powerbi: 'Power BI', qlik: 'Qlik', sigma: 'Sigma', tableau: 'Tableau', thoughtspot: 'ThoughtSpot' };
  for (const [id] of tabs) {
    click({ 'data-action': 'dtab', 'data-tool': id });
    html = sec(h, 'dictionary');
    assert.match(html, new RegExp(`<article class="pb-dict" id="dict-${id}"`), `${id} is shown`);
    assert.match(html, new RegExp(`id="dtab-${id}" aria-selected="true"`));
    assert.match(html, new RegExp(`<p class="pb-dict-main">${names[id]} is best suited for [^<]+\.</p>`), `${id}: one sentence, with the tool's name spelled right`);
    assert.match(html, new RegExp(`<a class="pb-btn pb-btn-ghost" href="${docs[id].replace(/[.*+?^${}()|[\]\/]/g, '\$&')}" target="_blank" rel="noopener">Read the official documentation`), `${id}: the link to its own documentation`);
    assert.equal((html.match(/<p class="pb-dict-main">/g) || []).length, 1);
    assert.ok(!/<h4>/.test(html.slice(html.indexOf('<article class="pb-dict"'), html.indexOf('</article>'))), 'no lists of features, benefits or costs');
  }
  assert.equal(Object.keys(docs).length, tabs.length, 'a link for every tool');
  // the arrow keys move between tabs
  const key = (k, tool) => h.listeners.keydown.forEach((fn) => fn({ key: k, target: { closest: () => ({ getAttribute: () => tool }) }, preventDefault() {} }));
  key('ArrowRight', 'thoughtspot');
  assert.match(sec(h, 'dictionary'), /id="dtab-looker" aria-selected="true"/, 'it wraps round to the first');
  key('ArrowLeft', 'looker');
  assert.match(sec(h, 'dictionary'), /id="dtab-thoughtspot" aria-selected="true"/);
});

test('the old page ids still land on the new pages', () => {
  const h = load(memoryStorage());
  for (const [old, page] of [['compare', 'home'], ['comparehome', 'home'], ['versus', 'home'], ['recommendation', 'discovery'], ['matrix', 'home'], ['shortlist', 'discovery']]) {
    assert.ok(h.api.knows(old), old);
    h.api.go(old);
    assert.equal(h.api.tab, page, `${old} opens ${page}`);
  }
  assert.equal(h.api.knows('nonsense'), false);
  h.api.go('home');
  assert.equal(h.api.tab, 'home');
});

test('there is no reference section, and nothing on the page cites the deck as a source', () => {
  const h = load(memoryStorage());
  h.api.answer('Q13', ['yes']); h.api.answer('Q14', ['looker']); h.api.answer('Q04', ['snowflake']);
  for (const id of ['overview', 'dictionary', 'matrix', 'discovery', 'shortlist', 'migration', 'final']) {
    h.api.go(id);
    assert.ok(!/More reference|Source: deck|Source: Deck|\(deck, slide|deck’s own|the deck/i.test(h.container.innerHTML), `${id}: no deck sourcing`);
  }
  h.api.go('home');
  assert.ok(!/sec-reference|More reference/.test(h.container.innerHTML));
});

test('the final recommendation is a document: the headline, why, watch-outs, the other tools, next steps, the winner documentation link and the answers', () => {
  const h = load(memoryStorage());
  h.api.answer('Q04', ['microsoft']);
  let html = sec(h, 'final');
  assert.match(html, /Internal use only · \d{4}-\d{2}-\d{2} · Provisional: 1 of 19 questions answered/);
  assert.match(h.api.summary(), /## Best fit so far: /);
  answerAll(h);
  assert.equal(h.api.session().result().state, 'complete');
  html = sec(h, 'final');
  assert.match(html, /Complete: all \d+ questions answered/);
  for (const part of ['class="pb-rep-hero"', 'Best fit</p>', '>Why ', '>Watch-outs for ', '>The other tools<', '>Next steps<', '>Answers and notes<', 'Run a proof of concept on the riskiest assumption', 'Check current pricing and licensing with the vendor']) assert.ok(html.includes(part), part);
  assert.match(html, /Official documentation for [A-Za-z ]+: <a href="https:\/\/[^"]+" target="_blank" rel="noopener">/, 'the documentation link of the winner ends the next steps');
  assert.ok(!/<pre/.test(html), 'a document, not a block of text');
  assert.match(html, /data-action="copy">Copy as Markdown<\/button>/);
  assert.match(html, /data-action="mdsave">Save as Markdown/);
  assert.match(html, /data-action="print">Save as PDF/);
  const md = h.api.summary();
  assert.match(md, /^# BI tool recommendation\n/);
  assert.match(md, /\*Internal use only · \d{4}-\d{2}-\d{2} · Complete: all \d+ questions answered\*/);
  assert.match(md, /## Best fit: /);
  assert.match(md, /## Why .+ fits\n\n- \*\*/);
  assert.match(md, /## Next steps\n\n- .+\n- .+/);
  assert.match(md, /- Official documentation for [A-Za-z ]+: \[https:\/\/[^\]]+\]\(https:\/\/[^)]+\)\n/);
  assert.match(md, /## Answers and notes\n\n### Business context and goals\n\n- \*\*/);
  assert.match(sec(h, 'shortlist'), /<p class="pb-doclink"><a href="https:\/\/[^"]+" target="_blank" rel="noopener">Official documentation/, 'the best-fit card ends with a link too');
  h.listeners.input.forEach((fn) => fn({ target: { matches: () => false, getAttribute: (k) => ({ 'data-action': 'client' }[k]), value: 'Acme' } }));
  assert.match(h.api.summary(), /^# BI tool recommendation for Acme\n/);
});

// ------------------------------------------------------------------ pages

test('the playbook is two pages; a page shows its own sections in the order of the story, and a section opens on its page', () => {
  const h = load(memoryStorage());
  assert.deepEqual([...h.api.tabs.map((t) => t.id)], PAGES);
  assert.deepEqual([...h.api.tabs.map((t) => t.label)], ['Tools overview', 'Client discovery']);
  const blocksOn = () => [...h.container.innerHTML.matchAll(/<div class="pb-block" id="sec-(\w+)"/g)].map((m) => m[1]);
  assert.equal(h.api.tab, 'home');
  assert.deepEqual([...blocksOn()], ['overview', 'navigate', 'principles', 'dictionary', 'matrix', 'cta'], 'purpose, contents, do’s and don’ts, the dictionary, the matrix, then the way to the questions');
  h.api.go('principles');
  assert.equal(h.api.tab, 'home');
  h.api.go('discovery');
  assert.equal(h.api.tab, 'discovery');
  assert.deepEqual([...blocksOn()], ['discovery', 'shortlist', 'scoring'], 'the areas and the start, then the recommendation (one tab of it), then how it is made');
  h.api.go('final');
  assert.equal(h.api.tab, 'discovery', 'the recommendation is on the same page as the questions');
  assert.deepEqual([...blocksOn()], ['discovery', 'final', 'scoring']);
  const page = h.container.innerHTML;
  assert.ok(page.indexOf('id="sec-discovery"') < page.indexOf('id="sec-reco"') && page.indexOf('id="sec-reco"') < page.indexOf('id="sec-scoring"'));
  assert.ok(page.indexOf('Areas we ask about') < page.indexOf('Start the questions'), 'the areas come before the start button');
});

test('page 1 tells the story in the consultant’s voice: purpose, contents, do’s and don’ts, then it ends by asking who is still unsure', () => {
  const h = load(memoryStorage());
  const html = sec(h, 'overview');
  assert.match(html, /<h2>Purpose<\/h2>/);
  assert.match(html, /we do not start with a favourite/, 'we are the consultants');
  assert.match(html, /Looker, Power BI, Qlik, Sigma, Tableau and ThoughtSpot/, 'tools are listed alphabetically');
  assert.match(html, /What it does not replace/);
  assert.ok(!/Internal use only|Check before you quote/.test(html), 'the disclaimers are not in the middle of the page');
  assert.ok(!/Who is this for\?|How to navigate|Guiding principles/.test(h.container.innerHTML), 'the earlier overview headings are gone');
  const nav = sec(h, 'navigate');
  assert.match(nav, /<h2>Contents<\/h2>/);
  const cards = [...nav.matchAll(/data-action="go" data-tab="(\w+)"(?: data-anchor="([\w-]+)")?/g)].map((m) => `${m[1]}${m[2] ? '#' + m[2] : ''}`);
  assert.deepEqual([...cards], ['home#sec-principles', 'home#sec-dictionary', 'home#sec-matrix'], 'do’s and don’ts, dictionary, matrix: the questions are reached only from the button at the end');
  assert.ok(!/discovery/.test(nav));
  const pr = sec(h, 'principles');
  assert.match(pr, /<h2>Do’s and Don’ts<\/h2>/);
  assert.match(pr, /We start with the business problem/);
  assert.match(pr, /We never declare a universal “best BI tool”/);
  const cta = sec(h, 'cta');
  assert.match(cta, /Still unable to pick a BI tool\?/);
  assert.match(cta, /5 to 10 minutes/);
  assert.match(cta, /data-action="go" data-tab="discovery">Start client discovery/);
  const page = h.container.innerHTML;
  const order = ['<h2>Purpose', '<h2>Contents', 'Do’s and Don’ts</h2>', 'Tools dictionary</h2>', 'Comparison matrix</h2>', 'Still unable to pick'].map((t) => page.indexOf(t));
  assert.ok(order.every((i, k) => i >= 0 && (k === 0 || i > order[k - 1])), `sections out of order: ${order}`);
  const toc = [...h.toc.innerHTML.matchAll(/data-toc="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...toc], ['sec-overview', 'sec-navigate', 'sec-principles', 'sec-dictionary', 'sec-matrix', 'sec-cta'], 'the contents list follows the page');
  assert.match(sec(h, 'scoring'), /How the recommendation is made/);
  assert.match(sec(h, 'scoring'), /<details/, 'how it is made is a closed disclosure');
  h.api.go('discovery');
  assert.deepEqual([...h.toc.innerHTML.matchAll(/data-toc="([^"]+)"/g)].map((m) => m[1]), ['disc-about', 'disc-areas', 'sec-reco', 'sec-scoring']);
});

test('the discovery page shows the five areas and a download card as a grid of cards, with one button to start', () => {
  const h = load(memoryStorage());
  const html = sec(h, 'discovery');
  assert.match(html, /The client’s answers decide the tool, not our preferences/);
  assert.match(html, /It takes about 5 to 10 minutes\./);
  const cards = [...html.matchAll(/<(?:button|div) class="pb-area[^"]*"(?: data-action="(\w+)")?(?: data-section="(\d)")?/g)].map((m) => (m[1] ? m[1] + (m[2] ? ':' + m[2] : '') : 'save'));
  assert.deepEqual(cards, ['openq:1', 'openq:2', 'openq:3', 'openq:4', 'openq:5', 'save'], 'the five areas, then the save card last');
  assert.match(html, /<strong class="pb-area-title">Save your answers<\/strong>/);
  assert.match(html, /data-action="mdsave">Markdown<\/button><button class="pb-btn pb-btn-ghost" data-action="pdf">PDF<\/button>/, 'Markdown and PDF');
  assert.ok(html.indexOf('Existing reporting and migration') > html.indexOf('Data landscape and delivery'), 'migration is the last area');
  assert.match(html, /class="pb-area is-next" data-action="openq" data-section="1"[\s\S]*Start here/, 'the first card says where to begin');
  assert.match(html, /data-action="openq">Start the questions/);
  assert.ok(!/pb-tips|moves on by itself|Double-click an answer/.test(html), 'no list of tips under the start button');
  assert.ok(!/Start the questions<\/h3>/.test(html));
  assert.match(html, /data-action="go" data-tab="home">[\s\S]*Tools overview/, 'a way back to page 1');
  h.api.answer('Q04', ['microsoft']);
  const again = sec(h, 'discovery');
  assert.match(again, /Continue the questions/);
  assert.match(again, /1 of 8 answered/, 'a card shows how far its area is');
  assert.match(again, /Up next/);
});

test('there is no tab row: the questions are reached from the last button of page 1, and the page 1 contents no longer lists them', () => {
  const h = load(memoryStorage());
  assert.match(sec(h, 'cta'), /data-action="go" data-tab="discovery">Start client discovery/);
  assert.ok(!/data-tab="discovery"/.test(sec(h, 'navigate')));
  assert.ok(!/pv-tab/.test(read('src/page/index.html')) && !/pv-tabs/.test(read('src/page/styles.css')), 'the preview shell has no tab row');
  h.api.go('discovery');
  assert.equal(h.api.tab, 'discovery');
});

test('the save card writes the recommendation as a Markdown file; the PDF waits for the recommendation; the back-up file is still there', () => {
  const h = load(memoryStorage(), { lockUntilComplete: true });
  h.api.answer('Q04', ['microsoft']); h.api.setNote('Q04', 'a note');
  assert.match(sec(h, 'discovery'), /data-action="pdf" disabled title="The PDF holds the recommendation/, 'no PDF until every question is answered');
  const saved = [];
  const a = { style: {}, parentNode: null, click() { saved.push(a.download); }, set href(v) { a._h = v; } };
  const revoked = [];
  h.ctx.Blob = function (parts, o) { saved.push(parts.join(''), o.type); };
  h.ctx.URL = { createObjectURL: () => 'blob:x', revokeObjectURL: (u) => revoked.push(u) };
  h.container.ownerDocument.createElement = () => a;
  h.container.ownerDocument.body = { appendChild(n) { n.parentNode = this; }, removeChild(n) { n.parentNode = null; } };
  const click = (act) => h.listeners.click[1]({ target: { closest: () => ({ tagName: 'BUTTON', getAttribute: (k) => ({ 'data-action': act }[k]) }) } });
  click('mdsave');
  assert.match(saved[0], /^# BI tool recommendation\n/);
  assert.match(saved[0], /- \*\*Which enterprise ecosystem do you primarily operate within\?\*\*: Microsoft \*\(a note\)\*/);
  assert.equal(saved[1], 'text/markdown');
  assert.equal(saved[2], 'bi-tool-recommendation.md');
  assert.deepEqual(revoked, [], 'the address stays until the browser has started the download');
  h.timers.filter(Boolean).forEach((t) => t.fn());
  assert.deepEqual(revoked, ['blob:x'], 'and is released afterwards');
  saved.length = 0;
  click('download');
  assert.deepEqual(JSON.parse(saved[0]).answers.Q04, ['microsoft']);
  assert.equal(saved[2], 'bi-playbook-answers.json');
  answerAll(h);
  assert.ok(!/data-action="pdf" disabled/.test(sec(h, 'discovery')), 'the PDF button works once everything is answered');
});

// ------------------------------------------------------------------ the question carousel

test('opening an area shows one question in a dialog with the area title, a progress bar, arrows, a close button and the top three', () => {
  const h = load(memoryStorage());
  h.api.openDiscovery('2');
  assert.ok(h.api.overlayOpen());
  const html = h.overlay.innerHTML;
  assert.match(html, /data-action="prev"[^>]*disabled/, 'the first question of an area has nothing before it');
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(html, /<h2 id="pb-ovl-title">Data, security and governance<\/h2>/);
  assert.match(html, /Area 2 of 5/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /data-action="next"/);
  assert.match(html, /data-action="close"/);
  assert.match(html, /Question 1 of 5/);
  assert.equal((html.match(/<fieldset/g) || []).length, 1, 'one question at a time');
  assert.match(html, /will appear here after your first scored answer/);
  assert.equal(h.overlay.hidden, false);
  h.api.closeDiscovery();
  assert.equal(h.overlay.innerHTML, '');
  assert.equal(h.overlay.hidden, true);
  assert.equal(h.api.tab, 'discovery', 'closing drops back to the discovery page');
});

test('the questionnaire is accessible by construction: every option sits in a label, every group has a legend, ids are unique', () => {
  const h = load(memoryStorage());
  h.api.answer('Q10', ['client_team']);
  for (const s of ['1', '2', '3', '4', '5']) {
    h.api.openDiscovery(s);
    const html = h.overlay.innerHTML;
    const inputs = (html.match(/<input type="(radio|checkbox)"/g) || []).length;
    const labelled = (html.match(/<label class="pb-opt[^"]*"[^>]*><input type="(radio|checkbox)"/g) || []).length;
    assert.ok(inputs >= 3, `area ${s} has options`);
    assert.equal(labelled, inputs, `area ${s}: every option input is wrapped in its own label`);
    assert.equal((html.match(/<fieldset/g) || []).length, (html.match(/<legend>/g) || []).length, 'every fieldset has a legend');
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `area ${s}: ids are unique`);
    h.api.closeDiscovery();
  }
  h.api.openDiscovery('1');
  const q = h.api.session().visible().filter((v) => v.id === h.api.step().qid)[0];
  assert.ok(h.overlay.innerHTML.includes(`<span class="pb-qtext">${q.text.replace(/&/g, '&amp;')}</span></legend>`), 'the legend carries the question text');
});

test('follow-up questions open inside the card of the question that triggers them', () => {
  const h = load(memoryStorage());
  h.api.openDiscovery('Q10');
  assert.equal(h.api.step().qid, 'Q10');
  assert.ok(!/Follow-up/.test(h.overlay.innerHTML), 'none until the parent is answered');
  h.api.answer('Q10', ['client_team']);
  const html = h.overlay.innerHTML;
  assert.match(html, /class="pb-follow is-new"/, 'the follow-up block appears (and animates) when the answer opens it');
  const parent = fieldset(html, 'Q10');
  assert.ok(parent.includes('id="q-Q11"') && parent.includes('id="q-Q12"'), 'Q11 and Q12 sit inside the Q10 card');
  assert.match(parent, /Follow-up/);
  h.api.answer('Q11', ['beginner']);
  assert.ok(!/class="pb-follow is-new"/.test(h.overlay.innerHTML), 'it does not replay its animation on later answers');
  h.api.answer('Q10', ['jman']);
  assert.ok(!/id="q-Q11"/.test(h.overlay.innerHTML), 'closing the branch removes the follow-ups');
  assert.match(h.overlay.innerHTML, /were cleared because that part of the questionnaire no longer applies/);
  assert.match(h.overlay.innerHTML, /data-action="undo"/);
  // the steps never list a follow-up question on its own
  h.api.answer('Q10', ['joint_delivery']);
  h.api.openDiscovery('3');
  assert.equal(h.api.step().count, 2, 'the area has two questions of its own');
  assert.equal(h.api.step().qid, 'Q10');
  h.api.move(1);
  assert.equal(h.api.step().qid, 'Q24');
});

test('migration questions come last, all as follow-ups inside the existing-reporting question', () => {
  const h = load(memoryStorage());
  h.api.openDiscovery('5');
  assert.equal(h.api.step().count, 1, 'with nothing answered, only the gate question is asked');
  h.api.answer('Q13', ['yes']);
  h.api.openDiscovery('Q13');
  assert.equal(h.api.step().count, 1, 'every migration question is a follow-up of it, never a card of its own');
  const q13 = fieldset(h.overlay.innerHTML, 'Q13');
  for (const id of ['Q14', 'Q15', 'Q17', 'Q20']) assert.ok(q13.includes(`id="q-${id}"`), `${id} sits inside the existing-reporting card`);
  h.api.answer('Q13', ['no']);
  assert.ok(!/id="q-Q17"/.test(h.overlay.innerHTML) && !/id="q-Q20"/.test(h.overlay.innerHTML), 'a client with nothing to migrate is not asked them');
  // data landscape (Q16, Q18, Q19) is asked before the migration area, of everyone
  h.api.openDiscovery('4');
  const area4 = [h.api.step().qid];
  h.api.move(1); area4.push(h.api.step().qid);
  h.api.move(1); area4.push(h.api.step().qid);
  assert.deepEqual(area4, ['Q16', 'Q18', 'Q19']);
});

test('Enter goes to the next open question; skipped ones come round again; an area is finished only when none is open', () => {
  const h = load(memoryStorage());
  h.api.openDiscovery('1');
  assert.equal(h.api.step().qid, 'Q01');
  h.api.advance();                                    // Q01 is open: Enter skips it
  assert.equal(h.api.step().qid, 'Q02', 'on to the next open question');
  h.api.answer('Q02', ['finance']);
  h.api.advance();
  assert.equal(h.api.step().qid, 'Q03');
  for (const [id, a] of [['Q03', 'no'], ['Q04', 'microsoft'], ['Q21', 'important'], ['Q22', 'ai_assisted'], ['Q23', 'balanced']]) { h.api.openDiscovery(id); h.api.answer(id, [a]); }
  h.api.openDiscovery('Q25'); h.api.answer('Q25', ['u_51_100']);
  // everything but the skipped Q01 is answered: from the last question Enter wraps round to it
  h.api.openDiscovery('Q25');
  h.api.advance();
  assert.equal(h.api.step().qid, 'Q01', 'the skipped question is queued again');
  // the only open question: Enter says so and stays
  h.api.advance();
  assert.equal(h.api.step().qid, 'Q01');
  assert.match(h.overlay.innerHTML, /This is the last open question in this area/);
  h.api.answer('Q01', ['self_service_analytics_and_reporting']);
  assert.ok(!/This is the last open question/.test(h.overlay.innerHTML), 'the hint goes with the answer');
  h.api.advance();                                    // area 1 is complete: it says so first
  assert.equal(h.api.step().kind, 'done');
  assert.equal(h.api.step().section, '1');
  assert.match(h.overlay.innerHTML, /<h3 tabindex="-1">Area 1 complete<\/h3><p>All 8 questions in “Business context and goals” answered\.<\/p><p class="pb-done-next">Next: Data, security and governance<\/p>/);
  h.api.advance();                                    // a held-down Enter does not skip the message
  assert.equal(h.api.step().kind, 'done', 'Enter within half a second is ignored');
  h.timers.filter(Boolean).forEach((t) => t.fn());    // a moment later the card fades out and the next area that has open questions opens
  assert.equal(h.api.step().kind, 'q');
  assert.equal(h.api.step().section, '2');
  assert.equal(h.api.step().qid, 'Q05');
});

test('finishing an area says so, fades out, and opens the next one; the last area shows the winner, and Enter opens the recommendation', () => {
  const h = load(memoryStorage());
  answerAll(h, ['Q13']);
  h.api.openDiscovery('Q13');
  h.api.advance();                                    // Q13 is open and alone
  assert.equal(h.api.step().qid, 'Q13');
  h.api.answer('Q13', ['no']);
  h.api.advance();                                    // nothing is open any more
  assert.equal(h.api.step().kind, 'end');
  let html = h.overlay.innerHTML;
  assert.match(html, /class="pb-winner"/);
  assert.match(html, /All areas are complete/);
  assert.match(html, /data-action="finish"/);
  assert.ok(!h.timers.filter(Boolean).length, 'no countdown: it waits for the reader');
  h.api.advance();                                    // Enter on the winner
  assert.equal(h.api.overlayOpen(), false);
  assert.equal(h.api.tab, 'discovery', 'the recommendation is further down the same page');
  // two areas open: finishing the first goes straight to the second
  const g = load(memoryStorage());
  answerAll(g, ['Q05', 'Q06', 'Q26', 'Q07', 'Q08', 'Q16', 'Q18', 'Q19']);
  g.api.openDiscovery('2');
  assert.equal(g.api.step().section, '2');
  for (const id of ['Q05', 'Q06', 'Q26', 'Q07', 'Q08']) { g.api.openDiscovery(id); g.api.answer(id, [g.api.session().visible().find((v) => v.id === id).options.find((o) => !o.unknown).id]); }
  g.api.advance();
  assert.equal(g.api.step().kind, 'done');
  assert.match(g.overlay.innerHTML, /Area 2 complete[\s\S]*Next: Data landscape and delivery/, 'it names the area that follows, skipping the one answered already');
  g.timers.filter(Boolean).forEach((t) => t.fn());
  assert.equal(g.api.step().section, '4', 'area 2 is done, area 3 was answered already: on to area 4');
});

test('nothing moves on by itself while a question is open: there are no countdowns, and answering only waits for Enter or the arrows', () => {
  const h = load(memoryStorage());
  h.api.openDiscovery('Q04');
  h.api.answer('Q04', ['microsoft']);
  assert.ok(!h.timers.filter(Boolean).length, 'no timer after an answer');
  assert.ok(!/pb-prog-sweep/.test(h.overlay.innerHTML));
  assert.equal(h.api.step().qid, 'Q04', 'still on the same question');
  assert.match(h.overlay.innerHTML, /class="pb-keys pb-keys-bar"><kbd>Enter<\/kbd> next question/, 'the keys are said on screen');
  h.api.openDiscovery('Q10');
  h.api.answer('Q10', ['client_team']);
  assert.match(h.overlay.innerHTML, /Answer the follow-up questions, or press Enter to skip them/);
  assert.ok(!h.timers.filter(Boolean).length);
  const src = read('src/page/playbook.js');
  assert.ok(!/QUESTION_SECONDS|SECTION_SECONDS|WINNER_SECONDS|armQuestionTimer/.test(src), 'the countdown code is gone');
});

test('Enter, the arrow keys and the arrow buttons move between questions; arrows stop at the first question', () => {
  const h = load(memoryStorage());
  h.api.openDiscovery('1');
  assert.match(h.overlay.innerHTML, /data-action="prev"[^>]*disabled/);
  assert.match(h.overlay.innerHTML, /<svg class="pb-ico pb-ico-left"/);
  press(h, 'ArrowRight', { tagName: 'INPUT', type: 'checkbox' });
  assert.equal(h.api.step().qid, 'Q02', 'the arrow keys work even when an answer has focus');
  press(h, 'ArrowLeft');
  assert.equal(h.api.step().qid, 'Q01');
  press(h, 'ArrowLeft');
  assert.equal(h.api.step().qid, 'Q01', 'nothing before the first question');
  press(h, 'Enter', { tagName: 'INPUT', type: 'radio' });
  assert.equal(h.api.step().qid, 'Q02', 'Enter on an answer goes on to the next open question');
  press(h, 'Enter', { tagName: 'TEXTAREA' });
  assert.equal(h.api.step().qid, 'Q02', 'Enter in a note is a new line, not a move');
  press(h, 'ArrowRight', { tagName: 'TEXTAREA' });
  assert.equal(h.api.step().qid, 'Q02', 'and so are the arrows');
  press(h, 'Enter', { tagName: 'BUTTON' });
  assert.equal(h.api.step().qid, 'Q02', 'a focused button does its own job');
});

test('an area with every question answered opens as a review: all its questions together; Start goes straight to the recommendation when everything is answered', () => {
  const h = load(memoryStorage());
  answerAll(h);
  const html0 = sec(h, 'discovery');
  assert.match(html0, /data-action="openq">See the recommendation/);
  h.api.openDiscovery();                              // the Start button
  assert.equal(h.api.overlayOpen(), false, 'no walk through the questions');
  assert.equal(h.api.tab, 'discovery');
  h.api.openDiscovery('1');                           // a card of a finished area
  assert.equal(h.api.step().kind, 'review');
  const html = h.overlay.innerHTML;
  assert.match(html, /Review · Area 1 of 5/);
  assert.equal((html.match(/<fieldset class="pb-q/g) || []).length, 8, 'all eight questions at once');
  assert.match(html, /Question 1 of 8/);
  assert.match(html, /Question 8 of 8/);
  assert.match(html, /data-action="prev"[^>]*disabled/);
  assert.match(html, /data-action="next"[^>]*disabled/);
  assert.ok(!/pb-keys-bar/.test(html));
  // an answer can be changed in the review
  h.api.answer('Q03', ['yes']);
  assert.match(h.overlay.innerHTML, /id="o-Q03-yes"[^>]*checked/);
  assert.equal(h.api.step().kind, 'review', 'it stays a review');
  press(h, 'Enter', { tagName: 'INPUT', type: 'radio' });
  assert.equal(h.api.overlayOpen(), true, 'Enter on an answer does not close a review');
  press(h, 'Enter');
  assert.equal(h.api.overlayOpen(), false, 'Enter closes it');
});

test('a started area opens at its first open question, not at the top', () => {
  const h = load(memoryStorage());
  h.api.answer('Q01', ['self_service_analytics_and_reporting']);
  h.api.answer('Q02', ['finance']);
  h.api.openDiscovery('1');
  assert.equal(h.api.step().kind, 'q');
  assert.equal(h.api.step().qid, 'Q03');
  h.api.closeDiscovery();
  h.api.openDiscovery();                              // Start: the first area that has an open question
  assert.equal(h.api.step().section, '1');
  answerAll(h, ['Q10', 'Q24']);
  h.api.openDiscovery();
  assert.equal(h.api.step().section, '3', 'the first area that still has something open');
});

test('the live top three: sized by rank, a name on hover, and a popup with the reasons and the tools ranked either side', () => {
  const h = load(memoryStorage());
  h.api.openDiscovery('Q04');
  assert.match(h.overlay.innerHTML, /will appear here after your first scored answer/);
  h.api.answer('Q04', ['salesforce']);
  const html = h.overlay.innerHTML;
  assert.ok(!/Top three so far|provisional<\/em>/.test(html), 'no heading: the dock stands on its own');
  assert.match(html, /class="pb-top3 pb-dock"/);
  const logos = [...html.matchAll(/class="pb-logo-btn pb-r(\d)" data-action="tool" data-tool="(\w+)" aria-label="Rank (=?\d): ([^.]+)\./g)].map((m) => ({ size: m[1], id: m[2], rank: m[3], name: m[4] }));
  assert.equal(logos.length, 3);
  assert.equal(logos[0].id, 'tableau');
  assert.deepEqual(logos.map((l) => l.size), ['1', '2', '3'], 'the leader is the largest');
  assert.match(html, /<span class="pb-tip" role="tooltip">Tableau<\/span>/);
  assert.ok(!/pb-pop-wrap/.test(html), 'no popup until a logo is clicked');
  h.api.showTool('tableau');
  let pop = h.overlay.innerHTML;
  assert.match(pop, /id="pb-pop-title">Tableau<\/h3>/);
  assert.match(pop, /aria-label="Rank 1"/);
  assert.match(pop, /Why it fits/);
  assert.match(pop, /pb-pop-nav is-off/, 'nothing ranked above the leader');
  assert.match(pop, /aria-label="Next ranked: [^"]+"/);
  assert.ok(pop.indexOf('pb-pop-nav pb-pop-nav-next') > pop.indexOf('class="pb-pop"') && pop.indexOf('pb-pop-nav pb-pop-nav-next') > pop.indexOf('</header>'), 'the next-ranked tool sits to the right');
  assert.ok(/class="pb-pop-row">[\s\S]*<div class="pb-pop" role="dialog"[\s\S]*<\/div><button class="pb-pop-nav pb-pop-nav-next"/.test(pop), 'and outside the popup card');
  assert.match(pop, /<svg class="pb-ico pb-ico-right"/, 'arrows are icons, not text glyphs');
  assert.match(pop, /data-action="popclose"/);
  const next = pop.match(/aria-label="Next ranked: ([^"]+)"/)[1];
  h.api.showTool(logos[1].id);
  pop = h.overlay.innerHTML;
  assert.ok(pop.includes(`id="pb-pop-title">${next}</h3>`));
  assert.match(pop, /aria-label="Previous ranked: Tableau"/);
  h.listeners.click.forEach((fn) => fn({ target: { closest: () => ({ tagName: 'DIV', getAttribute: (k) => ({ 'data-action': 'popclose' }[k]) }) } }));
  assert.ok(!/pb-pop-wrap/.test(h.overlay.innerHTML));
});

test('ties in the top three get the same size and a shared rank', () => {
  const h = load(memoryStorage());
  h.api.openDiscovery('Q03');
  h.api.answer('Q03', ['no']);                  // Sigma and Tableau tie for first
  const html = h.overlay.innerHTML;
  assert.match(html, /pb-logo-btn pb-r1" data-action="tool" data-tool="sigma" aria-label="Rank =1/);
  assert.match(html, /pb-logo-btn pb-r1" data-action="tool" data-tool="tableau" aria-label="Rank =1/);
});

test('logos come from the build when it has them, and a neutral monogram stands in when it has not', () => {
  const h = load(memoryStorage(), { logos: { tableau: 'assets/logos/tableau.png', powerbi: 'assets/logos/powerbi.png' } });
  h.api.openDiscovery('Q04');
  h.api.answer('Q04', ['salesforce']);
  assert.match(h.overlay.innerHTML, /<img class="pb-logo " src="assets\/logos\/tableau\.png"/);
  h.api.showTool('tableau');
  assert.match(h.overlay.innerHTML, /pb-logo-md" src="assets\/logos\/tableau\.png"/);
  const bare = load(memoryStorage());
  bare.api.openDiscovery('Q04');
  bare.api.answer('Q04', ['salesforce']);
  assert.match(bare.overlay.innerHTML, /pb-mono[^>]*>T<\/span>/, 'a monogram, with no brand colour');
});

test('while a question is a draft it can be hidden, its saved answer is kept, and it returns when shown again', () => {
  const store = memoryStorage();
  const withDraft = json('data/questions.json');
  withDraft.questions.find((q) => q.id === 'Q21').status = 'draft';
  const h = load(store, {}, withDraft);
  h.api.answer('Q21', ['critical']);
  h.api.answer('Q04', ['microsoft']);
  h.api.openDiscovery('1');
  assert.match(h.overlay.innerHTML, /Question 1 of 8/);
  h.api.setShowDrafts(false);
  h.api.openDiscovery('1');
  assert.match(h.overlay.innerHTML, /Question 1 of 7/);
  assert.ok(!('Q21' in h.api.session().answers));
  assert.deepEqual(JSON.parse(store.m['bi-playbook-v1']).answers.Q21, ['critical'], 'the hidden draft answer is kept');
  h.api.setShowDrafts(true);
  assert.equal(JSON.stringify(h.api.session().answers.Q21), '["critical"]', 'and comes back when drafts are shown again');
});

test('each question has a one-line guide, and none of them names a tool or a score', () => {
  const h = load(memoryStorage());
  h.api.answer('Q10', ['client_team']);
  h.api.answer('Q13', ['yes']);
  const seen = new Set();
  for (const s of ['1', '2', '3', '4', '5']) {
    h.api.openDiscovery(s);
    for (let i = 0; i < 12 && h.api.step().kind === 'q'; i++) {
      const html = h.overlay.innerHTML;
      for (const f of html.split('<fieldset').slice(1)) {
        assert.match(f, /<p class="pb-help">/, 'a guide line is present');
        seen.add(/id="q-(Q\d+)"/.exec(f)[1]);
      }
      const guides = [...html.matchAll(/<p class="pb-help">([^<]*)<\/p>/g)].map((m) => m[1]);
      for (const g of guides) assert.ok(!/power bi|looker|qlik|sigma|tableau|thoughtspot|score|weight|rank/i.test(g.replace(/Ask this for every client/, '')), `a guide must not mention a tool or scoring: ${g}`);
      h.api.move(1);
    }
  }
  assert.equal(seen.size, 25, 'all 25 questions were shown with a guide');
});

// ------------------------------------------------------------------ double-click and keys

test('double-clicking a chosen answer clears it: a single answer becomes unanswered, one of several is removed', () => {
  const h = load(memoryStorage());
  h.api.answer('Q04', ['microsoft']);
  h.api.clearOption('Q04', 'microsoft');
  assert.ok(!('Q04' in h.api.session().answers), 'a single answer is cleared');
  h.api.answer('Q01', ['self_service_analytics_and_reporting', 'faster_data_driven_decision_making']);
  h.api.clearOption('Q01', 'faster_data_driven_decision_making');
  assert.equal(JSON.stringify(h.api.session().answers.Q01), '["self_service_analytics_and_reporting"]', 'only the double-clicked answer is removed');
  h.api.clearOption('Q01', 'faster_data_driven_decision_making');      // not selected: nothing happens
  assert.equal(JSON.stringify(h.api.session().answers.Q01), '["self_service_analytics_and_reporting"]');
  h.api.clearOption('Q01', 'self_service_analytics_and_reporting');
  assert.ok(!('Q01' in h.api.session().answers));
  assert.deepEqual(JSON.parse(JSON.stringify(h.api.session().result().ranking.map((r) => r.rank))), [1, 1, 1, 1, 1, 1], 'with no answers every tool is level');
});

test('a quick second change to the same checkbox is a double-click and clears it; a slow one is two ordinary clicks', () => {
  const h = load(memoryStorage());
  h.api.openDiscovery('Q01');
  const input = (v, checked) => ({ id: 'o-Q01-' + v, type: 'checkbox', value: v, checked, tagName: 'INPUT', matches: () => true, getAttribute: (k) => ({ 'data-qid': 'Q01' }[k]) });
  const change = (target) => h.listeners.change[h.listeners.change.length - 1]({ target });
  const A = 'self_service_analytics_and_reporting', B = 'faster_data_driven_decision_making';
  h.api.answer('Q01', [A, B]);
  h.setChecked([input(A, true)]); change(input(B, false));
  assert.equal(JSON.stringify(h.api.session().answers.Q01), JSON.stringify([A]), 'first toggle: B off');
  h.setChecked([input(A, true), input(B, true)]); change(input(B, true));
  assert.equal(JSON.stringify(h.api.session().answers.Q01), JSON.stringify([A]), 'second toggle in the same moment: B stays cleared');
  let t = Date.now();
  h.ctx.Date = class extends Date { static now() { return t; } };       // the module reads Date.now() from its own global
  h.setChecked([input(A, true), input(B, true)]); change(input(B, true));
  assert.equal(JSON.stringify(h.api.session().answers.Q01), JSON.stringify([A, B]), 'a lone click selects');
  t += 2000; h.setChecked([input(A, true)]); change(input(B, false));
  assert.equal(JSON.stringify(h.api.session().answers.Q01), JSON.stringify([A]), 'a click two seconds later is a normal toggle');
});

test('Escape closes the questions (or the popup first)', () => {
  const h = load(memoryStorage());
  h.api.openDiscovery('Q04');
  h.api.answer('Q04', ['salesforce']);
  h.api.showTool('tableau');
  press(h, 'Escape');
  assert.ok(!/pb-pop-wrap/.test(h.overlay.innerHTML) && h.api.overlayOpen(), 'the first Escape puts the popup away');
  press(h, 'Escape');
  assert.equal(h.api.overlayOpen(), false);
});

test('after the last open question the winner is shown alone in the middle, and the reader opens the recommendation', () => {
  const h = load(memoryStorage());
  answerAll(h, ['Q13']);
  h.api.openDiscovery('Q13'); h.api.answer('Q13', ['no']); h.api.advance();
  const html = h.overlay.innerHTML;
  assert.match(html, /class="pb-winner"/);
  assert.match(html, /<p class="pb-winner-kicker">Best fit<\/p>/);
  assert.equal((html.match(/class="pb-winner-logo"/g) || []).length, 1, 'the winner alone');
  assert.match(html, /All areas are complete/);
  assert.ok(!h.timers.filter(Boolean).length, 'it stays until the reader moves on');
});

test('the best fit is one full card with its logo, and the other tools are grey logos that swap the card when picked', () => {
  const h = load(memoryStorage(), { logos: { tableau: 'assets/logos/tableau.png' } });
  h.api.answer('Q04', ['salesforce']);
  let html = sec(h, 'shortlist');
  assert.equal((html.match(/<article/g) || []).length, 1, 'only the best fit gets a card');
  assert.match(html, /<article class="pb-card pb-tool is-best" data-tool="tableau"><header><span class="pb-rank"[^>]*>1<\/span><span class="pb-card-logo"><img class="pb-logo " src="assets\/logos\/tableau\.png"/);
  assert.match(html, /<span class="pb-bestflag">Best fit<\/span>/);
  const side = [...html.matchAll(/class="pb-side-logo" data-action="short" data-tool="(\w+)"/g)].map((m) => m[1]);
  assert.equal(side.length, 5, 'every other tool is a logo');
  assert.ok(!side.includes('tableau'));
  assert.match(html, /aria-label="Rank 2: [^"]+\. Show its reasons\."/);
  assert.ok(!/Why it fits[\s\S]*Why it fits/.test(html), 'only one set of reasons');
  h.listeners.click.forEach((fn) => fn({ target: { closest: () => ({ tagName: 'BUTTON', getAttribute: (k) => ({ 'data-action': 'short', 'data-tool': side[0] }[k]) }) } }));
  html = sec(h, 'shortlist');
  assert.match(html, new RegExp(`<article class="pb-card pb-tool" data-tool="${side[0]}"`), 'picking a logo shows that tool');
  assert.match(html, /Back to the best fit/);
  assert.match(html, /class="pb-side-logo" data-action="short" data-tool="tableau"[^>]*aria-label="Best fit: Tableau/, 'the best fit stays one click away');
});

test('the recommendation stays closed until every question has an answer', () => {
  const h = load(memoryStorage(), { lockUntilComplete: true });
  h.api.answer('Q04', ['salesforce']);
  h.api.go('shortlist');
  let html = h.container.innerHTML;
  assert.match(html, /id="sec-locked"/);
  assert.match(html, /The recommendation opens once every question has an answer/);
  assert.match(html, /1 of 19<\/strong> questions answered\. 18 to go\./);
  assert.ok(!/pb-tool|Best fit<\/h2>|pb-subtab/.test(html), 'no result, no tabs');
  assert.match(html, /data-action="openq">Continue the questions/);
  for (const id of ['migration', 'final']) { h.api.go(id); assert.match(h.container.innerHTML, /id="sec-locked"/, `${id} is closed too`); }
  // the carousel's last card asks for what is missing instead of showing a winner
  assert.match(h.container.innerHTML, /data-action="openq">Continue the questions/);
  // answering everything opens it
  for (let i = 0; i < 60 && h.api.session().openQuestions().length; i++) {
    const q = h.api.session().visible().find((v) => !v.answered);
    h.api.answer(q.id, [q.options.find((o) => !o.unknown).id]);
  }
  h.api.go('shortlist');
  assert.ok(!/id="sec-locked"/.test(h.container.innerHTML));
  assert.match(h.container.innerHTML, /pb-tool is-best/);
});

test('the matrix shows its groups closed with one short line for each tool, tints the leaders, and shows the criteria as children when a group is opened', () => {
  const h = load(memoryStorage());
  const groups = json('data/deck/matrix.json').groups;
  const tools = ['looker', 'powerbi', 'qlik', 'sigma', 'tableau', 'thoughtspot'];
  let html = sec(h, 'matrix');
  const cols = [...html.matchAll(/<th scope="col"><span class="pb-colhead">[\s\S]*?<span>([^<]+)<\/span><\/span><\/th>/g)].map((m) => m[1]);
  assert.deepEqual([...cols], ['Looker', 'Power BI', 'Qlik', 'Sigma', 'Tableau', 'ThoughtSpot'], 'alphabetical');
  assert.equal((html.match(/class="pb-groupbtn"/g) || []).length, groups.length, 'one row per group');
  assert.equal((html.match(/aria-expanded="false"/g) || []).length, groups.length, 'all closed to start with');
  assert.equal((html.match(/pb-childrow/g) || []).length, 0, 'no criteria until a group is opened');
  assert.match(html, new RegExp(`${groups[0].name}</span><span class="pb-groupmeta">${groups[0].criteria.length} criteria`));
  // a closed row reads as a row of the matrix: a cell per tool, each a short line (never a bare count)
  assert.equal((html.match(/class="pb-groupcell/g) || []).length, groups.length * 6);
  assert.ok(!/criteria led/.test(html), 'every group and tool has its own line');
  assert.ok(!/\d of \d<\/td>/.test(html), 'no "1 of 3" counts');
  const cells = [...html.matchAll(/<td class="pb-groupcell[^"]*">(?:<span class="pb-sr">Leads this group\. <\/span>)?([^<]+)<\/td>/g)].map((m) => m[1]);
  assert.equal(cells.length, groups.length * 6);
  for (const c of cells) assert.ok(c.length <= 62, `short enough to sit in a cell: ${c}`);
  assert.equal(new Set(cells).size, cells.length, 'no line repeats');
  const ba = html.slice(html.indexOf('Business Adoption</span>'), html.indexOf('AI &amp; Analytics</span>'));
  assert.match(ba, /pb-groupcell is-win"><span class="pb-sr">Leads this group\. <\/span>Fastest for spreadsheet teams, easy to edit/);
  assert.equal((ba.match(/is-win/g) || []).length, 1, 'one winner there');
  const ai = html.slice(html.indexOf('AI &amp; Analytics</span>'), html.indexOf('Enterprise Readiness</span>'));
  assert.equal((ai.match(/is-win/g) || []).length, 3, 'a tie tints every tied tool');
  assert.ok(!/Most leads:|Tied:/.test(html), 'the tint says it, no extra words');
  const click = (attrs) => h.listeners.click[1]({ target: { closest: () => ({ tagName: 'BUTTON', getAttribute: (k) => attrs[k] }) } });
  click({ 'data-action': 'mgroup', 'data-group': '0' });
  html = sec(h, 'matrix');
  assert.equal((html.match(/class="pb-childrow/g) || []).length, groups[0].criteria.length, 'only that group opened');
  assert.match(html, /pb-childrow is-last/, 'the last child closes the connector');
  const leadsIn0 = groups[0].criteria.reduce((n, c) => n + tools.filter((t) => c.cells[t].leads).length, 0);
  assert.equal((html.match(/<td class="is-lead">/g) || []).length, leadsIn0, 'the deck’s leaders are tinted, no others');
  assert.ok(!/pb-cell-d/.test(html), 'six tools: headlines only');
  click({ 'data-action': 'mall', 'data-open': '1' });
  html = sec(h, 'matrix');
  assert.equal((html.match(/class="pb-childrow/g) || []).length, 14, 'the deck\'s 14 criteria');
  assert.match(html, /Fastest to adopt/);
  assert.match(html, /Collapse all groups/);
  click({ 'data-action': 'mall', 'data-open': '0' });
  assert.equal((sec(h, 'matrix').match(/pb-childrow/g) || []).length, 0);
});

test('the matrix takes the place of the 1 v 1 view: pick the tools to show, at least two stay, and with three or fewer each cell gives its detail', () => {
  const h = load(memoryStorage());
  const click = (attrs) => h.listeners.click[1]({ target: { closest: () => ({ tagName: 'BUTTON', getAttribute: (k) => attrs[k] }) } });
  const shown = () => [...sec(h, 'matrix').matchAll(/<th scope="col"><span class="pb-colhead">[\s\S]*?<span>([^<]+)<\/span><\/span><\/th>/g)].map((m) => m[1]);
  let html = sec(h, 'matrix');
  assert.equal((html.match(/data-action="mtool"/g) || []).length, 6, 'a switch for each tool');
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 6, 'all on to start with');
  assert.ok(!/select|1 v 1|Compare two tools in depth/.test(html), 'no separate comparison view');
  for (const t of ['powerbi', 'qlik', 'sigma', 'thoughtspot']) click({ 'data-action': 'mtool', 'data-tool': t });
  assert.deepEqual([...shown()], ['Looker', 'Tableau'], 'two tools left, still alphabetical');
  html = sec(h, 'matrix');
  assert.ok(!/Choose the tools to show|Head to head/.test(html), 'no explanatory line under the switches');
  assert.equal((html.match(/aria-disabled="true"/g) || []).length, 2, 'the last two cannot be switched off');
  click({ 'data-action': 'mtool', 'data-tool': 'looker' });
  assert.deepEqual([...shown()], ['Looker', 'Tableau'], 'a third cannot be dropped');
  // winners are among the tools shown: Tableau and Looker tie on Business Adoption? check by the deck
  const groups = json('data/deck/matrix.json').groups;
  const leadsOf = (g, t) => g.criteria.filter((c) => c.cells[t].leads).length;
  const row = (g) => { const i = html.indexOf(`${g.name.replace('&', '&amp;')}</span>`); return html.slice(i, html.indexOf('</tr>', i)); };
  for (const g of groups) {
    const a = leadsOf(g, 'looker'), b = leadsOf(g, 'tableau');
    const wins = (row(g).match(/is-win/g) || []).length;
    assert.equal(wins, a === b ? (a ? 2 : 0) : 1, g.name);
  }
  click({ 'data-action': 'mall', 'data-open': '1' });
  html = sec(h, 'matrix');
  assert.equal((html.match(/pb-cell-d/g) || []).length, 14 * 2, 'a detail line under every headline');
  assert.match(html, /needs LookML built first/);
  click({ 'data-action': 'mtool', 'data-tool': 'qlik' });
  assert.equal((sec(h, 'matrix').match(/pb-cell-d/g) || []).length, 14 * 3, 'three tools still show the detail');
  click({ 'data-action': 'mtool', 'data-tool': 'sigma' });
  assert.ok(!/pb-cell-d/.test(sec(h, 'matrix')), 'four tools: headlines only');
  click({ 'data-action': 'mall-tools' });
  assert.equal(shown().length, 6);
});

test('the burger menu lists every area and question, marks answers and the current question, and jumps', () => {
  const h = load(memoryStorage());
  h.api.answer('Q10', ['client_team']);
  h.api.answer('Q04', ['microsoft']);
  h.api.openDiscovery('Q04');
  assert.match(h.overlay.innerHTML, /class="pb-ovl-burger" data-action="menu"[^>]*aria-expanded="false"/);
  assert.ok(!/pb-menu-wrap/.test(h.overlay.innerHTML), 'closed until asked');
  h.api.menu(true);
  const html = h.overlay.innerHTML;
  assert.match(html, /aria-expanded="true"/);
  const areas = [...html.matchAll(/data-action="jumpsec" data-section="(\d)"/g)].map((m) => m[1]);
  assert.deepEqual(areas, ['1', '2', '3', '4', '5']);
  const qs = [...html.matchAll(/data-action="jump" data-qid="(Q\d+)"/g)].map((m) => m[1]);
  assert.equal(qs.length, h.api.session().visible().length, 'every question that is asked now');
  assert.ok(qs.indexOf('Q11') === qs.indexOf('Q10') + 1, 'an open follow-up sits right under its parent');
  assert.match(html, /<li class="is-nested"><button class="pb-menu-q/);
  assert.match(html, /pb-menu-q is-answered is-here" data-action="jump" data-qid="Q04" aria-current="step"/, 'the current question is marked, and answered ones are ticked');
  assert.match(html, /<svg class="pb-ico pb-ico-check"/);
  h.api.jump('Q12');
  assert.equal(h.api.step().qid, 'Q10', 'a follow-up jumps to the question that holds it');
  assert.ok(!/pb-menu-wrap/.test(h.overlay.innerHTML), 'the menu closes after a jump');
  h.api.menu(true);
  h.listeners.keydown.forEach((fn) => fn({ key: 'Escape', target: { tagName: 'DIV' }, preventDefault() {} }));
  assert.ok(!/pb-menu-wrap/.test(h.overlay.innerHTML) && h.api.overlayOpen(), 'Escape closes the menu first');
  h.api.menu(true);
  h.listeners.click.forEach((fn) => fn({ target: { closest: () => ({ tagName: 'BUTTON', getAttribute: (k) => ({ 'data-action': 'jumpsec', 'data-section': '5' }[k]) }) } }));
  assert.equal(h.api.step().section, '5');
  assert.equal(h.api.step().qid, 'Q13');
});

test('leaving the questions unfinished shrinks them into a corner window that stays until every question is answered, and reopens where they were left', () => {
  const h = load(memoryStorage());
  assert.equal(h.api.minimized(), false);
  assert.equal(h.mini.hidden, true, 'nothing to show before the questions are started');
  h.api.openDiscovery('Q10');
  h.api.answer('Q04', ['microsoft']);
  h.api.closeDiscovery();
  assert.equal(h.api.overlayOpen(), false);
  assert.ok(h.api.minimized());
  assert.equal(h.mini.hidden, false);
  assert.match(h.mini.innerHTML, /data-action="resume" aria-label="Resume the questions: 1 of 19 answered"/);
  assert.match(h.mini.innerHTML, /1 of 19 answered · Skills and change readiness/, 'it says where they are');
  assert.match(h.mini.innerHTML, /class="pb-mini-ring" style="--p:5%"/);
  h.api.go('compare');                      // it follows the reader to other pages
  assert.equal(h.mini.hidden, false);
  h.listeners.click.forEach((fn) => fn({ target: { closest: () => ({ tagName: 'BUTTON', getAttribute: (k) => ({ 'data-action': 'resume' }[k]) }) } }));
  assert.ok(h.api.overlayOpen(), 'a click reopens them');
  assert.equal(h.api.step().qid, 'Q10', 'at the question that was left');
  assert.equal(h.api.tab, 'discovery');
  assert.equal(h.mini.hidden, true, 'the corner window goes while the questions are open');
  // finishing everything closes them for good
  for (let i = 0; i < 60 && h.api.session().openQuestions().length; i++) {
    const q = h.api.session().visible().find((v) => !v.answered);
    h.api.answer(q.id, [q.options.find((o) => !o.unknown).id]);
  }
  h.api.closeDiscovery();
  assert.equal(h.api.minimized(), false);
  assert.equal(h.mini.hidden, true, 'nothing is left to resume');
  // a questionnaire that was started in an earlier visit keeps its corner window on load, and Start over removes it
  const store = memoryStorage();
  const a = load(store); a.api.answer('Q04', ['microsoft']);
  const b = load(store);
  assert.equal(b.mini.hidden, false);
  b.api.reset();
  assert.equal(b.mini.hidden, true);
});

test('the disclaimers appear once, at the bottom of every page, and nowhere in the middle', () => {
  const h = load(memoryStorage());
  h.api.answer('Q04', ['salesforce']);
  for (const id of ['overview', 'dictionary', 'matrix', 'discovery', 'shortlist', 'migration', 'final']) {
    h.api.go(id);
    const page = h.container.innerHTML;
    assert.equal((page.match(/<aside class="pb-notices"/g) || []).length, 1, `${id}: one notices block`);
    assert.ok(page.lastIndexOf('<aside class="pb-notices"') > page.lastIndexOf('<div class="pb-block"'), `${id}: after the last section`);
    const body = page.slice(0, page.indexOf('<aside class="pb-notices"'));
    assert.ok(!/Check before you quote|Verify current platform details|Nothing is sent anywhere/.test(body), `${id}: not repeated above`);
  }
  const notes = h.container.innerHTML.slice(h.container.innerHTML.indexOf('<aside class="pb-notices"'));
  assert.match(notes, /<p>Internal use only\.<\/p><p>Check before you quote pricing\.<\/p><\/aside>/, 'two short lines');
  assert.ok(!/<strong>/.test(notes), 'not bold');
  assert.match(read('src/page/styles.css'), /\.pb-notices \{[^}]*opacity: \.55;[^}]*font-weight: 400;/, 'translucent and regular weight');
});

test('page 1 is wide enough for the matrix, and the contents list follows each page', () => {
  const h = load(memoryStorage());
  assert.match(h.container.innerHTML, /<div class="pb-page" data-page="home">/);
  assert.notEqual(h.toc.innerHTML, '');
  assert.equal(h.toc.hidden, false);
  h.api.go('discovery');
  assert.match(h.container.innerHTML, /<div class="pb-page" data-page="discovery">/);
  assert.notEqual(h.toc.innerHTML, '');
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'src/page/styles.css'), 'utf8');
  assert.match(css, /\.pb-page\[data-page="home"\], \.pb-page\[data-page="home"\] \.pb-sec \{ max-width: 1200px; \}/, 'the tools page uses the wider measure');
  assert.ok(/pv-layout:has\(\.pv-toc\[hidden\]\)/.test(css), 'a page without a contents list still gives the column back');
});

test('a back-to-top button sits at the bottom right, appears after a screen of scrolling, scrolls up, and stays clear of the questions and the corner window', () => {
  const made = [];
  const mk = () => { const cls = new Set(); const el = { className: '', innerHTML: '', attrs: {}, listeners: {}, classList: { toggle: (c, on) => { on ? cls.add(c) : cls.delete(c); }, contains: (c) => cls.has(c), add: (c) => cls.add(c), remove: (c) => cls.delete(c) }, setAttribute(k, v) { el.attrs[k] = v; }, addEventListener(t, fn) { el.listeners[t] = fn; }, appendChild() {}, focus() {}, hidden: false, style: {} }; made.push(el); return el; };
  const scrolls = [];
  const scrollListeners = [];
  const doc = { createElement: mk, body: { appendChild() {} } };
  const h = load(memoryStorage(), null, null, doc, { pageYOffset: 0, addEventListener: (t, fn) => { if (t === 'scroll') scrollListeners.push(fn); }, scrollTo: (a) => scrolls.push(a) });
  const btn = made.find((e) => e.className === 'pb-top');
  assert.ok(btn, 'the button exists');
  assert.equal(btn.attrs['aria-label'], 'Back to top');
  assert.match(btn.innerHTML, /pb-ico-top/);
  assert.equal(scrollListeners.length, 1, 'it listens for scrolling');
  assert.equal(btn.classList.contains('is-on'), false, 'hidden at the top of the page');
  h.ctx.pageYOffset = 900; scrollListeners[0]();
  assert.equal(btn.classList.contains('is-on'), true, 'shown once the reader has scrolled');
  btn.listeners.click();
  assert.equal(scrolls.length, 1);
  assert.equal(scrolls[0].top, 0);
  h.ctx.pageYOffset = 10; scrollListeners[0]();
  assert.equal(btn.classList.contains('is-on'), false, 'and gone again at the top');
  // the stylesheet keeps it away from the questions (html.pb-lock is set while they are open) and above the corner window
  const css = read('src/page/styles.css');
  assert.match(css, /\.pb-top \{ position: fixed; right: 22px; bottom: 22px; z-index: 180;/);
  assert.match(css, /html\.pb-lock \.pb-top \{ display: none; \}/, 'hidden while the questions are open');
  assert.match(css, /body:has\(\.pb-mini:not\(\[hidden\]\)\) \.pb-top \{ bottom: 106px; \}/, 'lifted above the corner window');
  assert.ok(/\.pb-overlay \{ position: fixed; inset: 0; z-index: 200;/.test(css) && /\.pb-mini \{ position: fixed; right: 22px; bottom: 22px; z-index: 190;/.test(css), 'and below both of them in the stacking order');
});

test('page 1 reads shorter: purpose as four labelled rows, no line under Contents, do’s and don’ts with a red cross, a dictionary header that does not cut its text, links without underline in the recommendation, the site font', () => {
  const h = load(memoryStorage());
  const purpose = sec(h, 'overview');
  assert.equal((purpose.match(/<dt>/g) || []).length, 4);
  assert.ok(!/<p class="pb-intro">/.test(purpose), 'no long paragraph');
  assert.ok(!/<p class="pb-lead">/.test(sec(h, 'navigate')), 'nothing between the Contents heading and its cards');
  const pr = sec(h, 'principles');
  assert.match(pr, /What We Do<\/h4>/);
  assert.match(pr, /What We Don’t Do<\/h4>/);
  assert.equal((pr.match(/<li>/g) || []).length, 6 + 3, 'plain bullets, no marker on each point');
  assert.equal((pr.match(/pb-mk /g) || []).length, 2, 'only the two headings carry an icon');
  const css = read('src/page/styles.css');
  assert.match(css, /\.pb-mk-dont \{[^}]*color: #D6293E;/, 'the cross is red');
  const rule = (name) => css.slice(css.indexOf('\n' + name + ' {')).split('}')[0];
  assert.ok(!/max-width/.test(rule('.pb-lead')) && !/max-width/.test(rule('.pb-intro')), 'paragraphs are not cut short');
  assert.ok(!/\.pb-dict-main \{[^}]*max-width/.test(css) && !/\.pb-intro-sm \{[^}]*max-width/.test(css));
  assert.match(sec(h, 'dictionary'), /<h3>Looker<\/h3><\/header><p class="pb-dict-main">Looker is best suited for /);
  const how = sec(h, 'scoring');
  const prose = how.slice(how.indexOf('pb-prose'), how.indexOf('</details>'));
  assert.equal((prose.match(/<p>/g) || []).length, 4, 'four short paragraphs, in plain sentences');
  assert.ok(!/<strong>|<ul|<li>/.test(prose), 'no bold labels and no bullet pattern');
  assert.match(how, /We don’t simply add the ratings up/);
  assert.match(css, /#sec-reco \.pb-link, #sec-reco a \{ text-decoration: none;/, 'links in the recommendation have no underline');
  assert.match(css, /--font: "M PLUS 1", "M PLUS 1 Fallback", ui-sans-serif/, 'the site font first, with its fallback');
  assert.match(css, /--text: #334155;/, 'body text in the marketplace slate');
  assert.match(css, /\.pb-sec p, \.pb-sec li, \.pb-sec dd \{ line-height: 1\.75; \}/, 'and its line height');
  assert.match(read('src/page/index.html'), /fonts\.googleapis\.com\/css2\?family=M\+PLUS\+1/, 'the preview shell loads it');
});

test('content audit: the matrix correction applies to the original text only, and the scoring text says where scores come from', () => {
  const matrix = json('data/deck/matrix.json');
  const h = load(memoryStorage());
  assert.equal(matrix.groups[1].criteria[0].cells.sigma.detail, 'Ask Sigma covers the basics', 'the correction is written for this exact text');
  h.listeners.click[1]({ target: { closest: () => ({ tagName: 'BUTTON', getAttribute: (k) => ({ 'data-action': 'mall', 'data-open': '1' }[k]) }) } });
  for (const t of ['powerbi', 'qlik', 'tableau', 'thoughtspot', 'looker']) h.listeners.click[1]({ target: { closest: () => ({ tagName: 'BUTTON', getAttribute: (k) => ({ 'data-action': 'mtool', 'data-tool': t }[k]) }) } });
  const m = sec(h, 'matrix');
  assert.match(m, /Sigma Assistant \(successor to Ask Sigma\) covers the basics/);
  assert.ok(!/Ask Sigma covers the basics/.test(m));
  const sc = sec(h, 'scoring');
  assert.match(sc, /Most of the ratings come from our experts/);
  assert.match(sc, /were taken from our comparison table, and three answers started as our own proposals\. The experts have approved all of them/);
  assert.ok(!/For every answer, subject-matter experts/.test(sc));
});

// ------------------------------------------------------------------ audit of 2026-11-23: defects found in the review of src

test('an address that names a built-in property (#/constructor, #/__proto__) is not a page: nothing crashes and the page stays where it was', () => {
  const h = load(memoryStorage());
  for (const id of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf', 'isPrototypeOf']) {
    assert.equal(h.api.knows(id), false, `${id} is not a page`);
    assert.doesNotThrow(() => h.api.go(id), `${id} does not crash`);
    assert.equal(h.api.tab, 'home');
  }
  assert.ok(h.api.knows('shortlist') && h.api.knows('discovery') && h.api.knows('home'), 'real pages and the earlier ids still resolve');
  h.api.go('shortlist');
  assert.equal(h.api.tab, 'discovery');
});

test('answers saved by an earlier version of the questions are checked: moved ones are carried over, stale ones removed, and the reader is told', () => {
  const store = memoryStorage();
  store.m['bi-playbook-v1'] = JSON.stringify({
    answers: { Q04: ['microsoft'], Q09: ['yes'], Q06: ['external_access', 'basic_access'], Q18: ['offline_on_premises_operation'], Q99: ['x'], Q05: 'yes', Q01: [3] },
    notes: { Q04: 'keep', Q99: 'unknown question', Q05: 7 }
  });
  const h = load(store);
  const ans = h.api.session().answers;
  assert.equal(JSON.stringify(ans.Q04), '["microsoft"]');
  assert.deepEqual([...ans.Q06].sort(), ['ai_governance_concerns', 'basic_access'], 'the AI governance answer now sits in Q06 and the removed option is gone');
  for (const gone of ['Q09', 'Q18', 'Q99', 'Q05', 'Q01']) assert.ok(!(gone in ans), `${gone} is not kept`);
  const saved = JSON.parse(store.m['bi-playbook-v1']);
  assert.deepEqual(Object.keys(saved.answers).sort(), ['Q04', 'Q06'], 'the old values do not stay on the device');
  assert.deepEqual(saved.notes, { Q04: 'keep' });
  h.api.openDiscovery('1');
  assert.match(h.overlay.innerHTML, /An earlier answer about AI governance now sits under the security and access question\. 5 saved answers no longer matched the questions, so they were removed\./);
  // damaged storage is treated as empty, not spread into the answers
  for (const bad of ['"x"', '[]', 'null', '{"answers":"x","notes":[]}', '{"answers":null}', 'not json']) {
    const s2 = memoryStorage(); s2.m['bi-playbook-v1'] = bad;
    const g = load(s2);
    assert.equal(JSON.stringify(g.api.session().answers), '{}', bad);
    g.api.answer('Q04', ['google_cloud']);
    assert.deepEqual(Object.keys(JSON.parse(s2.m['bi-playbook-v1']).answers), ['Q04'], `${bad}: only real questions are stored`);
  }
});

test('"Relevant to your answers" on the AI criterion follows the AI answers only, not every answer to the security question', () => {
  const open = (h) => h.listeners.click[1]({ target: { closest: () => ({ tagName: 'BUTTON', getAttribute: (k) => ({ 'data-action': 'mall', 'data-open': '1' }[k]) }) } });
  const aiRow = (html) => html.slice(html.indexOf('AI-Assisted'), html.indexOf('Predictive'));
  const h = load(memoryStorage());
  h.api.answer('Q06', ['basic_access']);
  open(h);
  let m = sec(h, 'matrix');
  assert.ok(!/Relevant to your answers/.test(aiRow(m)), 'basic access says nothing about AI');
  assert.match(m.slice(m.indexOf('Governance &amp; Security'), m.indexOf('Semantic Layer')), /Relevant to your answers/, 'but it is relevant to governance and security');
  h.api.answer('Q06', ['basic_access', 'ai_governance_concerns']);
  m = sec(h, 'matrix');
  assert.match(aiRow(m), /Relevant to your answers/, 'the AI governance answer makes it relevant');
  const g = load(memoryStorage());
  g.api.answer('Q22', ['ai_first']); open(g);
  assert.match(aiRow(sec(g, 'matrix')), /Relevant to your answers/, 'and so does the AI question');
});

test('when the answers do not separate two tools, the migration lines cover each of them', () => {
  const model = json('data/questions.json');
  model.questions.forEach((q) => {                                                          // two tools that are alike on every answer, and in how each question is calibrated
    q.options.forEach((o) => { if (o.scores) o.scores.powerbi = o.scores.tableau; });
    if (q.baseline) { q.baseline.powerbi = q.baseline.tableau; q.variance.powerbi = q.variance.tableau; }
  });
  const q04 = model.questions.find((q) => q.id === 'Q04').options.find((o) => o.id === 'microsoft');
  for (const t of Object.keys(q04.scores)) q04.scores[t] = t === 'powerbi' || t === 'tableau' ? 4 : 1;
  const h = load(memoryStorage(), {}, model);
  h.api.answer('Q04', ['microsoft']); h.api.answer('Q13', ['yes']); h.api.answer('Q14', ['qlik']);
  const r = h.api.session().result();
  assert.equal(r.coLeaders.map((t) => t.id).sort().join(), 'powerbi,tableau', 'a genuine tie');
  const md = h.api.summary();
  assert.match(md, /Too close to call: Power BI and Tableau/);
  assert.match(md, /- From Qlik to Power BI: /);
  assert.match(md, /- From Qlik to Tableau: /);
});

test('the Markdown file keeps the notes and the client name on one line each: they cannot add a heading, a list item or emphasis', () => {
  const h = load(memoryStorage());
  h.api.answer('Q04', ['microsoft']);
  h.api.setNote('Q04', 'Prefers Tableau\n## Decision: *Tableau*\n- extra <b>item</b> `x` [l](u)');
  const md = h.api.summary();
  assert.ok(!/^## Decision/m.test(md) && !/^- extra/m.test(md), 'the note adds no line of its own');
  const line = md.split('\n').find((l) => /Prefers Tableau/.test(l));
  assert.ok(line.endsWith('*(Prefers Tableau ## Decision: \\*Tableau\\* - extra \\<b\\>item\\</b\\> \\`x\\` \\[l\\](u))*'), line);
  const L = h.ctx.PageLib;
  assert.equal(L.md('a\r\n\r\nb'), 'a b');
  assert.equal(L.md(null), '');
  assert.ok(L.buildSummary({ state: 'none', informative: false, date: 'd', answers: undefined }).includes('- None yet.'), 'no answers given: no crash');
});

test('the on-page recommendation, like the Markdown file, says when it rests on questions still marked as draft', () => {
  const model = json('data/questions.json');
  model.questions.find((q) => q.id === 'Q04').status = 'draft';
  const h = load(memoryStorage(), {}, model);
  h.api.answer('Q04', ['microsoft']);
  assert.match(sec(h, 'final'), /This result uses questions marked as draft \(Q04\); their scores are awaiting review\./);
  assert.match(h.api.summary(), /This result uses questions marked as draft \(Q04\)/);
  const clean = load(memoryStorage());
  clean.api.answer('Q04', ['microsoft']);
  assert.ok(!/marked as draft/.test(sec(clean, 'final')));
});

test('restoring a back-up needs a back-up of this playbook, replaces the notes with the file’s own, and asks before replacing answers', () => {
  class FileReader { readAsText(f) { this.result = f.text; this.onload(); } }
  const store = memoryStorage();
  const h = load(store, {}, undefined, undefined, { FileReader });
  h.api.answer('Q04', ['salesforce']); h.api.setNote('Q04', 'the previous client');
  const input = (text) => { const t = { files: [{ text }], value: 'x', getAttribute: (k) => ({ 'data-action': 'restore' }[k]) }; h.listeners.change[0]({ target: t }); return t; };
  const backup = (o) => JSON.stringify(Object.assign({ app: 'bi-playbook', version: 1, answers: { Q04: ['microsoft'] } }, o));
  for (const bad of ['{"answers":{"Q04":["microsoft"]}}', '[]', 'null', 'not json', JSON.stringify({ app: 'bi-playbook', answers: 'x' })]) {
    input(bad);
    assert.equal(JSON.stringify(h.api.session().answers), '{"Q04":["salesforce"]}', `refused: ${bad}`);
  }
  h.ctx.confirm = () => false;
  input(backup());
  assert.equal(JSON.stringify(h.api.session().answers), '{"Q04":["salesforce"]}', 'declined: nothing changes');
  h.ctx.confirm = () => true;
  const t = input(backup({ answers: { Q04: ['microsoft'], Q09: ['yes'] } }));
  assert.equal(t.value, '', 'the same file can be chosen again');
  assert.equal(JSON.stringify(h.api.session().answers), '{"Q04":["microsoft"],"Q06":["ai_governance_concerns"]}');
  assert.ok(!/the previous client/.test(sec(h, 'final')), 'the earlier client’s note does not follow the answers');
  assert.deepEqual(JSON.parse(store.m['bi-playbook-v1']).notes, {});
  input(backup({ notes: { Q04: 'kept from the file', Q77: 'unknown', Q05: 3 } }));
  assert.deepEqual(JSON.parse(store.m['bi-playbook-v1']).notes, { Q04: 'kept from the file' });
});

test('the date on the document is the local date, not the UTC date', () => {
  const RealDate = Date;
  const FixedDate = class extends RealDate { constructor(...a) { super(...(a.length ? a : [new RealDate(2026, 10, 23, 0, 30).getTime()])); } };
  const h = load(memoryStorage(), {}, undefined, undefined, { Date: FixedDate });     // 00:30 local time: where the offset is ahead of UTC the UTC date is the day before
  h.api.answer('Q04', ['microsoft']);
  assert.match(h.api.summary(), /Internal use only · 2026-11-23 · /);
});

test('a corner window supplied by the page gets the same handlers, so clicking it resumes the questions', () => {
  const h = load(memoryStorage());
  h.api.openDiscovery('1'); h.api.answer('Q04', ['microsoft']); h.api.closeDiscovery();
  assert.ok(h.api.minimized());
  const handlers = h.listeners.click.length;
  assert.ok(handlers >= 6, 'the container, the questions and the corner window each have their handlers');
  h.listeners.click[handlers - 1]({ target: { closest: () => ({ tagName: 'BUTTON', getAttribute: (k) => ({ 'data-action': 'resume' }[k]) }) } });
  assert.ok(h.api.overlayOpen(), 'the click on the corner window opened the questions again');
});

test('the page shell follows the address without trapping Back, and tells a start-up fault from a data failure', () => {
  const html = read('src/page/index.html');
  assert.match(html, /history\[replace \? 'replaceState' : 'pushState'\]/, 'moving to another page adds a history entry');
  assert.match(html, /routing = true; try \{[\s\S]*\} finally \{ routing = false; \}/, 'following the address itself never adds one, so Back cannot loop');
  assert.match(html, /The playbook could not start\./);
  assert.match(html, /The playbook data could not be loaded\./);
});

test('the area-complete card can be closed or skipped: closing shrinks the questions into the corner window and the timer then does nothing', () => {
  const h = load(memoryStorage());
  h.api.openDiscovery('1');
  for (const [id, a] of [['Q01', 'self_service_analytics_and_reporting'], ['Q02', 'finance'], ['Q03', 'no'], ['Q04', 'microsoft'], ['Q21', 'important'], ['Q22', 'ai_assisted'], ['Q23', 'balanced'], ['Q25', 'u_51_100']]) { h.api.openDiscovery(id); h.api.answer(id, [a]); }
  h.api.advance();
  assert.equal(h.api.step().kind, 'done');
  h.api.closeDiscovery();
  assert.equal(h.api.overlayOpen(), false);
  assert.ok(h.api.minimized(), 'the unfinished questions wait in the corner');
  h.timers.filter(Boolean).forEach((t) => t.fn());
  assert.equal(h.api.overlayOpen(), false, 'the pending move on does not reopen them');
  h.api.resume();
  assert.equal(h.api.step().section, '2', 'resuming lands in the next area');
});

test('between phone and desktop widths the answer tiles use columns at least 190 px wide, so words are never broken letter by letter', () => {
  const css = read('src/page/styles.css');
  assert.match(css, /@media \(min-width: 761px\) and \(max-width: 1100px\) \{\s*\.pb-card-q \.pb-opts-grid \{ grid-template-columns: repeat\(auto-fit, minmax\(190px, 1fr\)\); \}/);
});

test('the comparison matrix has no description under its heading: the tool picker follows it directly', () => {
  const h = load(memoryStorage());
  const m = sec(h, 'matrix');
  assert.match(m, /<h2>Comparison matrix<\/h2><div class="pb-picker"/);
  assert.ok(!/side by side|head to head/.test(m));
});

test('a table wrapper is its own positioning box, so the visually hidden text inside a table cannot widen the page on a phone', () => {
  const css = read('src/page/styles.css');
  assert.match(css, /\.pb-tablewrap \{ position: relative; overflow-x: auto;/);
  assert.match(read('src/page/index.html'), /if \(ctl\.overlayOpen\(\)\) ctl\.closeDiscovery\(\); routing = true;/, 'Back or Forward closes the questions first');
});
