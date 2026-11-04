/** Synthetic offline end-to-end SDK consumers. No wallet, key, signature or network. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { binToHex, encodeTransaction, decodeTransaction, hexToBin, hashTransaction } from '@bitauth/libauth';
import { fixture, owner, stranger, category } from './fixtures.js';
import { createPaymentRequestDraft, type PaymentRequestWire } from './payment-request.js';
import { buildPaymentRequestPlan, type OfflineRequestPlanContext, type RequestPlanResult } from './request-plan.js';
import { verifyCandidate, validatedIntentDigest } from './guard.js';
const address = 'bchtest:qr7fzmep8g7h7ymfxy74lgc0v950j3r295pdnvy3hr';
const aware = 'bchtest:zr7fzmep8g7h7ymfxy74lgc0v950j3r295x8qj2hgs';
const recipientScript = '76a914fc916f213a3d7f1369313d5fa30f6168f9446a2d88ac';
function setup(token = false) {
  const f = fixture(token), now = f.input.now;
  const request: PaymentRequestWire = { schemaVersion: 1, kind: 'intentguard-payment-request', requestId: 'sdk-order-001', network: 'chipnet', expiresAt: f.input.intent.expiresAt, maxFeeBch: '0.000006', recipients: [{ address: token ? aware : address, bch: '0.00001', ...(token ? { token: { category, amountAtomic: '100' } } : {}) }] };
  const context: OfflineRequestPlanContext = { ownerScripts: [owner], changeScript: owner, snapshot: structuredClone(f.input.snapshot), selectedInputs: [{ txid: hashTransaction(encodeTransaction(f.parent)), index: 0 }], feePolicy: { targetSatoshisPer1000Bytes: '1000', maxSatoshisPer1000Bytes: '3000', signatureModel: 'compressed-p2pkh-schnorr', allowBchDustToFee: false } };
  return { request, context, now, parent: f.parent };
}
function digest(request: unknown, now: number): string { const r = createPaymentRequestDraft(request, now); assert.equal(r.status, 'DRAFT_READY', r.issue ?? ''); return r.draft!.requestDigest; }
function rejected(r: RequestPlanResult, issue: string, builderIssue: string | null = null): void {
  assert.equal(r.status, 'REJECTED'); assert.equal(r.issue, issue); assert.equal(r.builderIssue, builderIssue);
  assert.equal(r.plan, null); assert.equal(r.intent, null); assert.equal(r.binding, null); assert.equal(r.draft, null);
  for (const flag of ['canSign', 'broadcastable', 'receiptValid', 'networkVerified', 'ownershipVerified'] as const) assert.equal(r[flag], false);
}

test('BCH request maps exact terms and binds request, intent, candidate plan without authority', () => {
  const s = setup(); const original = JSON.stringify({ request: s.request, context: s.context, now: s.now }); const expected = digest(s.request, s.now);
  const r = buildPaymentRequestPlan(s.request, expected, s.context, s.now);
  assert.equal(r.status, 'REQUEST_PLAN_BOUND_OFFLINE', r.issue ?? ''); assert.equal(r.builderIssue, null);
  assert.deepEqual(r.intent, { network: 'chipnet', expiresAt: s.request.expiresAt, maxFeeSatoshis: '600', recipients: [{ script: recipientScript, satoshis: '1000' }], ownerScripts: [owner] });
  assert.equal(r.binding?.requestDigest, expected); assert.equal(r.binding?.intentDigest, validatedIntentDigest(structuredClone(r.intent!)));
  assert.equal(r.binding?.intentDigest, r.plan?.intentDigest); assert.equal(r.binding?.planDigest, r.plan?.planDigest); assert.equal(r.binding?.requestId, 'sdk-order-001'); assert.match(r.binding!.requestPlanDigest, /^[a-f0-9]{64}$/);
  assert.equal(r.plan?.feeSatoshis, '219'); assert.equal(r.plan?.guard?.status, 'MATCH_OFFLINE');
  const tx = decodeTransaction(hexToBin(r.plan!.unsignedHex!)); assert.notEqual(typeof tx, 'string'); if (typeof tx !== 'string') assert.ok(tx.inputs.every(i => i.unlockingBytecode.length === 0));
  assert.equal(verifyCandidate({ intent: structuredClone(r.intent!), snapshot: s.context.snapshot, candidateHex: r.plan!.unsignedHex!, now: s.now }).status, 'MATCH_OFFLINE');
  for (const flag of ['canSign', 'broadcastable', 'receiptValid', 'networkVerified', 'ownershipVerified'] as const) assert.equal(r[flag], false);
  assert.equal(JSON.stringify({ request: s.request, context: s.context, now: s.now }), original);
});

test('token-aware request preserves full category, base units and BCH carrier through builder and Guard', () => {
  const s = setup(true); const r = buildPaymentRequestPlan(s.request, digest(s.request, s.now), s.context, s.now);
  assert.equal(r.status, 'REQUEST_PLAN_BOUND_OFFLINE', r.issue ?? ''); assert.deepEqual(r.intent?.recipients, [{ script: recipientScript, satoshis: '1000', token: { category, amount: '100' } }]);
  assert.deepEqual(r.plan?.outputSummary.map(o => [o.role, o.satoshis, o.token?.amount]), [['recipient', '1000', '100'], ['token-change', '657', '400'], ['bch-change', '8018', undefined]]);
  assert.equal(r.plan?.feeSatoshis, '325'); assert.equal(r.plan?.guard?.status, 'MATCH_OFFLINE');
});

test('ordered multiple recipients are not merged and canonical text/decimal variants bind identically', () => {
  const s = setup(); const request = { ...s.request, recipients: [{ address, bch: '0.00001' }, { address: aware, bch: '0.00002' }] };
  const r = buildPaymentRequestPlan(JSON.stringify(request), digest(request, s.now), s.context, s.now); assert.equal(r.status, 'REQUEST_PLAN_BOUND_OFFLINE');
  assert.deepEqual(r.plan?.outputSummary.slice(0, 2).map(o => [o.script, o.satoshis]), [[recipientScript, '1000'], [recipientScript, '2000']]);
  const equivalent = { ...request, maxFeeBch: '0.00000600', recipients: [{ address: address.toUpperCase(), bch: '0.00001000' }, { address: aware, bch: '0.00002000' }] };
  const again = buildPaymentRequestPlan(equivalent, digest(request, s.now), s.context, s.now); assert.equal(again.binding?.requestPlanDigest, r.binding?.requestPlanDigest);
});

test('every semantic request edit after review is refused before planning', () => {
  const s = setup(); const expected = digest(s.request, s.now);
  for (const request of [{ ...s.request, requestId: 'new-order' }, { ...s.request, maxFeeBch: '0.000007' }, { ...s.request, expiresAt: s.request.expiresAt + 1 }, { ...s.request, recipients: [{ address, bch: '0.00002' }] }, { ...s.request, recipients: [{ address: aware, bch: '0.00001' }] }]) rejected(buildPaymentRequestPlan(request, expected, null, s.now), 'REQUEST_PLAN_REVIEW_CHANGED');
  rejected(buildPaymentRequestPlan(s.request, '', s.context, s.now), 'REQUEST_PLAN_REVIEW_DIGEST_REQUIRED');
  rejected(buildPaymentRequestPlan(s.request, 'aa'.repeat(32), s.context, s.now), 'REQUEST_PLAN_REVIEW_CHANGED');
  const t = setup(true); const edited = { ...t.request, recipients: [{ address: aware, bch: '0.00001', token: { category, amountAtomic: '101' } }] };
  rejected(buildPaymentRequestPlan(edited, digest(t.request, t.now), t.context, t.now), 'REQUEST_PLAN_REVIEW_CHANGED');
});

test('new request IDs change request binding even when the exact transaction plan is unchanged', () => {
  const s = setup(); const a = buildPaymentRequestPlan(s.request, digest(s.request, s.now), s.context, s.now); const second = { ...s.request, requestId: 'another-order' };
  const b = buildPaymentRequestPlan(second, digest(second, s.now), s.context, s.now);
  assert.equal(a.plan?.planDigest, b.plan?.planDigest); assert.equal(a.plan?.unsignedHex, b.plan?.unsignedHex); assert.notEqual(a.binding?.requestPlanDigest, b.binding?.requestPlanDigest);
  // This is correlation only, not unique receipt allocation or duplicate-payment protection.
});

test('request import never accepts derived fields, stored verdicts or duplicate decoded JSON keys', () => {
  const s = setup(); const expected = digest(s.request, s.now); const ready = createPaymentRequestDraft(s.request, s.now);
  for (const request of [{ ...s.request, ownerScripts: [owner] }, { ...s.request, confirmed: true }, { ...s.request, now: s.now }, { ...s.request, intent: {} }, ready.draft, buildPaymentRequestPlan(s.request, expected, s.context, s.now)]) rejected(buildPaymentRequestPlan(request, expected, s.context, s.now), 'REQUEST_INVALID_SCHEMA');
  rejected(buildPaymentRequestPlan(JSON.stringify(s.request).replace('"network":"chipnet"', '"network":"chipnet","network":"mainnet"'), expected, s.context, s.now), 'REQUEST_DUPLICATE_JSON_KEY');
  rejected(buildPaymentRequestPlan(' '.repeat(8193), expected, s.context, s.now), 'REQUEST_TOO_LARGE');
  rejected(buildPaymentRequestPlan('{', expected, s.context, s.now), 'REQUEST_INVALID_JSON');
});

test('trusted invocation time governs expiry and freshness; request or context cannot freeze time', () => {
  const s = setup(); const expected = digest(s.request, s.now);
  rejected(buildPaymentRequestPlan(s.request, expected, s.context, s.request.expiresAt), 'REQUEST_EXPIRED');
  rejected(buildPaymentRequestPlan(s.request, expected, s.context, NaN), 'REQUEST_INVALID_CLOCK');
  rejected(buildPaymentRequestPlan(s.request, expected, { ...s.context, now: s.now }, s.now), 'REQUEST_PLAN_INVALID_CONTEXT');
  s.context.snapshot.observedAt = s.now - 120001;
  rejected(buildPaymentRequestPlan(s.request, expected, s.context, s.now), 'REQUEST_PLAN_BUILD_REJECTED', 'STALE_OR_INVALID_SNAPSHOT');
  s.context.snapshot.observedAt = s.now + 1;
  rejected(buildPaymentRequestPlan(s.request, expected, s.context, s.now), 'REQUEST_PLAN_BUILD_REJECTED', 'STALE_OR_INVALID_SNAPSHOT');
});

test('missing context never gets teaching defaults and context cannot carry an alternate intent', () => {
  const s = setup(); const expected = digest(s.request, s.now);
  for (const context of [null, undefined]) rejected(buildPaymentRequestPlan(s.request, expected, context, s.now), 'REQUEST_PLAN_CONTEXT_REQUIRED');
  for (const extra of [{ intent: {} }, { requestId: 'replacement' }, { requestDigest: expected }, { canSign: true }, { networkVerified: true }, { endpoint: 'https://example.invalid' }]) rejected(buildPaymentRequestPlan(s.request, expected, { ...s.context, ...extra }, s.now), 'REQUEST_PLAN_INVALID_CONTEXT');
});

test('context is strict plain data: no accessors, symbols, hidden fields or custom prototypes execute', () => {
  const s = setup(); const expected = digest(s.request, s.now); let getterCalls = 0;
  const accessor = { ...s.context }; Object.defineProperty(accessor, 'snapshot', { get() { getterCalls++; return s.context.snapshot; } });
  const hidden = { ...s.context }; Object.defineProperty(hidden, 'trusted', { value: true });
  const symbol = { ...s.context, [Symbol('trusted')]: true }; const prototype = Object.assign(Object.create({ trusted: true }), s.context);
  const nested = { ...s.context, feePolicy: { ...s.context.feePolicy } }; Object.defineProperty(nested.feePolicy, 'signatureModel', { get() { getterCalls++; return 'compressed-p2pkh-schnorr'; } });
  for (const context of [accessor, hidden, symbol, prototype, nested]) rejected(buildPaymentRequestPlan(s.request, expected, context, s.now), 'REQUEST_PLAN_INVALID_CONTEXT');
  assert.equal(getterCalls, 0);
});

test('every context array rejects holes, custom prototypes and extra properties', () => {
  const s = setup(); const expected = digest(s.request, s.now);
  for (const path of ['ownerScripts', 'selectedInputs', 'parentTransactionHexes', 'unspentOutpoints'] as const) {
    for (const mutation of ['hole', 'prototype', 'extra', 'getter'] as const) {
      const c = structuredClone(s.context); const a = path === 'ownerScripts' || path === 'selectedInputs' ? c[path] : c.snapshot[path];
      if (mutation === 'hole') Reflect.deleteProperty(a, '0');
      if (mutation === 'prototype') Object.setPrototypeOf(a, { ...Array.prototype });
      if (mutation === 'extra') Object.defineProperty(a, 'trusted', { value: true });
      if (mutation === 'getter') Object.defineProperty(a, '0', { get() { throw Error('must not execute'); } });
      rejected(buildPaymentRequestPlan(s.request, expected, c, s.now), 'REQUEST_PLAN_INVALID_CONTEXT');
    }
  }
});

test('network, ownership claims and recipient/change ambiguity fail closed without inferring ownership', () => {
  const s = setup(); const expected = digest(s.request, s.now);
  rejected(buildPaymentRequestPlan(s.request, expected, { ...s.context, snapshot: { ...s.context.snapshot, network: 'mainnet' } }, s.now), 'REQUEST_PLAN_BUILD_REJECTED', 'NETWORK_MISMATCH');
  rejected(buildPaymentRequestPlan(s.request, expected, { ...s.context, changeScript: stranger }, s.now), 'REQUEST_PLAN_BUILD_REJECTED', 'INVALID_CHANGE_SCRIPT');
  rejected(buildPaymentRequestPlan(s.request, expected, { ...s.context, ownerScripts: [stranger], changeScript: stranger }, s.now), 'REQUEST_PLAN_BUILD_REJECTED', 'UNCONFIRMED_INPUT_OWNER');
  rejected(buildPaymentRequestPlan(s.request, expected, { ...s.context, ownerScripts: [owner, recipientScript] }, s.now), 'REQUEST_PLAN_BUILD_REJECTED', 'AMBIGUOUS_RECIPIENT_CHANGE');
});

test('missing or duplicate selected outpoints, invalid parent bytes and fee rejection cannot yield a partial plan', () => {
  const s = setup(); const expected = digest(s.request, s.now);
  rejected(buildPaymentRequestPlan(s.request, expected, { ...s.context, selectedInputs: [{ txid: 'aa'.repeat(32), index: 0 }] }, s.now), 'REQUEST_PLAN_BUILD_REJECTED', 'MISSING_OR_SPENT_PREVOUT');
  rejected(buildPaymentRequestPlan(s.request, expected, { ...s.context, selectedInputs: [...s.context.selectedInputs, ...s.context.selectedInputs] }, s.now), 'REQUEST_PLAN_BUILD_REJECTED', 'DUPLICATE_INPUT');
  rejected(buildPaymentRequestPlan(s.request, expected, { ...s.context, snapshot: { ...s.context.snapshot, parentTransactionHexes: ['00'] } }, s.now), 'REQUEST_PLAN_BUILD_REJECTED', 'INVALID_PARENT');
  const expensive = { ...s.context, feePolicy: { ...s.context.feePolicy, targetSatoshisPer1000Bytes: '3000' } };
  rejected(buildPaymentRequestPlan(s.request, expected, expensive, s.now), 'REQUEST_PLAN_BUILD_REJECTED', 'FEE_LIMIT');
  const large = { ...s.request, recipients: [{ address, bch: '0.0002' }] };
  rejected(buildPaymentRequestPlan(large, digest(large, s.now), s.context, s.now), 'REQUEST_PLAN_BUILD_REJECTED', 'INSUFFICIENT_BCH');
});

test('owner/change/fee policy edits change bound plan while caller ordering does not', () => {
  const s = setup(); const expected = digest(s.request, s.now); const a = buildPaymentRequestPlan(s.request, expected, s.context, s.now);
  const additional = { ...s.context, ownerScripts: [owner, stranger] }; const b = buildPaymentRequestPlan(s.request, expected, additional, s.now);
  const reordered = buildPaymentRequestPlan(s.request, expected, { ...additional, ownerScripts: [stranger, owner] }, s.now);
  assert.notEqual(a.binding?.requestPlanDigest, b.binding?.requestPlanDigest); assert.equal(b.binding?.requestPlanDigest, reordered.binding?.requestPlanDigest);
  const changed = buildPaymentRequestPlan(s.request, expected, { ...additional, changeScript: stranger }, s.now); assert.notEqual(changed.binding?.requestPlanDigest, b.binding?.requestPlanDigest);
  const policy = buildPaymentRequestPlan(s.request, expected, { ...s.context, feePolicy: { ...s.context.feePolicy, maxSatoshisPer1000Bytes: '4000' } }, s.now);
  assert.equal(a.plan?.unsignedHex, policy.plan?.unsignedHex); assert.notEqual(a.binding?.requestPlanDigest, policy.binding?.requestPlanDigest);
});

test('bounded context rejects oversized collections, malformed numeric fields and aggregate parent sizes', () => {
  const s = setup(); const expected = digest(s.request, s.now);
  for (const context of [
    { ...s.context, ownerScripts: Array(21).fill(owner) }, { ...s.context, selectedInputs: Array(21).fill(s.context.selectedInputs[0]) },
    { ...s.context, selectedInputs: [{ txid: 'aa'.repeat(32), index: 4294967296 }] },
    { ...s.context, snapshot: { ...s.context.snapshot, parentTransactionHexes: Array(3).fill('00'.repeat(100000)) } },
    { ...s.context, snapshot: { ...s.context.snapshot, unspentOutpoints: ['aa'.repeat(32) + ':4294967296'] } },
    { ...s.context, feePolicy: { ...s.context.feePolicy, targetSatoshisPer1000Bytes: 1000 } },
    { ...s.context, feePolicy: { ...s.context.feePolicy, allowBchDustToFee: 'false' } }
  ]) rejected(buildPaymentRequestPlan(s.request, expected, context, s.now), 'REQUEST_PLAN_INVALID_CONTEXT');
});

test('output is deeply frozen and independent of future edits; failures never restore older successful plans', () => {
  const s = setup(); const expected = digest(s.request, s.now); const r = buildPaymentRequestPlan(s.request, expected, s.context, s.now); const frozen = JSON.stringify(r);
  assert.ok(Object.isFrozen(r)); assert.ok(Object.isFrozen(r.binding)); assert.ok(Object.isFrozen(r.intent?.recipients)); assert.ok(Object.isFrozen(r.plan?.outputSummary[0])); assert.ok(Object.isFrozen(r.plan?.guard?.limitations));
  assert.equal(Reflect.defineProperty(r.plan!.outputSummary[0]!, 'satoshis', { value: '999' }), false);
  s.context.snapshot.parentTransactionHexes[0] = '00'; s.context.feePolicy.maxSatoshisPer1000Bytes = '9000';
  assert.equal(JSON.stringify(r), frozen); rejected(buildPaymentRequestPlan(s.request, expected, s.context, s.now), 'REQUEST_PLAN_BUILD_REJECTED', 'INVALID_PARENT');
});


test('declared change policy stays bound even when no change output is produced', () => {
  const s = setup(); const request = { ...s.request, recipients: [{ address, bch: '0.00009815' }] };
  const expected = digest(request, s.now); const context = { ...s.context, ownerScripts: [owner, stranger] };
  const a = buildPaymentRequestPlan(request, expected, context, s.now); const b = buildPaymentRequestPlan(request, expected, { ...context, changeScript: stranger }, s.now);
  assert.equal(a.status, 'REQUEST_PLAN_BOUND_OFFLINE'); assert.equal(b.status, 'REQUEST_PLAN_BOUND_OFFLINE');
  assert.equal(a.plan?.feeSatoshis, '185'); assert.equal(a.plan?.outputSummary.length, 1); assert.equal(a.plan?.unsignedHex, b.plan?.unsignedHex); assert.equal(a.plan?.planDigest, b.plan?.planDigest);
  assert.notEqual(a.binding?.planningPolicyDigest, b.binding?.planningPolicyDigest); assert.notEqual(a.binding?.requestPlanDigest, b.binding?.requestPlanDigest);
});

test('every declared fee-policy field participates in the bound policy content', () => {
  const s = setup(); const expected = digest(s.request, s.now); const original = buildPaymentRequestPlan(s.request, expected, s.context, s.now);
  for (const feePolicy of [
    { ...s.context.feePolicy, targetSatoshisPer1000Bytes: '1001' },
    { ...s.context.feePolicy, maxSatoshisPer1000Bytes: '4000' },
    { ...s.context.feePolicy, allowBchDustToFee: true },
    { ...s.context.feePolicy, signatureModel: 'compressed-p2pkh-low-s-ecdsa' }
  ]) {
    const changed = buildPaymentRequestPlan(s.request, expected, { ...s.context, feePolicy }, s.now);
    assert.equal(changed.status, 'REQUEST_PLAN_BOUND_OFFLINE', changed.builderIssue ?? '');
    assert.notEqual(changed.binding?.planningPolicyDigest, original.binding?.planningPolicyDigest);
    assert.notEqual(changed.binding?.requestPlanDigest, original.binding?.requestPlanDigest);
  }
});

test('content binding is not a snapshot identity or a reusable freshness verdict', () => {
  const s = setup(); const expected = digest(s.request, s.now); const a = buildPaymentRequestPlan(s.request, expected, s.context, s.now);
  const context = { ...s.context, snapshot: { ...s.context.snapshot, observedAt: s.now - 1000 } };
  const b = buildPaymentRequestPlan(s.request, expected, context, s.now);
  assert.equal(a.binding?.requestPlanDigest, b.binding?.requestPlanDigest); assert.equal(b.networkVerified, false); assert.equal(b.ownershipVerified, false);
  context.snapshot.observedAt = s.now - 120001;
  rejected(buildPaymentRequestPlan(s.request, expected, context, s.now), 'REQUEST_PLAN_BUILD_REJECTED', 'STALE_OR_INVALID_SNAPSHOT');
  assert.equal(a.status, 'REQUEST_PLAN_BOUND_OFFLINE'); // Historical object, never promoted to current authority.
});
