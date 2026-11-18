'use strict';
/* Engine properties: the "no platform bias" guarantees, tested on the real data. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createEngine, TOO_CLOSE_Z } = require('../src/engine/engine.js');

const load = () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8'));

function rng(seed) {                       // mulberry32: small seeded generator, deterministic across runs
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform random client; `pinNulls` answers every requirement-style question with its 'not a priority' option. */
function randomClient(engine, rand, pinNulls) {
  const answers = {};
  engine.questions.forEach((q) => {
    const vis = engine.visibleQuestions(answers).visible.some((v) => v.id === q.id);
    if (!vis) return;
    if (pinNulls && q.reference === 'neutral') { answers[q.id] = [q.options.find((o) => o.unknown).id]; return; }
    const ids = q.options.map((o) => o.id);
    if (q.type === 'single') { answers[q.id] = [ids[Math.floor(rand() * ids.length)]]; return; }
    const k = 1 + Math.floor(rand() * Math.min(3, ids.length));
    const pool = ids.slice(); const pick = [];
    while (pick.length < k) pick.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    answers[q.id] = pick;
  });
  return answers;
}

test('the calibration shipped in the JSON matches what the scores imply', () => {
  assert.deepEqual(createEngine(load()).verifyCalibration(), []);
});

test('a client who gives no usable answer sees every platform tied for first', () => {
  const e = createEngine(load());
  for (const answers of [{}, { Q02: ['other_not_yet_defined'] }, { Q13: ['yes'] }]) {
    const r = e.score(answers);
    assert.deepEqual(Object.values(r.rank), e.tools.map(() => 1), JSON.stringify(answers));
    assert.equal(r.tiedLeaders.length, e.tools.length);
    r.ranked.forEach((t) => assert.equal(r.z[t], 0));
  }
});

test('tied tools are listed alphabetically and share a rank', () => {
  const e = createEngine(load());
  const r = e.score({});
  assert.deepEqual(r.ranked, e.tools.slice().sort());
});

test('tool order in the data never changes a rank', () => {
  const base = load();
  const rand = rng(11);
  const engine = createEngine(base);
  const shuffled = JSON.parse(JSON.stringify(base));
  for (let i = shuffled.tools.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled.tools[i], shuffled.tools[j]] = [shuffled.tools[j], shuffled.tools[i]];
  }
  assert.notDeepEqual(shuffled.tools.map((t) => t.id), base.tools.map((t) => t.id), 'shuffle should change the order');
  const other = createEngine(shuffled);
  const r2 = rng(5);
  for (let i = 0; i < 400; i++) {
    const a = randomClient(engine, r2, i % 2 === 0);
    const x = engine.score(a), y = other.score(a);
    assert.deepEqual(x.rank, y.rank);
    assert.deepEqual(x.ranked, y.ranked);
  }
});

test('clients who state no requirement: equal expected score, equal volatility, fair share of wins', () => {
  const e = createEngine(load());
  const rand = rng(21);
  const N = 4000, sum = {}, sq = {}, wins = {};
  e.tools.forEach((t) => { sum[t] = 0; sq[t] = 0; wins[t] = 0; });
  for (let i = 0; i < N; i++) {
    const r = e.score(randomClient(e, rand, true));
    e.tools.forEach((t) => { sum[t] += r.z[t]; sq[t] += r.z[t] * r.z[t]; });
    r.tiedLeaders.forEach((t) => { wins[t] += 1 / r.tiedLeaders.length; });
  }
  const mean = {}, sd = {};
  e.tools.forEach((t) => { mean[t] = sum[t] / N; sd[t] = Math.sqrt(sq[t] / N - mean[t] * mean[t]); });
  e.tools.forEach((t) => assert.ok(Math.abs(mean[t]) < 0.05, `mean z of ${t} = ${mean[t]}`));
  const ratio = Math.max(...Object.values(sd)) / Math.min(...Object.values(sd));
  assert.ok(ratio < 1.25, `volatility ratio ${ratio}`);
  e.tools.forEach((t) => assert.ok(wins[t] / N > 0.10 && wins[t] / N < 0.24, `${t} wins ${(100 * wins[t] / N).toFixed(1)}%`));
});

test('Pareto guard: no tool outranks one that fits at least as well on every answered question', () => {
  const e = createEngine(load());
  const rand = rng(33);
  let adjusted = 0;
  for (let i = 0; i < 3000; i++) {
    const r = e.score(randomClient(e, rand, i % 2 === 0));
    for (const a of r.ranked) {
      for (const b of r.ranked) {
        if (a === b || r.rank[a] >= r.rank[b]) continue;       // a is ranked above b
        let bGeAll = true, bGtSome = false;
        for (const qid of Object.keys(r.perQuestion)) {
          const x = r.perQuestion[qid].r;
          if (x[b] < x[a] - 1e-9) bGeAll = false;
          if (x[b] > x[a] + 1e-9) bGtSome = true;
        }
        assert.ok(!(bGeAll && bGtSome), `${a} outranks ${b} although ${b} dominates`);
        if (r.z[a] < r.z[b] - 1e-9) adjusted++;               // the guard actually reordered here
      }
    }
  }
  assert.ok(adjusted > 0, 'the guard was never exercised, so this test proves nothing');
});

test('a mandatory filter removes the tool and says why', () => {
  const e = createEngine(load());
  const r = e.score({ Q26: ['no_self_hosted'], Q04: ['snowflake'] });
  assert.deepEqual(r.excluded, ['sigma']);
  assert.ok(!r.ranked.includes('sigma'));
  assert.deepEqual(r.excludedBy.sigma, [{ questionId: 'Q26', optionId: 'no_self_hosted' }]);
});

test('answers to a question whose branch is closed are ignored', () => {
  const e = createEngine(load());
  const open = e.score({ Q10: ['client_team'], Q11: ['beginner'], Q04: ['microsoft'] });
  const shut = e.score({ Q10: ['jman'], Q11: ['beginner'], Q04: ['microsoft'] });
  assert.ok(open.counted.includes('Q11'));
  assert.ok(!shut.counted.includes('Q11'));
});

test('multi-select averages the selected answers and never sums them', () => {
  const e = createEngine(load());
  const one = e.score({ Q01: ['self_service_analytics_and_reporting'] }, { mode: 'raw' }).rawFit.looker;
  const two = e.score({ Q01: ['improved_forecasting_and_planning'] }, { mode: 'raw' }).rawFit.looker;
  const both = e.score({ Q01: ['self_service_analytics_and_reporting', 'improved_forecasting_and_planning'] }, { mode: 'raw' }).rawFit.looker;
  assert.ok(Math.abs(both - (one + two) / 2) < 1e-12);
});

test('a weight override changes the result; weight 0 removes the question', () => {
  const e = createEngine(load());
  const answers = { Q04: ['salesforce'], Q05: ['yes'] };
  const base = e.score(answers);
  const off = e.score(answers, { weights: { Q04: 0 } });
  assert.ok(base.counted.includes('Q04'));
  assert.ok(!off.counted.includes('Q04'));
  assert.notDeepEqual(base.z, off.z);
});

test('TOO_CLOSE_Z is exported and positive', () => {
  assert.ok(TOO_CLOSE_Z > 0 && TOO_CLOSE_Z < 1);
});
