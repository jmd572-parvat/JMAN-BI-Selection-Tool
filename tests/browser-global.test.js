'use strict';
/* The page loads the engine with plain <script> tags. Prove that works with no module system present. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('engine.js then session.js work as classic scripts and expose BIEngine / BISession globals', () => {
  const ctx = { console };
  ctx.self = ctx;                                   // what a browser's global scope looks like to the UMD wrapper
  vm.createContext(ctx);
  for (const f of ['engine.js', 'session.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', f), 'utf8'), ctx, { filename: f });
  }
  assert.equal(typeof ctx.BIEngine.createEngine, 'function');
  assert.equal(typeof ctx.BISession.Session, 'function');
  assert.equal(typeof ctx.module, 'undefined', 'no CommonJS leaked into the browser context');

  const model = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8'));
  const s = new ctx.BISession.Session(model);
  s.answer('Q04', ['salesforce']);
  const r = s.result();
  assert.equal(r.ranking[0].tool.id, 'tableau');
  assert.equal(r.informative, true);
});
