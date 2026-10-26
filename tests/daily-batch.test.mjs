import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePendingRows, knownIds, carryOver, selectBatch } from '../batch/select-batch.mjs';
import { parseTracker, buildReport } from '../batch/daily-report.mjs';

const pipeline = [
  '## Pending',
  '- [ ] https://a.test/1 | Acme | Data Engineer | Paris | posted: 2026-10-01 | rank: 4.2/5 — fits',
  '- [ ] https://a.test/2 | Beta | AI Engineer | Paris | posted: 2026-10-05 | rank: 4.2/5 — fits',
  '- [ ] https://a.test/3 | Gamma | DevOps | Paris | rank: 3.0/5 — generic',
  '- [ ] https://a.test/4 | Delta | Unranked role | Paris',
  '- [x] https://a.test/5 | Done | Old | Paris | rank: 5.0/5 — done',
  '- [ ] https://a.test/6 | Known | Already evaluated | Paris | rank: 4.9/5 — fits',
].join('\n');

const state = 'id\turl\tstatus\tstarted_at\tcompleted_at\treport_num\tscore\terror\tretries\n'
  + '7\thttps://a.test/6\tcompleted\ts\te\t001\t4.0\t-\t0\n'
  + '9\thttps://a.test/8\tpaused_rate_limit\ts\te\t002\t-\t429\t1\n';

test('pending rows keep only open rows and read rank and posting date', () => {
  const rows = parsePendingRows(pipeline);
  assert.deepEqual(rows.map(r => r.url), ['https://a.test/1', 'https://a.test/2', 'https://a.test/3', 'https://a.test/4', 'https://a.test/6']);
  assert.equal(rows[0].rank, 4.2);
  assert.equal(rows[0].posted, '2026-10-01');
  assert.equal(rows[3].rank, null);
});

test('selection skips known URLs and unranked rows, orders by rank then recency, numbers after the highest id', () => {
  const known = knownIds(state);
  assert.equal(known.maxId, 9);
  const picked = selectBatch(parsePendingRows(pipeline), known, { count: 5, minRank: 3.5 });
  assert.deepEqual(picked.map(p => [p.id, p.url]), [[10, 'https://a.test/2'], [11, 'https://a.test/1']]);
  assert.deepEqual(selectBatch(parsePendingRows(pipeline), known, { count: 1, minRank: 0 }).map(p => p.url), ['https://a.test/2']);
});

test('carry-over keeps unfinished input rows and drops completed ones', () => {
  const input = 'id\turl\tsource\tnotes\n7\thttps://a.test/6\tr\tx\n9\thttps://a.test/8\tr\ty\n';
  assert.deepEqual(carryOver(input, knownIds(state)).map(r => r[0]), ['9']);
});

test('report lists scores best first, flags failures and totals the measured cost', () => {
  const tracker = parseTracker([
    '| 1 | 2026-10-19 | Acme | Data Engineer | 4.2/5 | Evaluated | ❌ | [001](../reports/001-acme.md) | Good fit |',
    '| 2 | 2026-10-19 | Beta | AI Engineer | 3.0/5 | Evaluated | ❌ | [002](../reports/002-beta.md) | Meh |',
  ].join('\n'));
  assert.equal(tracker.get('001').company, 'Acme');
  const input = [['1', 'https://a.test/1', 'r', 'Acme'], ['2', 'https://a.test/2', 'r', 'Beta'], ['3', 'https://a.test/3', 'r', 'Gamma']];
  const stateRows = [
    ['1', 'https://a.test/1', 'completed', 's', 'e', '001', '4.2', '-', '0'],
    ['2', 'https://a.test/2', 'completed', 's', 'e', '002', '3.0', '-', '0'],
    ['3', 'https://a.test/3', 'failed', 's', 'e', '-', '-', 'boom', '2'],
  ];
  const md = buildReport({
    date: '2026-10-20', input, state: stateRows, tracker, usageFor: () => ({ total_cost_usd: 0.5 }),
    scanRun: { new_added: '12', found: '300', boards: '5' }, pending: [{ rank: 4.1, company: 'Zed', title: 'Next' }], pendingTotal: 40,
  });
  assert.match(md, /Évaluées\*\* : 2 sur 3 · \*\*échecs\*\* : 1/);
  assert.match(md, /1,00 \$|1\.00 \$/);
  assert.ok(md.indexOf('| 4.2 | Acme') < md.indexOf('| 3.0 | Beta'));
  assert.match(md, /À regarder en priorité.*Acme \(4\.2\)/);
  assert.match(md, /#3 Gamma — failed \(boom\)/);
  assert.match(md, /4\.1 — Zed — Next/);
});
