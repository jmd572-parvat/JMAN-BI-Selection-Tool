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

function load(storage, opts, modelOverride) {
  const timers = [];
  const ctx = { console, JSON, Date, Math, Object, Array, String, Number, Promise };
  ctx.self = ctx;
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
  const container = Object.assign(mkHost(), { ownerDocument: { activeElement: { id: 'o-Q04-microsoft' }, documentElement: { setAttribute() {}, removeAttribute() {} } } });
  const overlay = mkHost();
  const rail = { innerHTML: '', addEventListener() {} };
  const toc = { innerHTML: '', addEventListener() {} };
  const deck = { profiles: json('data/deck/profiles.json'), matrix: json('data/deck/matrix.json'), migration: json('data/deck/migration.json'), reference: json('data/deck/reference.json') };
  const api = ctx.Playbook.mount({ container, rail, toc, overlay, model: modelOverride || json('data/questions.json'), deck, config: Object.assign({ preview: true, showDrafts: true, lockUntilComplete: false }, opts || {}) });   // most tests look at results after one answer; the lock has its own tests
  return { api, container, overlay, rail, toc, ctx, timers, listeners, setChecked: (inputs) => { ctxChecked = inputs; } };
}
const memoryStorage = () => { const m = {}; return { m, getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; };
const PAGES = ['home', 'compare', 'discovery', 'recommendation'];
const SECTIONS = ['overview', 'purpose', 'criteria', 'principles', 'scoring', 'tools', 'matrix', 'versus', 'reference', 'discovery', 'shortlist', 'migration', 'final'];
const BAD = /undefined|NaN|\[object|null</;

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
  assert.equal(prod.questions.length, 26, 'no draft is left to leave out');
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
  assert.match(all.final, /INTERNAL USE ONLY/);
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
  assert.match(html, /Based on 1 of 20 questions/);
});

