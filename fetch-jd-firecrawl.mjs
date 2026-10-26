#!/usr/bin/env node
/**
 * fetch-jd-firecrawl.mjs — last-resort JD reader, through the Firecrawl CLI.
 *
 *   CAREER_OPS_FIRECRAWL=1 node fetch-jd-firecrawl.mjs <url>
 *
 * JD text on stdout and exit 0 on a hit. Exit 1 with empty stdout otherwise,
 * the same contract as fetch-jd.mjs: a miss is the expected "fall back" case.
 * Off unless CAREER_OPS_FIRECRAWL=1 (one credit per page, see lib/firecrawl-jd.mjs).
 */

import { fetchJdViaFirecrawl } from './lib/firecrawl-jd.mjs';
import { isMainModule } from './lib/is-main-module.mjs';

const USAGE = `Usage: CAREER_OPS_FIRECRAWL=1 node fetch-jd-firecrawl.mjs <url>

Prints the job description of <url> read through the Firecrawl CLI (one credit
per page). Exits 1 with no output when off, refused or unreadable.`;

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    process.exit(0);
  }
  const url = args[0];
  if (!url) {
    console.error(USAGE);
    process.exit(1);
  }
  const result = fetchJdViaFirecrawl(url);
  if (!result) process.exit(1);
  process.stdout.write(result.text);
}

if (isMainModule(import.meta.url)) main();
