// tests/state-file-silent-reset.test.mjs — a user-state file that must never
// reset itself quietly.
//
// intake.mjs's data/intake-state.json is the ledger of documents whose
// proposals the user already reviewed. Its loader used to answer an unreadable
// file with an empty object, which is indistinguishable from "this is a first
// run" — and the next write persisted that emptiness, so the loss was
// permanent.
//
// So each suite below pins both halves: a corrupt file is refused (loudly,
// exit 1, original bytes untouched), and an absent file is still a first run.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { pass, fail, ROOT, NODE } from './helpers.mjs';

console.log('\nState files — an unreadable file is not a first run');

const TRACKER = [
  '# Applications Tracker',
  '',
  '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
  '|---|------|---------|------|-------|--------|-----|--------|-------|',
  '| 7 | 2026-01-05 | Acme | Staff Engineer | 4.5/5 | Hired | ✅ | [7](reports/007-acme-2026-01-05.md) | — |',
  '| 8 | 2026-02-11 | Globex | Principal Engineer | 4.7/5 | Hired | ✅ | [8](reports/008-globex-2026-02-11.md) | — |',
  '',
].join('\n');

// Every child inherits a sanitized env. CAREER_OPS_TRACKER outranks the
// resolved root (DATA_CONTRACT.md), so leaving a developer's own export in
// place would point these writers at their real tracker (#3988).
function env(root) {
  return { ...process.env, CAREER_OPS_ROOT: root, CAREER_OPS_DATA_DIR: '', CAREER_OPS_TRACKER: '' };
}

function runScript(script, args, root) {
  try {
    const stdout = execFileSync(NODE, [join(ROOT, script), ...args], {
      env: env(root), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      code: err.status ?? 1,
      stdout: String(err.stdout || ''),
      stderr: String(err.stderr || ''),
    };
  }
}

/** A workspace with a data/ tracker, plus whatever state file the case needs. */
function makeWorkspace(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(dir, 'data'), { recursive: true });
  writeFileSync(join(dir, 'data', 'applications.md'), TRACKER);
  return dir;
}

const cleanup = [];

// ── intake: a corrupt ledger is refused, not treated as empty ───────────────
{
  const dir = makeWorkspace('intake-corrupt-');
  cleanup.push(dir);
  mkdirSync(join(dir, 'documents'), { recursive: true });
  writeFileSync(join(dir, 'documents', 'master-cv.md'), '# Master CV\n\nTen years of things.\n');
  const statePath = join(dir, 'data', 'intake-state.json');
  const corrupt = '{"ingested": {"documents/master-cv.md": {"hash": "abc';
  writeFileSync(statePath, corrupt);

  const r = runScript('intake.mjs', ['--summary'], dir);
  if (r.code !== 0) pass('intake exits nonzero on an unreadable ingest ledger');
  else fail(`intake exited 0 with a corrupt ledger; stdout: ${r.stdout.slice(0, 200)}`);

  if (/not valid JSON/i.test(r.stderr) && r.stderr.includes('intake-state.json')) {
    pass('the error names the ledger and says it is not valid JSON');
  } else fail(`error message does not identify the problem: ${JSON.stringify(r.stderr.slice(0, 300))}`);

  if (!/^\s*Error:|\n\s+at /.test(r.stderr)) pass('the ledger error is a message, not a stack trace');
  else fail(`stack trace leaked to the user: ${r.stderr.slice(0, 300)}`);

  if (!/\bnew\b/.test(r.stdout)) pass('no document is re-proposed as new off a ledger it cannot read');
  else fail(`intake proposed documents anyway: ${r.stdout.slice(0, 300)}`);

  if (readFileSync(statePath, 'utf8') === corrupt) pass('the damaged ledger is left exactly as found');
  else fail('intake rewrote the damaged ledger');
}

