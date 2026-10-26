// tests/gmail-oauth.test.mjs — pins lib/gmail-oauth.mjs, the Google OAuth helpers
// behind gmail-auth.mjs (fork fr-data). No network: fetch is injected.
import { createHash } from 'node:crypto';
import { pass, fail } from './helpers.mjs';
import {
  SCOPES, TOKEN_ENV, buildAuthUrl, exchangeCode, parseCallback, pkcePair, randomToken, refreshAccessToken,
} from '../lib/gmail-oauth.mjs';

console.log('\nlib/gmail-oauth.mjs — Google OAuth (loopback + PKCE)');

const ok = (cond, msg) => (cond ? pass(msg) : fail(msg));
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };

// ── scopes and token variables: least privilege, one token per use ──
ok(SCOPES.readonly.endsWith('/gmail.readonly') && SCOPES.compose.endsWith('/gmail.compose'), 'two scopes: readonly and compose');
ok(!Object.values(SCOPES).some((s) => /gmail\.(send|modify)|mail\.google\.com\/$/.test(s)), 'no send, modify or full-mailbox scope is ever requested');
ok(TOKEN_ENV.readonly === 'GMAIL_REFRESH_TOKEN' && TOKEN_ENV.compose === 'GMAIL_DRAFT_REFRESH_TOKEN' && TOKEN_ENV.readonly !== TOKEN_ENV.compose, 'each scope has its own token variable');

// ── PKCE ────────────────────────────────────────────────────
const { verifier, challenge } = pkcePair();
ok(/^[A-Za-z0-9_-]{43,128}$/.test(verifier), 'the verifier is URL-safe and 43-128 characters');
ok(challenge === createHash('sha256').update(verifier).digest('base64url'), 'the challenge is the S256 hash of the verifier');
ok(pkcePair('fixed-verifier-for-the-test-0123456789abcdefghij').challenge === createHash('sha256').update('fixed-verifier-for-the-test-0123456789abcdefghij').digest('base64url'), 'a given verifier always gives the same challenge');
ok(randomToken() !== randomToken(), 'random tokens differ');

// ── consent URL ─────────────────────────────────────────────
const url = new URL(buildAuthUrl({ clientId: 'cid', redirectUri: 'http://127.0.0.1:5555', scope: SCOPES.compose, state: 'st', challenge: 'ch' }));
const p = url.searchParams;
ok(url.origin === 'https://accounts.google.com', 'the consent page is on accounts.google.com');
ok(p.get('client_id') === 'cid' && p.get('redirect_uri') === 'http://127.0.0.1:5555' && p.get('scope') === SCOPES.compose, 'client, redirect and scope are carried');
ok(p.get('response_type') === 'code' && p.get('code_challenge') === 'ch' && p.get('code_challenge_method') === 'S256' && p.get('state') === 'st', 'code flow with S256 challenge and state');
ok(p.get('access_type') === 'offline' && p.get('prompt') === 'consent', 'offline access with a forced consent, so a refresh token is returned');

// ── callback ────────────────────────────────────────────────
ok(parseCallback('/?code=abc&state=st', 'st') === 'abc', 'the code is read from the redirect');
ok(throws(() => parseCallback('/?code=abc&state=other', 'st'), /state/), 'a state mismatch is refused');
ok(throws(() => parseCallback('/?code=abc', 'st'), /state/), 'a missing state is refused');
ok(throws(() => parseCallback('/?error=access_denied&state=st', 'st'), /access_denied/), 'a denied consent is reported');
ok(throws(() => parseCallback('/?state=st', 'st'), /code/), 'a redirect without a code is refused');

// ── token calls ─────────────────────────────────────────────
const calls = [];
const stub = (status, json) => async (u, init) => { calls.push({ u, body: String(init.body) }); return { ok: status === 200, status, json: async () => json, text: async () => JSON.stringify(json) }; };

const tokens = await exchangeCode({ clientId: 'cid', clientSecret: 'sec', code: 'abc', verifier: 'v', redirectUri: 'http://127.0.0.1:5555' }, stub(200, { refresh_token: 'rt', access_token: 'at' }));
ok(tokens.refresh_token === 'rt' && calls[0].u === 'https://oauth2.googleapis.com/token', 'the code is traded at Google\'s token endpoint');
ok(/grant_type=authorization_code/.test(calls[0].body) && /code_verifier=v/.test(calls[0].body), 'the PKCE verifier is sent with the code');

ok(await refreshAccessToken({ clientId: 'cid', clientSecret: 'sec', refreshToken: 'rt' }, stub(200, { access_token: 'at2' })) === 'at2', 'a refresh token gives an access token');
ok(/grant_type=refresh_token/.test(calls[1].body), 'refresh uses grant_type=refresh_token');

let msg = '';
try { await refreshAccessToken({ clientId: 'cid', clientSecret: 'SECRET-VALUE', refreshToken: 'RT-VALUE' }, stub(400, { error: 'invalid_grant' })); } catch (e) { msg = e.message; }
ok(/400/.test(msg) && /invalid_grant/.test(msg) && !/SECRET-VALUE|RT-VALUE/.test(msg), 'a Google refusal is explained without echoing the secrets');
msg = '';
try { await refreshAccessToken({ clientId: 'c', clientSecret: 's', refreshToken: 'r' }, stub(200, {})); } catch (e) { msg = e.message; }
ok(/jeton d'accès/.test(msg), 'an answer without access_token is an error');
