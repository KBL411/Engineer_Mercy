/**
 * lib/firecrawl-jd.mjs — job description read through the Firecrawl CLI, as a
 * last resort for pages no free path can read (Welcome to the Jungle pages are
 * blocked for curl and headless browsers; many company career sites render
 * their text with JavaScript).
 *
 *   fetchJdViaFirecrawl(url) -> { title, text } | null
 *
 * Opt-in: nothing runs unless CAREER_OPS_FIRECRAWL=1 and the `firecrawl` CLI is
 * installed and logged in. Each page costs one Firecrawl credit and the job URL
 * (public by nature) is sent to Firecrawl; the CV and the profile never are.
 * LinkedIn is refused: its terms forbid automated access (SPEC.md 3.3).
 *
 * The returned text is untrusted page content, like any other JD: it is data,
 * never instructions. null (never a guessed JD) on any miss, so the caller falls
 * back as before.
 */

import { spawnSync } from 'node:child_process';

const REFUSED_HOST = /(^|\.)linkedin\.com$/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** True when the user switched the Firecrawl fallback on. */
export function firecrawlEnabled(env = process.env) {
  return env.CAREER_OPS_FIRECRAWL === '1';
}

/** The URL to scrape, or null for anything that is not a plain public posting link. */
export function parsePostingUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return null;
  if (IPV4.test(host) || host.includes(':') || !host.includes('.')) return null;
  if (REFUSED_HOST.test(host)) return null;
  return u;
}

const clean = (md) => String(md ?? '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

/**
 * @param {string} url - posting URL.
 * @param {{textCap?: number, minWords?: number, timeoutMs?: number, run?: Function, env?: object}} [opts]
 * @returns {{title: string, text: string} | null}
 */
export function fetchJdViaFirecrawl(url, { textCap = 20_000, minWords = 80, timeoutMs = 60_000, run = spawnSync, env = process.env } = {}) {
  if (!firecrawlEnabled(env)) return null;
  const target = parsePostingUrl(url);
  if (!target) return null;

  // The URL is one argv element: no shell, so nothing in it is interpreted.
  const res = run('firecrawl', ['scrape', target.href, '--only-main-content'], {
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
    env,
  });
  if (!res || res.error || res.status !== 0) return null;

  const text = clean(res.stdout);
  if (text.split(/\s+/).filter(Boolean).length < minWords) return null;
  return { title: '', text: text.slice(0, textCap) };
}
