// tests/project-identity.test.mjs — several files describe this project and only
// one pair of them was ever compared, so the rest drifted in silence.
//
// This test started out asserting over FOUR files, which was wrong: sweeping by
// content instead of by the filenames I expected found more short blurbs (the
// plugin manifests mirrored package.json). The count in a comment is exactly the
// thing that goes stale, so the assertions below enumerate the places from the
// files themselves where they can.
//
// What was found on 2026-09-04, all three at once:
//
//   a plugin manifest           "AI job search command center"
//                               — "command center" reads as centralized infrastructure,
//                                 which is the opposite of what this tool is.
//   package.json  homepage      https://santifer.io
//   CITATION.cff  url           https://santifer.io
//                               — both set in the same branding commit, BEFORE
//                                 career-ops.org existed. Meanwhile the GitHub
//                                 homepage and the README already say career-ops.org.
//
// CITATION.cff's `url` is the field Zenodo and citation tooling copy as the
// SOFTWARE's website, so a stale value there tells the academic-citation
// ecosystem the wrong thing about where this project lives.
//
// None of it broke anything, which is exactly why it lasted: a description is
// read by people, not by code, so drift produces no error and no failing test.
//
// These assertions compare the files to EACH OTHER, never to an expected string
// kept in here. A hardcoded blurb would just be a fifth copy to keep in sync,
// and the bug being fixed is that there were already four.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (p) => readFileSync(join(ROOT, p), 'utf-8');

test('every short blurb describes the same project in the same words', () => {
  const pkg = JSON.parse(read('package.json'));

  // package.json is the reference only because npm publishes it; it carries no
  // more authority than the others. What matters is that they agree. The plugin
  // manifest is compared only while it exists, so a fork that drops it is not
  // told to bring it back.
  const blurbs = [
    ['package.json', pkg.description],
    ...['.github/plugin/plugin.json']
      .filter((p) => existsSync(join(ROOT, p)))
      .map((p) => [p, JSON.parse(read(p)).description]),
  ];

  for (const [where, blurb] of blurbs) {
    assert.ok(blurb, `${where} must carry a description`);
  }
  for (const [where, blurb] of blurbs.slice(1)) {
    assert.equal(
      blurb,
      pkg.description,
      `${where} drifted from package.json: these are the same sentence for the same ` +
      'audience, so if one changes, change them all in the same commit',
    );
  }
});

test("CITATION.cff's url is the project's site, not a personal one", () => {
  const pkg = JSON.parse(read('package.json'));
  const citation = read('CITATION.cff');

  const url = citation.match(/^url:\s*"([^"]+)"/m)?.[1];
  assert.ok(url, 'CITATION.cff must carry a `url:` field');
  assert.equal(
    url,
    pkg.homepage,
    "CITATION.cff `url` is what Zenodo shows as the software's website: " +
    'it must be the same place package.json calls home',
  );
});

test('the CITATION.cff repository-code field points at this repository', () => {
  const pkg = JSON.parse(read('package.json'));
  const citation = read('CITATION.cff');

  const repoCode = citation.match(/^repository-code:\s*"([^"]+)"/m)?.[1];
  assert.ok(repoCode, 'CITATION.cff must carry a `repository-code:` field');

  // package.json's repository.url may carry a git+ prefix or a .git suffix;
  // compare the owner/name that both agree on rather than the raw strings.
  const slug = (u) => u.match(/github\.com[/:]([^/]+\/[^/.]+)/)?.[1];
  assert.equal(
    slug(repoCode),
    slug(pkg.repository?.url ?? ''),
    'CITATION.cff repository-code and package.json repository must name the same repo',
  );
});
