import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
test('CLI emits bounded summary only, no funding address or transaction, and no arguments', () => {
  const run = spawnSync(process.execPath, ['dist/preseason/allowance/cli.js'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr); assert(run.stdout.length < 4096);
  const summary = JSON.parse(run.stdout);
  assert.equal(summary.status, 'SYNTHETIC_VM_VERIFIED'); assert.equal(summary.canSign, false);
  assert(!/bitcoincash:|bchtest:|serializedTransaction|lockingBytecode|unlockingBytecode|privateKey|fundingAddress/.test(run.stdout));
  const bad = spawnSync(process.execPath, ['dist/preseason/allowance/cli.js', '--export'], { encoding: 'utf8' });
  assert.equal(bad.status, 1); assert.equal(bad.stdout, '');
});
