/**
 * lib/gmail-oauth.mjs — Google OAuth helpers for the two optional Gmail uses.
 *
 *   readonly  GMAIL_REFRESH_TOKEN        read job-alert emails (plugins/gmail)
 *   compose   GMAIL_DRAFT_REFRESH_TOKEN  save application DRAFTS (gmail-draft.mjs)
 *
 * Two scopes, two tokens, one OAuth client: the alert reader never holds the
 * right to write, and the draft writer never reads the mailbox. Google has no
 * "drafts only" scope (gmail.compose also covers sending), so the guarantee that
 * nothing is ever sent is kept in code: no module here or in gmail-draft.mjs
 * names a send endpoint, and tests/gmail-draft.test.mjs fails if one appears.
 *
 * The flow is the installed-app one with PKCE: a loopback redirect on
 * 127.0.0.1, a random `state`, a S256 code challenge. Nothing here logs a token.
 */

import { createHash, randomBytes } from 'node:crypto';

export const SCOPES = {
  readonly: 'https://www.googleapis.com/auth/gmail.readonly',
  compose: 'https://www.googleapis.com/auth/gmail.compose',
};

/** The env var that stores the refresh token of each scope. */
export const TOKEN_ENV = {
  readonly: 'GMAIL_REFRESH_TOKEN',
  compose: 'GMAIL_DRAFT_REFRESH_TOKEN',
};

export const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

/** A random URL-safe string, for `state` and the PKCE verifier. */
export function randomToken(bytes = 32, random = randomBytes) {
  return b64url(random(bytes));
}

/** PKCE pair: the verifier stays here, only its S256 hash goes in the URL. */
export function pkcePair(verifier = randomToken(48)) {
  return { verifier, challenge: b64url(createHash('sha256').update(verifier).digest()) };
}

/** The consent URL to open in a browser. */
export function buildAuthUrl({ clientId, redirectUri, scope, state, challenge }) {
  const u = new URL(AUTH_URL);
  u.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    // offline + consent: without both, Google may not return a refresh token.
    access_type: 'offline',
    prompt: 'consent',
  }).toString();
  return u.href;
}

/**
 * The authorization code from the redirect URL the browser was sent to.
 * Throws a short, secret-free message on a denied consent or a state mismatch
 * (a state mismatch means the request did not come from our own consent page).
 */
export function parseCallback(requestUrl, expectedState) {
  const u = new URL(requestUrl, 'http://127.0.0.1');
  const error = u.searchParams.get('error');
  if (error) throw new Error(`Google a refusé l'autorisation (${error}).`);
  if (u.searchParams.get('state') !== expectedState) {
    throw new Error('Réponse ignorée : le paramètre state ne correspond pas à la demande.');
  }
  const code = u.searchParams.get('code');
  if (!code) throw new Error('Réponse sans code d\'autorisation.');
  return code;
}

async function postToken(params, fetchFn) {
  const res = await fetchFn(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  if (!res.ok) {
    // The body names the failure (invalid_grant, invalid_client...) and never
    // echoes our secrets; still, cap it.
    throw new Error(`Google a refusé la demande de jeton : ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

/** Trade the authorization code for tokens. Returns the raw token response. */
export function exchangeCode({ clientId, clientSecret, code, verifier, redirectUri }, fetchFn = globalThis.fetch) {
  return postToken({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  }, fetchFn);
}

/** A short-lived access token from a stored refresh token. */
export async function refreshAccessToken({ clientId, clientSecret, refreshToken }, fetchFn = globalThis.fetch) {
  const data = await postToken({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }, fetchFn);
  if (!data.access_token) throw new Error('Google n\'a pas renvoyé de jeton d\'accès.');
  return data.access_token;
}
