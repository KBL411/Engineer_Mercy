#!/usr/bin/env node

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { flagValue, hasFlag, validateFlags } from './lib/cli-flags.mjs';
import { fileURLToPath } from 'url';
import { getCareerOpsRoot } from './path-resolver.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
// CAREER_OPS_BATCH_STATE overrides the batch-state.tsv path — the same override
// merge-tracker.mjs already honours, so tests can drive this script against a
// sandbox instead of the developer's real batch run.
const batchStateFile = process.env.CAREER_OPS_BATCH_STATE
  ? resolve(process.env.CAREER_OPS_BATCH_STATE)
  : join(__dirname, 'batch', 'batch-state.tsv');
// reports/ is User Layer (DATA_CONTRACT.md), so it follows the data root —
// CAREER_OPS_ROOT / CAREER_OPS_DATA_DIR / .career-ops-data — not the code
// checkout. batch/ and modes/ are System Layer and stay on __dirname.
const reportsDir = join(getCareerOpsRoot(), 'reports');

const USAGE = `career-ops batch tailor — bulk generate tailored CVs for high-scoring batch jobs

Usage:
  node batch-tailor.mjs [--min-score N]

Options:
  --min-score N   Minimum score to tailor (default: 4.0). The --min-score=N form works too.
  --help, -h      Show this help
`;

const args = process.argv.slice(2);

// Route through the shared parser instead of hand-rolling it: this script used
// to read only the `--min-score=N` form, so `--min-score 4.5` was dropped and a
// typo fell through — both silently ran at the 4.0 default and spawned worker
// runs the caller never asked for. That is the #2459 class lib/cli-flags.mjs
// exists to end.
// requireOperand: `--min-score --help` would otherwise print usage and exit 0,
// so the malformed flag is never reported and the numeric check below never
// runs. This script has nothing more specific to say about a missing operand
// than the shared message, which is exactly when opting in is right.
validateFlags(args, ['--min-score', '--help', '-h'], USAGE, { valueFlags: ['--min-score'], requireOperand: true });

let minScore = 4.0;
if (hasFlag(args, '--min-score')) {
  const raw = flagValue(args, '--min-score');
  // Number(), not parseFloat(): parseFloat stops at the first invalid character,
  // so "4.5abc" silently became 4.5 and the run proceeded on a threshold the
  // caller never wrote. The empty/whitespace guard must come FIRST — Number('')
  // is 0, which is finite, and a 0 threshold tailors every completed job.
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  minScore = trimmed === '' ? NaN : Number(trimmed);
  // A NaN threshold compares false against every score, so the old code printed
  // "no roles found with score >= NaN" and exited 0 — indistinguishable from a
  // genuinely empty batch. Fail loudly instead.
  if (!Number.isFinite(minScore)) {
    console.error(`ERROR: --min-score expects a number, got ${raw === undefined ? '(no value)' : `"${raw}"`}`);
    process.exit(1);
  }
}

if (!existsSync(batchStateFile)) {
  console.error(`ERROR: Batch state file not found at ${batchStateFile}`);
  process.exit(1);
}

// existsSync() is true for a directory and says nothing about permissions, so
// reading can still throw (EISDIR, EACCES) — an uncaught stack trace where a
// usage error belongs. Name the RESOLVED path: with CAREER_OPS_BATCH_STATE set,
// the value that failed is not the one written in the source.
let stateContent;
try {
  stateContent = readFileSync(batchStateFile, 'utf-8');
} catch (err) {
  console.error(`ERROR: cannot read batch state file at ${batchStateFile}: ${err.message}`);
  process.exit(1);
}

const lines = stateContent.split('\n');
const toProcess = [];

for (const line of lines) {
  if (!line || line.startsWith('id\t')) continue;
  const parts = line.split('\t');
  if (parts.length < 7) continue;
  
  const id = parts[0];
  const url = parts[1];
  const status = parts[2];
  const reportNum = parts[5];
  const scoreStr = parts[6];
  
  if (status === 'completed') {
    const score = parseFloat(scoreStr);
    if (!isNaN(score) && score >= minScore) {
      toProcess.push({ id, url, reportNum, score });
    }
  }
}

if (toProcess.length === 0) {
  console.log(`No completed roles found with score >= ${minScore}.`);
  process.exit(0);
}

console.log(`Found ${toProcess.length} roles scoring >= ${minScore}. Beginning bulk tailoring...`);

const reports = existsSync(reportsDir) ? readdirSync(reportsDir) : [];

for (let i = 0; i < toProcess.length; i++) {
  const job = toProcess[i];
  console.log(`\n[${i + 1}/${toProcess.length}] Tailoring CV for Report ${job.reportNum} (Score: ${job.score}) — ${job.url}`);
  
  // Try to find the local report file to pass to the agent
  const matchingReport = reports.find(f => f.startsWith(`${job.reportNum}-`) && f.endsWith('.md'));
  // Absolute: with a split data root, a bare `reports/...` points at the code
  // checkout, where the report does not exist.
  const reportPath = matchingReport ? join(reportsDir, matchingReport) : null;
  if (reportPath) console.log(`  Report: ${reportPath}`);

  // Fork fr-data (SPEC.md §3.5): no headless worker runs with
  // --dangerously-skip-permissions, and tailoring a CV runs a dozen scripts
  // (HTML build, CV fact gate, PDF) that no fixed allowlist covers safely
  // against an untrusted posting. Tailored CVs are generated in an interactive
  // session instead, where each step is approved.
  console.log(`  ⏭️  Skipped: bulk tailoring is disabled in this fork. Run /career-ops pdf for report ${job.reportNum} in an interactive session.`);
}

console.log('\nBulk tailoring skipped (SPEC.md §3.5).');
