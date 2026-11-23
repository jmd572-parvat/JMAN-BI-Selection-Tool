'use strict';
/*
 * Runs scripts/check_integrity.py (no network): the workbook, the JSON, the hosted page, the parity fixtures, the deck data, the page's own
 * constants and the files that are tracked all have to agree. A FAIL there fails this test and prints the failing lines; WARN lines
 * (points that need a person's decision, such as answers still waiting for an expert) do not fail it. The web addresses are opened
 * only on request: python scripts/check_integrity.py --links
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');

test('the data, the hosted page and the documents agree (scripts/check_integrity.py reports no FAIL)', () => {
  const r = spawnSync('python', ['-X', 'utf8', 'scripts/check_integrity.py'], { cwd: root, encoding: 'utf8' });
  assert.ok(!r.error, r.error && r.error.message);
  const out = (r.stdout || '') + (r.stderr || '');
  const failed = out.split('\n').filter((l) => /^\[FAIL\]/.test(l));
  assert.equal(r.status, 0, `integrity check failed:\n${out.split('\n').filter((l, i, a) => /^\[FAIL\]/.test(l) || (i && /^\[FAIL\]/.test(a[i - 1]))).join('\n')}`);
  assert.equal(failed.length, 0);
  assert.match(out, /\[PASS\] A1 /, 'the check really ran');
});
