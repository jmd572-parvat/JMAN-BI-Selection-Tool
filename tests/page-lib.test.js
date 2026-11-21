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
  tie.answer('Q03', ['no']);          // an answer that scores every tool the same: Sigma and Tableau share the baseline, so they tie
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

test('the summary is Markdown: internal, states its status, lists notes, and never names a single winner for a tie', () => {
  const text = L.buildSummary({
    date: '2026-11-17', clientName: 'Example client', state: 'provisional', answered: 1, visible: 22, informative: true,
    winners: [{ id: 'sigma', name: 'Sigma', docUrl: 'https://help.sigmacomputing.com/' }, { id: 'tableau', name: 'Tableau', docUrl: 'https://help.tableau.com/' }],
    leadSentence: 'Sigma and Tableau fit equally.', leadStrength: 'tooClose', boundaryMessage: null, others: [{ name: 'Looker', rank: 3, tied: false }], excluded: [],
    reasons: [{ tool: 'Sigma', strengths: [{ answer: 'No', question: 'Strict governance?', why: 'Warehouse permissions are enough.' }], concerns: [] }, { tool: 'Tableau', strengths: [], concerns: [] }],
    constraints: [], migration: [], nextSteps: ['Run a proof of concept.'], usesDraft: ['Q21'],
    answers: [{ section: 'Business context and goals', question: 'Presentation quality?', answer: 'Critical', note: 'board pack' }]
  });
  assert.match(text, /^# BI tool recommendation for Example client\n/);
  assert.match(text, /\*Internal use only · 2026-11-17 · Provisional: 1 of 22 questions answered\*/);
  assert.match(text, /## Too close to call: Sigma and Tableau/);
  assert.ok(!/## Best fit/.test(text), 'a tie is never one winner');
  assert.match(text, /## Why Sigma fits\n\n- \*\*No\*\* \(Strict governance\?\): Warehouse permissions are enough\./);
  assert.match(text, /## Why Tableau fits\n\n- No answer favours it yet\./);
  assert.match(text, /- Rank 3: Looker/);
  assert.match(text, /- Official documentation for Sigma: \[https:\/\/help\.sigmacomputing\.com\/\]\(https:\/\/help\.sigmacomputing\.com\/\)/);
  assert.match(text, /- Official documentation for Tableau: /);
  assert.match(text, /\*\(board pack\)\*/);
  assert.match(text, /questions marked as draft \(Q21\)/);
});

test('a summary with nothing scored says there is nothing to recommend', () => {
  const t = L.buildSummary({ date: 'x', clientName: '', state: 'none', answered: 0, visible: 22, informative: false, answers: [] });
  assert.match(t, /nothing to recommend/);
  assert.match(t, /## Answers and notes\n\n- None yet\./);
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

test('up to three answers sit in one bar; more fill a grid', () => {
  assert.equal(L.optionLayout(2), 'seg'); assert.equal(L.optionLayout(3), 'seg');
  assert.equal(L.optionLayout(4), 'grid'); assert.equal(L.optionLayout(10), 'grid');
});

test('tile columns make even rows where they can: 4 answers a 2 x 2, 6 a 3 x 2, 8 a 4 x 2', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(L.optionColumns), [1, 2, 3, 2, 3, 3, 4, 4, 3, 4, 4]);
});
