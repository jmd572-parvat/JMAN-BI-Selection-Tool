'use strict';
/* Session layer: validation, branching, pruning and the result object the page renders. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Session } = require('../src/engine/session.js');

const model = () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8'));

test('a new session asks the questions that are not behind a branch, in asking order', () => {
  const s = new Session(model());
  const ids = s.visible().map((q) => q.id);
  assert.equal(ids[0], 'Q01');
  assert.ok(!ids.includes('Q11') && !ids.includes('Q12'), 'skills questions wait for Q10');
  assert.ok(!ids.includes('Q14') && !ids.includes('Q15'), 'migration questions wait for Q13');
  assert.ok(ids.includes('Q16') && ids.includes('Q20'), 'Q16-Q20 are asked of everyone');
  const orders = s.visible().map((q) => q.order);
  assert.deepEqual(orders, orders.slice().sort((a, b) => a - b));
});

test('answers are validated', () => {
  const s = new Session(model());
  assert.throws(() => s.answer('Q99', ['x']), /Unknown question/);
  assert.throws(() => s.answer('Q04', ['nonsense']), /Unknown option/);
  assert.throws(() => s.answer('Q04', ['microsoft', 'google_cloud']), /single-select/);
  assert.throws(() => s.answer('Q11', ['beginner']), /not asked/);
  s.answer('Q01', ['self_service_analytics_and_reporting', 'self_service_analytics_and_reporting']);
  assert.deepEqual(s.answers.Q01, ['self_service_analytics_and_reporting'], 'duplicates collapse');
});

test('closing a branch clears the answers behind it and says which', () => {
  const s = new Session(model());
  s.answer('Q10', ['client_team']);
  s.answer('Q11', ['beginner']);
  s.answer('Q12', ['no_training_required']);
  assert.equal(s.progress().answered, 3);
  const { pruned } = s.answer('Q10', ['jman']);
  assert.deepEqual(pruned.sort(), ['Q11', 'Q12']);
  assert.ok(!('Q11' in s.answers) && !('Q12' in s.answers));
});

test('clearing an answer removes it', () => {
  const s = new Session(model());
  s.answer('Q04', ['microsoft']);
  s.clear('Q04');
  assert.ok(!('Q04' in s.answers));
});

test('no answers: nothing is ranked as better, and the page is told so', () => {
  const r = new Session(model()).result();
  assert.equal(r.informative, false);
  assert.equal(r.tooCloseToCall, false);
  assert.deepEqual(r.shortlist, []);
  assert.deepEqual(r.coLeaders, []);
});

test('a clear answer produces a leader, a margin and a shortlist', () => {
  const s = new Session(model());
  s.answer('Q04', ['salesforce']);
  const r = s.result();
  assert.equal(r.informative, true);
  assert.equal(r.ranking[0].tool.id, 'tableau');
  assert.ok(r.margin > 0.15 && !r.tooCloseToCall);
  assert.ok(r.shortlist.length >= 3);
  assert.ok(r.ranking.every((row, i, a) => !i || a[i - 1].rank <= row.rank), 'ranking is in rank order');
});

test('tied leaders are shown as co-leaders, alphabetically, and flagged too close to call', () => {
  const s = new Session(model());
  s.answer('Q21', ['critical']);          // draft scores give Tableau and Sigma the same fit
  const r = s.result();
  assert.deepEqual(r.coLeaders.map((t) => t.name), ['Sigma', 'Tableau']);
  assert.equal(r.tooCloseToCall, true);
  assert.deepEqual(r.ranking.slice(0, 2).map((x) => x.tool.name), ['Sigma', 'Tableau']);
  assert.ok(r.ranking[0].tied && r.ranking[0].tiedWith.includes('tableau'));
});

test('a mandatory filter lists the excluded tool with the answer that excluded it', () => {
  const s = new Session(model());
  s.answer('Q26', ['no_self_hosted']);
  const r = s.result();
  assert.equal(r.excluded.length, 1);
  assert.equal(r.excluded[0].tool.id, 'sigma');
  assert.equal(r.excluded[0].because[0].questionId, 'Q26');
  assert.match(r.excluded[0].because[0].optionLabel, /on-premises/i);
  assert.equal(r.excluded[0].because[0].optionId, 'no_self_hosted');
  assert.ok(r.excluded[0].because[0].rationale.length > 20, 'the SME rationale for the excluded tool is carried');
  assert.ok(!r.ranking.some((row) => row.tool.id === 'sigma'));
});

test('draft questions that influenced the result are reported so the page can say so', () => {
  const s = new Session(model());
  s.answer('Q04', ['microsoft']);
  assert.deepEqual(s.result().usesDraftQuestions, []);
  s.answer('Q23', ['tight_budget']);
  assert.deepEqual(s.result().usesDraftQuestions, ['Q23']);
});

test('explain() gives the answers that moved a tool most, with the SME rationale', () => {
  const s = new Session(model());
  s.answer('Q04', ['microsoft']);
  s.answer('Q05', ['yes']);
  const e = s.explain('powerbi');
  assert.equal(e.tool.name, 'Power BI');
  assert.ok(e.strengths.length > 0);
  const top = e.strengths[0];
  assert.ok(top.contribution > 0 && top.answer.length > 0 && top.why.length > 0 && top.why[0].length > 20);
  const looker = s.explain('looker');
  assert.ok(looker.concerns.some((x) => x.questionId === 'Q04'), 'Looker is held back by a Microsoft estate');
});

test('saved answers restore; anything stale or invalid is dropped', () => {
  const s = new Session(model());
  s.answer('Q04', ['snowflake']);
  s.answer('Q10', ['client_team']);
  s.answer('Q11', ['intermediate']);
  const back = Session.fromJSON(model(), JSON.parse(JSON.stringify(s.toJSON())));
  assert.deepEqual(back.answers, s.answers);
  const dirty = Session.fromJSON(model(), { answers: { Q04: ['snowflake'], Q11: ['intermediate'], Q05: ['bogus'], Q99: ['x'] } });
  assert.deepEqual(dirty.answers, { Q04: ['snowflake'] });
});

test('progress counts only the questions currently asked', () => {
  const s = new Session(model());
  const p0 = s.progress();
  assert.equal(p0.answered, 0);
  s.answer('Q10', ['client_team']);
  const p1 = s.progress();
  assert.equal(p1.visible, p0.visible + 2, 'Q11 and Q12 appear');
  assert.equal(p1.answered, 1);
});

test('lead strength follows the calibrated bands, and ties are always too close', () => {
  const { classifyGap, TOO_CLOSE_Z, CLEAR_LEAD_Z } = require('../src/engine/engine.js');
  assert.equal(classifyGap(TOO_CLOSE_Z - 0.001), 'tooClose');
  assert.equal(classifyGap(TOO_CLOSE_Z), 'narrow');
  assert.equal(classifyGap(CLEAR_LEAD_Z - 0.001), 'narrow');
  assert.equal(classifyGap(CLEAR_LEAD_Z), 'clear');
  assert.ok(TOO_CLOSE_Z < CLEAR_LEAD_Z);

  const none = new Session(model()).result();
  assert.equal(none.leadStrength, 'none');
  assert.equal(none.shortlistBoundary, null);

  const clear = new Session(model());
  clear.answer('Q04', ['salesforce']);
  assert.equal(clear.result().leadStrength, 'clear');

  const tie = new Session(model());
  tie.answer('Q21', ['critical']);
  assert.equal(tie.result().leadStrength, 'tooClose');
});

test('the shortlist boundary says how far the third platform is ahead of the first one left out', () => {
  const s = new Session(model());
  s.answer('Q04', ['salesforce']);
  s.answer('Q05', ['yes']);
  const r = s.result();
  assert.ok(r.shortlistBoundary, 'there are more than three platforms, so there is a boundary');
  assert.ok(r.shortlistBoundary.gap >= 0);
  assert.ok(['clear', 'narrow', 'tooClose'].includes(r.shortlistBoundary.strength));
  const left = r.ranking.find((x) => x.rank > 3);
  assert.equal(r.shortlistBoundary.firstLeftOut.id, left.tool.id);
});

test('coverage is the share of visible question weight answered, and states follow it', () => {
  const { NEAR_COMPLETE_COVERAGE } = require('../src/engine/engine.js');
  const s = new Session(model());
  assert.equal(s.progress().coverage, 0);
  assert.equal(s.result().state, 'none');
  s.answer('Q04', ['microsoft']);                    // weight 5
  const p = s.progress();
  assert.ok(p.coverage > 0 && p.coverage < 0.2, `coverage ${p.coverage}`);
  assert.equal(p.weightAnswered, 5);
  assert.equal(s.result().state, 'provisional');
  // answer everything that is visible: coverage reaches 1 and the state is complete
  for (let guard = 0; guard < 40 && s.openQuestions().length; guard++) {
    const q = s.visible().find((v) => !v.answered);
    s.answer(q.id, [q.options[0].id]);
  }
  assert.equal(s.openQuestions().length, 0);
  assert.equal(s.progress().coverage, 1);
  assert.equal(s.result().state, 'complete');
  assert.ok(NEAR_COMPLETE_COVERAGE > 0.5 && NEAR_COMPLETE_COVERAGE < 1);
});

test('the near-complete state starts at the calibrated coverage line', () => {
  const { NEAR_COMPLETE_COVERAGE } = require('../src/engine/engine.js');
  const s = new Session(model());
  let sawProvisional = false, sawNear = false;
  for (let guard = 0; guard < 40; guard++) {
    const open = s.openQuestions();
    if (open.length <= 1) break;                       // stop before the last question so 'complete' is not reached
    const q = s.visible().find((v) => v.id === open[0].id);
    s.answer(q.id, [q.options.find((o) => !o.unknown).id]);
    const r = s.result();
    if (r.coverage < NEAR_COMPLETE_COVERAGE) { assert.equal(r.state, 'provisional'); sawProvisional = true; }
    else { assert.equal(r.state, 'near'); sawNear = true; }
  }
  assert.ok(sawProvisional && sawNear, 'both states should be reached on the way');
});

test('open questions are listed heaviest first, then in asking order, and shrink as answers arrive', () => {
  const s = new Session(model());
  const open = s.openQuestions();
  assert.equal(open[0].id, 'Q04', 'ecosystem carries the largest weight');
  const w = (id) => s.engine.qmap[id].weight;
  for (let i = 1; i < open.length; i++) {
    assert.ok(w(open[i - 1].id) > w(open[i].id) || (w(open[i - 1].id) === w(open[i].id) && open[i - 1].order < open[i].order));
  }
  assert.ok(!('weight' in open[0]), 'weights are never exposed to the page');
  s.answer('Q04', ['microsoft']);
  assert.ok(!s.openQuestions().some((q) => q.id === 'Q04'));
});
