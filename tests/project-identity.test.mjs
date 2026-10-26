// tests/project-identity.test.mjs — several files describe this project and only
// one pair of them was ever compared, so the rest drifted in silence.
//
// What was found on 2026-09-04: a plugin manifest said "AI job search command
// center" — "command center" reads as centralized infrastructure, which is the
// opposite of what this tool is — and package.json's homepage was a personal
// site. None of it broke anything, which is exactly why it lasted: a description
// is read by people, not by code, so drift produces no error and no failing test.
//
// These assertions compare the files to EACH OTHER, never to an expected string
// kept in here. A hardcoded blurb would just be another copy to keep in sync,
// and the bug being fixed is that there were already several.

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

test("package.json's homepage and repository name the same GitHub repo", () => {
  const pkg = JSON.parse(read('package.json'));

  // The fork's identity lives in package.json alone: nothing else carries a
  // project URL. The two fields must agree, and must not point back at the
  // upstream project or a personal site.
  // repository.url may carry a git+ prefix or a .git suffix; compare the
  // owner/name that both agree on rather than the raw strings.
  const slug = (u) => u?.match(/github\.com[/:]([^/]+\/[^/.]+)/)?.[1];
  const homepage = slug(pkg.homepage ?? '');
  const repository = slug(typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? '');

  assert.ok(homepage, 'package.json must carry a GitHub `homepage`');
  assert.ok(repository, 'package.json must carry a GitHub `repository.url`');
  assert.equal(
    homepage,
    repository,
    'package.json homepage and repository must name the same repo: ' +
    'a stale one tells npm and every tool that reads it the wrong thing about where this fork lives',
  );
  assert.ok(
    !['santifer/career-ops', 'career-ops-hq/career-ops'].includes(repository.toLowerCase()),
    'package.json still points at the upstream repository, not this fork',
  );
});
