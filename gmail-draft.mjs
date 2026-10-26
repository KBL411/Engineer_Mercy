#!/usr/bin/env node
/**
 * gmail-draft.mjs — save an application email as a Gmail DRAFT, with its CV and
 * cover letter attached. It never sends: you review the draft in Gmail and press
 * Send yourself.
 *
 *   node gmail-draft.mjs --to recruiter@example.com --subject "Candidature ..." \
 *     --body-file output/email-acme.txt --attach output/cv-acme.pdf --attach output/lettre-acme.pdf
 *
 * Every file must sit under output/ (.pdf, .docx or .txt). --dry-run builds the
 * message and prints what would be saved, without any network call. Needs
 * GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_DRAFT_REFRESH_TOKEN in .env
 * (docs/GMAIL_SETUP.md; get the token with: node gmail-auth.mjs --scope compose).
 */

import { join } from 'node:path';
import { getCareerOpsRoot } from './path-resolver.mjs';
import { validateFlags } from './lib/cli-flags.mjs';
import { isMainModule } from './lib/is-main-module.mjs';
import { refreshAccessToken } from './lib/gmail-oauth.mjs';
import {
  buildMime, createGmailDraft, loadAttachment, loadBody, validateHeaderText, validateRecipient,
} from './lib/gmail-draft.mjs';

const USAGE = `Usage: node gmail-draft.mjs --subject <text> --body-file <output/file.txt> [--to <address>] [--attach <output/file>]... [--dry-run]

Saves a DRAFT in your Gmail (never sends). Files must be under output/ and end in .pdf, .docx or .txt.
--dry-run   build the message and print a summary, without contacting Google.`;

/** All values of a repeatable flag, in order (`--attach a --attach b`). */
function values(args, flag) {
  const out = [];
  args.forEach((a, i) => {
    if (a === flag && args[i + 1] !== undefined) out.push(args[i + 1]);
    else if (a.startsWith(`${flag}=`)) out.push(a.slice(flag.length + 1));
  });
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  validateFlags(args, ['--to', '--subject', '--body-file', '--attach', '--dry-run', '--help', '-h'], USAGE, {
    valueFlags: ['--to', '--subject', '--body-file', '--attach'],
    requireOperand: true,
  });

  const fail = (msg) => { console.error(`Erreur : ${msg}`); process.exit(1); };
  const [to] = values(args, '--to');
  const [subject] = values(args, '--subject');
  const [bodyFile] = values(args, '--body-file');
  if (!subject) fail('--subject est obligatoire.');
  if (!bodyFile) fail('--body-file est obligatoire (un .txt sous output/).');

  const root = getCareerOpsRoot();
  let draft;
  try {
    if (to) validateRecipient(to);
    validateHeaderText(subject, 'Objet');
    draft = {
      to,
      subject,
      body: loadBody(bodyFile, root),
      attachments: values(args, '--attach').map((f) => loadAttachment(f, root)),
    };
    buildMime(draft); // validates every header before any network call
  } catch (err) {
    fail(err.message);
  }

  const summary = `Destinataire : ${to || '(aucun, à remplir dans Gmail)'}\nObjet : ${subject}\nPièces jointes : ${draft.attachments.map((a) => a.filename).join(', ') || '(aucune)'}`;
  if (args.includes('--dry-run')) {
    console.log(`Brouillon (simulation, rien n'est envoyé ni enregistré) :\n${summary}`);
    return;
  }

  try {
    const { config } = await import('dotenv');
    config({ path: join(root, '.env'), quiet: true });
  } catch { /* dotenv missing: the shell environment still works */ }
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_DRAFT_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    fail('GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET et GMAIL_DRAFT_REFRESH_TOKEN doivent être dans ton .env. Voir docs/GMAIL_SETUP.md.');
  }

  try {
    const accessToken = await refreshAccessToken({ clientId, clientSecret, refreshToken });
    const { webUrl } = await createGmailDraft(draft, accessToken);
    console.log(`Brouillon enregistré dans Gmail (rien n'est envoyé) :\n${summary}\n\nOuvre-le ici, relis-le et envoie-le toi-même : ${webUrl}`);
  } catch (err) {
    fail(err.message);
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((err) => {
    console.error(`gmail-draft : erreur inattendue — ${err?.message || err}`);
    process.exit(1);
  });
}
