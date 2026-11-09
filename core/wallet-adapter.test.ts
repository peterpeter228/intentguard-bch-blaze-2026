import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'eventemitter3';
import { RelayClient, RelayStatus, RelayMsgAction, generateKeyExchangeCredentials, type RelayStatusCallback, type ProtocolMessage, type SignTransactionRequest, type WalletReadyMessage } from '@wizardconnect/core';
import { deriveHdPrivateNodeFromSeed, deriveHdPublicNode, deriveHdPath, encodeHdPublicKey, binToHex, hexToBin, hashTransaction, encodeTransaction } from '@bitauth/libauth';
import { ConnectedWallet, type RelayStarter, type SignEnvelope } from './wallet-adapter.js';
import { buildUnsignedPlan } from './unsigned-builder.js';
import { fixture } from './fixtures.js';

/** Actual pinned manager + relay-client public seam; no WebSocket or chain. */
function harness() {
  const messages: ProtocolMessage[] = [];
  class Wire extends RelayClient { override async relay(message: ProtocolMessage): Promise<void> { messages.push(message); } }
  const wire = new Wire({ explicitRelayUrls: [], signerPrivateKey: randomBytes(32), logNetworkActivity: false });
  wire.setPairedPublicKey(wire.getPublicKey());
  const credentials = generateKeyExchangeCredentials();
  const events = new EventEmitter<{ keyexchangecomplete: [Uint8Array] }>();
  let status: RelayStatusCallback = () => {}, starts = 0;
  const start: RelayStarter = callback => { starts++; status = callback; return { client: wire, credentials, uri: 'PRIVATE_PAIRING_NOT_CAPTURED', qrUri: '', events, cleanup: () => {} }; };
  const quarantined: { envelope: SignEnvelope; signedHex: string }[] = [];
  const wallet = new ConnectedWallet(() => {}, start, (envelope, signedHex) => { quarantined.push({ envelope, signedHex }); });
  const root = deriveHdPrivateNodeFromSeed(randomBytes(32));
  const paths = ['receive', 'change'].map((name, i) => ({ name, xpub: encodeHdPublicKey({ network: 'testnet', node: deriveHdPublicNode(deriveHdPath(root, 'm/' + i)) }).hdPublicKey }));
  const ready: WalletReadyMessage = { action: RelayMsgAction.WalletReady, time: Math.floor(Date.now() / 1000), wallet_name: 'SYNTHETIC TEST WALLET', wallet_icon: '', dapp_discovered: true,
    supported_protocols: ['hdwalletv1'], session: { hdwalletv1: { paths } }, public_key: 'ab'.repeat(32), secret: credentials.secret };
  const connect = (): void => { wallet.connect('chipnet'); status({ client: wire, status: RelayStatus.connected() }); events.emit('keyexchangecomplete', hexToBin(ready.public_key)); wire.emit('message', ready); };
  const candidate = () => {
    const bindings = wallet.paths(0, 0), { input, parent } = fixture();
    parent.outputs[0]!.lockingBytecode = hexToBin(bindings[0]!.script);
    const raw = binToHex(encodeTransaction(parent)), id = hashTransaction(hexToBin(raw)), now = Date.now();
    const plan = buildUnsignedPlan({ intent: { ...input.intent, ownerScripts: bindings.map(p => p.script), expiresAt: now + 60000 },
      snapshot: { network: 'chipnet', observedAt: now, parentTransactionHexes: [raw], unspentOutpoints: [id + ':0'] }, selectedInputs: [{ txid: id, index: 0 }],
      changeScript: bindings[1]!.script, now, feePolicy: { signatureModel: 'compressed-p2pkh-schnorr', targetSatoshisPer1000Bytes: '1000', maxSatoshisPer1000Bytes: '3000', allowBchDustToFee: false } });
    assert.equal(plan.status, 'BUILT_OFFLINE');
    const envelope: SignEnvelope = { operationId: '01'.repeat(32), attemptId: '02'.repeat(32), revision: 1, requestDigest: '03'.repeat(32), intentDigest: plan.intentDigest!,
      planDigest: plan.planDigest!, unsignedHash: hashTransaction(hexToBin(plan.unsignedHex!)), sessionId: wallet.currentSessionId()!, sequence: wallet.nextSequence('chipnet', new AbortController().signal), expiresAt: now + 60000 };
    return { bindings, plan, envelope };
  };
  return { wallet, wire, events, ready, status: (s: RelayStatus) => status({ client: wire, status: s }), messages, connect, candidate, starts: () => starts, quarantined };
}

