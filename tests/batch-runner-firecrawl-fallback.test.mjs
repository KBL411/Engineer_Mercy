// tests/batch-runner-firecrawl-fallback.test.mjs — pins the opt-in Firecrawl step
// of batch/batch-runner.sh (fork fr-data): last resort after the curl prefetch and
// the ATS API, off unless CAREER_OPS_FIRECRAWL=1, and the offer URL is one argv
// element. fetch-jd-firecrawl.mjs is stubbed: no network, no firecrawl binary.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { pass, fail, getBash } from './helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'batch/batch-runner.sh'), 'utf-8').replace(/\r\n/g, '\n');

console.log('\nbatch-runner.sh — opt-in Firecrawl fallback for the JD file');

const ok = (cond, msg) => (cond ? pass(msg) : fail(msg));
const block = (SRC.match(/  local jd_fc_words=0\n[\s\S]*?\n  fi\n/) || [null])[0];

ok(block !== null, 'batch-runner.sh has the Firecrawl block');
ok(SRC.indexOf('local jd_fc_words=0') > SRC.indexOf('local jd_api_words=0'), 'it runs after the ATS API step');
ok(block && /CAREER_OPS_FIRECRAWL:-0\}" == "1"/.test(block), 'it is off unless CAREER_OPS_FIRECRAWL=1');
ok(block && /! -s "\$jd_file"/.test(block), 'it only fires when the JD file is still empty');
ok(block && /node "\$PROJECT_DIR\/fetch-jd-firecrawl\.mjs" "\$url"/.test(block), 'the offer URL is passed as one quoted argument');

const bash = getBash();
if (!bash || !block) {
  if (block) pass('functional checks skipped: no bash available on this platform');
} else {
  const work = mkdtempSync(join(tmpdir(), 'co-fc-'));
  try {
    const long = Array.from({ length: 120 }, (_, i) => `mot${i}`).join(' ');
    const project = join(work, 'project');
    execFileSync(bash, ['-c', 'mkdir -p "$1"', 'mk', project]);
    writeFileSync(join(project, 'fetch-jd-firecrawl.mjs'), [
      "import { appendFileSync } from 'node:fs';",
      "appendFileSync(process.env.STUB_TRACE, JSON.stringify(process.argv.slice(2)) + '\\n');",
      `if (process.env.STUB_MODE === 'miss') process.exitCode = 1; else process.stdout.write(${JSON.stringify(long)});`,
      '',
    ].join('\n'));

    let n = 0;
    const run = ({ mode, seed = '', enabled = '1', url = 'https://example.com/job' }) => {
      n += 1;
      const jd = join(work, `jd-${n}.txt`);
      const trace = join(work, `trace-${n}.txt`);
      writeFileSync(jd, seed);
      writeFileSync(trace, '');
      const script = join(work, `case-${n}.sh`);
      writeFileSync(script, [
        '#!/usr/bin/env bash',
        `jd_file=${JSON.stringify(jd)}`,
        `PROJECT_DIR=${JSON.stringify(project)}`,
        'prefetch_min_words=80',
        'url="$OFFER_URL"',
        'runFallback() {',
        block,
        '}',
        'runFallback',
      ].join('\n'));
      const env = { ...process.env, STUB_MODE: mode, STUB_TRACE: trace, OFFER_URL: url, TMPDIR: work };
      if (enabled === '') delete env.CAREER_OPS_FIRECRAWL; else env.CAREER_OPS_FIRECRAWL = enabled;
      const out = execFileSync(bash, [script], { encoding: 'utf-8', timeout: 30000, cwd: work, env });
      return { jd: readFileSync(jd, 'utf-8'), trace: readFileSync(trace, 'utf-8'), out };
    };

    const hit = run({ mode: 'hit' });
    ok(hit.jd === long && /words from Firecrawl/.test(hit.out), 'enabled + empty JD + hit: the text becomes the JD file');

    const off = run({ mode: 'hit', enabled: '' });
    ok(off.jd === '' && off.trace === '', 'not enabled: Firecrawl is never called');

    const zero = run({ mode: 'hit', enabled: '0' });
    ok(zero.jd === '' && zero.trace === '', 'CAREER_OPS_FIRECRAWL=0: Firecrawl is never called');

    const kept = run({ mode: 'hit', seed: 'a JD an earlier step already wrote' });
    ok(kept.jd === 'a JD an earlier step already wrote' && kept.trace === '', 'non-empty JD file: Firecrawl is not called');

    const miss = run({ mode: 'miss' });
    ok(miss.jd === '' && miss.trace.trim() !== '', 'a miss leaves the JD file empty after one call');

    const marker = join(work, 'pwned');
    const hostile = `https://example.com/j?x=$(touch ${marker})&y=\`touch ${marker}\`";touch ${marker};"`;
    const evil = run({ mode: 'miss', url: hostile });
    let argv = null;
    try { argv = JSON.parse(evil.trace.trim().split('\n')[0]); } catch {}
    ok(!existsSync(marker) && Array.isArray(argv) && argv.length === 1 && argv[0] === hostile, 'hostile URL: one argument, no command substitution runs');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
