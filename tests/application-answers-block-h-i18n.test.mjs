import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDraftAnswersBlockH } from '../application-answers.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** A report whose Block H heading carries `title`. */
const report = (title) => `# Report

## G) Posting Legitimacy

Tier: verified.

## H) ${title}

**Why do you want this role?**

Because the work is close to what I already do.

## Risk Summary

None.
`;

// The parser reads the Block H letter, not the title, so a translated title
// still parses. No shipped mode translates it any more (only modes/oferta.md
// and the French set remain), so these titles are parser inputs, not copies of
// what a mode emits. Latin accents, Cyrillic and CJK each exercise the letter
// rule on a non-ASCII title.
const TRANSLATED_TITLES = [
  'Brouillons de réponses pour la candidature',
  'Черновики ответов на форму',
  '开放性问题拟答草稿',
];

for (const title of TRANSLATED_TITLES) {
  test(`Block H parses when its title is translated (${title})`, () => {
    const got = parseDraftAnswersBlockH(report(title));
    assert.ok(got, `returned null — indistinguishable from "this report has no Block H"`);
    assert.equal(got.freeText.length, 1);
    assert.match(got.freeText[0].question, /want this role/);
  });
}

test('the English title still parses', () => {
  const got = parseDraftAnswersBlockH(report('Draft Application Answers'));
  assert.ok(got);
  assert.equal(got.freeText.length, 1);
});

test('the English title is the one modes/oferta.md actually emits', () => {
  // Guards against this suite testing a title the mode no longer uses, which
  // would make the English case above pass against nothing.
  //
  // A missing mode file FAILS here rather than being skipped. Skipping defeats
  // the guard in the exact case it exists for: a mode file that moved leaves a
  // hard-coded title that nothing emits any more, and the suite stays green.
  const mode = 'modes/oferta.md';
  const path = join(ROOT, mode);
  assert.ok(existsSync(path),
    `${mode} is not in the repo — move this check to the mode's new path, do not delete it`);
  const src = readFileSync(path, 'utf-8');
  assert.ok(src.includes('## H) Draft Application Answers'),
    `${mode} no longer emits "## H) Draft Application Answers" — update this suite, do not delete the case`);
});

test('a report with no Block H still returns null', () => {
  assert.equal(parseDraftAnswersBlockH('# Report\n\n## G) Something\n\nbody\n'), null);
});

test('an H marker with no title is not treated as Block H', () => {
  assert.equal(parseDraftAnswersBlockH('# Report\n\n## H)\n\nbody\n'), null);
});

test('a different lettered block is not mistaken for H', () => {
  assert.equal(parseDraftAnswersBlockH(report('x').replace('## H)', '## G)')), null);
});

test('the marker must start the line, so prose mentioning it does not match', () => {
  const prose = '# Report\n\nSee the ## H) Draft Application Answers block.\n';
  assert.equal(parseDraftAnswersBlockH(prose), null);
});

// The letter rule is the last resort and the only one that reads a translated
// heading, so its grammar is the one that decides what ELSE gets read as draft
// answers. HEADING_PREFIX_RE, which this rule first used, also accepts `H:` and
// `Block H`; no mode writes either for this block, so the wider grammar bought
// nothing and let an unrelated `H:` section be parsed as answers a user later
// sends to an employer. Both forms are pinned as rejected (#4400 review).
test('an H: section is not Block H, because no mode writes that form', () => {
  const r = '# Report\n\n## H: Internal Notes\n\n**Q?**\n\nA.\n';
  assert.equal(parseDraftAnswersBlockH(r), null);
});

test('a "Block H" heading is not Block H, for the same reason', () => {
  const r = '# Report\n\n## Block H — Internal Notes\n\n**Q?**\n\nA.\n';
  assert.equal(parseDraftAnswersBlockH(r), null);
});

// `\s+` after `##` also matches a newline, so a bare `##` line consumed it and
// the matcher captured the FOLLOWING line as the heading. Combined with the
// letter rule, `##` then `H) Internal Notes` made an unrelated section parse as
// draft answers, which modes/apply.md later offers as a base for what a user
// sends to an employer (#4400 review).
test('a bare ## does not capture the next line as its heading', () => {
  const r = '# Report\n\n##\nH) Internal Notes\n\n**Q?**\n\nA.\n';
  assert.equal(parseDraftAnswersBlockH(r), null);
});

// The opener accepts `##` plus a tab, so the terminator has to as well. While it
// matched only `## `, a later `##\tI) ...` section stayed inside Block H and its
// bold text came back as draft answers, which is the same leak as the bare `##`
// case one layer further on (#4400 review).
test('a tab-separated later heading still ends Block H', () => {
  const r = '# Report\n\n## H) Draft Application Answers\n\n**Q1?**\n\nA1.\n'
    + '\n##\tI) Internal Notes\n\n**Not an answer?**\n\nStays out.\n';
  const out = parseDraftAnswersBlockH(r);
  assert.equal(out.freeText.length, 1, 'only Block H own pair is returned');
  assert.equal(out.freeText[0].answer, 'A1.');
});
