import { existsSync, readFileSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fail, pass, ROOT } from './helpers.mjs';

console.log('\nSkill project-root resolution (#3332)');

const entrypoint = join('.claude', 'skills', 'career-ops', 'SKILL.md');

function findProjectRoot(skillPath) {
  let current = dirname(skillPath);
  while (true) {
    if (existsSync(join(current, 'AGENTS.md')) && existsSync(join(current, 'modes'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function hasRoutingRule(text) {
  return text.includes('Resolve every path in this router') &&
    text.includes("never against the process's current working directory");
}

function isRegularFile(filePath) {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

const skillPath = join(ROOT, entrypoint);
const failures = [];
if (!isRegularFile(skillPath)) {
  failures.push(`${entrypoint}: missing entrypoint`);
} else {
  const resolvedRoot = findProjectRoot(skillPath);
  if (resolve(resolvedRoot || '') !== resolve(ROOT)) {
    failures.push(`${entrypoint}: resolved ${resolvedRoot || '(none)'}`);
  }
  if (!hasRoutingRule(readFileSync(skillPath, 'utf8'))) {
    failures.push(`${entrypoint}: missing cwd-independent routing rule`);
  }
}

if (failures.length === 0) {
  pass('the skill router resolves modes/ from the checkout root, not cwd');
} else {
  fail(failures.join(' | '));
}
