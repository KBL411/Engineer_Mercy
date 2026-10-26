// tests/verdict-lead-block.test.mjs: the `## Verdict (lead)` block is part of the
// report contract, in every evaluation mode and in the batch worker prompt.
//
// Moved out of test-all.mjs: new tests belong in their own auto-discovered
// file, not as a section of the harness (CONTRIBUTING.md, tests/README.md).
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { pass, fail, ROOT } from './helpers.mjs';

console.log('\nVerdict (lead) block across evaluation modes');

function readFile(path) {
  const fullPath = join(ROOT, path);
  let content = readFileSync(fullPath, 'utf-8');
  if (content.trim().startsWith('..') && content.trim().split('\n').length === 1) {
    const target = join(dirname(fullPath), content.trim());
    if (existsSync(target)) {
      content = readFileSync(target, 'utf-8');
    }
  }
  return content;
}

// The heading shape the report contract requires. A report body is split on
// /^##\s+(.*)$/ and a heading ending in `(lead)` is the lead verdict. The mode
// contract requires the language-invariant `(lead)` marker (modes/oferta.md),
// so this guard matches `(lead)` only. `##` must be followed by whitespace, any
// kind but a newline, as `\s` reads it there. `##Verdict (lead)` and
// `### Verdict (lead)` are not sections at all, and a guard that accepted them
// would pass on a heading that is never read as the lead verdict.
const LEAD_HEADING = /^##[^\S\n]+[^\n]*\(lead\)[^\S\n]*$/gmi;
const leadHeadings = (text) => {
  LEAD_HEADING.lastIndex = 0;
  return [...text.matchAll(LEAD_HEADING)];
};

// The guard itself: it must accept every `(lead)` section heading and reject
// what is not read as a heading. A bare `## Verdict` and a `(verdict)` heading
// are rejected on purpose, because the `(lead)` marker is the contract.
{
  const accepted = ['## Verdict (lead)', '## Veredicto (lead)', '## 结论 (lead)', '##\tVeredicto (lead)', '##\u00a0Verdict (lead)'];
  const rejected = ['##Verdict (lead)', '### Verdict (lead)', '#Verdict (lead)', 'Verdict (lead)'];
  const contractRejected = ['## Veredicto (verdict)', '## Verdict'];
  const wrong = [
    ...accepted.filter((l) => leadHeadings(l).length !== 1),
    ...rejected.filter((l) => leadHeadings(l).length !== 0),
    ...contractRejected.filter((l) => leadHeadings(l).length !== 0),
  ];
  if (wrong.length > 0) {
    fail(`lead-heading guard misjudges the (lead) contract: ${wrong.map((l) => JSON.stringify(l)).join(', ')}`);
  } else {
    pass(`lead-heading guard accepts ${accepted.length} (lead) headings and rejects ${rejected.length} non-headings and ${contractRejected.length} headings without the (lead) marker`);
  }
}

// ── Verdict (lead) block presence across evaluation modes ──
// The lead block is a report-contract element, so the contract guard has to
// assert it. It cannot join REQUIRED_HEADINGS in test-all.mjs's localized
// oferta.md parity check. That list matches literal substrings, the heading
// noun is translated per locale, and a translated mode may quote the English
// form in prose as an example of the convention, so a
// literal `## Verdict (lead)` entry would pass whether or not that file
// carries a block. The `(lead)` marker is the language-invariant
// part, so this matches the marker on a heading line. A heading line is not by
// itself proof of a real block: every one of these files also illustrates the
// block inside a fenced example, and those examples carry heading lines too.
// What separates the template from documentation about it is the window. The
// template is the one place where `## G)` is followed by `## Risk Summary`,
// so the lead heading is required inside that run. Anchoring the run on the
// LAST of each marker does not work: a mode that puts its template first and
// its prose second has its last `## G)` and last `## Risk Summary` far apart,
// swallowing the document.
// Keyed on the report skeleton instead of the filename: a locale whose
// evaluation mode is not named oferta.md (modes/fr/offre.md)
// is invisible to the oferta.md walk in test-all.mjs. A file
// still at the pre-Block-G shape has no Block G for the lead block to follow,
// so it drops out by carrying no `## H)` and no `## Risk Summary`, with no
// allowlist to maintain.
{
  const modeFiles = ['modes/oferta.md'];
  for (const d of readdirSync(join(ROOT, 'modes'), { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    for (const f of readdirSync(join(ROOT, 'modes', d.name))) {
      if (f.endsWith('.md')) modeFiles.push(`modes/${d.name}/${f}`);
    }
  }
  const skeleton = modeFiles.map(f => [f, readFile(f)])
    .filter(([, t]) => t.includes('## H)') && t.includes('## Risk Summary'));
  const names = skeleton.map(([f]) => f);
  // Only modes/oferta.md carries the full skeleton today: modes/fr/offre.md is
  // still at the pre-Block-G shape and drops out, as the comment above says.
  if (names.length < 1 || !names.includes('modes/oferta.md')) {
    fail(`verdict-lead walk found ${names.length} full-skeleton modes (${names.join(', ')}) — expected ≥1 incl. modes/oferta.md; the check would be blind`);
  } else {
    const gaps = [];
    for (const [f, t] of skeleton) {
      const g = t.indexOf('## G)');
      const rs = g < 0 ? -1 : t.indexOf('## Risk Summary', g);
      if (g < 0 || rs < 0) { gaps.push(`${f} (no \`## G)\` → \`## Risk Summary\` run)`); continue; }
      const hits = leadHeadings(t).map(m => m.index);
      if (!hits.some(i => g < i && i < rs)) {
        gaps.push(`${f} (no \`(lead)\` heading between G) and Risk Summary)`);
      }
    }
    if (gaps.length > 0) {
      fail(`evaluation modes missing the lead verdict block: ${gaps.join('; ')}`);
    } else {
      pass(`Verdict (lead) block present and positioned in all ${names.length} full-skeleton evaluation modes`);
    }
  }

  // batch/batch-prompt.md carries the same contract in a different shape and so
  // falls outside the walk above: headless workers get a bulleted list of the
  // blocks to emit, not a fenced report template, and the file lives outside
  // modes/. It is the only report producer a user never watches, so a missing
  // entry here costs a whole batch of reports. Assert the same ordering on the
  // list it actually emits from.
  {
    const emitted = readFile('batch/batch-prompt.md');
    const g = emitted.indexOf('- `## G) Posting Legitimacy`');
    const lead = g < 0 ? -1 : emitted.indexOf('- `## Verdict (lead)`', g);
    const rs = lead < 0 ? -1 : emitted.indexOf('- `## Risk Summary`', lead);
    if (g >= 0 && lead > g && rs > lead) {
      pass('batch workers emit `## Verdict (lead)` between Block G and Risk Summary');
    } else {
      fail('batch/batch-prompt.md emitted-block list has no `## Verdict (lead)` entry between Block G and `## Risk Summary`, so batch reports would carry no lead block');
    }
  }
}
