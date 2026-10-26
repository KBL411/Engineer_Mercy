// tests/codeowners-paths.test.mjs — CODEOWNERS parses, names an owner for every
// pattern, and covers the files whose edits must reach the maintainer.
//
// This fork keeps a single catch-all rule (`*  @KBL411`), so the path-by-path
// checks the upstream file needed are gone. What stays worth pinning: a pattern
// that matches nothing fails silently (GitHub requests no review and reports no
// error), so every pattern must resolve to something, and the skill router, the
// one file `/career-ops <mode>` goes through, must stay a regular file the
// catch-all can own (a symlink would hide an edit from the owner entry).
import { pass, fail, ROOT } from './helpers.mjs';
import assert from 'node:assert';
import { existsSync, readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

const ok = (name, fn) => { try { fn(); pass(name); } catch (e) { fail(`${name} — ${e.message}`); } };
const read = (p) => readFileSync(join(ROOT, p), 'utf-8');

const rules = read('.github/CODEOWNERS').split('\n')
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('#'))
  .map(l => l.split(/\s+/));
const patterns = rules.map(r => r[0]);

// Handles the catch-all `*` and root-anchored patterns that use a `*` only in
// the last segment; anything fancier fails loudly instead of passing unread.
function matchesSomething(pattern) {
  if (pattern === '*') return readdirSync(ROOT).length > 0;
  assert.ok(pattern.startsWith('/'), `${pattern}: only '*' and root-anchored patterns are understood by this test`);
  const rel = pattern.slice(1).replace(/\/$/, '');
  if (!rel.includes('*')) {
    if (!existsSync(join(ROOT, rel))) return false;
    // A trailing slash claims a directory.
    return !pattern.endsWith('/') || lstatSync(join(ROOT, rel)).isDirectory();
  }
  const dir = dirname(rel);
  assert.ok(!dir.includes('*'), `${pattern}: a wildcard outside the last segment is not understood by this test`);
  if (!existsSync(join(ROOT, dir))) return false;
  const re = new RegExp('^' + basename(rel).split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$');
  return readdirSync(join(ROOT, dir)).some(name => re.test(name));
}

ok('every CODEOWNERS pattern matches a path that exists', () => {
  assert.ok(patterns.length >= 1, 'CODEOWNERS parsed');
  assert.deepEqual(patterns.filter(p => !matchesSomething(p)), []);
});

ok('every CODEOWNERS rule names at least one @owner', () => {
  const ownerless = rules.filter(r => r.length < 2 || !r.slice(1).every(o => /^@[\w.-]+(\/[\w.-]+)?$/.test(o)));
  assert.deepEqual(ownerless.map(r => r.join(' ')), []);
});

ok('a catch-all rule means every PR asks the maintainer for a review', () => {
  assert.ok(patterns.includes('*'), "CODEOWNERS has no '*' rule, so unlisted paths have no owner");
});

// The router is a regular file, so a symlink here would hide an edit from the
// catch-all owner entry.
const ROUTER = '.claude/skills/career-ops/SKILL.md';

ok('the skill router is a regular file and has a code owner', () => {
  assert.ok(existsSync(join(ROOT, ROUTER)), `${ROUTER} exists`);
  assert.ok(!lstatSync(join(ROOT, ROUTER)).isSymbolicLink(), `${ROUTER} is a regular file, not a symlink`);
  assert.ok(patterns.includes('*') || patterns.includes(`/${ROUTER}`), `${ROUTER} is covered by no CODEOWNERS entry`);
});
