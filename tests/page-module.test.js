'use strict';
/*
 * Smoke test for the content module: runs src/page/*.js as classic scripts in a browser-like context (no module system) with a
 * stub DOM and storage, renders every tab at several answer states, and checks what is rendered and what is stored.
 * It exists because a scope bug once hid behind try/catch (storage silently never saved) and was only found in the browser.
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
  const ctx = { console, JSON, Date, Math, Object, Array, String, Number, Promise };
  ctx.self = ctx;
  ctx.localStorage = storage;
  ctx.confirm = () => true;
  vm.createContext(ctx);
  for (const f of ['src/engine/engine.js', 'src/engine/session.js', 'src/page/lib.js', 'src/page/playbook.js']) vm.runInContext(read(f), ctx, { filename: f });
  // a stand-in for the page: innerHTML is the nine blocks, and querySelector('#sec-x') hands back one block, so partial redraws are exercised too
  let blocks = null;
  const container = {
    get innerHTML() { return blocks ? Object.keys(blocks).map((id) => `<div class="pb-block" id="sec-${id}" data-sec="${id}">${blocks[id]}</div>`).join('') : ''; },
    set innerHTML(v) {
      blocks = {};
      v.split('<div class="pb-block" id="sec-').slice(1).forEach((part) => { blocks[part.slice(0, part.indexOf('"'))] = part.slice(part.indexOf('>') + 1, part.lastIndexOf('</div>')); });
    },
    ownerDocument: { activeElement: { id: 'o-Q04-microsoft' }, documentElement: { setAttribute() {}, removeAttribute() {} } },
    contains: () => true, querySelectorAll: () => [], addEventListener() {},
    querySelector(sel) {
      const m = /^#sec-(\w+)$/.exec(sel);
      if (!m || !blocks || !(m[1] in blocks)) return null;
      return { get innerHTML() { return blocks[m[1]]; }, set innerHTML(v) { blocks[m[1]] = v; } };
    }
  };
  const rail = { innerHTML: '', addEventListener() {} };
  const toc = { innerHTML: '', addEventListener() {} };
  const deck = { profiles: json('data/deck/profiles.json'), matrix: json('data/deck/matrix.json'), migration: json('data/deck/migration.json'), reference: json('data/deck/reference.json') };
  const api = ctx.Playbook.mount({ container, rail, toc, model: modelOverride || json('data/questions.json'), deck, config: Object.assign({ preview: true, showDrafts: true }, opts || {}) });
  return { api, container, rail, toc, ctx };
}
const memoryStorage = () => { const m = {}; return { m, getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; };
const TABS = ['overview', 'purpose', 'principles', 'discovery', 'shortlist', 'migration', 'tools', 'final', 'reference'];
const BAD = /undefined|NaN|\[object|null</;

/** The html of one section of the single page. */
function sec(h, id) {
  const html = h.container.innerHTML;
  const start = html.indexOf(`<div class="pb-block" id="sec-${id}"`);
  assert.ok(start >= 0, `section ${id} is on the page`);
  const next = html.indexOf('<div class="pb-block" id="sec-', start + 10);
  return html.slice(start, next < 0 ? html.length : next);
}
function renderAll(h) {
  const out = {};
  for (const t of TABS) { h.api.go(t); out[t] = sec(h, t); }
  return out;
}

test('every tab renders at every answer state without broken output', () => {
  const h = load(memoryStorage());
  let all = renderAll(h);
  for (const t of TABS) assert.ok(all[t].length > 200, `${t} rendered`);
  // nothing answered, then a partial set, then a full branch set
  const steps = [
    [['Q04', ['microsoft']], ['Q01', ['self_service_analytics_and_reporting']]],
    [['Q13', ['yes']], ['Q14', ['looker', 'excel_other']], ['Q10', ['client_team']], ['Q11', ['beginner']], ['Q22', ['ai_first']], ['Q26', ['no_self_hosted']]]
  ];
  all = renderAll(h);
  for (const t of TABS) assert.ok(!BAD.test(all[t].replace(/null</g, '')), `${t}: ${(all[t].match(BAD) || [])[0]}`);
  for (const step of steps) {
    step.forEach(([q, a]) => h.api.answer(q, a));
    all = renderAll(h);
    for (const t of TABS) assert.ok(!BAD.test(all[t]), `${t} after ${step.length} answers: ${(all[t].match(BAD) || [])[0]}`);
    assert.ok(!BAD.test(h.rail.innerHTML), 'rail');
  }
});

