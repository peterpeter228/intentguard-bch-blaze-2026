/** Actual pinned XO pure-engine tests with explicitly synthetic funding. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { binToHex, decodeTransaction, encodeTransaction, hashTransaction, hexToBin } from '@bitauth/libauth';
import { buildInvitationTransactionFromMergedCommit, completeMergedOutput, type MergedInvitation } from '@xo-cash/engine';
import { p2pkhTemplate } from '@xo-cash/templates';
import { parseTemplate, generateTemplateIdentifier } from '@xo-cash/utils';
import type { XOInvitationVariable } from '@xo-cash/types';
import { fixture, owner, stranger, category } from './fixtures.js';
import { createPaymentRequestDraft, type PaymentRequestWire } from './payment-request.js';
import { buildPaymentRequestPlan, type OfflineRequestPlanContext } from './request-plan.js';
import { buildXoTemplateCandidate, compareXoCandidateBytes, XO_P2PKH_TEMPLATE_IDENTIFIER, type XoCandidateResult } from './xo-candidate.js';
import type { PaymentIntent } from './guard.js';

function setup(token = false) {
  const f = fixture(token); const now = f.input.now;
  const request: PaymentRequestWire = { schemaVersion: 1, kind: 'intentguard-payment-request', requestId: 'xo-synthetic-001', network: 'chipnet', expiresAt: f.input.intent.expiresAt, maxFeeBch: '0.000006', recipients: [{ address: token ? 'bchtest:zr7fzmep8g7h7ymfxy74lgc0v950j3r295x8qj2hgs' : 'bchtest:qr7fzmep8g7h7ymfxy74lgc0v950j3r295pdnvy3hr', bch: '0.00001', ...(token ? { token: { category, amountAtomic: '100' } } : {}) }] };
  const context: OfflineRequestPlanContext = { ownerScripts: [owner], changeScript: owner, snapshot: structuredClone(f.input.snapshot), selectedInputs: [{ txid: hashTransaction(encodeTransaction(f.parent)), index: 0 }], feePolicy: { targetSatoshisPer1000Bytes: '1000', maxSatoshisPer1000Bytes: '3000', signatureModel: 'compressed-p2pkh-schnorr', allowBchDustToFee: false } };
  return { request, context, now };
}
function digest(request: unknown, now: number): string { const d = createPaymentRequestDraft(request, now); assert.equal(d.status, 'DRAFT_READY'); return d.draft!.requestDigest; }
function noAuthority(r: XoCandidateResult): void {
  for (const flag of ['canSign', 'broadcastable', 'receiptValid', 'networkVerified', 'ownershipVerified'] as const) assert.equal(r[flag], false);
  assert.doesNotThrow(() => JSON.stringify(r)); assert.equal(Object.isFrozen(r), true);
  assert.equal(Object.hasOwn(r, 'candidateHex'), false); assert.equal(Object.hasOwn(r, 'requestPlan'), false);
  assert.equal(Object.hasOwn(r, 'snapshot'), false);
}
function rejected(r: XoCandidateResult, issue: string): void { assert.equal(r.status, 'REJECTED'); assert.equal(r.issue, issue); assert.equal(r.binding, null); assert.deepEqual(r.outputSummary, []); assert.equal(r.feeSatoshis, null); noAuthority(r); }

for (const token of [false, true]) test(`official XO ${token ? 'FT' : 'BCH'} compilation equals independent planner bytes and Guard fee`, () => {
  const s = setup(token), expected = digest(s.request, s.now); const before = JSON.stringify(s);
  const r = buildXoTemplateCandidate(s.request, expected, s.context, s.now);
  assert.equal(r.status, 'EXACT_MATCH_OFFLINE', r.issue ?? ''); assert.equal(r.exactBytesMatch, true); assert.equal(r.guard?.status, 'MATCH_OFFLINE');
  assert.equal(r.binding?.templateIdentifier, XO_P2PKH_TEMPLATE_IDENTIFIER);
  assert.equal(r.binding?.actionIdentifier, token ? 'sendFungibleTokens' : 'sendSatoshis');
  const plan = buildPaymentRequestPlan(s.request, expected, s.context, s.now);
  assert.deepEqual(r.outputSummary, plan.plan?.outputSummary); assert.equal(r.feeSatoshis, plan.plan?.feeSatoshis);
  assert.equal(r.binding?.requestPlanDigest, plan.binding?.requestPlanDigest);
  assert.equal(r.candidateBytes, plan.plan!.unsignedHex!.length / 2);
  assert.deepEqual(r.estimatedSignedBytes, plan.plan?.estimatedSignedBytes);
  assert.notEqual(r.upstreamFeeEstimateSatoshis, r.feeSatoshis); // actual fee is not XO count heuristic
  if (token) assert.deepEqual(r.outputSummary.map(o => o.token?.amount), ['100', '400', undefined]);
  noAuthority(r); assert.equal(JSON.stringify(s), before);
  assert.deepEqual(buildXoTemplateCandidate(JSON.stringify(s.request), expected, s.context, s.now), r);
  const json = JSON.stringify(r); assert.equal(json.includes(s.context.snapshot.parentTransactionHexes[0]!), false); assert.equal(json.includes(plan.plan!.unsignedHex!), false);
});

test('template normalized official identity is pinned, not JSON source formatting', () => {
  assert.equal(generateTemplateIdentifier(parseTemplate(JSON.stringify(p2pkhTemplate))), XO_P2PKH_TEMPLATE_IDENTIFIER);
  assert.equal(generateTemplateIdentifier(parseTemplate(JSON.stringify(p2pkhTemplate, null, 2))), XO_P2PKH_TEMPLATE_IDENTIFIER);
});

test('review edits, missing context, stale claims, expired invocation and invalid clock fail closed', () => {
  const s = setup(), expected = digest(s.request, s.now);
  rejected(buildXoTemplateCandidate({ ...s.request, requestId: 'changed' }, expected, s.context, s.now), 'REQUEST_PLAN_REVIEW_CHANGED');
  rejected(buildXoTemplateCandidate(s.request, '', s.context, s.now), 'REQUEST_PLAN_REVIEW_DIGEST_REQUIRED');
  rejected(buildXoTemplateCandidate(s.request, expected, undefined, s.now), 'REQUEST_PLAN_CONTEXT_REQUIRED');
  rejected(buildXoTemplateCandidate(s.request, expected, { ...s.context, now: s.now }, s.now), 'REQUEST_PLAN_INVALID_CONTEXT');
  rejected(buildXoTemplateCandidate(s.request, expected, s.context, s.request.expiresAt), 'REQUEST_EXPIRED');
  assert.equal(buildXoTemplateCandidate(s.request, expected, s.context, NaN).status, 'REJECTED');
  const oldContext = structuredClone(s.context); oldContext.snapshot.observedAt -= 120001;
  const stale = buildXoTemplateCandidate(s.request, expected, oldContext, s.now);
  rejected(stale, 'REQUEST_PLAN_BUILD_REJECTED'); assert.equal(stale.builderIssue, 'STALE_OR_INVALID_SNAPSHOT');
  const spent = structuredClone(s.context); spent.snapshot.unspentOutpoints = ['00'.repeat(32) + ':0'];
  assert.equal(buildXoTemplateCandidate(s.request, expected, spent, s.now).status, 'REJECTED');
});

test('context observation binding changes without implying newly authenticated evidence', () => {
  const s = setup(), expected = digest(s.request, s.now); const a = buildXoTemplateCandidate(s.request, expected, s.context, s.now);
  const changed = structuredClone(s.context); changed.snapshot.observedAt -= 1;
  const b = buildXoTemplateCandidate(s.request, expected, changed, s.now);
  assert.equal(b.status, 'EXACT_MATCH_OFFLINE'); assert.equal(a.binding?.requestPlanDigest, b.binding?.requestPlanDigest);
  assert.equal(a.binding?.candidateDigest, b.binding?.candidateDigest); assert.notEqual(a.binding?.contextDigest, b.binding?.contextDigest); assert.notEqual(a.binding?.candidateBindingDigest, b.binding?.candidateBindingDigest); noAuthority(b);
});

test('multiple recipient requests are explicitly unsupported instead of a fabricated official action', () => {
  const s = setup(); const request = { ...s.request, recipients: [s.request.recipients[0]!, s.request.recipients[0]!] };
  rejected(buildXoTemplateCandidate(request, digest(request, s.now), s.context, s.now), 'XO_SINGLE_RECIPIENT_REQUIRED');
});

test('input object accessors, malformed text, imported verdicts and unexpected fields do not become engine instructions', () => {
  const s = setup(), expected = digest(s.request, s.now); let called = false;
  const c = { ...s.context, get snapshot() { called = true; return s.context.snapshot; } };
  rejected(buildXoTemplateCandidate(s.request, expected, c, s.now), 'REQUEST_PLAN_INVALID_CONTEXT'); assert.equal(called, false);
  assert.equal(buildXoTemplateCandidate('{', expected, s.context, s.now).status, 'REJECTED');
  const r = buildXoTemplateCandidate(s.request, expected, s.context, s.now);
  assert.equal(buildXoTemplateCandidate(r, expected, s.context, s.now).status, 'REJECTED');
  assert.equal(buildXoTemplateCandidate(s.request, expected, { ...s.context, compile: () => 'forged' }, s.now).status, 'REJECTED');
});

// Build adversarial bytes through the ACTUAL official template/engine, not a
// test double or callback injected into the public candidate-building API.
function engineCandidate(token: boolean, mutation: 'none' | 'recipient' | 'amount' | 'category' | 'tokenAmount' | 'sequence' | 'changeOrder') {
  const s = setup(token), expected = digest(s.request, s.now); const p = buildPaymentRequestPlan(s.request, expected, s.context, s.now);
  assert.ok(p.intent && p.plan?.unsignedHex);
  const intent: PaymentIntent = { ...p.intent, ownerScripts: [...p.intent.ownerScripts], recipients: p.intent.recipients.map(r => ({ ...r })) };
  const tx = decodeTransaction(hexToBin(p.plan.unsignedHex)); assert.notEqual(typeof tx, 'string'); if (typeof tx === 'string') throw Error(tx);
  const r = intent.recipients[0]!; const template = parseTemplate(JSON.stringify(p2pkhTemplate));
  const action = token ? 'sendFungibleTokens' : 'sendSatoshis'; const sourceCommitIdentifier = 'synthetic-test-only';
  const variables: XOInvitationVariable[] = [{ variableIdentifier: 'recipientLockingscript', value: mutation === 'recipient' ? stranger : r.script }, ...(token ? [{ variableIdentifier: 'transferredTokenCategory', value: mutation === 'category' ? '55'.repeat(32) : r.token!.category }, { variableIdentifier: 'transferredTokenAmount', value: BigInt(r.token!.amount) + (mutation === 'tokenAmount' ? 1n : 0n) }] : [{ variableIdentifier: 'transferredSatoshis', value: BigInt(r.satoshis) + (mutation === 'amount' ? 1n : 0n) }])];
  const compiled = completeMergedOutput({ outputIdentifier: token ? 'transferFungibleTokensOutput' : 'transferSatoshisOutput', ...(token ? { valueSatoshis: BigInt(r.satoshis) + (mutation === 'amount' ? 1n : 0n) } : {}), sourceCommitIdentifier }, 0, variables, template, action);
  const merged: MergedInvitation = { variables, transactionVersion: tx.version, transactionLocktime: tx.locktime, inputs: tx.inputs.map(i => ({ ...i, sequenceNumber: mutation === 'sequence' ? i.sequenceNumber - 1 : i.sequenceNumber, sourceCommitIdentifier })), outputs: [{ ...compiled, sourceCommitIdentifier }, ...(mutation === 'changeOrder' ? tx.outputs.slice(1).reverse() : tx.outputs.slice(1)).map(o => ({ ...o, sourceCommitIdentifier }))] };
  const built = buildInvitationTransactionFromMergedCommit(merged, template, action);
  return { check: compareXoCandidateBytes({ intent, snapshot: s.context.snapshot, candidateHex: built.serializedTransaction, now: s.now }, p.plan.unsignedHex), compiled, r, built };
}
for (const token of [false, true]) test(`actual engine ${token ? 'FT' : 'BCH'} recipient and amount mutation is rejected independently`, () => {
  const good = engineCandidate(token, 'none'); assert.equal(good.check.exactBytesMatch, true); assert.equal(good.check.guard.status, 'MATCH_OFFLINE');
  assert.equal(binToHex(good.compiled.lockingBytecode!), good.r.script);
  for (const mutation of ['recipient', 'amount', ...(token ? ['category', 'tokenAmount'] as const : [])] as const) {
    const bad = engineCandidate(token, mutation); assert.equal(bad.check.exactBytesMatch, false, mutation); assert.equal(bad.check.guard.status, 'REJECTED', mutation);
  }
});
test('exact binding rejects an engine-produced change-order mutation even if economic Guard matches', () => {
  const bad = engineCandidate(true, 'changeOrder'); assert.equal(bad.check.guard.status, 'MATCH_OFFLINE'); assert.equal(bad.check.exactBytesMatch, false);
});


test('non-symmetric full category bytes survive engine variables, token change and Guard binding', () => {
  const s = setup(true); const category = '0123456789abcdef'.repeat(4);
  const parent = decodeTransaction(hexToBin(s.context.snapshot.parentTransactionHexes[0]!));
  assert.notEqual(typeof parent, 'string'); if (typeof parent === 'string') throw Error(parent);
  parent.outputs[0]!.token!.category = hexToBin(category);
  const raw = encodeTransaction(parent), txid = hashTransaction(raw);
  s.context.snapshot.parentTransactionHexes = [binToHex(raw)]; s.context.snapshot.unspentOutpoints = [txid + ':0'];
  s.context.selectedInputs = [{ txid, index: 0 }];
  s.request = { ...s.request, recipients: [{ ...s.request.recipients[0]!, token: { ...s.request.recipients[0]!.token!, category } }] };
  const r = buildXoTemplateCandidate(s.request, digest(s.request, s.now), s.context, s.now);
  assert.equal(r.status, 'EXACT_MATCH_OFFLINE', r.issue ?? '');
  assert.deepEqual(r.outputSummary.filter(o => o.token).map(o => o.token!.category), [category, category]);
});
