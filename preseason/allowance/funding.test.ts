import assert from 'node:assert/strict';
import { test } from 'node:test';
import { binToHex, encodeTransaction } from '@bitauth/libauth';
import { AUTHORITY } from './template.js';
import { syntheticCase } from './lab.js';
import { inspectSyntheticFunding, MAX_SYNTHETIC_PARENT_BYTES } from './funding.js';
const config = { payoutSatoshis: '1000', delayBlocks: 6 };
function request(n = 3, p = config) {
  return { parentTransactionHex: binToHex(encodeTransaction(syntheticCase(p, n).parent)), outputIndex: 0, parameters: p, plannedTranches: n, policy: { feeSatPerKb: '1000', dustRelayFeeSatPerKb: '1000' } };
}
test('full bounded parent-bound depletion, boundary parameters and fixed cumulative economics', () => {
  for (const n of [1, 2, 100]) for (const p of [config, { payoutSatoshis: '546', delayBlocks: 1 }, { payoutSatoshis: '1000000000', delayBlocks: 65535 }]) {
    const r = inspectSyntheticFunding(request(n, p));
    assert.equal(r.status, 'SYNTHETIC_CONTINUATION_VERIFIED');
    assert.equal(r.metrics!.verifiedSteps, n); assert.equal(r.metrics!.totalFeeSatoshis, String(n * 1000));
    assert.equal(r.metrics!.totalPaidSatoshis, String(BigInt(n) * BigInt(p.payoutSatoshis)));
    assert.equal(r.metrics!.remainingReserveSatoshis, '0');
    assert(r.metrics!.minimumSerializedBytes > 0); assert(r.metrics!.maximumSerializedBytes < 1000);
    assert.equal(BigInt(r.metrics!.totalPaidSatoshis) + BigInt(r.metrics!.totalFeeSatoshis), BigInt(r.metrics!.initialSatoshis));
  }
});
test('selected nonzero index is spent, other outputs are not mistaken for selected principal', () => {
  const c = syntheticCase(config, 3), r = request();
  c.parent.outputs.unshift({ valueSatoshis: 999999n, lockingBytecode: new Uint8Array([0x51]) });
  r.parentTransactionHex = binToHex(encodeTransaction(c.parent)); r.outputIndex = 1;
  assert.equal(inspectSyntheticFunding(r).status, 'SYNTHETIC_CONTINUATION_VERIFIED');
  r.outputIndex = 0; assert.equal(inspectSyntheticFunding(r).status, 'OUTPUT_MISMATCH');
  r.outputIndex = 2; assert.equal(inspectSyntheticFunding(r).issue, 'OUTPUT_INDEX_MISSING');
});
test('valid excess and short funding are intent mismatch, invalid funding is no release path', () => {
  for (const n of [2, 4]) assert.equal(inspectSyntheticFunding({ ...request(n), plannedTranches: 3 }).status, 'PLAN_MISMATCH');
  for (const value of [0n, 1n, 1999n, 2001n, 202000n, 202001n]) {
    const c = syntheticCase(config, 3); c.parent.outputs[0]!.valueSatoshis = value;
    const result = inspectSyntheticFunding({ ...request(), parentTransactionHex: binToHex(encodeTransaction(c.parent)) });
    assert.equal(result.status, 'CONTRACT_REJECTED'); assert.equal(result.issue, 'AMOUNT_HAS_NO_RELEASE_PATH');
  }
});
test('different covenant/script is unsupported, actual FT and NFT funding has no release path', () => {
  for (const p of [{ ...config, payoutSatoshis: '1001' }, { ...config, delayBlocks: 7 }]) assert.equal(inspectSyntheticFunding({ ...request(3, p), parameters: config }).status, 'OUTPUT_MISMATCH');
  for (const kind of ['ft', 'none', 'mutable', 'minting'] as const) {
    const c = syntheticCase(config, 3);
    c.parent.outputs[0]!.token = { category: new Uint8Array(32).fill(0x44), amount: kind === 'ft' ? 1n : 0n, ...(kind === 'ft' ? {} : { nft: { capability: kind, commitment: new Uint8Array([1]) } }) };
    assert.equal(inspectSyntheticFunding({ ...request(), parentTransactionHex: binToHex(encodeTransaction(c.parent)) }).issue, 'TOKEN_FUNDING_HAS_NO_RELEASE_PATH');
  }
});
test('strict plain descriptors, numeric bounds, unknown fields and malformed raw encodings reject', () => {
  let getterCalled = false;
  const accessor = Object.defineProperty(request(), 'outputIndex', { get() { getterCalled = true; return 0; }, enumerable: true });
  const bad: unknown[] = [null, [], {}, Object.create(request()), { ...request(), extra: true }, { ...request(), [Symbol('x')]: true }, accessor];
  for (const index of [-0, -1, 0.5, NaN, Infinity, '0', 0x100000000]) bad.push({ ...request(), outputIndex: index });
  for (const n of [0, 101, 1.5, '3', NaN]) bad.push({ ...request(), plannedTranches: n });
  for (const hex of ['', '0', 'xx', '00', request().parentTransactionHex + '00', request().parentTransactionHex.slice(0, -2), '00'.repeat(MAX_SYNTHETIC_PARENT_BYTES + 1)]) bad.push({ ...request(), parentTransactionHex: hex });
  for (const s of ['0', '-1', '01', '1.0', '1e3', '1000001', ' 1000', 1000]) bad.push({ ...request(), policy: { feeSatPerKb: s, dustRelayFeeSatPerKb: '1000' } });
  bad.push({ ...request(), policy: { ...request().policy, extra: 1 } });
  bad.push({ ...request(), parameters: { ...config, extra: 1 } });
  // Non-minimal CompactSize for the parent's single input.
  const hex = request().parentTransactionHex;
  bad.push({ ...request(), parentTransactionHex: hex.slice(0, 8) + 'fd0100' + hex.slice(10) });
  for (const value of bad) assert.equal(inspectSyntheticFunding(value).status, 'INPUT_REJECTED');
  assert.equal(getterCalled, false);
  assert.equal(inspectSyntheticFunding({ ...request(), parentTransactionHex: request().parentTransactionHex.toUpperCase() }).status, 'SYNTHETIC_CONTINUATION_VERIFIED');
});
test('explicit policy checks all steps with exact ceil fees and actual serialized-output dust', () => {
  const base = inspectSyntheticFunding(request());
  const fee = inspectSyntheticFunding({ ...request(), policy: { feeSatPerKb: '1000000', dustRelayFeeSatPerKb: '1' } });
  assert.equal(fee.status, 'LOCAL_POLICY_REJECTED'); assert.equal(fee.metrics!.verifiedSteps, 3); assert.equal(fee.metrics!.feeFailingSteps, 3);
  assert.equal(fee.metrics!.minimumFeeHeadroomSatoshis, String(1000 - fee.metrics!.maximumSerializedBytes * 1000));
  const rate = Math.floor(1000000 / base.metrics!.maximumSerializedBytes);
  for (const [r, passes] of [[rate, true], [rate + 1, false]] as const) {
    const result = inspectSyntheticFunding({ ...request(), policy: { feeSatPerKb: String(r), dustRelayFeeSatPerKb: '1' } });
    assert.equal(result.metrics!.feeFailingSteps === 0, passes);
    assert.equal(result.metrics!.minimumFeeHeadroomSatoshis, String(1000 - Math.ceil(base.metrics!.maximumSerializedBytes * r / 1000)));
  }
  const dust = inspectSyntheticFunding({ ...request(3, { payoutSatoshis: '546', delayBlocks: 1 }), policy: { feeSatPerKb: '1', dustRelayFeeSatPerKb: '2000' } });
  assert.equal(dust.status, 'LOCAL_POLICY_REJECTED'); assert.equal(dust.metrics!.dustFailingSteps, 3);
  assert.equal(dust.metrics!.maximumPayoutDustThresholdSatoshis, '1092'); assert.equal(dust.metrics!.maximumReserveDustThresholdSatoshis, '1152');
  assert.equal(inspectSyntheticFunding({ ...request(), policy: { feeSatPerKb: '1', dustRelayFeeSatPerKb: '1' } }).status, 'SYNTHETIC_CONTINUATION_VERIFIED');
});
test('bounded frozen summary never exports bytes, scripts, addresses or authority', () => {
  for (const value of [request(), {}, { ...request(), plannedTranches: 2 }, { ...request(), policy: { feeSatPerKb: '1000000', dustRelayFeeSatPerKb: '1000000' } }]) {
    const result = inspectSyntheticFunding(value);
    assert(Object.isFrozen(result)); assert(Object.isFrozen(result.limits));
    if (result.metrics) assert(Object.isFrozen(result.metrics)); if (result.policy) assert(Object.isFrozen(result.policy));
    for (const key of Object.keys(AUTHORITY) as (keyof typeof AUTHORITY)[]) assert.equal(result[key], false);
    const json = JSON.stringify(result); assert(json.length < 4000); assert(!json.includes(request().parentTransactionHex));
    assert(!/[0-9a-f]{64}/i.test(json)); assert(!json.includes('bitcoincash:')); assert(!json.includes('serializedTransaction'));
  }
});

test('initial selected covenant output dust is checked independently of successor payout', () => {
  const r = inspectSyntheticFunding({ ...request(1, { payoutSatoshis: '550000', delayBlocks: 6 }), policy: { feeSatPerKb: '1000', dustRelayFeeSatPerKb: '1000000' } });
  assert.equal(r.status, 'LOCAL_POLICY_REJECTED'); assert.equal(r.metrics!.sourceBelowDust, true);
  assert.equal(r.metrics!.sourceDustThresholdSatoshis, '576000'); assert.equal(r.metrics!.dustFailingSteps, 0);
});