test('real SDK handshake is required; cached discovery and wrong shared-secret do not authenticate', () => {
  const h = harness();
  try {
    assert.equal(h.wallet.currentSessionId(), null);
    h.wallet.connect('chipnet'); h.status(RelayStatus.connected());
    h.wire.emit('message', { ...h.ready, secret: 'wrong' });
    assert.equal(h.wallet.currentSessionId(), null);
    assert.equal(h.wallet.getPubkey(0, 0n), undefined);
  } finally { h.wallet.disconnect(); }
});
test('fresh verified key exchange + hdwalletv1 supplies actual paths; disconnect is immediate, not SDK grace', () => {
  const h = harness();
  try { h.connect(); assert.match(h.wallet.currentSessionId()!, /^[0-9a-f]{64}$/); assert.equal(h.wallet.paths(0, 0).length, 2);
    h.wire.emit('message', { action: RelayMsgAction.Disconnect, reason: 'user_disconnect', time: Math.floor(Date.now() / 1000) });
    assert.equal(h.wallet.currentSessionId(), null); assert.equal(h.wallet.hasPath(0), false);
  } finally { h.wallet.disconnect(); }
});
test('mainnet and already-aborted invocation refuse before relay allocation/sign message', async () => {
  const h = harness();
  try {
    assert.throws(() => h.wallet.connect('mainnet'), /MAINNET_CAP_ZERO/); assert.equal(h.starts(), 0);
    h.connect(); const { plan, envelope, bindings } = h.candidate(), c = new AbortController(); c.abort();
    await assert.rejects(h.wallet.sign('chipnet', envelope, plan, bindings, c.signal), /ABORTED/);
    await assert.rejects(h.wallet.sign('mainnet', envelope, plan, bindings, new AbortController().signal), /MAINNET_CAP_ZERO/);
    await assert.rejects(h.wallet.sign('chipnet', { ...envelope, expiresAt: Date.now() - 1 }, plan, bindings, new AbortController().signal), /INTENT_EXPIRED/);
    assert.equal(h.messages.filter(m => m.action === RelayMsgAction.SignTransactionRequest).length, 0);
  } finally { h.wallet.disconnect(); }
});
test('actual low-level SDK request uses complete source input+output and broadcast:false; response binds sequence', async () => {
  const h = harness();
  try {
    h.connect(); const { plan, envelope, bindings } = h.candidate();
    const promise = h.wallet.sign('chipnet', envelope, plan, bindings, new AbortController().signal);
    const request = h.messages.find(m => m.action === RelayMsgAction.SignTransactionRequest) as SignTransactionRequest;
    assert.equal(request.transaction.broadcast, false); assert.deepEqual(request.inputPaths, [[0, 'receive', 0]]);
    assert.equal(request.transaction.sourceOutputs[0]!.outpointIndex, 0); assert.equal(request.transaction.sourceOutputs[0]!.valueSatoshis, 10000n);
    h.wire.emit('message', { action: RelayMsgAction.SignTransactionResponse, sequence: envelope.sequence, time: Math.floor(Date.now() / 1000), signedTransaction: '0100' });
    assert.deepEqual(await promise, { envelope, signedHex: '0100' });
  } finally { h.wallet.disconnect(); }
});
test('candidate/session substitutions refuse; cancellation removes SDK pending replay and late callback cannot sign again', async () => {
  const h = harness();
  try {
    h.connect(); const { plan, envelope, bindings } = h.candidate(), c = new AbortController();
    await assert.rejects(h.wallet.sign('chipnet', { ...envelope, unsignedHash: 'ff'.repeat(32) }, plan, bindings, c.signal), /ATTEMPT_MISMATCH/);
    const promise = h.wallet.sign('chipnet', envelope, plan, bindings, c.signal); c.abort();
    await assert.rejects(promise, /SIGNING_UNKNOWN/); assert.equal(h.wallet.currentSessionId(), null);
    // Real manager's walletready replay loop now finds no pending request.
    h.wire.emit('message', h.ready);
    h.wire.emit('message', { action: RelayMsgAction.SignTransactionResponse, time: Math.floor(Date.now() / 1000), sequence: envelope.sequence, signedTransaction: '0100' });
    assert.deepEqual(h.quarantined, [{ envelope, signedHex: '0100' }]);
    assert.equal(h.messages.filter(m => m.action === RelayMsgAction.SignTransactionRequest).length, 1);
    assert.equal(h.messages.filter(m => m.action === RelayMsgAction.SignCancel).length, 1);
  } finally { h.wallet.disconnect(); }
});
test('relay reconnect and repeat wallet_ready invalidate rather than resending a pending signature', async () => {
  for (const reconnect of [true, false]) {
    const h = harness();
    try { h.connect(); const { plan, envelope, bindings } = h.candidate();
      const promise = h.wallet.sign('chipnet', envelope, plan, bindings, new AbortController().signal);
      if (reconnect) h.status(RelayStatus.reconnecting('synthetic drop')); else h.wire.emit('message', h.ready);
      await assert.rejects(promise, /SIGNING_UNKNOWN/);
      assert.equal(h.messages.filter(m => m.action === RelayMsgAction.SignTransactionRequest).length, 1);
    } finally { h.wallet.disconnect(); }
  }
});
test('malformed or error response is bounded SIGNING_UNKNOWN, never raw SDK errors', async () => {
  for (const response of [{ signedTransaction: '<untrusted>' }, { error: 'PRIVATE_MARKER_DO_NOT_ECHO' }, { signedTransaction: '0100', time: 0 }]) {
    const h = harness();
    try { h.connect(); const { plan, envelope, bindings } = h.candidate();
      const promise = h.wallet.sign('chipnet', envelope, plan, bindings, new AbortController().signal);
      h.wire.emit('message', { action: RelayMsgAction.SignTransactionResponse, sequence: envelope.sequence, time: Math.floor(Date.now() / 1000), ...response });
      await assert.rejects(promise, /^Error: SIGNING_UNKNOWN$/);
    } finally { h.wallet.disconnect(); }
  }
});
