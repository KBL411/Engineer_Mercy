/**
 * lib/gmail-draft.mjs — save an application email as a Gmail DRAFT, with its
 * attachments, and nothing more.
 *
 * Why a script and not the Gmail connector's create_draft: a PDF travels as
 * base64 inside the tool call, which means through the model's context (a 100 KB
 * CV is about 130,000 characters). Here the bytes go from disk to Google directly.
 *
 * The candidate reviews the draft in Gmail and sends it themself. This file has
 * no send path on purpose; tests/gmail-draft.test.mjs fails if one is added.
 *
 * Inputs are untrusted (the recipient and subject often come from a job posting):
 * header fields cannot carry a line break, the recipient must be one plain
 * address, and every file must sit under output/ with a known extension.
 */

import { readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, extname, join, relative, sep } from 'node:path';

export const GMAIL_DRAFTS_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/drafts';
export const GMAIL_DRAFTS_WEB = 'https://mail.google.com/mail/u/0/#drafts';

/** Extensions an application email may carry, with their MIME types. */
export const ATTACHMENT_TYPES = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain; charset=utf-8',
};

// Gmail caps a message at 25 MB; base64 adds a third, so stay well under.
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const ADDRESS = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
// Any control character, including the Unicode line and paragraph separators.
const CONTROL = new RegExp('[\\u0000-\\u001f\\u007f\\u2028\\u2029]');
const NO_LINE_BREAK = /^[^\r\n\u2028\u2029]*$/;

/** One plain address, no display name, no list, no control character. Throws otherwise. */
export function validateRecipient(to) {
  if (typeof to !== 'string' || CONTROL.test(to) || !ADDRESS.test(to.trim()) || to.length > 254) {
    throw new Error(`Destinataire invalide : « ${String(to).slice(0, 60)} » (une seule adresse e-mail simple attendue).`);
  }
  return to.trim();
}

/** A header value with no line break (a CR/LF here would inject extra headers). */
export function validateHeaderText(value, label) {
  const text = String(value ?? '');
  if (!NO_LINE_BREAK.test(text)) throw new Error(`${label} : les retours à la ligne sont interdits.`);
  if (text.length > 300) throw new Error(`${label} : trop long (300 caractères au plus).`);
  return text;
}

/** RFC 2047 encoded-word for a header that is not plain ASCII. */
export function encodeHeader(text) {
  return /^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

const wrap76 = (b64) => b64.replace(/.{1,76}/g, '$&\r\n').trimEnd();

/**
 * The RFC 2822 message. Body and attachments are base64, so no line of the
 * payload can start a header or a MIME boundary by accident.
 *
 * @param {{to?: string, subject?: string, body: string, attachments?: {filename: string, mimeType: string, data: Buffer}[]}} draft
 * @param {string} [boundary] - fixed in tests only.
 */
export function buildMime({ to, subject = '', body, attachments = [] }, boundary = `career-ops-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`) {
  const headers = ['MIME-Version: 1.0'];
  if (to) headers.push(`To: ${validateRecipient(to)}`);
  headers.push(`Subject: ${encodeHeader(validateHeaderText(subject, 'Objet'))}`);
  const textPart = [
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(Buffer.from(String(body ?? ''), 'utf8').toString('base64')),
  ].join('\r\n');

  if (attachments.length === 0) return `${headers.join('\r\n')}\r\n${textPart}\r\n`;

  const parts = [`--${boundary}\r\n${textPart}`];
  for (const a of attachments) {
    const name = encodeHeader(validateHeaderText(a.filename, 'Nom de pièce jointe')).replace(/["\\]/g, '_');
    parts.push([
      `--${boundary}`,
      `Content-Type: ${a.mimeType}; name="${name}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${name}"`,
      '',
      wrap76(a.data.toString('base64')),
    ].join('\r\n'));
  }
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  return `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}\r\n--${boundary}--\r\n`;
}

/**
 * Read a file the draft may use: it must resolve (symlinks followed) to a path
 * under `<root>/output/`, and have an allowed extension.
 * @returns {{filename: string, mimeType: string, data: Buffer}}
 */
export function loadAttachment(file, root) {
  const outputDir = realpathSync(join(root, 'output'));
  let real;
  try {
    real = realpathSync(join(root, file));
  } catch {
    throw new Error(`Fichier introuvable : ${file}`);
  }
  const rel = relative(outputDir, real);
  if (rel === '' || rel.startsWith('..') || rel.split(sep).includes('..') || /^[A-Za-z]:/.test(rel) || rel.startsWith(sep)) {
    throw new Error(`Fichier refusé (hors du dossier output/) : ${file}`);
  }
  const mimeType = ATTACHMENT_TYPES[extname(real).toLowerCase()];
  if (!mimeType) throw new Error(`Type de fichier refusé (${Object.keys(ATTACHMENT_TYPES).join(', ')} seulement) : ${file}`);
  if (!statSync(real).isFile()) throw new Error(`Ce n'est pas un fichier : ${file}`);
  return { filename: basename(real), mimeType, data: readFileSync(real) };
}

/** The message body from a text file under output/ (same confinement as an attachment). */
export function loadBody(file, root) {
  const { data, mimeType } = loadAttachment(file, root);
  if (!mimeType.startsWith('text/')) throw new Error(`Le corps du mail doit être un fichier .txt : ${file}`);
  return data.toString('utf8');
}

/**
 * Create the draft in Gmail. Returns {id, webUrl}. `accessToken` comes from
 * refreshAccessToken() with the compose scope; `fetchFn` is injected in tests.
 */
export async function createGmailDraft({ to, subject, body, attachments = [] }, accessToken, fetchFn = globalThis.fetch) {
  const total = attachments.reduce((n, a) => n + a.data.length, 0);
  if (total > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Pièces jointes trop lourdes (${Math.round(total / 1048576)} Mo, ${MAX_ATTACHMENT_BYTES / 1048576} Mo au plus).`);
  }
  const raw = Buffer.from(buildMime({ to, subject, body, attachments }), 'utf8').toString('base64url');
  const res = await fetchFn(GMAIL_DRAFTS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!res.ok) throw new Error(`Gmail a refusé le brouillon : ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return { id: data.id, webUrl: GMAIL_DRAFTS_WEB };
}
