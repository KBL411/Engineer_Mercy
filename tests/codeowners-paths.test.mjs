// tests/codeowners-paths.test.mjs — every CODEOWNERS entry names a path that
// exists, and the agent-facing files that protect the same paths agree with it.
//
// A CODEOWNERS pattern that matches nothing fails silently: GitHub requests no
// review and reports no error. `/plugins-registry.json` sat there for months
// after the registry was split into one file per plugin under plugins-registry/
// (#1401), so a PR that re-pinned a plugin — the SHA that decides which
// third-party code users install — was routed to no owner, while the line read
// as if the trust root were covered. The skill router had the same gap from the
// other side: a path no owner entry or label glob named.
import { pass, fail, ROOT } from './helpers.mjs';
import assert from 'node:assert';
import { existsSync, readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

const ok = (name, fn) => { try { fn(); pass(name); } catch (e) { fail(`${name} — ${e.message}`); } };
const read = (p) => readFileSync(join(ROOT, p), 'utf-8');

const patterns = read('.github/CODEOWNERS').split('\n')
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('#'))
  .map(l => l.split(/\s+/)[0]);

// Anchored patterns only use a `*` in the last segment here; that is all this
// needs to resolve, and anything fancier fails loudly instead of passing unread.
function matchesSomething(pattern) {
  assert.ok(pattern.startsWith('/'), `${pattern}: only root-anchored patterns are understood by this test`);
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
  assert.ok(patterns.length > 10, 'CODEOWNERS parsed');
  assert.deepEqual(patterns.filter(p => !matchesSomething(p)), []);
});

ok('the plugin registry directory is owned, not the deleted single file', () => {
  assert.ok(existsSync(join(ROOT, 'plugins-registry')) && !existsSync(join(ROOT, 'plugins-registry.json')),
    'the registry is the plugins-registry/ directory');
  assert.ok(patterns.includes('/plugins-registry/'));
  assert.ok(!patterns.includes('/plugins-registry.json'));
});

// The router is the one skill file `/career-ops <mode>` goes through. It is a
// regular file, so a symlink here would hide an edit from the owner entry.
const ROUTER = '.claude/skills/career-ops/SKILL.md';

ok('the skill router is a regular file and has a code owner', () => {
  assert.ok(existsSync(join(ROOT, ROUTER)), `${ROUTER} exists`);
  assert.ok(!lstatSync(join(ROOT, ROUTER)).isSymbolicLink(), `${ROUTER} is a regular file, not a symlink`);
  assert.ok(patterns.includes(`/${ROUTER}`), `/${ROUTER} is not in CODEOWNERS`);
});

ok('every root agent doc named in copilot-instructions has a code owner', () => {
  const wrappers = [...read('.github/copilot-instructions.md').matchAll(/`([A-Z]+\.md)`/g)]
    .map(m => m[1]).filter(f => /^(CLAUDE|AGENTS)\.md$/.test(f));
  assert.ok(wrappers.includes('CLAUDE.md'));
  assert.deepEqual([...new Set(wrappers)].filter(f => !patterns.includes(`/${f}`)), []);
});

ok('copilot-instructions protects plugins-registry/, not the deleted file', () => {
  const doc = read('.github/copilot-instructions.md');
  assert.ok(!doc.includes('plugins-registry.json'), 'names the deleted plugins-registry.json');
  const controlFiles = doc.split('\n').find(l => l.includes('**control files**'));
  assert.ok(controlFiles && controlFiles.includes('`plugins-registry/`'), 'control files list names plugins-registry/');
});

ok('the agent-behavior label fires on the router', () => {
  const labeler = read('.github/labeler.yml');
  const block = labeler.slice(labeler.indexOf('agent-behavior'), labeler.indexOf('"🔧 scripts"'));
  const glob = `${ROUTER.split('/').slice(0, 2).join('/')}/**`;
  assert.ok(block.includes(`- ${glob}`), `${glob} missing from the agent-behavior globs`);
});