test('the module runs on the production data (no draft questions) at every answer state', () => {
  const { execFileSync } = require('node:child_process');
  const os = require('node:os');
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pb-prod-')), 'q.json');
  execFileSync('python', ['-X', 'utf8', 'scripts/excel_to_json.py', '--exclude-draft', '--out', out], { cwd: root, stdio: 'pipe' });
  const prod = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(prod.questions.length, 20);
  const h = load(memoryStorage(), { showDrafts: false, preview: false }, prod);
  let all = renderAll(h);
  for (const t of TABS) assert.ok(!BAD.test(all[t]), `${t} (no answers): ${(all[t].match(BAD) || [])[0]}`);
  [['Q04', ['microsoft']], ['Q05', ['yes']], ['Q06', ['enterprise_security']], ['Q13', ['yes']], ['Q14', ['tableau']], ['Q10', ['joint_delivery']], ['Q11', ['advanced']]]
    .forEach(([q, a]) => h.api.answer(q, a));
  all = renderAll(h);
  for (const t of TABS) assert.ok(!BAD.test(all[t]), `${t} (answered): ${(all[t].match(BAD) || [])[0]}`);
  assert.ok(!/Draft/.test(all.discovery) && !/draft questions/i.test(all.shortlist), 'no draft wording in production');
  assert.ok(!/Preview only|Proposed: owner/.test(all.principles), 'no preview labels in production');
  assert.match(all.discovery, /Question \d+ of \d+/);
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
  b.api.go('final');
  assert.match(sec(b, 'final'), /board wants Salesforce/, 'the note reaches the summary');
  b.api.reset();
  assert.deepEqual(JSON.parse(store.m['bi-playbook-v1']), { answers: {}, notes: {} });
  assert.equal(JSON.stringify(b.api.session().answers), '{}');
});

