import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
test('fixed funding risk demo exports bounded summaries and refuses arguments', () => {
  const run = args => spawnSync(process.execPath, ['dist/preseason/allowance/funding-cli.js', ...args], { encoding: 'utf8', timeout: 15000, maxBuffer: 50000 });
  const r = run([]); assert.equal(r.status, 0); assert.equal(r.stderr, '');
  assert(r.stdout.length < 20000); assert(!/[a-f0-9]{64}/i.test(r.stdout)); assert(!r.stdout.includes('bitcoincash:'));
  const parsed = JSON.parse(r.stdout); assert.deepEqual(parsed.cases.map(c => c.report.status), ['SYNTHETIC_CONTINUATION_VERIFIED', 'PLAN_MISMATCH', 'CONTRACT_REJECTED', 'LOCAL_POLICY_REJECTED', 'LOCAL_POLICY_REJECTED']);
  assert(parsed.cases.every(c => c.report.fundingPermitted === false && c.report.canSign === false));
  const bad = run(['--fund']); assert.equal(bad.status, 2); assert.equal(bad.stdout, '');
});
