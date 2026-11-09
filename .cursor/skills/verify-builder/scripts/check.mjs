import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { binToHex, hexToBin, encodeTransaction, decodeTransaction, hashTransaction } from '@bitauth/libauth';

const destination = resolve(process.argv[2] ?? 'dist/builder-evidence-' + Date.now());
await mkdir(destination);
const scratch = await mkdtemp(join(process.env.TMPDIR ?? tmpdir(), 'intentguard-builder-'));
const sources = ['core/unsigned-builder.ts', 'core/guard.ts'];
const hash = text => createHash('sha256').update(text).digest('hex');
const before = await Promise.all(sources.map(async file => ({ file, sha256: hash(await readFile(file)) })));
const original = await readFile(sources[0], 'utf8');
await copyFile(sources[1], join(scratch, 'guard.ts'));
async function load(contents, name) {
  await writeFile(join(scratch, 'unsigned-builder.ts'), contents);
  const output = join(scratch, name + '.mjs');
  await build({ entryPoints: [join(scratch, 'unsigned-builder.ts')], outfile: output, bundle: true, platform: 'node', format: 'esm', nodePaths: [resolve('node_modules')], logLevel: 'silent' });
  return (await import(pathToFileURL(output).href)).buildUnsignedPlan;
}
function sweep(builder) {
  let cases = 0, accepted = 0;
  for (const network of ['chipnet', 'mainnet']) for (const inputs of [1, 2]) for (const recipients of [1, 2]) for (const amount of [545n, 546n, 1000n])
    for (const funding of [546n, 1000n, 10000n]) for (const maxFee of ['0', '219', '600']) for (const defect of ['none', 'unknown-owner', 'missing-parent', 'stale', 'network', 'token', 'nft']) {
      cases++;
      const owner = '76a914' + '11'.repeat(20) + '88ac', recipient = i => '76a914' + (i ? '33' : '22').repeat(20) + '88ac';
      const parent = { version: 2, locktime: 0, inputs: [{ outpointTransactionHash: new Uint8Array(32).fill(9), outpointIndex: 0, sequenceNumber: 0xffffffff, unlockingBytecode: Uint8Array.of(0) }],
        outputs: Array.from({ length: inputs }, () => ({ valueSatoshis: funding, lockingBytecode: hexToBin(owner), ...(['token', 'nft'].includes(defect) ? { token: { category: new Uint8Array(32).fill(4), amount: 1n, ...(defect === 'nft' ? { nft: { capability: 'none', commitment: new Uint8Array() } } : {}) } } : {}) })) };
      const raw = binToHex(encodeTransaction(parent)), id = hashTransaction(hexToBin(raw)), now = 1800000000000;
      const input = { intent: { network, expiresAt: now + 60000, maxFeeSatoshis: maxFee, ownerScripts: [defect === 'unknown-owner' ? recipient(0) : owner], recipients: Array.from({ length: recipients }, (_, i) => ({ script: recipient(i), satoshis: amount.toString() })) },
        snapshot: { network: defect === 'network' ? network === 'chipnet' ? 'mainnet' : 'chipnet' : network, observedAt: now - (defect === 'stale' ? 120001 : 0), parentTransactionHexes: defect === 'missing-parent' ? [] : [raw], unspentOutpoints: Array.from({ length: inputs }, (_, i) => id + ':' + i) },
        selectedInputs: Array.from({ length: inputs }, (_, index) => ({ txid: id, index })), changeScript: owner, now,
        feePolicy: { signatureModel: 'compressed-p2pkh-schnorr', targetSatoshisPer1000Bytes: '1000', maxSatoshisPer1000Bytes: '3000', allowBchDustToFee: false } };
      const plan = builder(input);
      if (defect !== 'none' || amount < 546n) assert.equal(plan.status, 'REJECTED', JSON.stringify({ cases, defect, issue: plan.issue }));
      if (plan.status !== 'BUILT_OFFLINE') continue;
      accepted++;
      const tx = decodeTransaction(hexToBin(plan.unsignedHex)); assert.notEqual(typeof tx, 'string');
      assert.equal(tx.version, 2); assert.equal(tx.locktime, 0); assert.equal(tx.inputs.length, inputs);
      assert.ok(tx.inputs.every((i, index) => i.unlockingBytecode.length === 0 && i.sequenceNumber === 0xffffffff && binToHex(i.outpointTransactionHash) === id && i.outpointIndex === index));
      for (let i = 0; i < recipients; i++) assert.deepEqual({ script: binToHex(tx.outputs[i].lockingBytecode), value: tx.outputs[i].valueSatoshis }, { script: recipient(i), value: amount }, 'recipient mismatch: ' + plan.unsignedHex);
      assert.ok(tx.outputs.slice(recipients).every(o => binToHex(o.lockingBytecode) === owner && !o.token));
      assert.ok(tx.outputs.every(o => o.valueSatoshis >= 546n && !o.token));
      const fee = BigInt(inputs) * funding - tx.outputs.reduce((n, o) => n + o.valueSatoshis, 0n);
      assert.equal(fee.toString(), plan.feeSatoshis); assert.ok(fee <= BigInt(maxFee));
      assert.ok(fee * 1000n <= 3000n * BigInt(plan.estimatedSignedBytes.minimum));
      assert.equal(plan.broadcastable, false);
    }
  assert.ok(accepted > 0, 'No valid construction path exercised');
  return { cases, accepted };
}
try {
  const baseline = sweep(await load(original, 'baseline'));
  const target = 'r.unsignedHex = unsignedHex;';
  assert.equal(original.split(target).length, 2, 'Mutation anchor changed: inspect current builder');
  const broken = original.replace(target, 'r.unsignedHex = (() => { const corrupted = decode(unsignedHex); corrupted.outputs[0]!.valueSatoshis += 1n; return binToHex(encodeTransaction(corrupted)); })();');
  let negative;
  try { sweep(await load(broken, 'broken')); throw Error('NEGATIVE_CONTROL_MISSED'); }
  catch (error) { if (error.message === 'NEGATIVE_CONTROL_MISSED') throw error; negative = { detected: true, code: error.code, counterexample: error.message }; }
  const restored = sweep(await load(original, 'restored'));
  const after = await Promise.all(sources.map(async file => ({ file, sha256: hash(await readFile(file)) })));
  assert.deepEqual(after, before);
  const evidence = { kind: 'FINITE_ACTUAL_BUILDER_CHECK', baseline, negative, restored, before, after, candidateSourceUnchanged: true,
    sourceAnchors: ['buildUnsignedPlan', 'verifyCandidate'], bounds: '1/2 inputs;1/2 recipients;545/546/1000sat;546/1000/10000sat per input;fee cap0/219/600;two network labels;seven evidence/token/ownership cases',
    exclusions: ['unbounded JavaScript/amounts', 'cryptography', 'SDK side effects', 'browser', 'consensus', 'filesystem hardware durability'] };
  await writeFile(join(destination, 'builder.json'), JSON.stringify(evidence, null, 2) + '\n'); console.log(JSON.stringify(evidence, null, 2));
} finally { await rm(scratch, { recursive: true }); }