// ── intake: absent ledger is a first run; a healthy one is honored ──────────
{
  const dir = makeWorkspace('intake-healthy-');
  cleanup.push(dir);
  mkdirSync(join(dir, 'documents'), { recursive: true });
  writeFileSync(join(dir, 'documents', 'master-cv.md'), '# Master CV\n\nTen years of things.\n');

  const first = runScript('intake.mjs', ['--summary'], dir);
  if (first.code === 0 && /master-cv\.md\s+new\b/.test(first.stdout)) {
    pass('an absent ledger is a first run — the document reads as new');
  } else fail(`first run did not report the document as new: ${first.stdout.slice(0, 300)}${first.stderr.slice(0, 200)}`);

  const committed = runScript('intake.mjs', ['--commit', 'master-cv.md'], dir);
  if (committed.code === 0) pass('--commit records the reviewed source');
  else fail(`--commit failed: ${committed.stderr.slice(0, 200)}`);

  // Guard: the reason the ledger exists at all.
  const second = runScript('intake.mjs', ['--summary'], dir);
  if (/master-cv\.md\s+ingested\b/.test(second.stdout)) {
    pass('a reviewed document is not proposed again');
  } else fail(`reviewed document came back as unreviewed: ${second.stdout.slice(0, 300)}`);

  const strays = readdirSync(join(dir, 'data')).filter((f) => f.endsWith('.tmp'));
  if (strays.length === 0) pass('the ledger write leaves no .tmp file behind');
  else fail(`stray temp files after commit: ${strays.join(', ')}`);
}

// ── intake: an ingested that is present but not an object ──────────────────
{
  for (const [label, body] of [
    ['a string', '{"ingested":"documents/cv.md"}'],
    ['an array', '{"ingested":["documents/cv.md"]}'],
  ]) {
    const dir = makeWorkspace('intake-inner-');
    cleanup.push(dir);
    mkdirSync(join(dir, 'documents'), { recursive: true });
    writeFileSync(join(dir, 'documents', 'master-cv.md'), '# Master CV\n\nTen years of things.\n');
    const statePath = join(dir, 'data', 'intake-state.json');
    writeFileSync(statePath, body);

    const r = runScript('intake.mjs', ['--summary'], dir);
    if (r.code !== 0 && /ingested/.test(r.stderr)) {
      pass(`${label} under "ingested" is refused, and the message names the key`);
    } else {
      fail(`${label} under "ingested": expected a refusal naming the key, got code ${r.code} / `
        + `${JSON.stringify(r.stderr.slice(0, 160))}`);
    }
    if (!/\bnew\b/.test(r.stdout)) pass(`${label}: no document is re-proposed off it`);
    else fail(`${label}: intake proposed documents anyway`);
    if (readFileSync(statePath, 'utf8') === body) pass(`${label}: the damaged ledger is left as found`);
    else fail(`${label}: intake rewrote the damaged ledger`);
  }

  // Guard: absent is an empty ledger, and the document still reads as new.
  {
    const dir = makeWorkspace('intake-noingested-');
    cleanup.push(dir);
    mkdirSync(join(dir, 'documents'), { recursive: true });
    writeFileSync(join(dir, 'documents', 'master-cv.md'), '# Master CV\n\nthings\n');
    writeFileSync(join(dir, 'data', 'intake-state.json'), '{}');
    const r = runScript('intake.mjs', ['--summary'], dir);
    if (r.code === 0 && /master-cv\.md\s+new\b/.test(r.stdout)) {
      pass('an absent "ingested" still reads as an empty ledger');
    } else {
      fail(`an absent "ingested" should be an empty ledger: ${r.stdout.slice(0, 200)}`);
    }
  }
}

// ── intake: JSON that parses but is not a ledger object ────────────────────
{
  for (const [label, body] of [['an array', '[]'], ['null', 'null'], ['a string', '"{}"']]) {
    const dir = makeWorkspace('intake-shape-');
    cleanup.push(dir);
    mkdirSync(join(dir, 'documents'), { recursive: true });
    writeFileSync(join(dir, 'documents', 'master-cv.md'), '# CV\n\nthings\n');
    writeFileSync(join(dir, 'data', 'intake-state.json'), body);
    const r = runScript('intake.mjs', ['--summary'], dir);
    if (r.code !== 0 && r.stderr.includes('intake-state.json')) {
      pass(`${label} in the ledger is refused, and the message names the ledger`);
    } else {
      fail(`${label}: expected a refusal naming the ledger, got code ${r.code} / `
        + `${JSON.stringify(r.stderr.slice(0, 160))} / stdout ${r.stdout.slice(0, 120)}`);
    }
  }
}

for (const dir of cleanup) rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
