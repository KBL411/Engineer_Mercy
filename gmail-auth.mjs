#!/usr/bin/env node
/**
 * gmail-auth.mjs — get the Google refresh token for one of the two optional Gmail
 * uses, from your own OAuth client (docs/GMAIL_SETUP.md).
 *
 *   node gmail-auth.mjs --scope readonly   # job-alert reader  -> GMAIL_REFRESH_TOKEN
 *   node gmail-auth.mjs --scope compose    # application drafts -> GMAIL_DRAFT_REFRESH_TOKEN
 *
 * Needs GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in your .env. Opens nothing by
 * itself: it prints a Google consent URL, waits on a loopback port of this machine
 * (127.0.0.1) for Google's redirect, and prints the refresh token line to paste
 * into .env. --write appends that line to your .env for you; without it, nothing
 * is written. The token is never logged anywhere else.
 */

import { createServer } from 'node:http';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getCareerOpsRoot } from './path-resolver.mjs';
import { validateFlags, flagValue } from './lib/cli-flags.mjs';
import { isMainModule } from './lib/is-main-module.mjs';
import {
  SCOPES, TOKEN_ENV, buildAuthUrl, exchangeCode, parseCallback, pkcePair, randomToken,
} from './lib/gmail-oauth.mjs';

const USAGE = `Usage: node gmail-auth.mjs --scope readonly|compose [--write]

  --scope readonly   read job-alert emails      -> GMAIL_REFRESH_TOKEN
  --scope compose    save application drafts    -> GMAIL_DRAFT_REFRESH_TOKEN
  --write            append the token line to your .env (default: print it only)

Requires GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in your .env (docs/GMAIL_SETUP.md).`;

const TIMEOUT_MS = 5 * 60 * 1000;

/** Wait for Google's redirect on a loopback port; resolves with {code, redirectUri}. */
function waitForCode(state, onListening) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      let code;
      try {
        code = parseCallback(req.url, state);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`${err.message}\nTu peux fermer cet onglet.`);
        // A stray request (favicon, scanner) must not end the wait; a real
        // refusal or mismatch from Google does.
        if (/refusé|state/.test(err.message)) { clearTimeout(timer); server.close(); reject(err); }
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('C\'est fait. Tu peux fermer cet onglet et retourner dans le terminal.');
      clearTimeout(timer);
      server.close();
      resolve({ code, redirectUri: `http://127.0.0.1:${server.address().port}` });
    });
    const timer = setTimeout(() => { server.close(); reject(new Error('Délai dépassé (5 minutes) sans réponse de Google.')); }, TIMEOUT_MS);
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => onListening(`http://127.0.0.1:${server.address().port}`));
  });
}

async function main() {
  const args = process.argv.slice(2);
  validateFlags(args, ['--scope', '--write', '--help', '-h'], USAGE, { valueFlags: ['--scope'], requireOperand: true });

  const scopeName = flagValue(args, '--scope');
  if (!SCOPES[scopeName]) {
    console.error(`Erreur : --scope doit valoir readonly ou compose.\n\n${USAGE}`);
    process.exit(1);
  }

  const root = getCareerOpsRoot();
  try {
    const { config } = await import('dotenv');
    config({ path: join(root, '.env'), quiet: true });
  } catch { /* dotenv missing: the shell environment still works */ }

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Erreur : GMAIL_CLIENT_ID et GMAIL_CLIENT_SECRET manquent dans ton .env. Voir docs/GMAIL_SETUP.md, étape 3.');
    process.exit(1);
  }

  const state = randomToken(24);
  const { verifier, challenge } = pkcePair();
  let url;
  const waiting = waitForCode(state, (redirectUri) => {
    url = buildAuthUrl({ clientId, redirectUri, scope: SCOPES[scopeName], state, challenge });
    console.log(`\nOuvre ce lien dans ton navigateur, choisis ton compte Google et accepte :\n\n${url}\n`);
    console.log('En attente de la réponse de Google (5 minutes au plus)...');
  });

  let code, redirectUri;
  try {
    ({ code, redirectUri } = await waiting);
  } catch (err) {
    console.error(`Erreur : ${err.message}`);
    process.exit(1);
  }

  let tokens;
  try {
    tokens = await exchangeCode({ clientId, clientSecret, code, verifier, redirectUri });
  } catch (err) {
    console.error(`Erreur : ${err.message}`);
    process.exit(1);
  }
  if (!tokens.refresh_token) {
    console.error('Erreur : Google n\'a pas renvoyé de refresh token. Retire l\'accès de l\'application sur https://myaccount.google.com/permissions puis recommence.');
    process.exit(1);
  }

  const line = `${TOKEN_ENV[scopeName]}=${tokens.refresh_token}`;
  if (args.includes('--write')) {
    const envPath = join(root, '.env');
    const current = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
    if (new RegExp(`^${TOKEN_ENV[scopeName]}=`, 'm').test(current)) {
      console.error(`\n${TOKEN_ENV[scopeName]} existe déjà dans ton .env : je n'y touche pas. Remplace la valeur à la main par :\n${line}`);
      process.exit(1);
    }
    appendFileSync(envPath, `${current && !current.endsWith('\n') ? '\n' : ''}${line}\n`);
    console.log(`\nOK : ${TOKEN_ENV[scopeName]} ajouté à ${envPath}.`);
  } else {
    console.log(`\nAjoute cette ligne à ton .env (sans guillemets) :\n\n${line}\n`);
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((err) => {
    console.error(`gmail-auth : erreur inattendue — ${err?.message || err}`);
    process.exit(1);
  });
}
