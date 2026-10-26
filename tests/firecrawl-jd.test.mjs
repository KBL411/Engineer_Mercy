// tests/firecrawl-jd.test.mjs — pins lib/firecrawl-jd.mjs, the opt-in Firecrawl
// fallback that reads a JD when no free path can (fork fr-data).
//
// No network and no firecrawl binary: the CLI call is stubbed through `run`.
import { pass, fail } from './helpers.mjs';
import { firecrawlEnabled, parsePostingUrl, fetchJdViaFirecrawl } from '../lib/firecrawl-jd.mjs';

console.log('\nlib/firecrawl-jd.mjs — opt-in Firecrawl JD fallback');

const ok = (cond, msg) => (cond ? pass(msg) : fail(msg));
const ON = { CAREER_OPS_FIRECRAWL: '1' };
const words = (n) => Array.from({ length: n }, (_, i) => `mot${i}`).join(' ');

// ── opt-in ─────────────────────────────────────────────────
ok(firecrawlEnabled({ CAREER_OPS_FIRECRAWL: '1' }), 'enabled by CAREER_OPS_FIRECRAWL=1');
ok(!firecrawlEnabled({}) && !firecrawlEnabled({ CAREER_OPS_FIRECRAWL: '0' }) && !firecrawlEnabled({ CAREER_OPS_FIRECRAWL: 'true' }), 'off by default and for any other value');

// ── URL guard ──────────────────────────────────────────────
ok(parsePostingUrl('https://www.welcometothejungle.com/en/companies/a/jobs/b')?.hostname === 'www.welcometothejungle.com', 'accepts a public https posting');
ok(parsePostingUrl('ftp://example.com/job') === null, 'refuses a non-http scheme');
ok(parsePostingUrl('https://user:pw@example.com/job') === null, 'refuses credentials in the URL');
ok(parsePostingUrl('http://localhost/job') === null && parsePostingUrl('https://printer.local/job') === null && parsePostingUrl('https://jobs.internal/x') === null, 'refuses local hosts');
ok(parsePostingUrl('http://127.0.0.1/job') === null && parsePostingUrl('http://169.254.169.254/latest') === null && parsePostingUrl('http://[::1]/job') === null, 'refuses IP literals');
ok(parsePostingUrl('https://singlelabel/job') === null, 'refuses a host with no dot');
ok(parsePostingUrl('https://www.linkedin.com/jobs/view/123') === null && parsePostingUrl('https://fr.linkedin.com/jobs/view/123') === null, 'refuses LinkedIn');
ok(parsePostingUrl('https://notlinkedin.com/jobs/1') !== null, 'does not refuse a look-alike host by suffix');
ok(parsePostingUrl('not a url') === null, 'refuses garbage');

// ── fetch ──────────────────────────────────────────────────
let calls = [];
const stub = (stdout, extra = {}) => (cmd, args, opts) => { calls.push({ cmd, args, opts }); return { status: 0, stdout, ...extra }; };

calls = [];
ok(fetchJdViaFirecrawl('https://example.com/job', { env: {}, run: stub(words(200)) }) === null && calls.length === 0, 'not enabled: no call is made');

calls = [];
ok(fetchJdViaFirecrawl('https://www.linkedin.com/jobs/view/1', { env: ON, run: stub(words(200)) }) === null && calls.length === 0, 'refused URL: no call is made');

calls = [];
const hit = fetchJdViaFirecrawl('https://example.com/job?x=$(touch pwn)&y=`id`', { env: ON, run: stub(`![logo](https://x/y.png)\n\n${words(200)}\n\n\n\n`) });
ok(hit && hit.text.split(/\s+/).length === 200 && !/!\[/.test(hit.text), 'a real page becomes the JD, images stripped');
ok(calls.length === 1 && calls[0].cmd === 'firecrawl' && calls[0].args[0] === 'scrape' && calls[0].args.includes('--only-main-content'), 'calls "firecrawl scrape ... --only-main-content"');
ok(calls[0].args[1] === new URL('https://example.com/job?x=$(touch pwn)&y=`id`').href && calls[0].args.length === 3, 'the URL travels as a single argv element');

ok(fetchJdViaFirecrawl('https://example.com/job', { env: ON, run: stub(words(10)) }) === null, 'a thin page is not a JD');
ok(fetchJdViaFirecrawl('https://example.com/job', { env: ON, run: stub(words(200), { status: 1 }) }) === null, 'a failing CLI gives null');
ok(fetchJdViaFirecrawl('https://example.com/job', { env: ON, run: stub('', { error: new Error('ENOENT') }) }) === null, 'a missing binary gives null, not a throw');
ok(fetchJdViaFirecrawl('https://example.com/job', { env: ON, textCap: 100, run: stub(words(500)) }).text.length <= 100, 'the text is capped');
