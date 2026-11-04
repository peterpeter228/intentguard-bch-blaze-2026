/** Synthetic offline serialization only. No signatures, wallet calls or network. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { binToHex, hexToBin, encodeTransaction, decodeTransaction, hashTransaction, type Transaction } from '@bitauth/libauth';
import { fixture, owner, merchant } from './fixtures.js';
import { verifyCandidate } from './guard.js';
import { buildUnsignedPlan, type UnsignedBuildInput } from './unsigned-builder.js';
function setup(token = false) {
  const f = fixture(token);
  const input: UnsignedBuildInput = { intent: f.input.intent, snapshot: f.input.snapshot, now: f.input.now, selectedInputs: [{ txid: hashTransaction(encodeTransaction(f.parent)), index: 0 }], changeScript: owner, feePolicy: { targetSatoshisPer1000Bytes: '1000', maxSatoshisPer1000Bytes: '3000', signatureModel: 'compressed-p2pkh-schnorr', allowBchDustToFee: false } };
  function replaceParent(parent: Transaction, indices = [0]): void {
    const raw = binToHex(encodeTransaction(parent)); const txid = hashTransaction(encodeTransaction(parent));
    input.snapshot.parentTransactionHexes = [raw]; input.snapshot.unspentOutpoints = parent.outputs.map((_o, i) => `${txid}:${i}`); input.selectedInputs = indices.map(index => ({ txid, index }));
  }
  return { input, parent: f.parent, replaceParent };
}
function decoded(raw: string): Transaction { const tx = decodeTransaction(hexToBin(raw)); if (typeof tx === 'string') throw Error(tx); return tx; }
function rejected(input: UnsignedBuildInput, expected: string): void { const r = buildUnsignedPlan(input); assert.equal(r.status, 'REJECTED'); assert.equal(r.issue, expected); assert.equal(r.unsignedHex, null); assert.equal(r.planDigest, null); assert.equal(r.canSign, false); assert.equal(r.broadcastable, false); }

test('BCH plan uses exact recipient order, explicit selected input, empty unlocks and independent Guard recomparison', () => {
  const { input } = setup(); const before = JSON.stringify(input); const r = buildUnsignedPlan(input);
  assert.equal(r.status, 'BUILT_OFFLINE', r.issue ?? ''); assert.equal(r.canSign, false); assert.equal(r.broadcastable, false); assert.equal(r.receiptValid, false);
  assert.equal(r.feeSatoshis, '219'); assert.equal(r.budgetFeeSatoshis, '219'); assert.equal(r.donatedRemainderSatoshis, '0');
  assert.deepEqual(r.estimatedSignedBytes, { minimum: 219, maximum: 219, signatureModel: 'compressed-p2pkh-schnorr' });
  assert.deepEqual(r.outputSummary.map(o => [o.role, o.satoshis]), [['recipient', '1000'], ['bch-change', '8781']]);
  const tx = decoded(r.unsignedHex!); assert.equal(tx.version, 2); assert.equal(tx.locktime, 0); assert.equal(tx.inputs.length, 1); assert.equal(tx.inputs[0]?.unlockingBytecode.length, 0); assert.equal(tx.inputs[0]?.sequenceNumber, 0xffffffff);
  assert.equal(verifyCandidate({ intent: input.intent, snapshot: input.snapshot, now: input.now, candidateHex: r.unsignedHex! }).status, 'MATCH_OFFLINE');
  assert.equal(r.selectedInputs[0]?.sourceOutput.satoshis, '10000'); assert.match(r.planDigest!, /^[0-9a-f]{64}$/); assert.equal(JSON.stringify(input), before);
});

test('deterministic outpoint sorting ignores caller and parent order without consuming extra UTXOs', () => {
  const s = setup(); const second = structuredClone(s.parent); second.inputs[0]!.outpointIndex = 42; second.outputs.push(structuredClone(second.outputs[0]!));
  const firstId = s.input.selectedInputs[0]!.txid; const secondId = hashTransaction(encodeTransaction(second));
  s.input.snapshot.parentTransactionHexes.push(binToHex(encodeTransaction(second))); s.input.snapshot.unspentOutpoints.push(secondId + ':0', secondId + ':1');
  s.input.selectedInputs = [{ txid: secondId, index: 1 }, { txid: firstId, index: 0 }]; s.input.intent.maxFeeSatoshis = '3000';
  const first = buildUnsignedPlan(s.input); assert.equal(first.status, 'BUILT_OFFLINE', first.issue ?? '');
  s.input.selectedInputs = [...s.input.selectedInputs].reverse(); s.input.snapshot.parentTransactionHexes.reverse(); s.input.snapshot.unspentOutpoints.reverse();
  const secondPlan = buildUnsignedPlan(s.input); assert.equal(secondPlan.unsignedHex, first.unsignedHex); assert.equal(secondPlan.planDigest, first.planDigest);
  assert.equal(decoded(first.unsignedHex!).inputs.length, 2); assert.equal(first.selectedInputs.reduce((sum, p) => sum + BigInt(p.sourceOutput.satoshis), 0n), 20000n);
  assert.deepEqual(first.selectedInputs.map(o => o.txid), [firstId, secondId].sort());
});

test('fungible change preserves every token and uses token-aware BCH carrier dust', () => {
  const { input } = setup(true); const r = buildUnsignedPlan(input); assert.equal(r.status, 'BUILT_OFFLINE', r.issue ?? '');
  assert.deepEqual(r.outputSummary.map(o => o.role), ['recipient', 'token-change', 'bch-change']);
  assert.equal(r.outputSummary[0]?.token?.amount, '100'); assert.equal(r.outputSummary[1]?.token?.amount, '400'); assert.equal(r.outputSummary[1]?.satoshis, '657');
  assert.equal(r.selectedInputs[0]?.sourceOutput.token?.amount, '500'); assert.equal(r.guard?.status, 'MATCH_OFFLINE');
});

test('token change CompactSize boundaries affect exact dust and fee sizes', () => {
  for (const [remaining, dust] of [[252n, 651n], [253n, 657n], [65535n, 657n], [65536n, 663n]]) {
    const s = setup(true); s.parent.outputs[0]!.token!.amount = remaining! + 100n; s.replaceParent(s.parent);
    const r = buildUnsignedPlan(s.input); assert.equal(r.status, 'BUILT_OFFLINE', r.issue ?? '');
    assert.equal(r.outputSummary[1]?.token?.amount, remaining!.toString()); assert.equal(r.outputSummary[1]?.satoshis, dust!.toString());
    assert.equal(Number(r.feeSatoshis), decoded(r.unsignedHex!).inputs.length * 100 + r.unsignedHex!.length / 2);
  }
});

test('multiple categories return deterministic category-sorted change and unchanged recipient order', () => {
  const s = setup(true); const categoryA = '11'.repeat(32), categoryZ = 'ee'.repeat(32);
  s.parent.outputs[0]!.token!.category = hexToBin(categoryZ); const other = structuredClone(s.parent.outputs[0]!); other.token!.category = hexToBin(categoryA); s.parent.outputs.push(other); s.replaceParent(s.parent, [1, 0]);
  s.input.intent.recipients = [{ script: merchant, satoshis: '1000', token: { category: categoryZ, amount: '100' } }, { script: merchant, satoshis: '1000', token: { category: categoryA, amount: '100' } }]; s.input.intent.maxFeeSatoshis = '5000';
  const r = buildUnsignedPlan(s.input); assert.equal(r.status, 'BUILT_OFFLINE', r.issue ?? '');
  assert.deepEqual(r.outputSummary.filter(o => o.role === 'recipient').map(o => o.token?.category), [categoryZ, categoryA]);
  assert.deepEqual(r.outputSummary.filter(o => o.role === 'token-change').map(o => o.token?.category), [categoryA, categoryZ]);
  assert.deepEqual(r.selectedInputs.map(o => o.index), [0, 1]);
});

test('recipient dust equality passes and dust-minus-one fails, using full token serialization', () => {
  for (const [token, threshold] of [[false, '546'], [true, '651']] as const) {
    const s = setup(token); s.input.intent.recipients[0]!.satoshis = threshold;
    assert.equal(buildUnsignedPlan(s.input).status, 'BUILT_OFFLINE'); s.input.intent.recipients[0]!.satoshis = (BigInt(threshold) - 1n).toString();
    rejected(s.input, token ? 'DUST_RECIPIENT' : 'INVALID_RECIPIENT');
  }
});

test('exact-token payment omits zero-token change rather than encoding or burning it', () => {
  const s = setup(true); s.input.intent.recipients[0]!.token!.amount = '500'; const r = buildUnsignedPlan(s.input);
  assert.equal(r.status, 'BUILT_OFFLINE', r.issue ?? ''); assert.deepEqual(r.outputSummary.map(o => o.role), ['recipient', 'bch-change']);
});

test('insufficient token quantity or BCH carrier funding never burns token change', () => {
  const s = setup(true); s.input.intent.recipients[0]!.token!.amount = '501'; rejected(s.input, 'INSUFFICIENT_TOKEN');
  s.input.intent.recipients[0]!.token!.amount = '100'; s.input.intent.recipients[0]!.satoshis = '651'; s.parent.outputs[0]!.valueSatoshis = 1000n; s.replaceParent(s.parent); s.input.feePolicy.allowBchDustToFee = true; rejected(s.input, 'INSUFFICIENT_BCH');
});

test('BCH change dust threshold and narrowly authorized donation boundaries', () => {
  const s = setup(); s.input.intent.maxFeeSatoshis = '1000'; s.parent.outputs[0]!.valueSatoshis = 1765n; s.replaceParent(s.parent);
  const exact = buildUnsignedPlan(s.input); assert.equal(exact.status, 'BUILT_OFFLINE'); assert.equal(exact.outputSummary[1]?.satoshis, '546');
  s.parent.outputs[0]!.valueSatoshis = 1764n; s.replaceParent(s.parent); rejected(s.input, 'BCH_CHANGE_REQUIRES_DONATION');
  s.input.feePolicy.allowBchDustToFee = true; s.input.feePolicy.maxSatoshisPer1000Bytes = '5000'; rejected(s.input, 'BCH_REMAINDER_NOT_DUST');
  // No-change fee budget185: donation545 is dust; donation546 is not.
  s.parent.outputs[0]!.valueSatoshis = 1730n; s.replaceParent(s.parent); const donated = buildUnsignedPlan(s.input);
  assert.equal(donated.status, 'BUILT_OFFLINE', donated.issue ?? ''); assert.equal(donated.outputSummary.length, 1); assert.equal(donated.feeSatoshis, '730'); assert.equal(donated.budgetFeeSatoshis, '185'); assert.equal(donated.donatedRemainderSatoshis, '545');
  s.input.intent.maxFeeSatoshis = '729'; rejected(s.input, 'FEE_LIMIT'); s.input.intent.maxFeeSatoshis = '1000'; s.input.feePolicy.maxSatoshisPer1000Bytes = '3945'; rejected(s.input, 'FEE_RATE_LIMIT');
  s.input.feePolicy.maxSatoshisPer1000Bytes = '3946'; assert.equal(buildUnsignedPlan(s.input).status, 'BUILT_OFFLINE');
  s.parent.outputs[0]!.valueSatoshis = 1731n; s.replaceParent(s.parent); rejected(s.input, 'BCH_REMAINDER_NOT_DUST');
});

test('high fee rates cannot convert a non-dust uneconomic remainder into dust-only consent', () => {
  const s = setup(); s.parent.outputs[0]!.valueSatoshis = 110000n; s.replaceParent(s.parent);
  s.input.intent.maxFeeSatoshis = '109000'; s.input.feePolicy = { signatureModel: 'compressed-p2pkh-schnorr', targetSatoshisPer1000Bytes: '500000', maxSatoshisPer1000Bytes: '1000000', allowBchDustToFee: true };
  rejected(s.input, 'BCH_REMAINDER_NOT_DUST');
});

test('exact no-change budget succeeds without donation; one satoshi below fails', () => {
  const s = setup(); s.parent.outputs[0]!.valueSatoshis = 1185n; s.replaceParent(s.parent); const exact = buildUnsignedPlan(s.input);
  assert.equal(exact.status, 'BUILT_OFFLINE'); assert.equal(exact.feeSatoshis, '185'); assert.equal(exact.donatedRemainderSatoshis, '0'); assert.equal(exact.outputSummary.length, 1);
  s.parent.outputs[0]!.valueSatoshis = 1184n; s.replaceParent(s.parent); rejected(s.input, 'INSUFFICIENT_BCH');
});

test('absolute cap is inclusive and target rounding uses bigint ceiling', () => {
  const s = setup(); s.input.intent.maxFeeSatoshis = '219'; assert.equal(buildUnsignedPlan(s.input).status, 'BUILT_OFFLINE');
  s.input.intent.maxFeeSatoshis = '218'; rejected(s.input, 'FEE_LIMIT'); s.input.intent.maxFeeSatoshis = '600';
  s.input.feePolicy.targetSatoshisPer1000Bytes = '1001'; s.input.feePolicy.maxSatoshisPer1000Bytes = '1005'; const r = buildUnsignedPlan(s.input);
  assert.equal(r.status, 'BUILT_OFFLINE'); assert.equal(r.feeSatoshis, '220');
  s.input.feePolicy.maxSatoshisPer1000Bytes = '1004'; rejected(s.input, 'FEE_RATE_LIMIT');
});

test('Schnorr rate ceiling is inclusive; low-S ECDSA cap uses minimum size, not maximum', () => {
  const s = setup(); s.input.feePolicy.maxSatoshisPer1000Bytes = '1000'; assert.equal(buildUnsignedPlan(s.input).status, 'BUILT_OFFLINE');
  s.input.feePolicy.signatureModel = 'compressed-p2pkh-low-s-ecdsa'; rejected(s.input, 'FEE_RATE_LIMIT');
  s.input.feePolicy.maxSatoshisPer1000Bytes = '1387'; const r = buildUnsignedPlan(s.input); assert.equal(r.status, 'BUILT_OFFLINE'); assert.equal(r.feeSatoshis, '226');
  assert.deepEqual(r.estimatedSignedBytes, { minimum: 163, maximum: 226, signatureModel: 'compressed-p2pkh-low-s-ecdsa' });
  assert.deepEqual(r.feeRateBounds, { unit: 'satoshis-per-1000-bytes', minimum: { numerator: '226000', denominator: '226' }, maximum: { numerator: '226000', denominator: '163' } });
  assert.equal(decoded(r.unsignedHex!).inputs[0]?.unlockingBytecode.length, 0);
  s.input.feePolicy.maxSatoshisPer1000Bytes = '1386'; rejected(s.input, 'FEE_RATE_LIMIT');
});

test('plan digest binds fee policy even when transaction bytes are unchanged', () => {
  const s = setup(); const a = buildUnsignedPlan(s.input); s.input.feePolicy.maxSatoshisPer1000Bytes = '4000'; const b = buildUnsignedPlan(s.input);
  assert.equal(a.unsignedHex, b.unsignedHex); assert.notEqual(a.planDigest, b.planDigest);
});

test('NFT, undeclared category and missing token inputs are rejected without mint or burn', () => {
  const s = setup(true); s.parent.outputs[0]!.token!.nft = { capability: 'none', commitment: new Uint8Array() }; s.replaceParent(s.parent); rejected(s.input, 'NFT_UNSUPPORTED');
  const undeclared = setup(true); delete undeclared.input.intent.recipients[0]!.token; rejected(undeclared.input, 'UNDECLARED_TOKEN');
  const mint = setup(false); mint.input.intent.recipients[0]!.token = { category: 'ab'.repeat(32), amount: '1' }; rejected(mint.input, 'INSUFFICIENT_TOKEN');
});

test('selected prevouts must be unique, present, hash-bound and claimed owner/unspent', () => {
  const duplicate = setup(); duplicate.input.selectedInputs = [...duplicate.input.selectedInputs, ...duplicate.input.selectedInputs]; rejected(duplicate.input, 'DUPLICATE_INPUT');
  const spent = setup(); spent.input.snapshot.unspentOutpoints = []; rejected(spent.input, 'MISSING_OR_SPENT_PREVOUT');
  const unknown = setup(); unknown.parent.outputs[0]!.lockingBytecode = hexToBin(merchant); unknown.replaceParent(unknown.parent); rejected(unknown.input, 'UNCONFIRMED_INPUT_OWNER');
  const mismatch = setup(); mismatch.parent.outputs[0]!.valueSatoshis++; mismatch.input.snapshot.parentTransactionHexes = [binToHex(encodeTransaction(mismatch.parent))]; rejected(mismatch.input, 'MISSING_OR_SPENT_PREVOUT');
  const parents = setup(); parents.input.snapshot.parentTransactionHexes.push(parents.input.snapshot.parentTransactionHexes[0]!); rejected(parents.input, 'DUPLICATE_PARENT');
});

test('schema rejects unknown fields, numeric amounts, unsupported models and invalid rates', () => {
  for (const patch of [{ targetSatoshisPer1000Bytes: '0' }, { targetSatoshisPer1000Bytes: '1.5' }, { targetSatoshisPer1000Bytes: 1000 }, { maxSatoshisPer1000Bytes: '1000001' }, { maxSatoshisPer1000Bytes: '999' }, { signatureModel: 'uncompressed-key' }, { allowBchDustToFee: 'yes' }, { skipChecks: true }]) {
    const { input } = setup(); const r = Reflect.apply(buildUnsignedPlan, undefined, [{ ...input, feePolicy: { ...input.feePolicy, ...patch } }]); assert.equal(r.status, 'REJECTED'); assert.equal(r.unsignedHex, null);
  }
  const { input } = setup(); for (const obj of [{ ...input, trusted: true }, { ...input, intent: { ...input.intent, approved: true } }, { ...input, snapshot: { ...input.snapshot, authenticated: true } }, { ...input, selectedInputs: [{ ...input.selectedInputs[0], signed: true }] }]) assert.equal(Reflect.apply(buildUnsignedPlan, undefined, [obj]).issue, 'INVALID_BUILD_SCHEMA');
});

test('expired, stale, wrong-network and unconfirmed-change inputs cannot build', () => {
  const expired = setup(); expired.input.now = expired.input.intent.expiresAt; rejected(expired.input, 'INTENT_EXPIRED');
  const stale = setup(); stale.input.snapshot.observedAt -= 120001; rejected(stale.input, 'STALE_OR_INVALID_SNAPSHOT');
  const network = setup(); network.input.snapshot.network = 'mainnet'; rejected(network.input, 'NETWORK_MISMATCH');
  const change = setup(); change.input.changeScript = merchant; rejected(change.input, 'INVALID_CHANGE_SCRIPT');
});

test('input and aggregate parent budgets are bounded before decoding', () => {
  const many = setup(); many.input.selectedInputs = Array.from({ length: 21 }, () => many.input.selectedInputs[0]!); rejected(many.input, 'INVALID_SELECTION');
  const parents = setup(); parents.input.snapshot.parentTransactionHexes = Array.from({ length: 21 }, () => '00'); rejected(parents.input, 'INVALID_SNAPSHOT');
  const huge = setup(); huge.input.snapshot.parentTransactionHexes = ['00'.repeat(100000), '00'.repeat(100000), '00'.repeat(50001)]; rejected(huge.input, 'INVALID_SNAPSHOT');
});

test('maximum supported 20-category plan has bounded 41 outputs and conserves all tokens', () => {
  const s = setup(true); s.parent.outputs = Array.from({ length: 20 }, (_, i) => ({ valueSatoshis: 10000n, lockingBytecode: hexToBin(owner), token: { category: new Uint8Array(32).fill(i + 1), amount: 500n } }));
  s.replaceParent(s.parent, Array.from({ length: 20 }, (_, i) => 19 - i));
  s.input.intent.recipients = s.parent.outputs.map(o => ({ script: merchant, satoshis: '1000', token: { category: binToHex(o.token!.category), amount: '100' } })); s.input.intent.maxFeeSatoshis = '20000';
  const r = buildUnsignedPlan(s.input); assert.equal(r.status, 'BUILT_OFFLINE', r.issue ?? ''); assert.equal(r.outputSummary.length, 41); assert.equal(r.selectedInputs.length, 20); assert.equal(r.guard?.status, 'MATCH_OFFLINE');
  assert(r.estimatedSignedBytes!.maximum < 100000); assert(r.outputSummary.filter(o => o.role === 'token-change').every(o => o.token?.amount === '400'));
});
