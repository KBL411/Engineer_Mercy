/**
 * lib/wttj-jd.mjs — job description of a Welcome to the Jungle posting, read
 * from WTTJ's public search index instead of the page.
 *
 * The page sits behind CloudFront: a plain request gets an empty 202 and a
 * headless browser a 403, so no page read can work. The index the site's own
 * search box calls (the one providers/wttj.mjs scans) carries the posting
 * itself: summary, missions, profile, benefits, and the `remote` policy that
 * the scan row never shows. No bot protection is bypassed; the credentials come
 * from the site's public /api/env, as in providers/wttj.mjs.
 *
 *   fetchWttjJd(url) -> { title, text } | null
 *
 * null (never a guessed JD) when the URL is not a WTTJ posting, the posting is
 * no longer indexed, or the answer is unusable. The caller falls back as before.
 */

import { parseEnvPayload } from '../providers/wttj.mjs';

const SITE = 'https://www.welcometothejungle.com';
const INDEX = 'wttj_jobs_production_en';
const URL_RE = /^\/(?:[a-z]{2}\/)?companies\/([a-z0-9_-]+)\/jobs\/([a-z0-9_-]+)\/?$/i;

const REMOTE_LABELS = {
  fulltime: 'télétravail complet possible',
  partial: 'télétravail partiel',
  punctual: 'télétravail ponctuel',
  no: 'PAS DE TÉLÉTRAVAIL',
};

/** {orgSlug, slug} of a WTTJ posting URL, or null for anything else. */
export function parseWttjUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.hostname !== 'www.welcometothejungle.com') return null;
  const m = u.pathname.match(URL_RE);
  return m ? { orgSlug: m[1], slug: m[2] } : null;
}

const asList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);
const clean = (s) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** Readable JD text from one index hit. Empty when the hit has no posting body. */
export function formatWttjHit(h) {
  const parts = [];
  const org = h.organization?.name ?? '';
  const offices = (h.offices ?? [])
    .map((o) => [o.city, o.state, o.country].filter(Boolean).join(', '))
    .filter(Boolean);

  parts.push(`# ${clean(h.name)}${org ? ` — ${clean(org)}` : ''}`);
  if (offices.length) parts.push(`Lieu : ${offices.join(' | ')}`);
  if (h.remote) parts.push(`Télétravail : ${REMOTE_LABELS[h.remote] ?? clean(h.remote)}`);
  if (h.contract_type) parts.push(`Contrat : ${clean(h.contract_type)}`);
  if (h.experience_level_minimum != null) parts.push(`Expérience minimum : ${clean(h.experience_level_minimum)} ans`);
  if (h.salary_yearly_minimum || h.salary_maximum) {
    parts.push(`Salaire : ${h.salary_yearly_minimum ?? '?'} - ${h.salary_maximum ?? '?'} ${clean(h.salary_currency ?? '')} (${clean(h.salary_period ?? 'année')})`);
  }

  const summary = clean(h.summary);
  const missions = asList(h.key_missions).map(clean);
  const profile = clean(h.profile);
  const benefits = asList(h.benefits).map(clean);
  if (!summary && !missions.length && !profile) return '';

  if (summary) parts.push(`\n## Présentation\n${summary}`);
  if (missions.length) parts.push(`\n## Missions\n${missions.map((m) => `- ${m}`).join('\n')}`);
  if (profile) parts.push(`\n## Profil recherché\n${profile}`);
  if (benefits.length) parts.push(`\n## Avantages\n${benefits.map((b) => `- ${b}`).join('\n')}`);
  return parts.join('\n');
}

/**
 * @param {string} url
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number, textCap?: number }} [opts]
 */
export async function fetchWttjJd(url, { fetchImpl = fetch, timeoutMs = 15_000, textCap = 20_000 } = {}) {
  const ref = parseWttjUrl(url);
  if (!ref) return null;
  try {
    const envRes = await fetchImpl(`${SITE}/api/env`, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
    if (!envRes.ok) return null;
    const { appId, apiKey } = parseEnvPayload(await envRes.text());

    // The slug is "{title}_{city}": its title words rank the posting first in its
    // own company's listings, and the exact slug check below is what decides.
    const query = ref.slug.split('_')[0].replace(/-/g, ' ');
    const params = new URLSearchParams({
      query,
      filters: `organization.slug:${ref.orgSlug}`,
      hitsPerPage: '50',
    });
    const res = await fetchImpl(`https://${appId}-dsn.algolia.net/1/indexes/${INDEX}/query`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'x-algolia-application-id': appId,
        'x-algolia-api-key': apiKey,
        referer: `${SITE}/`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ params: params.toString() }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const hit = Array.isArray(json?.hits)
      ? json.hits.find((h) => h?.slug === ref.slug && h?.organization?.slug === ref.orgSlug)
      : null;
    if (!hit) return null;
    const text = formatWttjHit(hit);
    return text ? { title: clean(hit.name), text: text.slice(0, textCap) } : null;
  } catch {
    return null;
  }
}
