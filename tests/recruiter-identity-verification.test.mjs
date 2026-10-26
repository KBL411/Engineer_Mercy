import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { pass, fail } from './helpers.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const oferta = readFileSync(join(ROOT, 'modes', 'oferta.md'), 'utf8');
const batch = readFileSync(join(ROOT, 'batch', 'batch-prompt.md'), 'utf8');

console.log('\nRecruiter identity verification (Block G Signal 18, #5079)');

function check(label, condition, detail) {
  if (condition) pass(label);
  else fail(`${label}: ${detail}`);
}

const signal = oferta.match(/\*\*18\. Recruiter Identity Verification\*\*[\s\S]*?(?=\n### Output format:)/)?.[0] ?? '';
check('oferta defines Signal 18 as the last signal before the output format', Boolean(signal), 'missing Signal 18 section');
check(
  'signal runs only for recruiter outreach',
  /only when the role reached the candidate through recruiter outreach/i.test(signal)
    && /otherwise skip and say nothing/i.test(signal),
  'recruiter-only gate is missing',
);
check(
  'recruiter outreach that links a posting is still recruiter-sourced',
  /including outreach that links a public posting/.test(signal)
    && /a posting the candidate found on their own/.test(signal),
  'gate keys on URL presence instead of how the role arrived',
);
check(
  'checks without a query budget mark missing evidence Unknown, not Concerning',
  /Checks \(b\), \(c\) and \(e\) spend no queries/.test(signal)
    && /never Concerning on absence of evidence alone/.test(signal)
    && /Absence from a list that does not claim to be complete is Unknown/.test(signal),
  'Unknown rule for (b), (c), (e) is missing',
);
check(
  'signal carries all five checks',
  ['(a) Official board', '(b) Name pairing', '(c) Recruiter-to-company link', '(d) Public scam reports', '(e) Process requests']
    .every((label) => signal.includes(label)),
  'one or more of checks (a)-(e) is missing',
);
check(
  'research cost stays bounded',
  /at most one query each from the bounded research budget/i.test(signal),
  'query budget is not stated',
);
check(
  'agent never runs recruiter-supplied code',
  /never clone, install, open, or execute a repository, archive, or link the recruiter supplied/i.test(signal)
    && /untrusted external content/i.test(signal),
  'hard rule or untrusted-content rule is missing',
);
check(
  'signal feeds the tier with an evidence threshold',
  /this signal feeds the tier/i.test(signal)
    && /Recruiter contact alone is Neutral/.test(signal)
    && /\(a\) or \(d\) is Concerning and at least one other check is also Concerning/.test(signal),
  'tier rule is missing or has no evidence threshold',
);
check(
  'suspicious note is rendered in the output language and stays non-accusatory',
  signal.includes('⚠️ **Recruiter identity note:**')
    && signal.includes('Render in {language.output}')
    && /Present observations, not accusations/.test(signal),
  'note template is incomplete',
);

check(
  'recruiter contact is no longer a positive legitimacy signal (oferta)',
  !/recruiter contact is itself a positive legitimacy signal/i.test(oferta)
    && /Recruiter contact alone is Neutral, not a positive legitimacy signal: run Signal 18/.test(oferta),
  'edge case still treats recruiter contact as positive',
);
check(
  'batch prompt mirrors Signal 18 with the hard stop and lets it set the tier',
  /18\. \*\*Recruiter Identity Verification\*\*/.test(batch)
    && /Never clone, install, open, or execute anything the recruiter supplied/.test(batch)
    && /Signals 1-5, 7-9 and 18 set the tier/.test(batch)
    && /including outreach that links a public posting/.test(batch)
    && !/a posting URL → `not evaluated`/.test(batch)
    && /never Concerning\./.test(batch),
  'batch parity, gate, Unknown rule, hard stop, or tier wording is missing',
);
