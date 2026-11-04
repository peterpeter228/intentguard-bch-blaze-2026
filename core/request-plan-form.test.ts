/** UI adapter tests use explicit invented scenarios, not real funding or accounts. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { binToHex, encodeTransaction, decodeTransaction, hexToBin, hashTransaction, encodeCashAddress } from '@bitauth/libauth';
import { createPaymentRequestDraft } from './payment-request.js';
import { buildPaymentRequestPlan } from './request-plan.js';
import { contextFromFundingFields, parseUtcSecond, requestPlanSummary } from './request-plan-form.js';
import { syntheticRequestPlanningExample } from './request-plan-examples.js';
const now = 1800000000123;
function run(token = false) { const sample = syntheticRequestPlanningExample(token, now); const draft = createPaymentRequestDraft(sample.request, now); assert.equal(draft.status, 'DRAFT_READY'); const context = contextFromFundingFields(sample.funding, sample.request.network); const result = buildPaymentRequestPlan(sample.request, draft.draft!.requestDigest, context, now); return { sample, draft, context, result }; }

test('complete examples explicitly fill separate fields and build without hand-written JSON or external state', () => {
  for (const token of [false, true]) {
    const { sample, context, result } = run(token); assert.equal(result.status, 'REQUEST_PLAN_BOUND_OFFLINE', result.builderIssue ?? result.issue ?? '');
    assert.equal(sample.request.network, 'chipnet'); assert.match(sample.request.requestId, /^synthetic-/); assert.equal(context.snapshot.observedAt, now - 123);
    assert.equal(sample.request.expiresAt, now - 123 + 600000); assert.equal(context.snapshot.parentTransactionHexes[0], sample.funding.parentHex);
    assert.deepEqual(context.selectedInputs, [{ txid: hashTransaction(hexToBin(sample.funding.parentHex)), index: 0 }]);
    for (const flag of ['canSign', 'broadcastable', 'receiptValid', 'networkVerified', 'ownershipVerified'] as const) assert.equal(result[flag], false);
  }
});

test('owner and change address decoding requires explicit checksum, network, P2PKH and original casing', () => {
  const { sample } = run(); const f = sample.funding;
  for (const ownerAddress of [f.ownerAddress.replace('bchtest:', 'Bchtest:'), f.ownerAddress.slice(0, -1) + 'q', f.ownerAddress.split(':')[1]!, ' ' + f.ownerAddress, encodeCashAddress({ prefix: 'bchtest', type: 'p2sh', payload: hexToBin('11'.repeat(20)) }).address]) assert.throws(() => contextFromFundingFields({ ...f, ownerAddress }, 'chipnet'), /FORM_FUNDING_ADDRESS/);
  assert.throws(() => contextFromFundingFields(f, 'mainnet'), /FORM_FUNDING_ADDRESS/);
  assert.deepEqual(contextFromFundingFields({ ...f, ownerAddress: f.ownerAddress.toUpperCase(), changeAddress: f.changeAddress.toUpperCase() }, 'chipnet'), contextFromFundingFields(f, 'chipnet'));
});

test('one declared owner cannot silently provide an alternate change script or mismatching input', () => {
  const { sample } = run(); const other = encodeCashAddress({ prefix: 'bchtest', type: 'p2pkh', payload: hexToBin('33'.repeat(20)) }).address;
  assert.throws(() => contextFromFundingFields({ ...sample.funding, changeAddress: other }, 'chipnet'), /FORM_CHANGE_OWNER_MISMATCH/);
  assert.throws(() => contextFromFundingFields({ ...sample.funding, ownerAddress: other, changeAddress: other }, 'chipnet'), /FORM_INPUT_OWNER_MISMATCH/);
});

test('source index is explicit canonical uint32 and must resolve to a real output in supplied bytes', () => {
  const { sample } = run();
  for (const outputIndex of ['-1', '+0', '00', '0.0', '1e0', ' 0', '4294967296']) assert.throws(() => contextFromFundingFields({ ...sample.funding, outputIndex }, 'chipnet'), /FORM_OUTPUT_INDEX/);
  assert.throws(() => contextFromFundingFields({ ...sample.funding, outputIndex: '1' }, 'chipnet'), /FORM_OUTPUT_MISSING/);
  assert.throws(() => contextFromFundingFields({ ...sample.funding, outputIndex: '4294967295' }, 'chipnet'), /FORM_OUTPUT_MISSING/);
});

test('parent source accepts bounded canonical raw bytes, never repaired hex or JSON', () => {
  const { sample } = run();
  for (const parentHex of ['', '00', 'AA', '0', ' '+sample.funding.parentHex, JSON.stringify({ raw: sample.funding.parentHex }), sample.funding.parentHex+'00', '00'.repeat(100001)]) assert.throws(() => contextFromFundingFields({ ...sample.funding, parentHex }, 'chipnet'), /FORM_PARENT_HEX/);
  const tx = decodeTransaction(hexToBin(sample.funding.parentHex)); if (typeof tx === 'string') throw Error(tx);
  tx.outputs[0]!.token = { amount: 0n, category: hexToBin('44'.repeat(32)), nft: { capability: 'none', commitment: new Uint8Array() } };
  assert.throws(() => contextFromFundingFields({ ...sample.funding, parentHex: binToHex(encodeTransaction(tx)) }, 'chipnet'), /FORM_NFT_UNSUPPORTED/);
});

test('observation time uses exact real UTC seconds and still must satisfy SDK freshness', () => {
  assert.equal(parseUtcSecond('2026-11-04T17:30:00Z'), Date.parse('2026-11-04T17:30:00Z'));
  for (const invalid of ['2026-11-04T17:30:00', '2026-11-04T17:30:00+00:00', '2026-11-04T17:30:00.000Z']) assert.throws(() => parseUtcSecond(invalid), /FORM_UTC_REQUIRED/);
  assert.throws(() => parseUtcSecond('2026-02-30T17:30:00Z'), /FORM_UTC_INVALID/);
  const { sample, draft } = run(); const stale = { ...sample.funding, observedAtUtc: new Date(now - 121000).toISOString().replace(/\.\d{3}Z$/, 'Z') };
  const r = buildPaymentRequestPlan(sample.request, draft.draft!.requestDigest, contextFromFundingFields(stale, 'chipnet'), now); assert.equal(r.status, 'REJECTED'); assert.equal(r.builderIssue, 'STALE_OR_INVALID_SNAPSHOT');
});

test('fee assumptions and donation are passed as explicit context, not request overrides', () => {
  const { sample, draft } = run(); const changed = { ...sample.funding, targetRate: '3000', maxRate: '3000', allowDustToFee: true };
  const context = contextFromFundingFields(changed, 'chipnet'); assert.equal(context.feePolicy.allowBchDustToFee, true); assert.equal(context.feePolicy.targetSatoshisPer1000Bytes, '3000');
  const r = buildPaymentRequestPlan(sample.request, draft.draft!.requestDigest, context, now); assert.equal(r.status, 'REJECTED'); assert.equal(r.builderIssue, 'FEE_LIMIT');
  assert.throws(() => contextFromFundingFields({ ...sample.funding, signatureModel: 'guaranteed-wallet' }, 'chipnet'), /FORM_SIGNATURE_MODEL/);
});

test('summary includes every output, precise token/category amounts, fees and all content bindings', () => {
  const { result } = run(true); const summary = requestPlanSummary(result, 'synthetic-example');
  assert.match(summary, /SYNTHETIC EXAMPLE: invented funding/); assert.match(summary, /Output 0 \(recipient\): 1000 satoshis/); assert.match(summary, /Output 1 \(token-change\): 657 satoshis/); assert.match(summary, /Output 2 \(bch-change\): 8018 satoshis/);
  assert.match(summary, /Token amount: 100 base units/); assert.match(summary, /Token amount: 400 base units/); assert.ok(summary.includes('44'.repeat(32))); assert.match(summary, /Transaction fee: 325 satoshis/);
  for (const value of Object.values(result.binding!)) if (typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)) assert.ok(summary.includes(value));
  assert.match(summary, /NOT APPROVED TO PAY/); assert.match(requestPlanSummary(result, 'supplied-offline'), /SUPPLIED OFFLINE CLAIMS/);
});

test('bad SDK results cannot render a stale successful summary', () => {
  const { sample, draft, context } = run(); const rejected = buildPaymentRequestPlan(sample.request, draft.draft!.requestDigest, context, sample.request.expiresAt);
  assert.equal(requestPlanSummary(rejected, 'synthetic-example'), 'No valid offline plan.');
});
