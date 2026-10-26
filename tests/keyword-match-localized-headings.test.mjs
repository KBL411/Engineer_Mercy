// tests/keyword-match-localized-headings.test.mjs — keyword-match.mjs has to
// find the keyword section under the heading each evaluation mode writes.
//
// It looked for `## Keywords extracted` only. A translated evaluation mode
// (today modes/fr/offre.md, `## Mots-cles extraits`) writes another title, so
// its reports read as having no keywords at all, and the coverage check
// modes/pdf.md runs on every tailored CV exited 1 on them.
//
// The mode files are the input here, not a copy of their headings: evaluation
// modes are found by their Block F heading, the keyword heading by the 15-20
// keyword instruction written under it, and keyword-match.mjs has to read what
// the mode writes. A retranslated, renamed or deleted keyword section fails
// here instead of in somebody's `pdf` run.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { listTree } from '../lib/walk-tree.mjs';
import { KEYWORDS_HEADINGS, extractKeywords } from '../keyword-match.mjs';
import { pass, fail, NODE, ROOT, rmSync } from './helpers.mjs';

console.log('\nkeyword-match: localized keyword headings');

function check(label, run) {
  try { run(); pass(label); } catch (error) { fail(`${label}: ${error.message}`); }
}

const KEYWORDS = ['Python', 'gRPC', 'Kubernetes'];

/** What extractKeywords() reads from a block opened by `heading`. */
const keywordsUnder = (heading) =>
  extractKeywords(`${heading}\n- Python, gRPC\n- Kubernetes\n\n## Next\n- not a keyword\n`);

// ---- The shipped modes ------------------------------------------------------

// listTree skips a checkout placed under modes/ — another tree's content, not
// this repository's to hold to this contract (#3681/#3762) — on every descent.
function walk(dir) {
  return listTree(dir, { match: /\.md$/ });
}

// By property, not by file name: modes/fr/offre.md is not called oferta.md.
// Every evaluation mode defines Block F, as `## F)` or `## Block F`.
const BLOCK_F = /^## (?:F\)|Block F\b)/m;

/** `## ` headings whose first non-blank line below is the 15-20 keyword instruction. */
function keywordHeadingsIn(text) {
  const lines = text.split(/\r?\n/);
  return lines.filter((line, i) => {
    if (!/^##\s/.test(line)) return false;
    const below = (lines.slice(i + 1).find((next) => next.trim()) ?? '').trim();
    // A translated mode may write the range with an en dash.
    return below.startsWith('(') && below.endsWith(')') && /15\s*[-\u2013]\s*20/.test(below);
  });
}

const modes = walk(join(ROOT, 'modes'))
  .map((abs) => ({ rel: relative(ROOT, abs).split(sep).join('/'), text: readFileSync(abs, 'utf-8') }))
  .filter(({ text }) => BLOCK_F.test(text));

// A floor, so a Block F heading that stops matching cannot turn this suite into
// a green run over nothing. Two evaluation modes ship (modes/oferta.md and
// modes/fr/offre.md); a new market raises the count without touching this line.
check(`discovery finds the evaluation modes (${modes.length})`, () => {
  assert.ok(modes.length >= 2, `only ${modes.length} files under modes/ define Block F; 2 did when this suite was written`);
});

for (const { rel, text } of modes) {
  check(`${rel}: the keyword heading it writes is read`, () => {
    const headings = keywordHeadingsIn(text);
    assert.equal(headings.length, 1,
      `expected one heading over the 15-20 keyword instruction, found ${headings.length} ${JSON.stringify(headings)}; ` +
      'modes/pdf.md runs keyword-match.mjs on every report this mode writes');
    assert.deepEqual(keywordsUnder(headings[0]), KEYWORDS,
      `"${headings[0]}" is not read: add its title to KEYWORDS_HEADINGS in keyword-match.mjs, and keep the old title, which reports on disk still carry`);
  });
}

// batch/batch-prompt.md lists its report headings rather than defining Block F,
// so the walk above never sees it; its reports went unread until this check.
check('batch/batch-prompt.md: the keyword heading it writes is read', () => {
  const text = readFileSync(join(ROOT, 'batch', 'batch-prompt.md'), 'utf-8');
  const heading = text.match(/^- `(## [^`]*Keywords[^`]*)`$/m)?.[1];
  assert.ok(heading, 'no `## ...Keywords...` heading listed in batch/batch-prompt.md');
  assert.deepEqual(keywordsUnder(heading), KEYWORDS,
    `"${heading}" is not read: add its title to KEYWORDS_HEADINGS in keyword-match.mjs`);
});

// ---- The reader -------------------------------------------------------------

check('every title in KEYWORDS_HEADINGS is read, with or without a suffix after it', () => {
  for (const title of KEYWORDS_HEADINGS) {
    assert.deepEqual(keywordsUnder(`## ${title}`), KEYWORDS, title);
    assert.deepEqual(keywordsUnder(`## ${title} (18)`), KEYWORDS, `${title} (18)`);
  }
});

check('case and Latin accents do not hide the section', () => {
  // modes/fr/offre.md writes `Mots-cles`, which French spells with an accent.
  for (const heading of ['## Mots-clés extraits', '## KEYWORDS EXTRACTED']) {
    assert.deepEqual(keywordsUnder(heading), KEYWORDS, heading);
  }
});

check('headings that are not the keyword section are not read as one', () => {
  for (const heading of [
    '## Keyword Coverage',     // what keyword-match.mjs prints, pasted right below the keyword list
    '### Keywords extracted',  // level 3
    '## Extrahierte Keywords', // German: a past report in another language is unsupported
  ]) {
    assert.deepEqual(keywordsUnder(heading), [], heading);
  }
});

// ---- End to end: the call modes/pdf.md makes --------------------------------

check('the CLI scores a tailored HTML CV against a report written in French', () => {
  const work = mkdtempSync(join(tmpdir(), 'keyword-match-l10n-'));
  try {
    const report = join(work, '042-acme-2026-10-03.md');
    const cv = join(work, 'cv-acme.html');
    writeFileSync(report, [
      '# Évaluation : Acme — Staff Engineer',
      '',
      '## Mots-cles extraits',
      '- Python, gRPC',
      '- Kubernetes',
      '',
      '## Job Description (archived verbatim)',
      'Posted: not visible in source',
      '',
    ].join('\n'));
    writeFileSync(cv, '<html><body><p>Python and gRPC services on Kubernetes.</p></body></html>');
    const out = execFileSync(NODE, [join(ROOT, 'keyword-match.mjs'), report, '--cv', cv, '--json'], {
      encoding: 'utf-8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const result = JSON.parse(out);
    assert.equal(result.coveragePct, 100);
    assert.deepEqual(result.present, KEYWORDS);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
