import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PaymentJournal } from './operation-store.js';
import { buildUnsignedPlan } from './unsigned-builder.js';
import { fixture, owner } from './fixtures.js';
import { hashTransaction, hexToBin, decodeTransaction, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { PaymentFlow } from './payment-flow.js';
import { PaymentChain } from './payment-chain.js';
import { createPaymentRequestDraft } from './payment-request.js';

test('mainnet unsigned construction preserves all terms with empty unlocks; flow cannot promote it to signing', async () => {
  const { input, candidate } = fixture();
  const build = { intent: { ...input.intent, network: 'mainnet' as const }, snapshot: { ...input.snapshot, network: 'mainnet' as const },
    selectedInputs: [{ txid: hashTransaction(hexToBin(input.snapshot.parentTransactionHexes[0]!)), index: 0 }], changeScript: owner, now: input.now,
    feePolicy: { signatureModel: 'compressed-p2pkh-schnorr' as const, targetSatoshisPer1000Bytes: '1000', maxSatoshisPer1000Bytes: '3000', allowBchDustToFee: false } };
  const plan = buildUnsignedPlan(build); assert.equal(plan.status, 'BUILT_OFFLINE');
  const tx = decodeTransaction(hexToBin(plan.unsignedHex!)); assert.notEqual(typeof tx, 'string');
  if (typeof tx === 'string') throw Error(tx);
  assert.deepEqual(tx.outputs[0], candidate.outputs[0]); assert.equal(tx.inputs[0]!.unlockingBytecode.length, 0);
  const root = mkdtempSync(join(tmpdir(), 'intentguard-cap-')), journal = PaymentJournal.create(join(root, 'journal'));
  let sends = 0;
  try {
    const flow = new PaymentFlow(journal, new PaymentChain(undefined, async () => { sends++; throw Error('MUST_NOT_SEND'); }));
    const address = lockingBytecodeToCashAddress({ bytecode: candidate.outputs[0]!.lockingBytecode, prefix: 'bitcoincash' });
    if (typeof address === 'string') throw Error(address);
    const request = { schemaVersion: 1, kind: 'intentguard-payment-request', requestId: 'mainnet', network: 'mainnet', expiresAt: Date.now() + 60000, maxFeeBch: '0.000006', recipients: [{ address: address.address, bch: '0.00001' }] };
    const parsed = createPaymentRequestDraft(request, Date.now()); assert.equal(parsed.status, 'DRAFT_READY');
    if (parsed.status !== 'DRAFT_READY') throw Error('INVALID_FIXTURE');
    await assert.rejects(flow.handle({ action: 'prepare', request, expectedRequestDigest: parsed.draft.requestDigest, scripts: [owner], changeScript: owner, feePolicy: build.feePolicy }), /^Error: MAINNET_CAP_ZERO$/);
    assert.equal(sends, 0);
  } finally { journal.close(); rmSync(root, { recursive: true }); }
});
test('missing payment store cannot silently initialize recovery', () => {
  const root = mkdtempSync(join(tmpdir(), 'intentguard-missing-'));
  try { assert.throws(() => PaymentJournal.open(join(root, 'missing'))); }
  finally { rmSync(root, { recursive: true }); }
});