test('the shortlist lists tools by rank, then alphabetically, and shows ties as co-leaders', () => {
  const h = load(memoryStorage());
  h.api.answer('Q21', ['critical']);          // draft scores give Sigma and Tableau the same fit
  h.api.go('shortlist');
  const html = sec(h, 'shortlist');
  assert.match(html, /Sigma and Tableau fit equally well/);
  const cards = [...html.matchAll(/data-tool="([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(cards.indexOf('sigma') < cards.indexOf('tableau'), 'equal ranks are alphabetical');
  assert.match(html, /aria-label="Rank =1"/, 'a tie is shown as =1');
  assert.match(html, /Too close to call/);
});

test('the questionnaire is accessible by construction: every option sits in a label, every group has a legend', () => {
  const h = load(memoryStorage());
  h.api.go('discovery');
  const html = sec(h, 'discovery');
  const inputs = (html.match(/<input type="(radio|checkbox)"/g) || []).length;
  const labelled = (html.match(/<label class="pb-opt[^"]*"><input type="(radio|checkbox)"/g) || []).length;
  assert.ok(inputs > 60, 'every question section is on the page, so there are many options');
  assert.equal(labelled, inputs, 'every option input is wrapped in its own label');
  assert.equal((html.match(/<fieldset/g) || []).length, (html.match(/<legend>/g) || []).length, 'every fieldset has a legend');
  assert.equal((html.match(/<fieldset/g) || []).length, h.api.session().visible().length, 'one fieldset per visible question, across all five sections');
  for (const q of h.api.session().visible()) assert.ok(html.includes(`<span class="pb-qtext">${q.text.replace(/&/g, '&amp;')}</span></legend>`), `${q.id}: the legend carries the question text`);
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  assert.ok(!/<img /.test(html), 'no images without alternative text');
});

test('a clear answer produces one clear leader with reasons and fit words', () => {
  const h = load(memoryStorage());
  h.api.answer('Q04', ['salesforce']);
  h.api.go('shortlist');
  const html = sec(h, 'shortlist');
  assert.match(html, /Tableau fits this client best, with a clear lead over/);
  assert.match(html, /Strongest reasons/);
  assert.match(html, /pb-pill tier-(strong|good)/, 'fit words are shown beside each reason');
  assert.match(html, /Provisional/);
  assert.match(html, /Based on 1 of 22 questions/);
});

test('hiding draft questions removes them from the questionnaire and keeps their saved answers', () => {
  const store = memoryStorage();
  const h = load(store);
  h.api.answer('Q21', ['critical']);
  h.api.answer('Q04', ['microsoft']);
  h.api.setShowDrafts(false);
  h.api.go('discovery');
  assert.match(sec(h, 'discovery'), /Question \d+ of 16/);
  assert.ok(!('Q21' in h.api.session().answers));
  assert.deepEqual(JSON.parse(store.m['bi-playbook-v1']).answers.Q21, ['critical'], 'the hidden draft answer is kept');
  h.api.setShowDrafts(true);
  assert.equal(JSON.stringify(h.api.session().answers.Q21), '["critical"]', 'and comes back when drafts are shown again');
});

test('closing a branch clears the answers behind it and says so', () => {
  const h = load(memoryStorage());
  h.api.answer('Q10', ['client_team']);
  h.api.answer('Q11', ['beginner']);
  h.api.answer('Q10', ['jman']);
  h.api.go('discovery');
  assert.ok(!('Q11' in h.api.session().answers));
  assert.match(sec(h, 'discovery'), /were cleared because that part of the questionnaire no longer applies/);
  assert.match(sec(h, 'discovery'), /data-action="undo"/);
});

test('a ruled-out tool is explained with the answer, the deck deployment facts and the expert rationale', () => {
  const h = load(memoryStorage());
  h.api.answer('Q26', ['no_self_hosted']);
  h.api.answer('Q04', ['snowflake']);
  h.api.go('shortlist');
  const html = sec(h, 'shortlist');
  assert.match(html, /Ruled out by your answers/);
  assert.match(html, /Sigma deployment \(deck, slide 22\): Cloud-only \(SaaS\)\. On-premises option: No\./);
  assert.match(html, /Is a vendor-hosted \(SaaS\) BI platform acceptable\?/);
  assert.ok(!/data-tool="sigma"/.test(html), 'a ruled-out tool is not ranked');
});

test('the migration tab follows the answers: gate, none, tools in use', () => {
  const h = load(memoryStorage());
  h.api.go('migration');
  assert.match(sec(h, 'migration'), /Answer .*active reporting suite/);
  h.api.answer('Q13', ['no']);
  h.api.go('migration');
  assert.match(sec(h, 'migration'), /No existing reporting to migrate/);
  h.api.answer('Q13', ['yes']);
  h.api.answer('Q14', ['looker']);
  h.api.answer('Q04', ['microsoft']);
  h.api.answer('Q05', ['yes']);
  h.api.go('migration');
  assert.match(sec(h, 'migration'), /From Looker/);
  assert.match(sec(h, 'migration'), /Effort by dimension/);
});

test('the Tableau profile withholds the features that the deck copied from Power BI', () => {
  const h = load(memoryStorage());
  h.api.answer('Q04', ['salesforce']);
  h.api.go('tools');
  const html = sec(h, 'tools');
  assert.match(html, /Not shown yet\. The source slide repeats another tool/);
  assert.ok(!/Semantic data modeling with DAX/.test(html), 'the Power BI feature list is not shown under the Tableau profile');
});

test('the reference tab marks corrections and shows deployment cells for every tool', () => {
  const h = load(memoryStorage());
  h.api.go('reference');
  const html = sec(h, 'reference');
  assert.match(html, /Corrected/);
  assert.match(html, /Looker \(original\)/);
  assert.match(html, /ThoughtSpot Software/);
  assert.match(html, /Pending update/);
});

test('the final summary names the status and is marked internal', () => {
  const h = load(memoryStorage());
  h.api.answer('Q04', ['microsoft']);
  h.api.go('final');
  assert.match(sec(h, 'final'), /INTERNAL USE ONLY/);
  assert.match(sec(h, 'final'), /Status: Provisional, based on 1 of 22 questions/);
  assert.match(h.api.summary(), /Best fit so far: /);
  for (let i = 0; i < 40 && h.api.session().openQuestions().length; i++) {      // answer everything: no more hedge
    const q = h.api.session().visible().find((v) => !v.answered);
    h.api.answer(q.id, [q.options.find((o) => !o.unknown).id]);
  }
  assert.equal(h.api.session().result().state, 'complete');
  assert.match(h.api.summary(), /Status: Complete, all \d+ questions/);
  assert.match(h.api.summary(), /Best fit(?! so far): /);
});

test('the whole playbook is one page: all nine sections in order, and the contents list points at them', () => {
  const h = load(memoryStorage());
  const html = h.container.innerHTML;
  const ids = [...html.matchAll(/<div class="pb-block" id="sec-(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, TABS, 'nine sections in reading order, none swapped out');
  const toc = h.toc.innerHTML;
  for (const t of TABS) assert.ok(toc.includes(`data-toc="sec-${t}"`), `${t} is in "On this page"`);
  for (const n of [1, 2, 3, 4, 5]) {
    assert.ok(toc.includes(`data-toc="disc-${n}"`), `question section ${n} is in "On this page"`);
    assert.ok(html.includes(`id="disc-${n}"`), `question section ${n} is on the page`);
  }
  h.api.go('shortlist');
  assert.equal(h.api.tab, 'shortlist');
  assert.match(h.toc.innerHTML, /data-toc="sec-shortlist" aria-current="location"/);
  assert.equal(h.container.innerHTML, html, 'going to a section only scrolls: nothing is redrawn');
});

test('an answer redraws only the sections that depend on answers, so the reader keeps their place', () => {
  const h = load(memoryStorage());
  h.container.querySelector('#sec-overview').innerHTML += '<!--kept-->';
  h.container.querySelector('#sec-principles').innerHTML += '<!--kept-->';
  h.api.answer('Q04', ['microsoft']);
  assert.match(sec(h, 'overview'), /<!--kept-->/, 'overview was not redrawn');
  assert.match(sec(h, 'principles'), /<!--kept-->/, 'principles were not redrawn');
  assert.match(sec(h, 'shortlist'), /Based on 1 of 22 questions/, 'the shortlist moved with the answer');
  assert.match(sec(h, 'discovery'), /value="microsoft" checked/, 'the answer shows as chosen');
});

test('questions are tiles: short choices sit in one bar, long lists fill a grid, and "Title: detail" answers are split', () => {
  const h = load(memoryStorage());
  h.api.answer('Q13', ['yes']);                    // opens the migration questions (Q15 onwards)
  const html = sec(h, 'discovery');
  const fieldset = (id) => html.slice(html.indexOf(`id="q-${id}"`), html.indexOf('</fieldset>', html.indexOf(`id="q-${id}"`)));
  assert.match(fieldset('Q03'), /pb-opts-seg" style="--n:3"/, 'Yes / No / Maybe sit side by side');
  assert.match(fieldset('Q04'), /pb-opts-grid" style="--n:6"/, 'the ecosystem list fills a grid');
  assert.match(fieldset('Q21'), /<span class="pb-opt-title has-sub">Critical<\/span><span class="pb-opt-sub">Executive or board-grade bespoke visuals<\/span>/);
  assert.match(fieldset('Q15'), /<span class="pb-opt-title has-sub">Small<\/span><span class="pb-opt-sub">Up to 25 reports \/ 200 users<\/span>/);
  assert.match(fieldset('Q01'), /Choose all that apply/);
  assert.match(fieldset('Q03'), /Choose one/);
  assert.match(fieldset('Q25'), /pb-quiet/, 'answers that are not scored are drawn quietly');
  assert.match(fieldset('Q25'), /Not scored/);
});

test('every question carries a one-line guide, and none of them names a tool or a score', () => {
  const h = load(memoryStorage());
  const html = sec(h, 'discovery');
  const fieldsets = html.split('<fieldset').slice(1);
  assert.equal(fieldsets.length, h.api.session().visible().length);
  for (const f of fieldsets) assert.match(f, /<p class="pb-help">/, 'a guide line is present');
  const guides = [...html.matchAll(/<p class="pb-help">([^<]*)<\/p>/g)].map((m) => m[1]);
  for (const g of guides) assert.ok(!/power bi|looker|qlik|sigma|tableau|thoughtspot|score|weight|rank/i.test(g), `a guide must not mention a tool or scoring: ${g}`);
});

test('the notice about cleared answers sits after the question sections, so it can stay at the bottom of the window', () => {
  const h = load(memoryStorage());
  h.api.answer('Q10', ['client_team']); h.api.answer('Q11', ['beginner']); h.api.answer('Q10', ['jman']);
  const html = sec(h, 'discovery');
  assert.ok(html.lastIndexOf('class="pb-notice"') > html.lastIndexOf('</fieldset>'));
});
