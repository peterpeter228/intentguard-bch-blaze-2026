import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'eventemitter3';
import { RelayClient, RelayStatus, RelayMsgAction, generateKeyExchangeCredentials } from '@wizardconnect/core';
import { binToHex, hexToBin, hash160, hash256, hashTransaction, sha256, secp256k1, deriveHdPrivateNodeFromSeed, deriveHdPublicNode, deriveHdPath, encodeHdPublicKey,
  encodeTransaction, decodeTransaction, lockingBytecodeToCashAddress, generateSigningSerializationBCH } from '@bitauth/libauth';
import { ConnectedWallet } from '../dist/core/wallet-adapter.js';
import { PaymentJournal } from '../dist/core/operation-store.js';
import { PaymentChain } from '../dist/core/payment-chain.js';
import { PaymentFlow } from '../dist/core/payment-flow.js';
import { createPaymentServer } from '../dist/core/server.js';
import { createPaymentRequestDraft } from '../dist/core/payment-request.js';
import { verifySignedPlan } from '../dist/core/signed-verifier.js';
import { createEvidenceCollector, deriveSessionOwnership } from '../dist/core/evidence.js';

/** TEST ONLY: fresh in-memory Chipnet-labelled keys, synthetic RPC/relay, NO chain transaction. */
async function instance(options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'intentguard-payment-')), directory = join(root, 'journal');
  let journal = PaymentJournal.create(directory), sends = 0, signs = 0, storedSigned = null, sessionChanged = false;
  const master = deriveHdPrivateNodeFromSeed(randomBytes(32));
  const privateNode = deriveHdPath(master, 'm/0/0'), pub = secp256k1.derivePublicKeyCompressed(privateNode.privateKey);
  const ownedScript = '76a914' + binToHex(hash160(pub)) + '88ac';
  const parent = { version: 2, locktime: 0, inputs: [{ outpointTransactionHash: new Uint8Array(32).fill(9), outpointIndex: 1, sequenceNumber: 0xffffffff, unlockingBytecode: Uint8Array.of(0) }],
    outputs: [{ lockingBytecode: hexToBin(ownedScript), valueSatoshis: 10000n }] };
  const parentHex = binToHex(encodeTransaction(parent)), parentId = hashTransaction(hexToBin(parentHex));
  const header = new Uint8Array(80); new DataView(header.buffer).setUint32(68, Math.floor(Date.now() / 1000), true);
  const headerHex = binToHex(header), headerHash = binToHex(hash256(header).reverse());
  const paths = ['receive', 'change'].map((name, index) => ({ name, xpub: encodeHdPublicKey({ network: 'testnet', node: deriveHdPublicNode(deriveHdPath(master, 'm/' + index)) }).hdPublicKey }));
  const messages = [], credentials = generateKeyExchangeCredentials(), events = new EventEmitter();
  class Wire extends RelayClient {
    async relay(message) {
      messages.push(message);
      if (message.action !== RelayMsgAction.SignTransactionRequest) return;
      signs++; assert.equal(message.transaction.broadcast, false);
      const tx = decodeTransaction(hexToBin(message.transaction.transaction)); assert.notEqual(typeof tx, 'string');
      assert.deepEqual(message.inputPaths, [[0, 'receive', 0]]);
      const serialization = generateSigningSerializationBCH({ inputIndex: 0, transaction: tx, sourceOutputs: message.transaction.sourceOutputs },
        { coveredBytecode: message.transaction.sourceOutputs[0].lockingBytecode, signingSerializationType: Uint8Array.of(options.flag ?? 0x61) });
      const signature = secp256k1.signMessageHashSchnorr(privateNode.privateKey, hash256(serialization)); assert.notEqual(typeof signature, 'string');
      tx.inputs[0].unlockingBytecode = Uint8Array.from([65, ...signature, options.flag ?? 0x61, 33, ...pub]);
      options.mutate?.(tx);
      const response = { action: RelayMsgAction.SignTransactionResponse, sequence: message.sequence, time: Math.floor(Date.now() / 1000), signedTransaction: binToHex(encodeTransaction(tx)) };
      if (options.cancel) wallet.disconnect();
      queueMicrotask(() => this.emit('message', response));
    }
  }
  const wire = new Wire({ explicitRelayUrls: [], signerPrivateKey: randomBytes(32), logNetworkActivity: false });
  wire.setPairedPublicKey(wire.getPublicKey());
  let dispatch;
  const wallet = new ConnectedWallet(() => { sessionChanged = true; }, callback => { dispatch = callback; return { client: wire, credentials, events, uri: 'PRIVATE_SYNTHETIC_PAIRING', qrUri: '', cleanup: () => {} }; });
  wallet.connect('chipnet'); dispatch({ client: wire, status: RelayStatus.connected() });
  events.emit('keyexchangecomplete', wire.getPublicKey());
  wire.emit('message', { action: RelayMsgAction.WalletReady, time: Math.floor(Date.now() / 1000), public_key: binToHex(wire.getPublicKey()), secret: credentials.secret,
    wallet_name: 'TEST ONLY', wallet_icon: '', supported_protocols: ['hdwalletv1'], dapp_discovered: true, session: { hdwalletv1: { paths } } });
  const bindings = wallet.paths(0, 0); assert.equal(bindings[0].script, ownedScript);
  const source = async (method, params, index) => {
    if (method === 'server.features') return { genesis_hash: '00'.repeat(32), hash_function: 'sha256', cashtokens: true };
    if (method === 'blockchain.block.header') {
      if (params[0] === 90 || !storedSigned) return headerHex;
      const inclusion = new Uint8Array(header); inclusion.set(hexToBin(hashTransaction(hexToBin(storedSigned))).reverse(), 36);
      if (options.conflict && index === 1) inclusion[0] ^= 1;
      return binToHex(inclusion);
    }
    if (method === 'blockchain.headers.subscribe') return { height: 100, hex: headerHex };
    if (method === 'blockchain.scripthash.listunspent') {
      if (options.disappeared) return [];
      const expected = binToHex(sha256.hash(hexToBin(ownedScript)).reverse());
      return params[0] === expected ? [{ tx_hash: parentId, tx_pos: 0, value: options.disagree && index === 1 ? 9999 : 10000, height: 99, ...(options.token ? { token_data: { amount: '1' } } : {}) }] : [];
    }
    if (method === 'blockchain.transaction.get') {
      if (params[0] === parentId) return parentHex;
      if (storedSigned && params[0] === hashTransaction(hexToBin(storedSigned))) return storedSigned;
      throw Error('ORIGINAL_NOT_FOUND');
    }
    if (method === 'blockchain.scripthash.get_history') return storedSigned ? [{ tx_hash: hashTransaction(hexToBin(storedSigned)), height: options.confirmed ? 99 : 0 }] : [];
    if (method === 'blockchain.transaction.get_merkle') return { block_height: params[1], pos: 0, merkle: [] };
    throw Error('UNSUPPORTED_SYNTHETIC_READ');
  };
  const sources = [0, 1].map(index => ({ id: 'fixture-' + index, operatorId: 'fixture-operator-' + index, network: 'chipnet', kind: 'synthetic', genesisHash: '00'.repeat(32), checkpoint: { height: 90, hash: headerHash }, maxTipAgeMs: 7200000, transport: { request: (m, p) => source(m, p, index) } }));
  const chain = new PaymentChain(sources, async raw => { sends++; storedSigned = raw; if (options.loss) throw Error('RESPONSE_LOST'); return hashTransaction(hexToBin(raw)); }, Date.now,
    (sourceId, method, params) => source(method, params, Number(sourceId.slice(-1))));
  let server;
  const launch = async () => { server = createPaymentServer(new PaymentFlow(journal, chain)); await new Promise(r => server.listen(0, '127.0.0.1', r)); };
  await launch();
  const api = async body => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/payment`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${server.address().port}` }, body: JSON.stringify(body) });
    return { http: response.status, value: await response.json() };
  };
  const recipient = lockingBytecodeToCashAddress({ bytecode: hexToBin('76a914' + '22'.repeat(20) + '88ac'), prefix: 'bchtest' });
  assert.notEqual(typeof recipient, 'string');
  const request = { schemaVersion: 1, kind: 'intentguard-payment-request', requestId: 'one-economic-payment', network: 'chipnet', expiresAt: Date.now() + 60000, maxFeeBch: '0.000006', recipients: [{ address: recipient.address, bch: '0.00005' }] };
  const reviewed = createPaymentRequestDraft(request, Date.now()); assert.equal(reviewed.status, 'DRAFT_READY');
  const prepare = { action: 'prepare', request, expectedRequestDigest: reviewed.draft.requestDigest, scripts: bindings.map(p => p.script), changeScript: bindings[1].script,
    feePolicy: { targetSatoshisPer1000Bytes: '1000', maxSatoshisPer1000Bytes: '3000', signatureModel: 'compressed-p2pkh-schnorr', allowBchDustToFee: false } };
  return { api, prepare, chain, wallet, bindings, options, stats: () => ({ sends, signs }), original: () => storedSigned,
    port: () => server.address().port, journal: () => journal,
    restart: async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); journal.close(); journal = PaymentJournal.open(directory); await launch(); },
    close: async () => { wallet.disconnect(); server.closeAllConnections(); await new Promise(r => server.close(r)); journal.close(); await rm(root, { recursive: true }); } };
}
async function signed(f) {
  const prepared = await f.api(f.prepare); assert.equal(prepared.http, 200, JSON.stringify(prepared.value));
  let op = prepared.value, capability = op.capability;
  const ownership = deriveSessionOwnership(f.wallet, f.wallet.currentSessionId(), f.bindings, Date.now());
  const evidence = await createEvidenceCollector(f.chain.sources)(op.build.intent, op.plan.unsignedHex, ownership);
  assert.equal(evidence.status, 'SYNTHETIC_MATCH');
  const sequence = f.wallet.nextSequence('chipnet', new AbortController().signal);
  const reserved = await f.api({ action: 'reserve', id: op.id, revision: op.revision, capability, sequence, sessionId: f.wallet.currentSessionId(), planDigest: op.plan.planDigest });
  assert.equal(reserved.http, 200); op = reserved.value;
  assert.equal(f.journal().get(op.id).state, 'SIGNING');
  const result = await f.wallet.sign('chipnet', op.envelope, op.plan, f.bindings, new AbortController().signal);
  const checked = verifySignedPlan({ buildInput: op.build, signedHex: result.signedHex });
  const saved = await f.api({ action: 'signed', id: op.id, revision: op.revision, capability, envelope: result.envelope, signedHex: result.signedHex });
  assert.equal(saved.http, 200); return { op: saved.value, capability, checked, result };
}
export async function drivePayment(options = {}) {
  const f = await instance(options);
  try {
    assert.equal((await f.api({ action: 'config' })).value.mainnetCapSatoshis, '0'); // doctor
    const { op, capability, checked } = await signed(f); assert.equal(checked.status, 'SIGNED_PLAN_VALID_OFFLINE'); assert.equal(op.state, 'POSTCHECKED');
    assert.equal(f.journal().get(op.id).txid, op.txid); assert.equal(f.stats().sends, 0);
    await f.restart(); // Durable signed bytes/hash before effect.
    const send = { action: 'broadcast', id: op.id, revision: op.revision, capability };
    const replies = await Promise.all([f.api(send), f.api(send)]);
    assert.equal(replies.filter(r => r.http === 200).length, 1); assert.equal(f.stats().sends, 1);
    const current = (await f.api({ action: 'get', id: op.id })).value;
    assert.equal(current.recoveryObservation.status, 'OBSERVED');
    await f.restart();
    const replay = await f.api({ ...send, revision: current.revision }); assert.equal(replay.http, 409); assert.equal(f.stats().sends, 1);
    const recovered = (await f.api({ action: 'get', id: op.id })).value;
    assert.equal(recovered.txid, hashTransaction(hexToBin(f.original())));
    return { kind: 'MOCK_TRANSPORT', chainTransaction: false, liveWallet: 'NOT_RUN', mainnetCapSatoshis: '0',
      journalState: recovered.state, recoveryObservation: recovered.recoveryObservation.status, signCalls: f.stats().signs, sendCalls: f.stats().sends,
      journey: ['launch', 'doctor', 'SDK session', 'independent terms confirmation', 'HTTP build', 'session/node preflight', 'reserve', 'sign-only', 'postGuard+crypto', 'restart', 'one reserved send', 'response/recovery', 'restart/no-resend', 'owned cleanup'] };
  } finally { await f.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  test('HTTP connected-wallet guarded payment and durable restart (MOCK_TRANSPORT / NO_CHAIN_TRANSACTION)', async () => { const r = await drivePayment(); assert.equal(r.sendCalls, 1); assert.equal(r.signCalls, 1); });
  test('accepted send with lost response reconciles ORIGINAL hash, never resends (synthetic)', async () => { const r = await drivePayment({ loss: true }); assert.equal(r.journalState, 'UNKNOWN'); assert.equal(r.recoveryObservation, 'OBSERVED'); });
  test('post-sign all non-unlocking bytes, cryptosignature and WizardConnect0x61 flag checked before any send', async () => {
    for (const options of [{ mutate: tx => { tx.outputs[0].valueSatoshis++; } }, { mutate: tx => { tx.inputs[0].unlockingBytecode[10] ^= 1; } }, { mutate: tx => { tx.locktime++; } }, { flag: 0x41 }]) {
      const f = await instance(options);
      try { const { op, capability } = await signed(f); assert.equal(op.state, 'NEEDS_REVIEW');
        assert.equal((await f.api({ action: 'broadcast', id: op.id, revision: op.revision, capability })).http, 409); assert.equal(f.stats().sends, 0);
      } finally { await f.close(); }
    }
  });
  test('cancelled/late response, consumed input disappearance, mismatched sources/token summaries cannot pay', async () => {
    for (const options of [{ cancel: true }, { disappeared: true }, { disagree: true }, { token: true }]) {
      const f = await instance(options);
      try { if (options.cancel) await assert.rejects(signed(f), /SIGNING_UNKNOWN/); else assert.equal((await f.api(f.prepare)).http, 409); assert.equal(f.stats().sends, 0); }
      finally { await f.close(); }
    }
  });
  test('HTTP rejects duplicate keys, origin/host tampering, forged authority fields and unconfirmed edited requests', async () => {
    const f = await instance();
    try {
      const base = `http://127.0.0.1:${f.port()}`;
      assert.equal((await fetch(base + '/api/payment', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: '{"action":"config","action":"broadcast"}' })).status, 400);
      assert.equal((await fetch(base + '/api/payment', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{"action":"config"}' })).status, 403);
      assert.equal((await f.api({ ...f.prepare, ownershipVerified: true })).http, 409);
      assert.equal((await f.api({ ...f.prepare, request: { ...f.prepare.request, maxFeeBch: '0.1' } })).http, 409);
      const first = await f.api(f.prepare); assert.equal(first.http, 200);
      assert.equal((await f.api(f.prepare)).http, 409);
      assert.equal((await f.api({ action: 'observe', id: first.value.id, revision: first.value.revision, capability: first.value.capability })).value.issue, 'ORIGINAL_HASH_REQUIRED');
      await f.restart(); assert.equal((await f.api(f.prepare)).http, 409); assert.deepEqual(f.stats(), { sends: 0, signs: 0 });
      const reserve = { action: 'reserve', id: first.value.id, revision: first.value.revision, capability: first.value.capability,
        sequence: f.wallet.nextSequence('chipnet', new AbortController().signal), sessionId: f.wallet.currentSessionId(), planDigest: first.value.plan.planDigest };
      const signing = (await f.api(reserve)).value; assert.equal(signing.state, 'SIGNING');
      await f.restart();
      const recovered = (await f.api({ action: 'get', id: first.value.id })).value;
      assert.equal(recovered.state, 'SIGNING'); assert.equal(recovered.txid, null);
      assert.equal((await f.api({ ...reserve, revision: recovered.revision, sequence: 999 })).http, 409);
      const unknown = (await f.api({ action: 'uncertain', id: recovered.id, revision: recovered.revision, capability: first.value.capability })).value;
      assert.equal((await f.api({ action: 'observe', id: unknown.id, revision: unknown.revision, capability: first.value.capability })).value.issue, 'ORIGINAL_HASH_REQUIRED');
      assert.deepEqual(f.stats(), { sends: 0, signs: 0 });
    } finally { await f.close(); }
  });
  test('matching original raw bytes and inclusion confirm; later source conflict invalidates the receipt', async () => {
    const options = { confirmed: true }, f = await instance(options);
    try {
      const { op, capability } = await signed(f);
      let current = (await f.api({ action: 'broadcast', id: op.id, revision: op.revision, capability })).value;
      current = (await f.api({ action: 'observe', id: current.id, revision: current.revision, capability })).value;
      assert.equal(current.state, 'CONFIRMED_ON_CHAIN'); assert.match(current.observation.blockHash, /^[0-9a-f]{64}$/);
      options.conflict = true;
      const readOnly = (await f.api({ action: 'get', id: current.id })).value;
      assert.equal(readOnly.state, 'CONFLICTED');
      assert.equal(readOnly.persistedState, 'CONFIRMED_ON_CHAIN');
      current = (await f.api({ action: 'observe', id: current.id, revision: current.revision, capability })).value;
      assert.equal(current.state, 'CONFLICTED'); assert.equal(f.stats().sends, 1);
    } finally { await f.close(); }
  });
  test('late original bytes remain quarantined and duplicate signing reservations cannot replay', async () => {
    const f = await instance();
    try {
      const { op, capability, result } = await signed(f);
      const unknown = (await f.api({ action: 'uncertain', id: op.id, revision: op.revision, capability })).value;
      const late = (await f.api({ action: 'signed', id: op.id, revision: unknown.revision, capability, envelope: result.envelope, signedHex: result.signedHex })).value;
      assert.equal(late.state, 'NEEDS_REVIEW'); assert.equal(late.txid, op.txid);
      assert.equal((await f.api({ action: 'broadcast', id: op.id, revision: late.revision, capability })).http, 409);
      await f.restart();
      assert.equal((await f.api({ action: 'reserve', id: op.id, revision: late.revision, capability, sequence: 999, sessionId: 'aa'.repeat(32), planDigest: op.plan.planDigest })).http, 409);
      assert.deepEqual(f.stats(), { signs: 1, sends: 0 });
    } finally { await f.close(); }
  });
}
