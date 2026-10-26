// tests/gmail-draft.test.mjs — pins lib/gmail-draft.mjs and gmail-draft.mjs, the
// "save an application email as a Gmail DRAFT" path (fork fr-data).
//
// The central promise: a draft is saved, nothing is ever sent. The static guard at
// the bottom fails if any Gmail file names a send route. No network: fetch is
// injected, and the CLI is only run with --dry-run or with missing credentials.
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pass, fail, ROOT } from './helpers.mjs';
import {
  ATTACHMENT_TYPES, buildMime, createGmailDraft, encodeHeader, loadAttachment, loadBody, validateHeaderText, validateRecipient,
} from '../lib/gmail-draft.mjs';

console.log('\ngmail-draft — Gmail drafts with attachments, never sent');

const ok = (cond, msg) => (cond ? pass(msg) : fail(msg));
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };

// ── recipient and header guards ─────────────────────────────
ok(validateRecipient(' recrutement@exemple.fr ') === 'recrutement@exemple.fr', 'a plain address is accepted (trimmed)');
for (const bad of ['a@b.fr\nBcc: x@y.fr', 'Jane <jane@b.fr>', 'a@b.fr, c@d.fr', 'a@b', '', 'no-at-sign', 'a@b.fr\r', 'x'.repeat(260) + '@b.fr']) {
  ok(throws(() => validateRecipient(bad), /Destinataire invalide/), `refused recipient: ${JSON.stringify(bad).slice(0, 40)}`);
}
ok(throws(() => validateHeaderText('Objet\nBcc: evil@x.fr', 'Objet'), /retours à la ligne/), 'a line break in the subject is refused (header injection)');
ok(throws(() => validateHeaderText('a b', 'Objet'), /retours à la ligne/), 'a Unicode line separator is refused too');
ok(throws(() => validateHeaderText('x'.repeat(301), 'Objet'), /trop long/), 'an overlong subject is refused');
ok(encodeHeader('Candidature') === 'Candidature' && /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/.test(encodeHeader('Candidature — Ingénieur')), 'only a non-ASCII header is RFC 2047 encoded');

