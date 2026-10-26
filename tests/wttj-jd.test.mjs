// tests/wttj-jd.test.mjs — pins lib/wttj-jd.mjs, the Welcome to the Jungle JD
// reader (fork fr-data). The page is behind CloudFront (202 empty / 403), so the
// JD comes from the public search index; the batch worker has no other way in.
//
// No network: the index and /api/env are stubbed through fetchImpl.
import { pass, fail } from './helpers.mjs';
import { parseWttjUrl, formatWttjHit, fetchWttjJd } from '../lib/wttj-jd.mjs';

console.log('\nlib/wttj-jd.mjs — WTTJ job description from the public index');

const ok = (cond, msg) => (cond ? pass(msg) : fail(msg));

// ── URL parsing ────────────────────────────────────────────
const ref = parseWttjUrl('https://www.welcometothejungle.com/en/companies/hublo/jobs/data-ml-platform-engineer-f-h-n_paris');
ok(ref?.orgSlug === 'hublo' && ref?.slug === 'data-ml-platform-engineer-f-h-n_paris', 'parses org and slug from an /en/ URL');
ok(parseWttjUrl('https://www.welcometothejungle.com/fr/companies/axa/jobs/x_paris')?.slug === 'x_paris', 'accepts another language prefix');
ok(parseWttjUrl('http://www.welcometothejungle.com/en/companies/a/jobs/b') === null, 'refuses http');
ok(parseWttjUrl('https://evil.example/en/companies/a/jobs/b') === null, 'refuses another host');
ok(parseWttjUrl('https://www.welcometothejungle.com.evil.example/en/companies/a/jobs/b') === null, 'refuses a look-alike host');
ok(parseWttjUrl('https://www.welcometothejungle.com/en/companies/a') === null, 'refuses a non-posting path');
ok(parseWttjUrl('not a url') === null, 'refuses garbage');

// ── formatting ─────────────────────────────────────────────
const hit = {
  name: 'Platform Engineer',
  slug: 'platform-engineer_paris',
  organization: { slug: 'acme', name: 'Acme' },
  offices: [{ city: 'Paris', country: 'France' }],
  remote: 'no',
  contract_type: 'full_time',
  experience_level_minimum: 5,
  summary: 'Build <b>the</b> platform.',
  key_missions: ['Run Kubernetes', 'Own CI/CD'],
  profile: 'You know Terraform.',
  benefits: ['RTT'],
};
const text = formatWttjHit(hit);
ok(/PAS DE TÉLÉTRAVAIL/.test(text), 'remote "no" is spelled out loudly');
ok(/Lieu : Paris, France/.test(text) && /Expérience minimum : 5 ans/.test(text), 'location and seniority are kept');
ok(/- Run Kubernetes/.test(text) && /Terraform/.test(text) && /RTT/.test(text), 'missions, profile and benefits are kept');
ok(!/<b>/.test(text), 'markup is stripped');
ok(formatWttjHit({ name: 'x', organization: {} }) === '', 'a hit without a body gives no JD');

// ── fetch, stubbed ─────────────────────────────────────────
const env = 'window.env = {"PUBLIC_ALGOLIA_APPLICATION_ID":"ABCDEF12","PUBLIC_ALGOLIA_API_KEY_CLIENT":"0123456789abcdef0123"}';
let algoliaBody = null;
const stub = (hits) => async (url, init) => {
  if (String(url).endsWith('/api/env')) return { ok: true, text: async () => env };
  algoliaBody = String(init?.body);
  return { ok: true, json: async () => ({ hits }) };
};
const URL1 = 'https://www.welcometothejungle.com/en/companies/acme/jobs/platform-engineer_paris';

const got = await fetchWttjJd(URL1, { fetchImpl: stub([hit]) });
ok(got?.title === 'Platform Engineer' && /Run Kubernetes/.test(got.text), 'returns the posting when the slug matches');
ok(/organization\.slug%3Aacme/.test(algoliaBody), 'restricts the query to the company');

const other = { ...hit, slug: 'platform-engineer_lyon' };
ok(await fetchWttjJd(URL1, { fetchImpl: stub([other]) }) === null, 'a different slug is never taken for the posting');
const otherOrg = { ...hit, organization: { slug: 'other', name: 'Other' } };
ok(await fetchWttjJd(URL1, { fetchImpl: stub([otherOrg]) }) === null, 'a different company is never taken for the posting');
ok(await fetchWttjJd(URL1, { fetchImpl: stub([]) }) === null, 'a posting gone from the index gives null');
ok(await fetchWttjJd('https://example.com/x', { fetchImpl: stub([hit]) }) === null, 'a foreign URL is not looked up');
ok(await fetchWttjJd(URL1, { fetchImpl: async () => { throw new Error('offline'); } }) === null, 'a network error gives null, not a throw');
