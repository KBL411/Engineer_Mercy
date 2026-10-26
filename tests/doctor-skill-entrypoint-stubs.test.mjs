// tests/doctor-skill-entrypoint-stubs.test.mjs — doctor.mjs's check on the
// Claude Code skill router (career-ops#4589).
//
// .claude/skills/career-ops/SKILL.md is the one file Claude Code reads to learn
// the modes, and it must be a real file. A checkout without symlink support
// (core.symlinks=false) writes a symlink as a regular file holding only the
// target text, and the CLI then loads an empty skill. This pins the doctor
// check that says so, and that the shipped router passes it.
import { pass, fail, NODE, ROOT } from './helpers.mjs';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

console.log('\ndoctor.mjs — skill entrypoint');

const DOCTOR = join(ROOT, 'doctor.mjs');
const ENTRYPOINT = '.claude/skills/career-ops/SKILL.md';
const POINTER = '../pointer/to/SKILL.md';
const REAL_CONTENT = '# career-ops\n\n' + 'Route each request to a mode.\n'.repeat(60);

function runDoctor(cwd) {
  try {
    const out = execFileSync(NODE, [DOCTOR, '--json', '--target', cwd], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return JSON.parse(out);
  } catch (e) {
    return { _error: e.message, _stderr: e.stderr ? String(e.stderr) : '' };
  }
}

function put(dir, rel, content) {
  const p = join(dir, ...rel.split('/'));
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, 'utf-8');
  return p;
}

function skillWarning(state) {
  return (state.warnings || []).find((w) => w.includes(ENTRYPOINT)) || null;
}

/** Run doctor in a fresh directory prepared by `setup(dir)`; always cleans up. */
function inCheckout(label, setup, body) {
  const dir = mkdtempSync(join(tmpdir(), 'co-skill-entry-'));
  try {
    setup(dir);
    const state = runDoctor(dir);
    if (state._error) fail(`${label}: doctor crashed: ${state._error}`);
    else body(dir, state);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// 1. A pointer-text stub is reported, names the file, and gives the remedy.
{
  let stub;
  inCheckout('pointer stub', (dir) => { stub = put(dir, ENTRYPOINT, POINTER); }, (dir, state) => {
    const warning = skillWarning(state);
    if (warning) pass('a pointer-text entrypoint stub is surfaced in doctor --json warnings, naming the path');
    else fail(`stub was not surfaced: ${JSON.stringify(state.warnings)}`);
    if (warning && warning.includes(`git checkout -- ${ENTRYPOINT}`)) pass('the warning gives the restore command');
    else fail(`remedy missing from warning: ${JSON.stringify(warning)}`);
    if (readFileSync(stub, 'utf-8') === POINTER) pass('doctor stays read-only: the stub is left untouched');
    else fail('doctor rewrote the stub; it must only report');
  });
}

// 2. A missing entrypoint is reported the same way.
inCheckout('missing', () => {}, (dir, state) => {
  if (skillWarning(state)) pass('a missing entrypoint is surfaced in doctor --json warnings');
  else fail(`missing entrypoint was not surfaced: ${JSON.stringify(state.warnings)}`);
});

// 3. A real file too small to be the router is still a stub.
inCheckout('short file', (dir) => put(dir, ENTRYPOINT, '# career-ops\n'), (dir, state) => {
  if (skillWarning(state)) pass('a real but near-empty entrypoint is surfaced as a stub');
  else fail(`short entrypoint was not surfaced: ${JSON.stringify(state.warnings)}`);
});

// 4. A real file holding the router raises no warning.
inCheckout('real file', (dir) => put(dir, ENTRYPOINT, REAL_CONTENT), (dir, state) => {
  if (!skillWarning(state)) pass('an entrypoint holding real skill content raises no warning');
  else fail(`false positive on a real entrypoint: ${skillWarning(state)}`);
});

// 5. A symlink is not accepted: the router must be a regular file in the checkout.
{
  let linked = true;
  inCheckout('symlink', (dir) => {
    const target = put(dir, 'elsewhere/SKILL.md', REAL_CONTENT);
    mkdirSync(join(dir, '.claude', 'skills', 'career-ops'), { recursive: true });
    try {
      symlinkSync(target, join(dir, ...ENTRYPOINT.split('/')));
    } catch {
      linked = false; // no symlink privilege (Windows without developer mode)
    }
  }, (dir, state) => {
    if (!linked) pass('symlink case skipped: this platform cannot create one');
    else if (skillWarning(state)) pass('a symlinked entrypoint is surfaced, since a checkout without symlinks breaks it');
    else fail(`symlinked entrypoint raised no warning: ${JSON.stringify(state.warnings)}`);
  });
}

// 6. The router shipped in this repository passes its own check.
{
  const state = runDoctor(ROOT);
  if (state._error) fail(`shipped router: doctor crashed: ${state._error}`);
  else if (!skillWarning(state)) pass('the shipped .claude/skills/career-ops/SKILL.md raises no warning');
  else fail(`the shipped router is flagged: ${skillWarning(state)}`);
}