// ── MIME ────────────────────────────────────────────────────
const plain = buildMime({ to: 'a@b.fr', subject: 'Bonjour', body: 'Corps du message\nligne 2' }, 'BND');
ok(/^MIME-Version: 1\.0\r\nTo: a@b\.fr\r\nSubject: Bonjour\r\n/.test(plain) && !/multipart/.test(plain), 'no attachment: a single text part');
ok(Buffer.from(plain.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8') === 'Corps du message\nligne 2', 'the body is base64 UTF-8 and round-trips');

const pdf = Buffer.from('%PDF-1.4 fake pdf bytes\n--BND--\nSubject: injected');
const mime = buildMime({ subject: 'Lettre', body: 'x', attachments: [{ filename: 'cv "Rayan".pdf', mimeType: 'application/pdf', data: pdf }] }, 'BND');
ok(/Content-Type: multipart\/mixed; boundary="BND"/.test(mime) && mime.trimEnd().endsWith('--BND--'), 'attachments: multipart/mixed, closed boundary');
ok(!/^To:/m.test(mime), 'no recipient: no To header (to fill in Gmail)');
ok(/Content-Disposition: attachment; filename="cv _Rayan_\.pdf"/.test(mime), 'quotes in a file name are neutralised');
ok(!/injected/.test(mime.replace(/\r\n/g, '')) || !/^Subject: injected/m.test(mime), 'attachment bytes cannot forge a header or a boundary (they are base64)');
const att64 = mime.split('Content-Disposition')[1].split('\r\n\r\n')[1].split('\r\n--BND')[0].replace(/\r\n/g, '');
ok(Buffer.from(att64, 'base64').equals(pdf), 'the attachment bytes round-trip');
ok(mime.split('\r\n').every((l) => l.length <= 998), 'no line exceeds the RFC limit');

// ── file confinement under output/ ──────────────────────────
const root = mkdtempSync(join(tmpdir(), 'co-gmail-'));
try {
  mkdirSync(join(root, 'output'));
  mkdirSync(join(root, 'data'));
  writeFileSync(join(root, 'output', 'cv.pdf'), pdf);
  writeFileSync(join(root, 'output', 'mail.txt'), 'Bonjour,\n\nMa candidature.\n');
  writeFileSync(join(root, 'output', 'run.sh'), 'echo hi');
  writeFileSync(join(root, 'cv.md'), '# secret cv');
  writeFileSync(join(root, 'data', 'applications.md'), 'private');

  const a = loadAttachment('output/cv.pdf', root);
  ok(a.filename === 'cv.pdf' && a.mimeType === ATTACHMENT_TYPES['.pdf'] && a.data.equals(pdf), 'a PDF under output/ is loaded');
  ok(loadBody('output/mail.txt', root).startsWith('Bonjour'), 'the body is read from a .txt under output/');
  ok(throws(() => loadAttachment('cv.md', root), /hors du dossier output/), 'a file outside output/ is refused');
  ok(throws(() => loadAttachment('data/applications.md', root), /hors du dossier output/), 'the tracker cannot be attached');
  ok(throws(() => loadAttachment('output/../cv.md', root), /hors du dossier output/), 'a ../ escape is refused');
  ok(throws(() => loadAttachment(join(root, 'cv.md'), root), /hors du dossier output|introuvable/), 'an absolute path cannot escape either');
  ok(throws(() => loadAttachment('output/run.sh', root), /Type de fichier refusé/), 'a script is not an allowed attachment type');
  ok(throws(() => loadAttachment('output/missing.pdf', root), /introuvable/), 'a missing file is reported');
  ok(throws(() => loadBody('output/cv.pdf', root), /\.txt/), 'the body must be a text file');
  let linked = true;
  try { symlinkSync(join(root, 'cv.md'), join(root, 'output', 'link.txt')); } catch { linked = false; }
  if (linked) ok(throws(() => loadAttachment('output/link.txt', root), /hors du dossier output/), 'a symlink pointing out of output/ is refused');
  else pass('symlink case skipped: symlinks unavailable on this platform');

  // ── the Gmail call ────────────────────────────────────────
  const seen = [];
  const stub = (status, json) => async (u, init) => { seen.push({ u, init }); return { ok: status === 200, status, json: async () => json, text: async () => JSON.stringify(json) }; };
  const res = await createGmailDraft({ to: 'a@b.fr', subject: 'Candidature', body: 'Bonjour', attachments: [a] }, 'ACCESS', stub(200, { id: 'r123' }));
  ok(res.id === 'r123' && /mail\.google\.com\/mail\/u\/0\/#drafts$/.test(res.webUrl), 'the draft id and the Drafts link are returned');
  ok(seen[0].u === 'https://gmail.googleapis.com/gmail/v1/users/me/drafts' && seen[0].init.method === 'POST', 'it POSTs to the drafts collection');
  ok(seen[0].init.headers.Authorization === 'Bearer ACCESS', 'the access token is sent as a bearer');
  const raw = JSON.parse(seen[0].init.body).message.raw;
  ok(/^[A-Za-z0-9_-]+$/.test(raw) && Buffer.from(raw, 'base64url').toString('utf8').includes('filename="cv.pdf"'), 'the message is sent base64url-encoded');
  let msg = '';
  try { await createGmailDraft({ subject: 's', body: 'b' }, 'T', stub(403, { error: 'insufficient scope' })); } catch (e) { msg = e.message; }
  ok(/403/.test(msg) && !/Bearer|T\b.*secret/.test(msg), 'a Gmail refusal is reported');
  msg = '';
  try { await createGmailDraft({ subject: 's', body: 'b', attachments: [{ filename: 'big.pdf', mimeType: 'application/pdf', data: Buffer.alloc(16 * 1024 * 1024) }] }, 'T', stub(200, {})); } catch (e) { msg = e.message; }
  ok(/trop lourdes/.test(msg) && seen.length === 2, 'oversized attachments are refused before any request');

  // ── the CLI ───────────────────────────────────────────────
  const cli = (args, env = {}) => spawnSync(process.execPath, [join(ROOT, 'gmail-draft.mjs'), ...args], {
    encoding: 'utf8', timeout: 20000, env: { ...process.env, CAREER_OPS_ROOT: root, GMAIL_CLIENT_ID: '', GMAIL_CLIENT_SECRET: '', GMAIL_DRAFT_REFRESH_TOKEN: '', ...env },
  });
  const dry = cli(['--to', 'a@b.fr', '--subject', 'Candidature', '--body-file', 'output/mail.txt', '--attach', 'output/cv.pdf', '--dry-run']);
  ok(dry.status === 0 && /simulation/.test(dry.stdout) && /cv\.pdf/.test(dry.stdout) && /a@b\.fr/.test(dry.stdout), '--dry-run summarises the draft and exits 0');
  const noCreds = cli(['--subject', 'S', '--body-file', 'output/mail.txt']);
  ok(noCreds.status === 1 && /GMAIL_DRAFT_REFRESH_TOKEN/.test(noCreds.stderr) && !/Bearer/.test(noCreds.stderr), 'without credentials it stops with the missing variables, before any network call');
  ok(cli(['--subject', 'S\nBcc: x@y.fr', '--body-file', 'output/mail.txt', '--dry-run']).status === 1, 'a subject with a line break is refused by the CLI');
  ok(cli(['--subject', 'S', '--body-file', 'output/mail.txt', '--attach', 'cv.md', '--dry-run']).status === 1, 'an attachment outside output/ is refused by the CLI');
  ok(cli(['--body-file', 'output/mail.txt', '--dry-run']).status === 1, 'a missing subject is refused');
  ok(cli(['--help']).status === 0 && /Usage:/.test(cli(['--help']).stdout), '--help prints the usage and exits 0');
  ok(cli(['--send']).status === 1, 'an unknown flag such as --send is refused');
} finally {
  rmSync(root, { recursive: true, force: true });
}

// ── nothing here can send ───────────────────────────────────
const files = ['gmail-draft.mjs', 'gmail-auth.mjs', 'lib/gmail-draft.mjs', 'lib/gmail-oauth.mjs'];
const SEND = /\/messages\/send|\/drafts\/send|messages\.send|drafts\.send|gmail\.send|gmail\.modify|["'`]send["'`]|\.send\s*\(|https:\/\/mail\.google\.com\/["'`]/i;
for (const f of files) {
  const src = readFileSync(join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(!SEND.test(src), `${f} names no send route, no send scope`);
}
