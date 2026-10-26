// tests/doctor-cli-resolution.test.mjs — CLI resolution precedence coverage
// in `doctor.mjs`. CLI resolution feeds MCP detection (covered in
// tests/playwright-mcp-detection.test.mjs); this file owns the precedence
// paths themselves. This fork supports Claude Code only, so 'claude' is the
// single valid value and anything else resolves to the 'unknown' sentinel.
// Each scenario uses a fresh --target dir so no MCP config / .env / env
// leaks across cases.
import { pass, fail, NODE, ROOT, rmSync } from './helpers.mjs';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

console.log('\ndoctor.mjs — CLI resolution');

const DOCTOR = join(ROOT, 'doctor.mjs');

// doctor warns when the checkout lacks .claude/skills/career-ops/SKILL.md;
// give each fixture a valid one (regular file, > 1000 bytes).
function addSkill(dir) {
  const skillDir = join(dir, '.claude', 'skills', 'career-ops');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), `# career-ops skill\n${'fixture content line\n'.repeat(80)}`);
}

function runDoctor(cwd, args, env) {
  addSkill(cwd);
  const baseEnv = { ...process.env };
  // Hermetic env: in-process imports earlier in the suite load the repo .env
  // (scan.mjs, …), which sets CAREER_OPS_CLI and would silently override the
  // precedence scenarios below. Delete it so each scenario controls the CLI
  // explicitly (default → claude, or the --cli/env/.env value it supplies).
  delete baseEnv.CAREER_OPS_CLI;
  try {
    const out = execFileSync(NODE, [DOCTOR, '--json', '--target', cwd, ...args], {
      cwd,
      env: { ...baseEnv, ...env },
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return JSON.parse(out);
  } catch (e) {
    return { _error: e.message, _stderr: e.stderr ? String(e.stderr) : '' };
  }
}

function expectOk(state, msg) {
  if (state._error) { fail(`${msg}: doctor crashed: ${state._error}`); return false; }
  return true;
}

try {
  // 1. --cli flag beats process.env.CAREER_OPS_CLI. Pin precedence at the
  //    flag/env boundary: an invalid env value must be ignored once the flag
  //    supplies a valid one, so a future reorder of resolveActiveCli fails loudly.
  {
    const dir = mkdtempSync(join(tmpdir(), 'co-resolve-1-'));
    try {
      const state = runDoctor(dir, ['--cli', 'claude'], { CAREER_OPS_CLI: 'vim' });
      if (expectOk(state, '#1 flag beats env')
          && state.active_cli === 'claude'
          && state.cli_source === 'flag'
          && !state.warnings.some((w) => /not a recognized CLI/.test(w))) {
        pass('--cli flag beats CAREER_OPS_CLI env (active_cli=claude, cli_source=flag)');
      } else {
        fail(`#1 unexpected state: ${JSON.stringify(state)}`);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }

  // 2. process.env.CAREER_OPS_CLI beats CAREER_OPS_CLI in the dotenv file. Pin
  //    precedence at the env/dotenv boundary (the invalid file value is ignored).
  {
    const dir = mkdtempSync(join(tmpdir(), 'co-resolve-2-'));
    try {
      writeFileSync(join(dir, '.env'), 'CAREER_OPS_CLI=vim\n');
      const state = runDoctor(dir, [], { CAREER_OPS_CLI: 'claude' });
      if (expectOk(state, '#2 env beats .env')
          && state.active_cli === 'claude'
          && state.cli_source === 'env'
          && !state.warnings.some((w) => /not a recognized CLI/.test(w))) {
        pass('process.env CAREER_OPS_CLI beats .env file (active_cli=claude, cli_source=env)');
      } else {
        fail(`#2 unexpected state: ${JSON.stringify(state)}`);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }

  // 3. No flag/env/dotenv value -> default claude.
  {
    const dir = mkdtempSync(join(tmpdir(), 'co-resolve-3-'));
    try {
      const state = runDoctor(dir, [], {});
      if (expectOk(state, '#3 default')
          && state.active_cli === 'claude'
          && state.cli_source === 'default') {
        pass('no flag/env/.env -> active_cli=claude, cli_source=default');
      } else {
        fail(`#3 unexpected state: ${JSON.stringify(state)}`);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }

  // 4. An unknown CAREER_OPS_CLI in the dotenv file yields the 'unknown'
  //    sentinel plus a warning that names the file.
  {
    const dir = mkdtempSync(join(tmpdir(), 'co-resolve-4-'));
    try {
      writeFileSync(join(dir, '.env'), 'CAREER_OPS_CLI=vim\n');
      const state = runDoctor(dir, [], {});
      if (expectOk(state, '#4 .env unknown')
          && state.active_cli === 'unknown'
          && state.cli_source === '.env'
          && state.warnings.some((w) => /CAREER_OPS_CLI in \.env is not a recognized CLI/.test(w))) {
        pass('unknown CAREER_OPS_CLI in .env -> unknown sentinel + warning');
      } else {
        fail(`#4 unexpected state: ${JSON.stringify(state)}`);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }

} catch (e) {
  fail(`doctor-cli-resolution tests crashed: ${e.message}`);
}
