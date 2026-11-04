/** Official public CashAddr vectors and synthetic request data only. No wallet or network. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeCashAddress, hexToBin } from '@bitauth/libauth';
import { createPaymentRequestDraft, parsePaymentRequestDraft, exportPaymentRequest, MAX_PAYMENT_REQUEST_BYTES, MAX_PAYMENT_REQUEST_TTL_MS, type PaymentRequestWire } from './payment-request.js';
const now = 1800000000000;
// CashTokens specification, Token-Aware CashAddresses test-vector table.
const ordinary = 'bitcoincash:qr7fzmep8g7h7ymfxy74lgc0v950j3r2959lhtxxsl';
const aware = 'bitcoincash:zr7fzmep8g7h7ymfxy74lgc0v950j3r295z4y4gq0v';
const testAware = 'bchtest:zr7fzmep8g7h7ymfxy74lgc0v950j3r295x8qj2hgs';
const category = 'ab'.repeat(32);
function wire(): PaymentRequestWire { return { schemaVersion: 1, kind: 'intentguard-payment-request', requestId: 'order-001', network: 'mainnet', expiresAt: now + 60000, maxFeeBch: '0.00000600', recipients: [{ address: ordinary, bch: '1.23000000' }] }; }
function rejected(input: unknown, code: string): void { const r = createPaymentRequestDraft(input, now); assert.equal(r.status, 'REJECTED'); assert.equal(r.issue, code); assert.equal(r.draft, null); assert.equal(r.canSign, false); assert.equal(r.receiptValid, false); assert.equal(r.networkVerified, false); }

test('official P2PKH request normalizes exact units and remains an immutable unconfirmed draft', () => {
  const input = wire(); const original = JSON.stringify(input); const r = createPaymentRequestDraft(input, now); assert.equal(r.status, 'DRAFT_READY'); if (r.status !== 'DRAFT_READY') return;
  assert.equal(r.draft.request.recipients[0]?.bch, '1.23'); assert.equal(r.draft.request.maxFeeBch, '0.000006');
  assert.equal(r.draft.display.recipientSatoshis, '123000000'); assert.equal(r.draft.display.maxFeeSatoshis, '600');
  assert.equal(r.draft.display.recipients[0]?.script, '76a914fc916f213a3d7f1369313d5fa30f6168f9446a2d88ac'); assert.equal(r.draft.display.recipients[0]?.tokenAware, false);
  assert.equal(r.draft.status, 'UNCONFIRMED_DRAFT'); assert.equal(r.draft.canSign, false); assert.equal(r.draft.receiptValid, false); assert.equal(r.draft.networkVerified, false);
  assert.equal('ownerScripts' in r.draft, false); assert.equal('ownerScripts' in r.draft.request, false); assert.equal(Object.isFrozen(r.draft.request.recipients), true); assert.equal(Object.isFrozen(r.draft.display.recipients[0]), true);
  assert.equal(JSON.stringify(input), original); assert.match(r.draft.requestDigest, /^[0-9a-f]{64}$/);
});

test('all-uppercase CashAddr normalizes but mixed-case pinned-libauth loophole is rejected', () => {
  const lower = createPaymentRequestDraft(wire(), now); const upper = createPaymentRequestDraft({ ...wire(), recipients: [{ address: ordinary.toUpperCase(), bch: '1.23' }] }, now);
  assert.equal(lower.status, 'DRAFT_READY'); assert.equal(upper.status, 'DRAFT_READY'); if (lower.status !== 'DRAFT_READY' || upper.status !== 'DRAFT_READY') return;
  assert.equal(upper.draft.request.recipients[0]?.address, ordinary); assert.equal(upper.draft.requestDigest, lower.draft.requestDigest);
  rejected({ ...wire(), recipients: [{ address: ordinary.replace('bitcoincash:', 'Bitcoincash:'), bch: '1' }] }, 'REQUEST_MIXED_CASE_ADDRESS');
});

test('token-aware P2PKH signals token acceptance, not a distinct locking script or verified network', () => {
  const ordinaryDraft = createPaymentRequestDraft(wire(), now);
  const token = createPaymentRequestDraft({ ...wire(), network: 'chipnet', recipients: [{ address: testAware, bch: '0.00001', token: { category, amountAtomic: '9223372036854775807' } }] }, now);
  assert.equal(token.status, 'DRAFT_READY'); assert.equal(ordinaryDraft.status, 'DRAFT_READY'); if (token.status !== 'DRAFT_READY' || ordinaryDraft.status !== 'DRAFT_READY') return;
  assert.equal(token.draft.display.recipients[0]?.token?.amountAtomic, '9223372036854775807'); assert.equal(token.draft.display.recipients[0]?.script, ordinaryDraft.draft.display.recipients[0]?.script); assert.equal(token.draft.display.recipients[0]?.tokenAware, true); assert.equal(token.draft.networkVerified, false);
  rejected({ ...wire(), recipients: [{ address: ordinary, bch: '0.00001', token: { category, amountAtomic: '1' } }] }, 'REQUEST_TOKEN_AWARE_REQUIRED');
  assert.equal(createPaymentRequestDraft({ ...wire(), recipients: [{ address: aware, bch: '1' }] }, now).status, 'DRAFT_READY');
});

test('bad checksum, omitted prefix, URI, hidden characters and wrong network are not repaired', () => {
  for (const address of [ordinary.slice(0, -1) + 'q', ordinary.split(':')[1], ordinary + '?amount=1', ' ' + ordinary, ordinary + '\u200b', 'bitcoincash:' + ordinary, 'https://' + ordinary]) rejected({ ...wire(), recipients: [{ address, bch: '1' }] }, 'REQUEST_INVALID_ADDRESS');
  rejected({ ...wire(), recipients: [{ address: testAware, bch: '1' }] }, 'REQUEST_NETWORK_MISMATCH');
  rejected({ ...wire(), recipients: [{ address: 'bchreg:qr7fzmep8g7h7ymfxy74lgc0v950j3r295m39d8z59', bch: '1' }] }, 'REQUEST_NETWORK_MISMATCH');
  rejected({ ...wire(), network: 'testnet' }, 'REQUEST_INVALID_NETWORK');
});

test('valid P2SH and unsupported payload sizes are explicitly unsupported, not payment destinations', () => {
  rejected({ ...wire(), recipients: [{ address: 'bitcoincash:ppawqn2h74a4t50phuza84kdp3794pq3ccvm92p8sh', bch: '1' }] }, 'REQUEST_UNSUPPORTED_ADDRESS_TYPE');
  const wide = encodeCashAddress({ prefix: 'bitcoincash', type: 'p2pkh', payload: hexToBin('11'.repeat(24)) }).address;
  rejected({ ...wire(), recipients: [{ address: wide, bch: '1' }] }, 'REQUEST_UNSUPPORTED_ADDRESS_TYPE');
});

test('BCH parsing is exact, rejects ambiguous decimal syntax and respects money/dust bounds', () => {
  const exact = createPaymentRequestDraft({ ...wire(), recipients: [{ address: ordinary, bch: '1.00000001' }] }, now); assert.equal(exact.draft?.display.recipientSatoshis, '100000001');
  for (const bch of ['01', '00.1', '+1', '-1', '.1', '1.', '1e-3', '1,000', ' 1', '1 ', '1.000000000', 'NaN', 'Infinity', 1]) rejected({ ...wire(), recipients: [{ address: ordinary, bch }] }, 'REQUEST_INVALID_BCH_AMOUNT');
  rejected({ ...wire(), recipients: [{ address: ordinary, bch: '21000000.00000001' }] }, 'REQUEST_BCH_RANGE');
  rejected({ ...wire(), recipients: [{ address: ordinary, bch: '0' }] }, 'REQUEST_BCH_RANGE');
  rejected({ ...wire(), recipients: [{ address: ordinary, bch: '0.00000545' }] }, 'REQUEST_DUST_OUTPUT');
  assert.equal(createPaymentRequestDraft({ ...wire(), recipients: [{ address: ordinary, bch: '0.00000546' }] }, now).status, 'DRAFT_READY');
  rejected({ ...wire(), maxFeeBch: '21000000' }, 'REQUEST_BCH_RANGE');
});

test('token category/base units are exact, metadata/NFT claims forbidden, and carrier dust uses token size', () => {
  const recipient = { address: aware, bch: '0.00001', token: { category, amountAtomic: '1' } };
  for (const amountAtomic of ['0', '-1', '+1', '01', '1.0', '1e3', 1]) rejected({ ...wire(), recipients: [{ ...recipient, token: { category, amountAtomic } }] }, 'REQUEST_INVALID_TOKEN_AMOUNT');
  rejected({ ...wire(), recipients: [{ ...recipient, token: { category, amountAtomic: '9223372036854775808' } }] }, 'REQUEST_TOKEN_RANGE');
  for (const badCategory of ['PUSD', 'ab'.repeat(31), 'AB'.repeat(32)]) rejected({ ...wire(), recipients: [{ ...recipient, token: { category: badCategory, amountAtomic: '1' } }] }, 'REQUEST_INVALID_TOKEN_CATEGORY');
  for (const extra of [{ decimals: 2 }, { symbol: 'PUSD' }, { nft: {} }, { mint: true }]) rejected({ ...wire(), recipients: [{ ...recipient, token: { ...recipient.token, ...extra } }] }, 'REQUEST_INVALID_SCHEMA');
  rejected({ ...wire(), recipients: [{ ...recipient, bch: '0.00000650' }] }, 'REQUEST_DUST_OUTPUT');
  assert.equal(createPaymentRequestDraft({ ...wire(), recipients: [{ ...recipient, bch: '0.00000651' }] }, now).status, 'DRAFT_READY');
});

test('recipient order and aggregate limits are explicit; no automatic merging or owner allowlist', () => {
  const first = { address: ordinary, bch: '1' }; const second = { address: aware, bch: '2' };
  const r = createPaymentRequestDraft({ ...wire(), recipients: [first, second] }, now); assert.equal(r.status, 'DRAFT_READY'); assert.deepEqual(r.draft?.request.recipients.map(x => x.address), [ordinary, aware]); assert.equal(r.draft?.display.recipientSatoshis, '300000000');
  rejected({ ...wire(), recipients: [{ ...first, bch: '11000000' }, { ...second, bch: '11000000' }] }, 'REQUEST_BCH_RANGE');
  rejected({ ...wire(), recipients: [{ ...first, address: aware, token: { category, amountAtomic: '9223372036854775807' } }, { ...second, token: { category, amountAtomic: '1' } }] }, 'REQUEST_TOKEN_RANGE');
  rejected({ ...wire(), recipients: [] }, 'REQUEST_INVALID_SCHEMA'); rejected({ ...wire(), recipients: Array(1) }, 'REQUEST_INVALID_SCHEMA');
  rejected({ ...wire(), recipients: Array.from({ length: 21 }, () => first) }, 'REQUEST_INVALID_SCHEMA');
});

test('trusted caller clock, explicit expiry and fee fields cannot be overridden by import metadata', () => {
  rejected({ ...wire(), expiresAt: now }, 'REQUEST_EXPIRED'); rejected({ ...wire(), expiresAt: now + MAX_PAYMENT_REQUEST_TTL_MS + 1 }, 'REQUEST_EXPIRY_TOO_FAR');
  assert.equal(createPaymentRequestDraft({ ...wire(), expiresAt: now + MAX_PAYMENT_REQUEST_TTL_MS }, now).status, 'DRAFT_READY');
  assert.equal(createPaymentRequestDraft(wire(), NaN).issue, 'REQUEST_INVALID_CLOCK'); assert.equal(createPaymentRequestDraft(wire(), -1).issue, 'REQUEST_INVALID_CLOCK');
  for (const extra of [{ now }, { trusted: true }, { canSign: false }, { confirmed: true }, { ownerScripts: [] }, { requestDigest: 'ab'.repeat(32) }, { networkVerified: true }]) rejected({ ...wire(), ...extra }, 'REQUEST_INVALID_SCHEMA');
  rejected({ ...wire(), recipients: [{ ...wire().recipients[0], script: '76a914' + '11'.repeat(20) + '88ac' }] }, 'REQUEST_INVALID_SCHEMA');
  rejected({ ...wire(), maxFeeBch: '1e-5' }, 'REQUEST_INVALID_BCH_AMOUNT');
});

test('bounded JSON import rejects duplicate decoded keys, malformed/deep documents and oversized text', () => {
  const json = JSON.stringify(wire());
  assert.equal(parsePaymentRequestDraft(json, now).status, 'DRAFT_READY');
  assert.equal(parsePaymentRequestDraft(json.replace('"network":"mainnet"', '"network":"mainnet","network":"chipnet"'), now).issue, 'REQUEST_DUPLICATE_JSON_KEY');
  assert.equal(parsePaymentRequestDraft(json.replace('"network":"mainnet"', '"network":"mainnet","net\\u0077ork":"mainnet"'), now).issue, 'REQUEST_DUPLICATE_JSON_KEY');
  assert.equal(parsePaymentRequestDraft(json.replace('"bch":"1.23000000"', '"bch":"1","bch":"2"'), now).issue, 'REQUEST_DUPLICATE_JSON_KEY');
  assert.equal(parsePaymentRequestDraft('{broken}', now).issue, 'REQUEST_INVALID_JSON'); assert.equal(parsePaymentRequestDraft('['.repeat(7) + '0' + ']'.repeat(7), now).issue, 'REQUEST_TOO_DEEP');
  assert.equal(parsePaymentRequestDraft(' '.repeat(MAX_PAYMENT_REQUEST_BYTES + 1), now).issue, 'REQUEST_TOO_LARGE');
  assert.equal(parsePaymentRequestDraft('"' + '中'.repeat(3000) + '"', now).issue, 'REQUEST_TOO_LARGE');
  assert.equal(parsePaymentRequestDraft(json.replace('"requestId":"order-001"', '"__proto__":{"trusted":true},"requestId":"order-001"'), now).issue, 'REQUEST_INVALID_SCHEMA');
});

test('canonical wire export round-trips without exporting derived review or trust state', () => {
  const first = createPaymentRequestDraft(wire(), now); assert.equal(first.status, 'DRAFT_READY'); if (first.status !== 'DRAFT_READY') return;
  const exported = exportPaymentRequest(first.draft.request, now); const parsed = parsePaymentRequestDraft(exported, now); assert.equal(parsed.status, 'DRAFT_READY'); assert.equal(parsed.draft?.requestDigest, first.draft.requestDigest);
  for (const forbidden of ['canSign', 'script', 'requestDigest', 'networkVerified', 'ownerScripts', 'confirmed']) assert.equal(exported.includes('"' + forbidden + '"'), false);
  assert.throws(() => exportPaymentRequest(first.draft, now), /REQUEST_INVALID_SCHEMA/); assert.throws(() => exportPaymentRequest(first.draft.request, first.draft.request.expiresAt), /REQUEST_EXPIRED/);
  const edited = createPaymentRequestDraft({ ...wire(), recipients: [{ address: ordinary, bch: '1.24' }] }, now); assert.notEqual(edited.draft?.requestDigest, first.draft.requestDigest); assert.equal(edited.draft?.status, 'UNCONFIRMED_DRAFT');
});


test('public object API rejects sparse/accessor/extended arrays and maximum-shape export stays importable', () => {
  const sparse = new Array(1); rejected({ ...wire(), recipients: sparse }, 'REQUEST_INVALID_SCHEMA');
  const overridden = [{ ...wire().recipients[0] }]; Object.setPrototypeOf(overridden, Object.create(Array.prototype, { map: { value: () => [] } })); rejected({ ...wire(), recipients: overridden }, 'REQUEST_INVALID_SCHEMA');
  const extra = [{ ...wire().recipients[0] }]; Object.defineProperty(extra, 'trusted', { value: true }); rejected({ ...wire(), recipients: extra }, 'REQUEST_INVALID_SCHEMA');
  const symbol = [{ ...wire().recipients[0] }]; Object.defineProperty(symbol, Symbol('trusted'), { value: true }); rejected({ ...wire(), recipients: symbol }, 'REQUEST_INVALID_SCHEMA');
  let accessed = false; const accessor = new Array(1); Object.defineProperty(accessor, '0', { get: () => { accessed = true; return wire().recipients[0]; } }); rejected({ ...wire(), recipients: accessor }, 'REQUEST_INVALID_SCHEMA'); assert.equal(accessed, false);
  const maximum = { ...wire(), requestId: 'x'.repeat(80), recipients: Array.from({ length: 20 }, (_, i) => ({ address: aware, bch: '1000000.12345678', token: { category: (i + 1).toString(16).padStart(2, '0').repeat(32), amountAtomic: '9223372036854775807' } })) };
  const r = createPaymentRequestDraft(maximum, now); assert.equal(r.status, 'DRAFT_READY'); if (r.status !== 'DRAFT_READY') return;
  const text = exportPaymentRequest(r.draft.request, now); assert(new TextEncoder().encode(text).length <= MAX_PAYMENT_REQUEST_BYTES); assert.equal(parsePaymentRequestDraft(text, now).draft?.requestDigest, r.draft.requestDigest);
});