test('a ruled-out tool is explained with the answer, the deck deployment facts and the expert rationale', () => {
  const h = load(memoryStorage());
  h.api.answer('Q26', ['no_self_hosted']);
  h.api.answer('Q04', ['snowflake']);
  const html = sec(h, 'shortlist');
  assert.match(html, /Ruled out by your answers/);
  assert.match(html, /Sigma deployment \(deck, slide 22\): Cloud-only \(SaaS\)\. On-premises option: No\./);
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

test('tool profiles list all six tools alphabetically and withhold the Tableau features copied from Power BI', () => {
  const h = load(memoryStorage());
  h.api.answer('Q04', ['salesforce']);
  const html = sec(h, 'tools');
  const tabs = [...html.matchAll(/data-action="tooltab" data-tool="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabs, ['looker', 'powerbi', 'qlik', 'sigma', 'tableau', 'thoughtspot'], 'alphabetical, whatever the ranking');
  assert.match(html, /pb-tab2 on is-short[^>]*id="tt-tableau"/, 'the top tool opens first and the shortlist is marked');
  assert.match(html, /Not shown yet\. The source slide repeats another tool/);
  assert.ok(!/Semantic data modeling with DAX/.test(html), 'the Power BI feature list is not shown under the Tableau profile');
});

test('the reference section marks corrections and shows deployment cells for every tool', () => {
  const h = load(memoryStorage());
  const html = sec(h, 'reference');
  assert.match(html, /Corrected/);
  assert.match(html, /Looker \(original\)/);
  assert.match(html, /ThoughtSpot Software/);
  assert.match(html, /Pending update/);
  assert.ok(!/How scoring works/.test(html), 'scoring moved to the Guidelines page');
});

test('the final summary names the status and is marked internal', () => {
  const h = load(memoryStorage());
  h.api.answer('Q04', ['microsoft']);
  assert.match(sec(h, 'final'), /INTERNAL USE ONLY/);
  assert.match(sec(h, 'final'), /Status: Provisional, based on 1 of 20 questions/);
  assert.match(h.api.summary(), /Best fit so far: /);
  for (let i = 0; i < 40 && h.api.session().openQuestions().length; i++) {      // answer everything: no more hedge
    const q = h.api.session().visible().find((v) => !v.answered);
    h.api.answer(q.id, [q.options.find((o) => !o.unknown).id]);
  }
  assert.equal(h.api.session().result().state, 'complete');
  assert.match(h.api.summary(), /Status: Complete, all \d+ questions/);
  assert.match(h.api.summary(), /Best fit(?! so far): /);
});

// ------------------------------------------------------------------ pages

test('the playbook is four pages; a page shows only itself, and a section opens on its page', () => {
  const h = load(memoryStorage());
  assert.deepEqual([...h.api.tabs.map((t) => t.id)], PAGES);
  assert.deepEqual([...h.api.tabs.map((t) => t.label)], ['Overview', 'Compare tools', 'Client discovery', 'Recommendation']);
  const blocksOn = () => [...h.container.innerHTML.matchAll(/<div class="pb-block" id="sec-(\w+)"/g)].map((m) => m[1]);
  assert.equal(h.api.tab, 'home');
  assert.deepEqual([...blocksOn()], ['overview', 'purpose', 'criteria', 'principles', 'scoring'], 'the guidelines are part of the overview page');
  h.api.go('principles');
  assert.equal(h.api.tab, 'home');
  h.api.go('shortlist');
  assert.equal(h.api.tab, 'recommendation');
  assert.deepEqual([...blocksOn()], ['shortlist'], 'one tab of the recommendation at a time');
  h.api.go('final');
  assert.deepEqual([...blocksOn()], ['final']);
  h.api.go('matrix');
  assert.equal(h.api.tab, 'compare');
  assert.deepEqual([...blocksOn()], ['matrix']);
  h.api.go('versus');
  assert.deepEqual([...blocksOn()], ['versus']);
  h.api.go('reference');
  assert.deepEqual([...blocksOn()], ['reference']);
  h.api.go('discovery');
  assert.deepEqual([...blocksOn()], ['discovery']);
});

test('the overview holds the introduction and the guidelines: who it is for, three more pages, purpose, the five areas, principles and how it works', () => {
  const h = load(memoryStorage());
  const html = sec(h, 'overview');
  assert.match(html, /helps JMAN teams choose and justify the right BI tool/);
  assert.match(html, /Looker, Power BI, Qlik, Sigma, Tableau and ThoughtSpot/, 'tools are listed alphabetically');
  assert.match(html, /Who is this for\?/);
  assert.match(html, /How to navigate/);
  const cards = [...html.matchAll(/class="pb-chapter" data-action="go" data-tab="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual([...cards], ['compare', 'discovery', 'recommendation']);
  assert.match(html, /About 5 to 10 minutes/);
  const crit = sec(h, 'criteria');
  assert.match(crit, /What we ask about/);
  assert.equal((crit.match(/class="pb-criterion"/g) || []).length, 5, 'the five areas are the basic criteria');
  for (const t of ['Business context and goals', 'Data, security and governance', 'Skills and change readiness', 'Data landscape and delivery', 'Existing reporting and migration']) assert.ok(crit.includes(t), t);
  assert.match(sec(h, 'purpose'), /What it does not replace/);
  assert.match(sec(h, 'principles'), /Guiding principles/);
  assert.match(sec(h, 'scoring'), /How the recommendation is made/);
  for (const t of ['home-who', 'home-nav', 'sec-purpose', 'sec-criteria', 'sec-principles', 'sec-scoring']) assert.ok(h.toc.innerHTML.includes(`data-toc="${t}"`), t);
});

test('the discovery page lists the five areas and opens the carousel', () => {
  const h = load(memoryStorage());
  const html = sec(h, 'discovery');
  assert.match(html, /A set of questions to find the most suitable BI tool for this client\. It takes about 5 to 10 minutes\./);
  assert.match(html, /Start the questions/);
  const areas = [...html.matchAll(/class="pb-area[^"]*" data-action="openq" data-section="(\d)"/g)].map((m) => m[1]);
  assert.deepEqual(areas, ['1', '2', '3', '4', '5']);
  assert.ok(html.indexOf('Existing reporting and migration') > html.indexOf('Data landscape and delivery'), 'migration is the last area');
  h.api.answer('Q04', ['microsoft']);
  assert.match(sec(h, 'discovery'), /Continue the questions/);
});

// ------------------------------------------------------------------ the question carousel

test('opening an area shows one question in a dialog with the area title, a progress bar, arrows, a close button and the top three', () => {
  const h = load(memoryStorage());
  h.api.openDiscovery('2');
  assert.ok(h.api.overlayOpen());
  const html = h.overlay.innerHTML;
  assert.ok(!/data-action="prev"[^>]*disabled/.test(html), 'the earlier area is behind it');
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(html, /<h2 id="pb-ovl-title">Data, security and governance<\/h2>/);
  assert.match(html, /Area 2 of 5/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /data-action="next"/);
  assert.match(html, /data-action="close"/);
  assert.match(html, /Question 1 of 6/);
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
  const seen = [];
  for (let i = 0; i < 6 && h.api.step().kind === 'q'; i++) { seen.push(h.api.step().qid); h.api.move(1); }
  assert.deepEqual(seen, ['Q10', 'Q24']);
});

test('migration questions come last, all as follow-ups inside the existing-reporting question', () => {
  const h = load(memoryStorage());
  h.api.openDiscovery('5');
  const only = () => { const o = []; for (let i = 0; i < 10 && h.api.step().kind === 'q'; i++) { o.push(h.api.step().qid); h.api.move(1); } return o; };
  assert.deepEqual(only(), ['Q13'], 'with nothing answered, only the gate question is asked');
  h.api.answer('Q13', ['yes']);
  h.api.openDiscovery('5');
  assert.deepEqual(only(), ['Q13'], 'every migration question is a follow-up of it, never a card of its own');
  h.api.openDiscovery('Q13');
  const q13 = fieldset(h.overlay.innerHTML, 'Q13');
  for (const id of ['Q14', 'Q15', 'Q17', 'Q20']) assert.ok(q13.includes(`id="q-${id}"`), `${id} sits inside the existing-reporting card`);
  h.api.answer('Q13', ['no']);
  assert.ok(!/id="q-Q17"/.test(h.overlay.innerHTML) && !/id="q-Q20"/.test(h.overlay.innerHTML), 'a client with nothing to migrate is not asked them');
  // data landscape (Q16, Q18, Q19) is asked before the migration area, of everyone
  h.api.openDiscovery('4');
  const area4 = [];
  for (let i = 0; i < 6 && h.api.step().kind === 'q'; i++) { area4.push(h.api.step().qid); h.api.move(1); }
  assert.deepEqual(area4, ['Q16', 'Q18', 'Q19']);
});

test('finishing an area shows an "area complete" card with what comes next and a countdown; the last card leads to the recommendation', () => {
  const h = load(memoryStorage());
  h.api.openDiscovery('3');
  h.api.move(1); h.api.move(1);                       // past Q10 and Q24
  assert.equal(h.api.step().kind, 'done');
  let html = h.overlay.innerHTML;
  assert.match(html, /Skills and change readiness is complete/);
  assert.match(html, /Next: <strong>Data landscape and delivery<\/strong>/);
  assert.match(html, /pb-prog-sweep/, 'the countdown runs inside the progress bar');
  assert.ok(!/Moving on in|seconds/.test(html), 'and shows no text');
  const timer = h.timers.filter(Boolean).pop();
  assert.equal(timer.ms, 3200, '3.2 seconds');
  timer.fn();                                          // time passes
  assert.equal(h.api.step().kind, 'q');
  assert.equal(h.api.step().section, '4');
  for (let i = 0; i < 80 && h.api.step().kind !== 'end'; i++) h.api.move(1);
  assert.equal(h.api.step().kind, 'end');
  html = h.overlay.innerHTML;
  assert.match(html, /All areas are complete/);
  assert.match(html, /data-action="finish"/);
  h.timers.filter(Boolean).pop().fn();                 // the countdown on the last card
  assert.equal(h.api.overlayOpen(), false);
  assert.equal(h.api.tab, 'recommendation');
});

test('after a click, 3.2 seconds without another moves to the next question, shown only as the progress bar filling ahead; an unanswered question or an open follow-up does not', () => {
  const h = load(memoryStorage());
  const counting = () => /pb-prog-sweep/.test(h.overlay.innerHTML);
  h.api.openDiscovery('1');
  assert.ok(!counting(), 'no countdown before any answer');
  h.api.openDiscovery('Q04');
  h.api.answer('Q04', ['microsoft']);
  assert.ok(counting());
  assert.ok(!/Next question in|Stay here/.test(h.overlay.innerHTML), 'no countdown text and no extra row');
  assert.match(h.overlay.innerHTML, /pb-prog-sweep" style="--a:50%;--b:63%;animation-duration:3\.2s/, 'it fills from this question to the next one');
  const t = h.timers.filter(Boolean).pop();
  assert.equal(t.ms, 3200);
  h.timers[h.timers.indexOf(t)] = null; t.fn();          // time passes: this countdown is over
  assert.equal(h.api.step().qid, 'Q21', 'moved on to the next question');
  // another click restarts the clock: only the last timer is live
  h.api.answer('Q21', ['critical']);
  h.api.answer('Q21', ['important']);
  assert.equal(h.timers.filter(Boolean).length, 1, 'the earlier countdown was cancelled');
  // a question that opened follow-ups waits until they are answered
  h.api.openDiscovery('Q10');
  h.api.answer('Q10', ['client_team']);
  assert.ok(!counting(), 'no countdown while follow-ups are open');
  assert.match(h.overlay.innerHTML, /Answer the follow-up questions, or press next to skip them/);
  h.api.answer('Q11', ['intermediate']);
  assert.ok(!counting(), 'Q12 is still open');
  h.api.answer('Q12', ['can_upskill']);
  assert.ok(counting());
  // clearing an answer cancels the countdown
  h.api.clearOption('Q12', 'can_upskill');
  assert.ok(!counting());
  // typing a note cancels it too
  h.api.answer('Q12', ['can_upskill']);
  assert.ok(counting());
  h.listeners.input.forEach((fn) => fn({ target: { matches: () => true, getAttribute: () => 'Q12', value: 'x' } }));
  assert.ok(!counting() || h.timers.filter(Boolean).length === 0, 'the countdown was cancelled');
});

test('moving back and forth walks the same list of steps, and the arrows stop at the ends', () => {
  const h = load(memoryStorage());
  h.api.openDiscovery('1');
  assert.match(h.overlay.innerHTML, /data-action="prev"[^>]*disabled/);
  assert.match(h.overlay.innerHTML, /<svg class="pb-ico pb-ico-left"/);
  h.api.move(1);
  assert.equal(h.api.step().qid, 'Q02');
  h.api.move(-1);
  assert.equal(h.api.step().qid, 'Q01');
  for (let i = 0; i < 100 && h.api.step().kind !== 'end'; i++) h.api.move(1);
  assert.match(h.overlay.innerHTML, /data-action="next"[^>]*disabled/);
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
  assert.equal(seen.size, 26, 'all 26 questions were shown with a guide');
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

test('Escape closes the carousel (or the popup first), and the arrow keys move between questions', () => {
  const h = load(memoryStorage());
  h.api.openDiscovery('Q04');
  h.api.answer('Q04', ['salesforce']);
  const key = (k, t) => h.listeners.keydown.forEach((fn) => fn({ key: k, target: t || { tagName: 'DIV' }, preventDefault() {} }));
  h.api.showTool('tableau');
  key('Escape');
  assert.ok(!/pb-pop-wrap/.test(h.overlay.innerHTML) && h.api.overlayOpen(), 'the first Escape puts the popup away');
  key('ArrowRight', { tagName: 'INPUT', type: 'radio' });
  assert.equal(h.api.step().qid, 'Q04', 'arrow keys on an answer choose answers, not questions');
  key('ArrowRight');
  assert.equal(h.api.step().qid, 'Q21');
  key('ArrowLeft');
  assert.equal(h.api.step().qid, 'Q04');
  key('Escape');
  assert.equal(h.api.overlayOpen(), false);
});

test('after the last area the winner is shown alone in the middle before the recommendation opens; a tie shows every co-leader', () => {
  const toEnd = (h) => { h.api.openDiscovery('1'); for (let i = 0; i < 100 && h.api.step().kind !== 'end'; i++) h.api.move(1); };
  const h = load(memoryStorage());
  h.api.answer('Q04', ['salesforce']);
  toEnd(h);
  let html = h.overlay.innerHTML;
  assert.match(html, /class="pb-winner"/);
  assert.match(html, /Best fit so far/);
  assert.match(html, /<h3 tabindex="-1">Tableau<\/h3>/);
  assert.equal((html.match(/class="pb-winner-logo"/g) || []).length, 1, 'the winner alone');
  assert.match(html, /All areas are complete/);
  assert.equal(h.timers.filter(Boolean).pop().ms, 7000, 'it stays long enough to take in');
  const tie = load(memoryStorage());
  tie.api.answer('Q03', ['no']);
  toEnd(tie);
  html = tie.overlay.innerHTML;
  assert.match(html, /Too close to call/);
  assert.match(html, /<h3 tabindex="-1">Sigma and Tableau<\/h3>/);
  assert.equal((html.match(/class="pb-winner-logo"/g) || []).length, 2, 'both co-leaders, never a single pick');
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

test('the recommendation stays closed until every question has an answer, here and on the carousel\'s last card', () => {
  const h = load(memoryStorage(), { lockUntilComplete: true });
  h.api.answer('Q04', ['salesforce']);
  h.api.go('shortlist');
  let html = h.container.innerHTML;
  assert.match(html, /id="sec-locked"/);
  assert.match(html, /The recommendation opens once every question has an answer/);
  assert.match(html, /1 of 20<\/strong> questions answered\. 19 to go\./);
  assert.ok(!/pb-tool|Best fit<\/h2>|pb-subtab/.test(html), 'no result, no tabs');
  assert.match(html, /data-action="openq">Continue the questions/);
  for (const id of ['migration', 'final']) { h.api.go(id); assert.match(h.container.innerHTML, /id="sec-locked"/, `${id} is closed too`); }
  // the profiles do not give the answer away either
  assert.ok(!/is-short/.test(sec(h, 'tools')), 'no best-fit marker in the profiles');
  // the carousel's last card asks for what is missing instead of showing a winner
  h.api.openDiscovery('1');
  for (let i = 0; i < 100 && h.api.step().kind !== 'end'; i++) h.api.move(1);
  html = h.overlay.innerHTML;
  assert.match(html, /19 questions are still open/);
  assert.ok(!/pb-winner|data-action="finish"/.test(html));
  assert.match(html, /data-action="jump" data-qid="Q\d+">Go to the first open question/);
  assert.ok(!h.timers.filter(Boolean).length || h.timers.filter(Boolean).every((t) => t.ms !== 7000), 'no countdown towards a recommendation');
  // answering everything opens it
  for (let i = 0; i < 60 && h.api.session().openQuestions().length; i++) {
    const q = h.api.session().visible().find((v) => !v.answered);
    h.api.answer(q.id, [q.options.find((o) => !o.unknown).id]);
  }
  h.api.go('shortlist');
  assert.ok(!/id="sec-locked"/.test(h.container.innerHTML));
  assert.match(h.container.innerHTML, /pb-tool is-best/);
  h.api.openDiscovery('1');
  for (let i = 0; i < 100 && h.api.step().kind !== 'end'; i++) h.api.move(1);
  assert.match(h.overlay.innerHTML, /pb-winner/);
});

test('the matrix is one short line per tool for each of the 14 criteria, with no \"leads\" marker', () => {
  const h = load(memoryStorage());
  const html = sec(h, 'matrix');
  const cols = [...html.matchAll(/<th scope="col"><span class="pb-colhead">[\s\S]*?<span>([^<]+)<\/span><\/span><\/th>/g)].map((m) => m[1]);
  assert.deepEqual([...cols], ['Looker', 'Power BI', 'Qlik', 'Sigma', 'Tableau', 'ThoughtSpot'], 'alphabetical');
  assert.equal((html.match(/<tr><th scope="row">/g) || []).length, 14, 'the deck\'s 14 criteria');
  assert.equal((html.match(/class="pb-grouprow"/g) || []).length, json('data/deck/matrix.json').groups.length);
  assert.match(html, /Fastest to adopt/);
  assert.ok(!/Leads \(deck\)|pb-pill leads/.test(html), 'no leader markers');
  assert.match(html, /data-sub="versus">Compare two tools in depth/);
  assert.ok(!/Leads \(deck\)/.test(sec(h, 'reference')) && !/Decision matrix/.test(sec(h, 'reference')), 'and none left in the reference tab');
});

test('the 1 v 1 comparison puts two tools side by side on every criterion, then on deployment', () => {
  const h = load(memoryStorage());
  h.api.answer('Q04', ['salesforce']);
  let html = sec(h, 'versus');
  assert.match(html, /<select id="cmp-a"[\s\S]*value="tableau" selected/, 'it opens on the best fit');
  const b = html.match(/<select id="cmp-b"[\s\S]*?<option value="(\w+)" selected/)[1];
  assert.notEqual(b, 'tableau');
  assert.equal((html.match(/<tr><th scope="row">[^<]*(?:<br>[\s\S]*?)?<\/th><td>/g) || []).length >= 14, true);
  assert.match(html, /<th colspan="3" scope="colgroup">Deployment<\/th>/);
  assert.match(html, /Data residency control/);
  assert.ok(!/Leads \(deck\)/.test(html));
  // two different tools only
  assert.ok(!new RegExp(`<select id="cmp-a"[^>]*>[\\s\\S]*?value="${b}"[\\s\\S]*?</select><label>against`).test(html), 'the second tool is not offered as the first');
  h.listeners.change.forEach((fn) => fn({ target: { matches: () => false, getAttribute: (k) => ({ 'data-action': 'cmp-b' }[k]), value: 'looker' } }));
  html = sec(h, 'versus');
  assert.match(html, /<select id="cmp-b"[\s\S]*value="looker" selected/);
  assert.match(html, /Tableau compared with Looker/);
  h.listeners.change.forEach((fn) => fn({ target: { matches: () => false, getAttribute: (k) => ({ 'data-action': 'cmp-a' }[k]), value: 'looker' } }));
  html = sec(h, 'versus');
  const [a2, b2] = [html.match(/<select id="cmp-a"[\s\S]*?<option value="(\w+)" selected/)[1], html.match(/<select id="cmp-b"[\s\S]*?<option value="(\w+)" selected/)[1]];
  assert.equal(a2, 'looker');
  assert.notEqual(b2, 'looker', 'choosing the same tool twice moves the other one');
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
