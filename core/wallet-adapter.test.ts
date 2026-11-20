import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'eventemitter3';
import { RelayClient, RelayStatus, RelayMsgAction, SimplePool, decodeKeyExchangeURI, generateKeyExchangeCredentials, type RelayStatusCallback, type ProtocolMessage, type WalletReadyMessage } from '@wizardconnect/core';
import { deriveHdPrivateNodeFromSeed, deriveHdPublicNode, deriveHdPath, encodeHdPublicKey, binToHex, hexToBin, hashTransaction, encodeTransaction } from '@bitauth/libauth';
import { ConnectedWallet, type RelayStarter, type SignEnvelope } from './wallet-adapter.js';
import { buildUnsignedPlan } from './unsigned-builder.js';
import { fixture } from './fixtures.js';

/** Actual pinned manager + relay-client public seam; no WebSocket or chain. */
function harness(options: { onSend?: (msg: ProtocolMessage) => Promise<void>; onCleanup?: () => void } = {}) {
  const messages: ProtocolMessage[] = [];
  class Wire extends RelayClient {
    override async relay(message: ProtocolMessage): Promise<void> { messages.push(message); await options.onSend?.(message); }
  }
  const wire = new Wire({ explicitRelayUrls: [], signerPrivateKey: randomBytes(32), logNetworkActivity: false });
  wire.setPairedPublicKey(wire.getPublicKey());
  const credentials = generateKeyExchangeCredentials();
  const events = new EventEmitter<{ keyexchangecomplete: [Uint8Array] }>();
  let status: RelayStatusCallback = () => {}, starts = 0;
  const start: RelayStarter = callback => { starts++; status = callback; return { client: wire, credentials, uri: 'PRIVATE_PAIRING_NOT_CAPTURED', qrUri: '', events, cleanup: () => options.onCleanup?.() }; };
  const quarantined: { envelope: SignEnvelope; signedHex: string }[] = [];
  const wallet = new ConnectedWallet(() => {}, start, (envelope, signedHex) => { quarantined.push({ envelope, signedHex }); });
  const root = deriveHdPrivateNodeFromSeed(randomBytes(32));
  const paths = ['receive', 'change'].map((name, i) => ({ name, xpub: encodeHdPublicKey({ network: 'testnet', node: deriveHdPublicNode(deriveHdPath(root, 'm/' + i)) }).hdPublicKey }));
  const ready = { action: RelayMsgAction.WalletReady, time: Math.floor(Date.now() / 1000), wallet_name: 'SYNTHETIC TEST WALLET', wallet_icon: '', dapp_discovered: true,
    supported_protocols: ['hdwalletv1'], session: { hdwalletv1: { paths } }, public_key: 'ab'.repeat(32), secret: credentials.secret } satisfies WalletReadyMessage;
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
test('pairing, idle and pending sign survive reconnect without replay; response before EOSE is retained', async () => {
  const h = harness();
  const reconnect = () => h.status(RelayStatus.reconnecting('synthetic drop'));
  const connected = () => h.status(RelayStatus.connected());
  try {
    h.wallet.connect('chipnet'); reconnect(); connected();
    h.events.emit('keyexchangecomplete', hexToBin(h.ready.public_key)); h.wire.emit('message', h.ready);
    const id = h.wallet.currentSessionId(); assert.ok(id);
    reconnect(); assert.equal(h.wallet.currentSessionId(), null); connected(); h.wire.emit('message', h.ready);
    assert.equal(h.wallet.currentSessionId(), id);
    const { plan, envelope, bindings } = h.candidate(), signal = new AbortController().signal;
    const promise = h.wallet.sign('chipnet', envelope, plan, bindings, signal);
    reconnect();
    assert.throws(() => h.wallet.nextSequence('chipnet', signal), /SESSION_UNAVAILABLE/);
    h.wire.emit('message', h.ready);
    h.wire.emit('message', { action: RelayMsgAction.SignTransactionResponse, sequence: envelope.sequence, time: h.ready.time, signedTransaction: '0100' });
    connected(); h.wire.emit('message', h.ready);
    assert.deepEqual(await promise, { envelope, signedHex: '0100' });
    assert.equal(h.wallet.currentSessionId(), id);
    await assert.rejects(h.wallet.sign('chipnet', envelope, plan, bindings, signal), /ATTEMPT_MISMATCH/);
    const sequence = h.wallet.nextSequence('chipnet', signal);
    await assert.rejects(h.wallet.sign('chipnet', { ...envelope, sequence }, plan, bindings, signal), /ATTEMPT_MISMATCH/);
    assert.equal(h.messages.filter(m => m.action === RelayMsgAction.SignTransactionRequest).length, 1);
  } finally { await h.wallet.disconnect(); }
});

test('terminal transport and unauthenticated repeats revoke a pending sign immediately', async () => {
  const cases: ((h: ReturnType<typeof harness>) => void)[] = [
    h => h.status(RelayStatus.disconnected()),
    h => h.status(RelayStatus.sessionDeleted()),
    h => h.wire.emit('message', { action: RelayMsgAction.Disconnect, time: h.ready.time, reason: 'user_disconnect' }),
    h => h.wire.emit('message', { ...h.ready, secret: 'wrong' }),
    h => h.wire.emit('message', { ...h.ready, public_key: 'cd'.repeat(32) }),
    h => h.wire.emit('message', { ...h.ready, supported_protocols: [] }),
    ...[0, 1].map(index => (h: ReturnType<typeof harness>) => h.wire.emit('message', { ...h.ready, session: { hdwalletv1: {
      paths: h.ready.session.hdwalletv1.paths.map((p, i, paths) => i === index ? { ...p, xpub: paths[1 - i]!.xpub } : p),
    } } })),
  ];
  for (const [index, fail] of cases.entries()) {
    const h = harness();
    try {
      h.connect(); const { plan, envelope, bindings } = h.candidate();
      const promise = h.wallet.sign('chipnet', envelope, plan, bindings, new AbortController().signal);
      fail(h);
      assert.equal(h.wallet.currentSessionId(), null);
      await assert.rejects(promise, /^Error: SIGNING_UNKNOWN$/);
      assert.equal(h.messages.filter(m => m.action === RelayMsgAction.SignTransactionRequest).length, 1);
      if (index === 2) assert.ok(!h.messages.some(m => m.action === RelayMsgAction.Disconnect));
    } finally { await h.wallet.disconnect(); }
  }
});

test('failed publish is unknown, not retried on an ensuing wallet_ready', async () => {
  const h = harness({ onSend: async msg => { if (msg.action === RelayMsgAction.SignTransactionRequest) throw Error('TEST_PUBLISH_FAILED'); } });
  try {
    h.connect(); const { plan, envelope, bindings } = h.candidate();
    await assert.rejects(h.wallet.sign('chipnet', envelope, plan, bindings, new AbortController().signal), /^Error: SIGNING_UNKNOWN$/);
    h.wire.emit('message', h.ready);
    assert.equal(h.wallet.currentSessionId(), null);
    assert.equal(h.messages.filter(m => m.action === RelayMsgAction.SignTransactionRequest).length, 1);
  } finally { await h.wallet.disconnect(); }
});

test('disconnect flushes both publications before cleanup, bounded when the relay hangs', async () => {
  for (const stalled of [false, true]) {
    const cancel = Promise.withResolvers<void>(), disconnect = Promise.withResolvers<void>();
    let cleaned = false;
    const h = harness({ onCleanup: () => { cleaned = true; }, onSend: msg => msg.action === RelayMsgAction.SignCancel ? cancel.promise :
      msg.action === RelayMsgAction.Disconnect ? disconnect.promise : Promise.resolve() });
    h.connect(); const { plan, envelope, bindings } = h.candidate();
    const result = assert.rejects(h.wallet.sign('chipnet', envelope, plan, bindings, new AbortController().signal), /SIGNING_UNKNOWN/);
    const flush = h.wallet.disconnect();
    assert.equal(h.wallet.currentSessionId(), null);
    assert.equal(cleaned, false);
    await result;
    assert.deepEqual(h.messages.slice(-2).map(m => m.action), [RelayMsgAction.SignCancel, RelayMsgAction.Disconnect]);
    cancel.resolve();
    await Promise.resolve();
    assert.equal(cleaned, false);
    if (!stalled) disconnect.resolve();
    await flush;
    assert.equal(cleaned, true);
    disconnect.resolve();
  }
});

test('native relay keeps its hidden subscription and resubscribes after a silent drop', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  const clientReady = Promise.withResolvers<RelayClient>();
  const changed = Promise.withResolvers<void>();
  const ready = harness().ready;
  const wallet = new ConnectedWallet(changed.resolve);
  let subscriptions = 0, poolCloses = 0;
  t.mock.method(SimplePool.prototype, 'subscribeMany', function (_urls: string[], _filter: unknown, params: { oneose: () => void }) {
    subscriptions++;
    queueMicrotask(params.oneose);
    return { close: () => {} };
  });
  t.mock.method(SimplePool.prototype, 'publish', () => [Promise.resolve('ack')]);
  t.mock.method(SimplePool.prototype, 'close', () => { poolCloses++; });
  const connect = RelayClient.prototype.connect;
  t.mock.method(RelayClient.prototype, 'connect', async function (this: RelayClient) {
    await connect.call(this);
    clientReady.resolve(this);
  });
  const visibility = (state: string) => { document.visibilityState = state; document.dispatchEvent(new Event('visibilitychange')); };
  try {
    const { secret } = decodeKeyExchangeURI(wallet.connect('chipnet'));
    const client = await clientReady.promise;
    visibility('hidden');
    client.emit('message', { ...ready, secret });
    await changed.promise;
    const session = wallet.currentSessionId(); assert.ok(session);
    visibility('visible');
    assert.equal(subscriptions, 1);
    assert.equal(poolCloses, 0);
    assert.equal(wallet.currentSessionId(), session);
    visibility('hidden');
    const reconnect = new Promise<void>(resolve => client.once('connection', resolve));
    await client.disconnect(); // No subscription onclose callback: silent loss.
    assert.equal(client.isConnected(), false);
    assert.equal(subscriptions, 1);
    visibility('visible');
    await reconnect;
    assert.equal(subscriptions, 2);
    assert.equal(wallet.currentSessionId(), session);
  } finally {
    await wallet.disconnect();
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor); else Reflect.deleteProperty(globalThis, 'document');
  }
  visibility('hidden'); visibility('visible');
  assert.equal(subscriptions, 2);
  assert.equal(poolCloses, 2);
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
