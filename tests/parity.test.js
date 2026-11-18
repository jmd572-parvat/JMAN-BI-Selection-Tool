'use strict';
/*
 * Cross-language contract: the JavaScript engine must reproduce the Python reference (scripts/bi_model.py) on every
 * recorded case. If this fails after a data change, regenerate the fixture:  npm run parity:update
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createEngine } = require('../src/engine/engine.js');

const root = path.join(__dirname, '..');
const modelBytes = fs.readFileSync(path.join(root, 'data', 'questions.json'));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'parity.json'), 'utf8'));
const TOL = 1e-9;

function close(a, b) { return Math.abs(a - b) <= TOL; }

test('parity fixture was generated from the current data/questions.json', () => {
  const sha = crypto.createHash('sha256').update(modelBytes).digest('hex');
  assert.equal(sha, fixture.modelSha256, 'tests/fixtures/parity.json is stale: run `npm run parity:update`');
});

test(`JavaScript engine matches the Python reference on all ${fixture.cases.length} recorded cases`, () => {
  const engine = createEngine(JSON.parse(modelBytes));
  const problems = [];
  for (const c of fixture.cases) {
    const got = engine.score(c.answers, { weights: c.weights, mode: c.mode });
    const exp = c.expect;
    const where = (what) => `${c.name}: ${what}`;
    for (const t of Object.keys(exp.z)) {
      if (!close(got.z[t], exp.z[t])) problems.push(where(`z[${t}] ${got.z[t]} != ${exp.z[t]}`));
      if (!close(got.rawFit[t], exp.rawFit[t])) problems.push(where(`rawFit[${t}] ${got.rawFit[t]} != ${exp.rawFit[t]}`));
    }
    if (!close(got.margin, exp.margin)) problems.push(where(`margin ${got.margin} != ${exp.margin}`));
    if (!close(got.denominator, exp.denominator)) problems.push(where(`denominator ${got.denominator} != ${exp.denominator}`));
    for (const key of ['ranked', 'excluded', 'counted', 'visible', 'tiedLeaders']) {
      if (JSON.stringify(got[key]) !== JSON.stringify(exp[key])) {
        problems.push(where(`${key} ${JSON.stringify(got[key])} != ${JSON.stringify(exp[key])}`));
      }
    }
    if (JSON.stringify(got.rank) !== JSON.stringify(exp.rank)) {
      // key order of the object is irrelevant; compare values per tool
      for (const t of Object.keys(exp.rank)) if (got.rank[t] !== exp.rank[t]) problems.push(where(`rank[${t}] ${got.rank[t]} != ${exp.rank[t]}`));
    }
  }
  assert.deepEqual(problems.slice(0, 10), [], `${problems.length} mismatch(es); first shown`);
});
