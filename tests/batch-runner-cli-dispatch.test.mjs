// tests/batch-runner-cli-dispatch.test.mjs — pins the --cli handling of the
// batch runner.
//
// This fork runs Claude Code only (SPEC.md 3.2). The --cli flag survives so the
// choice can be stated explicitly, but any other value must be refused before a
// worker launches, and the worker dispatch must hold a single `claude` branch.
// A second branch coming back would be an unreviewed worker path outside the
// permission envelope.
//
// The execution checks extract the real check_prerequisites() out of
// batch/batch-runner.sh and run it through the same bash the runner would use,
// with a stub `claude` on PATH, so the test and the implementation cannot drift
// apart.
import { pass, fail, rmSync, getBash } from './helpers.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, chmodSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'batch/batch-runner.sh'), 'utf-8').replace(/\r\n/g, '\n');

console.log('\nbatch-runner.sh — --cli handling (claude only)');

// ── static checks ───────────────────────────────────────────────────────────

const dispatchCase = (() => {
  const m = SRC.match(/    case "\$CLI" in\n([\s\S]*?)\n    esac\n/);
  return m ? m[1] : null;
})();

if (dispatchCase) {
  pass('found the worker dispatch (case "$CLI")');
  const branches = [...dispatchCase.matchAll(/^      ([A-Za-z*|-]+)\)/gm)].map((m) => m[1]);
  if (branches.length === 1 && branches[0] === 'claude') {
    pass('the worker dispatch holds a single claude branch');
  } else {
    fail(`the worker dispatch must only hold a claude branch, found: ${JSON.stringify(branches)}`);
  }
} else {
  fail('could not find the worker dispatch in batch/batch-runner.sh — this test needs updating');
}

if (/--cli\) CLI="\$2"; shift 2 ;;/.test(SRC)) {
  pass('--cli is still parsed, so an unsupported value can be reported');
} else {
  fail('--cli is no longer parsed by the runner');
}

if (/Unknown --cli '\$CLI'\. Supported: claude/.test(SRC)) {
  pass('check_prerequisites rejects an unknown --cli value and names claude as the supported one');
} else {
  fail('check_prerequisites does not reject an unknown --cli value');
}

// ── execution checks ────────────────────────────────────────────────────────

const prereqFn = (() => {
  const m = SRC.match(/\ncheck_prerequisites\(\) \{\n[\s\S]*?\n\}\n/);
  return m ? m[0] : null;
})();

if (!prereqFn) {
  fail('could not extract check_prerequisites() from batch/batch-runner.sh — this test needs updating');
} else {
  const work = mkdtempSync(join(tmpdir(), 'batch-cli-dispatch-'));
  try {
    const bin = join(work, 'bin');
    mkdirSync(bin);
    // Stub claude so the "claude is in PATH" check passes without the real CLI.
    const stub = join(bin, 'claude');
    writeFileSync(stub, '#!/usr/bin/env bash\nexit 0\n');
    if (process.platform === 'win32') {
      // fs.chmodSync is a no-op on Windows; set the bit through Git Bash.
      try { execFileSync(getBash(), ['-c', 'chmod +x bin/claude'], { cwd: work }); } catch {}
    } else {
      chmodSync(stub, 0o755);
    }

    const input = join(work, 'batch-input.tsv');
    const prompt = join(work, 'batch-prompt.md');
    writeFileSync(input, 'id\turl\n');
    writeFileSync(prompt, 'PROMPT');

    // The stub goes on PATH through the child environment, not the script
    // text: a `C:\...` entry spliced into the script splits on the drive-letter
    // colon on Windows runners.
    const env = { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}` };
    const bash = getBash();

    const run = (cli) => {
      const script = join(work, `prereq-${cli}.sh`);
      writeFileSync(script, [
        'set -euo pipefail',
        `CLI=${cli}`,
        `INPUT_FILE=${JSON.stringify(input.replace(/\\/g, '/'))}`,
        `PROMPT_FILE=${JSON.stringify(prompt.replace(/\\/g, '/'))}`,
        `LOGS_DIR=${JSON.stringify(join(work, 'logs').replace(/\\/g, '/'))}`,
        `TRACKER_DIR=${JSON.stringify(join(work, 'tracker').replace(/\\/g, '/'))}`,
        `REPORTS_DIR=${JSON.stringify(join(work, 'reports').replace(/\\/g, '/'))}`,
        prereqFn,
        'check_prerequisites',
        'echo PREREQ_OK',
      ].join('\n'));
      try {
        const out = execFileSync(bash, [script], { encoding: 'utf-8', timeout: 30000, env, stdio: ['ignore', 'pipe', 'pipe'] });
        return { code: 0, out };
      } catch (e) {
        return { code: e.status ?? 1, out: String(e.stdout || '') + String(e.stderr || '') };
      }
    };

    const okRun = run('claude');
    if (okRun.code === 0 && /PREREQ_OK/.test(okRun.out)) {
      pass('--cli claude passes the prerequisites check');
    } else {
      fail(`--cli claude was refused: ${okRun.out.trim().slice(0, 200)}`);
    }

    for (const other of ['opencode', 'gemini', 'codex']) {
      const r = run(other);
      if (r.code === 1 && /Unknown --cli '.*'\. Supported: claude/.test(r.out) && !/PREREQ_OK/.test(r.out)) {
        pass(`--cli ${other} is refused with the "Unknown --cli" error (exit 1)`);
      } else {
        fail(`--cli ${other} was not refused as expected (exit ${r.code}): ${r.out.trim().slice(0, 200)}`);
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
