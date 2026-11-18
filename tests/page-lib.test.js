'use strict';
/* Page logic: the rules in docs/page-design.md that decide what the user is told. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../src/page/lib.js');
const { Session } = require('../src/engine/session.js');

const root = path.join(__dirname, '..');
const model = () => JSON.parse(fs.readFileSync(path.join(root, 'data', 'questions.json'), 'utf8'));
const q = (id) => model().questions.find((x) => x.id === id);

test('answers that name tools or ecosystems are shown alphabetically, catch-alls last', () => {
  assert.deepEqual(L.orderOptions(q('Q04')).map((o) => o.label),
    ['Databricks', 'Google Cloud', 'Microsoft', 'Salesforce', 'Snowflake', 'Hybrid', 'None / Not yet defined']);
  assert.deepEqual(L.orderOptions(q('Q14')).map((o) => o.label),
    ['Looker', 'Power BI', 'Qlik', 'Sigma', 'Tableau', 'ThoughtSpot', 'Excel / Other']);
});

test('questions with a natural order keep the workbook order', () => {
  for (const id of ['Q25', 'Q15', 'Q06', 'Q08']) {
    assert.deepEqual(L.orderOptions(q(id)).map((o) => o.id), q(id).options.map((o) => o.id), id);
  }
});

test('the first option offered never names Power BI or Microsoft on a tool or ecosystem question', () => {
  for (const id of L.ALPHABETICAL_QUESTIONS) assert.ok(!/power bi|microsoft/i.test(L.orderOptions(q(id))[0].label), id);
});

test('fit words follow the workbook legend and the documented cut-offs', () => {
  assert.equal(L.fitTier(4).label, 'Strong fit');
  assert.equal(L.fitTier(3.5).label, 'Strong fit');
  assert.equal(L.fitTier(3.49).label, 'Good fit');
  assert.equal(L.fitTier(2.5).label, 'Good fit');
  assert.equal(L.fitTier(2).label, 'Suitable');
  assert.equal(L.fitTier(1.5).label, 'Suitable');
  assert.equal(L.fitTier(1).label, 'Possible but not ideal');
});

test('the fit bar is centred on zero and clipped', () => {
  assert.deepEqual(L.barGeometry(0), { side: 'none', pct: 0 });
  assert.deepEqual(L.barGeometry(1.5), { side: 'right', pct: 25 });
  assert.deepEqual(L.barGeometry(-3), { side: 'left', pct: 50 });
  assert.equal(L.barGeometry(99).pct, 50);
  assert.equal(L.barGeometry(-99).side, 'left');
});

test('lead sentences name the right tools for each lead strength, and ties alphabetically', () => {
  const names = {};
  const none = new Session(model()).result();
  assert.match(L.leadSentence(none, names), /Answer a few questions/);

  const clear = new Session(model());
  clear.answer('Q04', ['salesforce']);
  const rc = clear.result();
  assert.equal(rc.state, 'provisional');
  assert.match(L.leadSentence(rc, names), /^So far, Tableau fits this client best, with a clear lead over /);
  // once the result is no longer provisional the hedge goes away
  assert.match(L.leadSentence({ ...rc, state: 'near' }, names), /^Tableau fits this client best, with a clear lead over /);
  assert.match(L.leadSentence({ ...rc, state: 'complete' }, names), /^Tableau fits this client best/);

  const tie = new Session(model());
  tie.answer('Q21', ['critical']);
  assert.match(L.leadSentence(tie.result(), names), /^So far, Sigma and Tableau fit equally well on these answers\. Use a proof of concept/);
});

test('the shortlist boundary message appears only when the third tool is not clearly ahead', () => {
  const base = { shortlist: [{ tool: { name: 'A' } }, { tool: { name: 'B' } }, { tool: { name: 'C' } }] };
  assert.equal(L.boundaryMessage({ ...base, shortlistBoundary: null }), null);
  assert.equal(L.boundaryMessage({ ...base, shortlistBoundary: { strength: 'clear', firstLeftOut: { name: 'D' } } }), null);
  assert.equal(L.boundaryMessage({ ...base, shortlistBoundary: { strength: 'narrow', firstLeftOut: { name: 'D' } } }), 'D is close behind C. Keep it in mind.');
  assert.equal(L.boundaryMessage({ ...base, shortlistBoundary: { strength: 'tooClose', firstLeftOut: { name: 'D' } } }), 'D is almost level with C. Consider it as well.');
});

test('state lines say how much the result rests on', () => {
  assert.equal(L.stateLine('provisional', 7, 22), 'Based on 7 of 22 questions. The order is likely to change as you answer more.');
  assert.equal(L.stateLine('near', 19, 22), 'Based on 19 of 22 questions. The order can still change.');
  assert.equal(L.stateLine('complete', 22, 22), 'Based on all 22 questions.');
  assert.equal(L.stateLine('none', 0, 22), '');
});

test('the summary is internal, states its status, lists notes, and never names a single winner for a tie', () => {
  const s = new Session(model());
  s.answer('Q21', ['critical']);
  const r = s.result();
  const text = L.buildSummary({
    date: '2026-11-17', clientName: 'Example client', state: r.state, answered: 1, visible: 22, informative: r.informative,
    coLeaders: r.coLeaders.map((t) => t.name), shortlist: r.shortlist.map((x) => ({ name: x.tool.name, rank: x.rank })),
    leadStrength: r.leadStrength, boundaryMessage: null, excluded: [], reasons: [], constraints: [], migration: [],
    usesDraft: r.usesDraftQuestions,
    answers: [{ section: 'Business context and goals', question: 'Presentation quality?', answer: 'Critical', note: 'board pack' }]
  });
  assert.match(text, /INTERNAL USE ONLY/);
  assert.match(text, /Status: Provisional, based on 1 of 22 questions/);
  assert.match(text, /Best fit so far: Sigma and Tableau fit equally on these answers/);
  assert.match(text, /Lead: too close to call/);
  assert.match(text, /\(board pack\)/);
  assert.match(text, /draft questions \(Q21\)/);
  assert.ok(!/Best fit[a-z ]*: Tableau\b/.test(text));
});

test('a summary with nothing scored says there is nothing to recommend', () => {
  const t = L.buildSummary({ date: 'x', clientName: '', state: 'none', answered: 0, visible: 22, informative: false, coLeaders: [], shortlist: [], excluded: [], answers: [] });
  assert.match(t, /nothing to recommend/);
});

test('html is escaped', () => {
  assert.equal(L.escapeHtml('<b>"x" & \'y\'</b>'), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
});

test('static page copy never lists three or more tools out of alphabetical order', () => {
  const TOOLS = /Looker|Power BI|Qlik|Sigma|Tableau|ThoughtSpot/g;
  const dir = path.join(root, 'src', 'page');
  const bad = [];
  for (const f of fs.readdirSync(dir).filter((n) => /\.(js|html|css)$/.test(n))) {
    fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((line, i) => {
      const found = line.match(TOOLS) || [];
      if (found.length < 3) return;
      const sorted = found.slice().sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      if (found.join('|') !== sorted.join('|')) bad.push(`${f}:${i + 1}: ${found.join(', ')}`);
    });
  }
  assert.deepEqual(bad, [], 'tool lists in page source must be alphabetical');
});

test('answers written as "Title: detail" or "Title — detail" split into a title and a line; nothing is added', () => {
  assert.deepEqual(L.splitLabel('Critical: executive or board-grade bespoke visuals'), { title: 'Critical', detail: 'Executive or board-grade bespoke visuals' });
  assert.deepEqual(L.splitLabel('Small — up to 25 reports / 200 users'), { title: 'Small', detail: 'Up to 25 reports / 200 users' });
  assert.deepEqual(L.splitLabel('Yes: vendor-hosted SaaS is acceptable'), { title: 'Yes', detail: 'Vendor-hosted SaaS is acceptable' });
  for (const plain of ['Microsoft', 'Hybrid / on-premises', 'Standard dashboards / simple calculations']) assert.deepEqual(L.splitLabel(plain), { title: plain, detail: '' });
  const norm = (x) => x.toLowerCase().replace(/[:—]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const qq of model().questions) for (const o of qq.options) {      // the words are the workbook's own: the two parts rejoin into the label
    const s = L.splitLabel(o.label);
    assert.equal(norm(s.title + ' ' + s.detail), norm(o.label), `${qq.id}/${o.id}`);
  }
});

test('up to three scored answers sit in one bar; more fill a grid', () => {
  assert.equal(L.optionLayout(2), 'seg'); assert.equal(L.optionLayout(3), 'seg');
  assert.equal(L.optionLayout(4), 'grid'); assert.equal(L.optionLayout(10), 'grid');
});
