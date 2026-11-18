'use strict';
/* The two site builds: preview (for reviewers) and production (what would ship). Builds into a temp folder. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
function build(args) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-site-'));
  execFileSync('python', ['-X', 'utf8', 'scripts/build_site.py', '--out', out, ...args], { cwd: root, stdio: 'pipe' });
  return out;
}
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const config = (html) => JSON.parse(html.match(/window\.PLAYBOOK_CONFIG = (\{.*\});<\/script>/)[1]);

test('preview build: drafts included with a toggle, reviewer notes present', () => {
  const out = build([]);
  const html = read(out, 'index.html');
  const cfg = config(html);
  assert.deepEqual(Object.keys(cfg.logos).sort(), ['looker', 'powerbi', 'qlik', 'sigma', 'tableau', 'thoughtspot'], 'a logo for every tool');
  for (const f of Object.values(cfg.logos)) assert.ok(fs.existsSync(path.join(out, f)), `${f} is shipped`);
  delete cfg.logos;
  assert.deepEqual(cfg, { preview: true, showDrafts: true, draftToggle: true, storageKey: 'bi-playbook-v1' });
  assert.match(html, /pv-preview/);
  assert.match(html, /About this preview: known gaps/);
  const q = JSON.parse(read(out, 'data/questions.json'));
  assert.equal(q.questions.length, 26);
  assert.ok(q.meta.draftsIncluded);
  assert.ok(!html.includes('{{'), 'no unreplaced template placeholders');
  assert.match(html, /playbook\.js\?v=[0-9a-f]{10}/, 'script URLs carry a build version');
});

test('production build: no draft questions, no reviewer strip, no preview config', () => {
  const out = build(['--production']);
  const html = read(out, 'index.html');
  const cfg = config(html);
  delete cfg.logos;
  assert.deepEqual(cfg, { preview: false, showDrafts: false, draftToggle: false, storageKey: 'bi-playbook-v1' });
  assert.ok(!/pv-preview/.test(html), 'the reviewer strip is removed');
  assert.ok(!/known gaps/.test(html), 'the known-gaps panel is removed');
  assert.ok(!html.includes('{{'));
  const q = JSON.parse(read(out, 'data/questions.json'));
  assert.equal(q.meta.draftsIncluded, false);
  assert.ok(q.questions.every((x) => x.status !== 'draft'), 'no draft question ships');
  assert.equal(q.questions.length, 20);
});

test('both builds contain every file the page loads, and nothing refers to a missing file', () => {
  for (const args of [[], ['--production']]) {
    const out = build(args);
    const html = read(out, 'index.html');
    const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1]).filter((r) => !/^https?:/.test(r));
    const fetched = [...html.matchAll(/get\('([^']+)'\)/g)].map((m) => m[1]);
    for (const r of [...refs, ...fetched]) assert.ok(fs.existsSync(path.join(out, r.split('?')[0])), `${args.join(' ') || 'preview'}: ${r} is missing`);
  }
});
