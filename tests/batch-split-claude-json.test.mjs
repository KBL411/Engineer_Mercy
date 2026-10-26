import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './helpers.mjs';

const SPLIT = join(ROOT, 'batch', 'split-claude-json.mjs');

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'split-claude-'));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
}

test('a JSON result becomes the text log plus a usage file', () => withDir((dir) => {
  const log = join(dir, '001-1.log');
  const usage = join(dir, '001-1.usage.json');
  writeFileSync(log, JSON.stringify({
    result: 'Évaluation terminée.',
    total_cost_usd: 0.5,
    usage: { input_tokens: 3, output_tokens: 10, cache_read_input_tokens: 100, cache_creation_input_tokens: 7 },
    modelUsage: { 'claude-sonnet-5-5': { costUSD: 0.5 } },
    num_turns: 4,
    duration_ms: 1234,
  }));
  assert.equal(spawnSync(process.execPath, [SPLIT, log, usage]).status, 0);
  assert.equal(readFileSync(log, 'utf8'), 'Évaluation terminée.\n');
  const u = JSON.parse(readFileSync(usage, 'utf8'));
  assert.equal(u.total_cost_usd, 0.5);
  assert.equal(u.usage.cache_read_input_tokens, 100);
}));

test('a log that is not the JSON envelope is left untouched', () => withDir((dir) => {
  const log = join(dir, 'x.log');
  const usage = join(dir, 'x.usage.json');
  for (const text of ['429 Too Many Requests\nRetry-After: 80\n', '{"no":"result"}', '']) {
    writeFileSync(log, text);
    assert.notEqual(spawnSync(process.execPath, [SPLIT, log, usage]).status, 0);
    assert.equal(readFileSync(log, 'utf8'), text);
    assert.equal(existsSync(usage), false);
  }
}));
