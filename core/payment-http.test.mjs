import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
  const fundingParents = [parent, ...[2, 3].map(outpointIndex => ({ ...parent, inputs: [{ ...parent.inputs[0], outpointIndex }] }))].map(tx => {
    const raw = binToHex(encodeTransaction(tx)); return { raw, id: hashTransaction(hexToBin(raw)) };
  });
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
      await options.beforeFunding?.();
      if (options.disappeared) return [];
      const expected = binToHex(sha256.hash(hexToBin(ownedScript)).reverse());
      const funding = fundingParents[options.fundingVariant ?? 0];
      return params[0] === expected ? [{ tx_hash: funding.id, tx_pos: 0, value: options.disagree && index === 1 ? 9999 : 10000, height: 99, ...(options.token ? { token_data: { amount: '1' } } : {}) }] : [];
    }
    if (method === 'blockchain.transaction.get') {
      const funding = fundingParents.find(p => p.id === params[0]);
      if (funding) return funding.raw;
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
async function refuseRevision(f, op, capability) {
  const before = f.journal().get(op.id);
  const result = await f.api({ ...f.prepare, action: 'revise', id: op.id, revision: op.revision, capability });
  assert.equal(result.http, 409); assert.deepEqual(f.journal().get(op.id), before);
}
export async function drivePayment(options = {}) {
  const f = await instance(options);
  try {
    assert.equal((await f.api({ action: 'config' })).value.mainnetCapSatoshis, '0'); // doctor
    const { op, capability, checked } = await signed(f); assert.equal(checked.status, 'SIGNED_PLAN_VALID_OFFLINE'); assert.equal(op.state, 'POSTCHECKED');
    await refuseRevision(f, op, capability);
    assert.equal(f.journal().get(op.id).txid, op.txid); assert.equal(f.stats().sends, 0);
    await f.restart(); // Durable signed bytes/hash before effect.
    const send = { action: 'broadcast', id: op.id, revision: op.revision, capability };
    const replies = await Promise.all([f.api(send), f.api(send)]);
    assert.equal(replies.filter(r => r.http === 200).length, 1); assert.equal(f.stats().sends, 1);
    const current = (await f.api({ action: 'get', id: op.id })).value;
    await refuseRevision(f, current, capability);
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
/** Compiled UI handlers -> real HTTP/builder/SQLite; public-wallet/RPC seams only.
 * No browser/stock-wallet claim. No signature or send is permitted on this path. */
export async function driveUnsignedRevision() {
  const f = await instance(), originals = { document: globalThis.document, window: globalThis.window, localStorage: globalThis.localStorage, fetch: globalThis.fetch };
  const prototypes = {}, elements = new Map(), storage = new Map(), requests = [];
  const session = f.wallet.currentSessionId(), getPubkey = f.wallet.getPubkey.bind(f.wallet), hasPath = f.wallet.hasPath.bind(f.wallet);
  let signCalls = 0;
  class Element {
    value = ''; checked = false; disabled = false; hidden = false; textContent = ''; listeners = new Map();
    addEventListener(event, fn) { const list = this.listeners.get(event) ?? []; list.push(fn); this.listeners.set(event, list); }
    emit(event) { if (event === 'click' && this.disabled) return; for (const fn of this.listeners.get(event) ?? []) fn({ target: this }); }
  }
  const el = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const wait = async predicate => { for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 5)); } throw Error('UI_TRANSITION_TIMEOUT'); };
  const click = async id => { assert.equal(el(id).disabled, false, id); el(id).emit('click'); await new Promise(r => setImmediate(r)); };
  try {
    const html = await readFile(new URL('./payment.html', import.meta.url), 'utf8');
    for (const tag of html.matchAll(/<[^>]+id="([^"]+)"[^>]*>/g)) { el(tag[1]).disabled = /\bdisabled\b/.test(tag[0]); el(tag[1]).value = tag[0].match(/\bvalue="([^"]*)"/)?.[1] ?? ''; }
    el('network').value = 'chipnet'; el('chain-ack').checked = true; el('recipient').value = f.prepare.request.recipients[0].address;
    globalThis.document = { getElementById: el }; globalThis.window = { addEventListener() {} };
    globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/payment');
      const base = `http://127.0.0.1:${f.port()}`;
      const response = await originals.fetch(base + url, { ...options, headers: { ...options.headers, Origin: base } });
      if (JSON.parse(options.body).action !== 'config') requests.push({ action: JSON.parse(options.body).action, http: response.status, value: await response.clone().json() }); return response;
    };
    for (const [name, implementation] of Object.entries({ currentSessionId: () => session, paths: () => f.bindings, getPubkey, hasPath,
      sign: () => { signCalls++; throw Error('FORBIDDEN_UI_SIGN'); } })) {
      prototypes[name] = ConnectedWallet.prototype[name]; ConnectedWallet.prototype[name] = implementation;
    }
    await import(pathToFileURL(resolve('dist/core/payment-ui.js')).href + '?unsigned-revision=' + Date.now());
    await wait(() => !el('connect').disabled);
    await click('review'); await click('confirm'); await click('build'); await wait(() => !el('sign').disabled);
    const first = requests.at(-1).value;
    assert.equal(first.state, 'PREFLIGHTED'); assert.equal(first.envelope, null);
    assert.equal(decodeTransaction(hexToBin(first.plan.unsignedHex)).outputs[0].valueSatoshis, 5000n);
    const requestId = storage.get('intentguard/payment/chipnet/request-id');
    el('amount').value = '0.00004'; el('amount').emit('input');
    assert.equal(el('sign').disabled, true); assert.equal(el('build').disabled, true);
    assert.ok(!el('candidate').textContent.includes(first.plan.planDigest));
    await click('review'); assert.equal(el('build').disabled, true); await click('confirm'); await click('build');
    await wait(() => requests.length === 2 && (!el('sign').disabled || el('result').textContent === 'ECONOMIC_KEY_EXISTS'));
    const second = requests.at(-1); assert.equal(second.http, 200, JSON.stringify(second)); assert.equal(second.action, 'revise');
    const revised = second.value, tx = decodeTransaction(hexToBin(revised.plan.unsignedHex)); assert.notEqual(typeof tx, 'string');
    assert.equal(revised.id, first.id); assert.equal(revised.revision, first.revision + 1); assert.notEqual(revised.plan.planDigest, first.plan.planDigest);
    assert.notEqual(revised.requestDigest, first.requestDigest); assert.equal(storage.get('intentguard/payment/chipnet/request-id'), requestId);
    assert.deepEqual(tx.outputs, [{ lockingBytecode: hexToBin('76a914' + '22'.repeat(20) + '88ac'), valueSatoshis: 4000n },
      { lockingBytecode: hexToBin(f.bindings[1].script), valueSatoshis: 10000n - 4000n - BigInt(revised.plan.feeSatoshis) }]);
    assert.ok(tx.inputs.every(i => i.unlockingBytecode.length === 0)); assert.equal(revised.envelope, null); assert.equal(revised.txid, null);
    assert.equal(el('sign').disabled, false); assert.ok(el('candidate').textContent.includes(revised.plan.planDigest));
    await f.restart(); assert.equal(f.journal().get(first.id).plan.unsignedHex, revised.plan.unsignedHex);
    const mutateOriginal = async body => {
      const base = `http://127.0.0.1:${f.port()}`;
      const response = await originals.fetch(base + '/api/payment', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(body) });
      assert.equal(response.status, 200); return response.json();
    };
    const signing = await mutateOriginal({ action: 'reserve', id: revised.id, revision: revised.revision, capability: revised.capability,
      sequence: 1, sessionId: session, planDigest: revised.plan.planDigest });
    assert.equal(signing.state, 'SIGNING');
    const blockedEdits = [];
    for (const [amount, expectedState] of [['0.00003', 'SIGNING'], ['0.00002', 'UNKNOWN']]) {
      if (expectedState === 'UNKNOWN') await mutateOriginal({ action: 'uncertain', id: revised.id, revision: signing.revision, capability: revised.capability });
      el('amount').value = amount; el('amount').emit('input'); await click('review'); await click('confirm'); await click('build');
      await wait(() => requests.length === 3 + blockedEdits.length && el('result').textContent === 'REVISION_CONFLICT');
      assert.equal(requests.at(-1).http, 409); assert.equal(el('sign').disabled, true); assert.equal(el('broadcast').disabled, true);
      const original = f.journal().get(revised.id); assert.equal(original.state, expectedState);
      assert.equal(original.plan.unsignedHex, revised.plan.unsignedHex); assert.deepEqual(original.envelope, signing.envelope);
      blockedEdits.push(expectedState);
    }
    assert.deepEqual(f.stats(), { sends: 0, signs: 0 }); assert.equal(signCalls, 0);
    return { kind: 'COMPILED_UI_HTTP_SQLITE_MOCK_WALLET_RPC_NO_BROWSER', beforeSatoshis: '5000', afterSatoshis: '4000',
      sameEconomicIdentity: revised.id === first.id, revision: revised.revision, exactOutputs: true, reconfirmRequired: true,
      durableReopen: true, blockedEdits, signCalls, sendCalls: f.stats().sends, mainnetCapSatoshis: revised.mainnetCapSatoshis };
  } finally {
    for (const [name, implementation] of Object.entries(prototypes)) ConnectedWallet.prototype[name] = implementation;
    Object.assign(globalThis, originals); await f.close();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  test('public demo reads an unsigned HTTP-prepared draft unchanged across strict journal reopen', async () => {
    const f = await instance(); let publicServer;
    const launch = async () => { publicServer = createPaymentServer(new PaymentFlow(f.journal(), f.chain), undefined, true); await new Promise(r => publicServer.listen(0, '127.0.0.1', r)); };
    const stop = async () => { publicServer.closeAllConnections(); await new Promise(r => publicServer.close(r)); };
    const read = id => new Promise((resolve, reject) => {
      import('node:http').then(({ request }) => {
        const req = request(`http://127.0.0.1:${publicServer.address().port}/api/payment`, { method: 'POST', headers: { Host: 'intentguard-api-production.up.railway.app', Origin: 'https://intentguard-bch.vercel.app', 'Content-Type': 'application/json' } }, res => {
          let raw = ''; res.on('data', b => raw += b); res.on('end', () => { try { assert.equal(res.statusCode, 200); resolve(JSON.parse(raw)); } catch (e) { reject(e); } });
        }); req.on('error', reject); req.end(JSON.stringify({ action: 'get', id }));
      }, reject);
    });
    try {
      const prepared = await f.api(f.prepare); assert.equal(prepared.http, 200);
      await launch(); const before = await read(prepared.value.id); await stop();
      await f.restart(); await launch(); const after = await read(prepared.value.id);
      assert.deepEqual(after, before); assert.equal(after.state, 'PREFLIGHTED'); assert.equal(after.envelope, null); assert.equal(after.txid, null);
      assert.equal(Object.hasOwn(after, 'capability'), false); assert.equal(Object.hasOwn(after, 'capabilityHash'), false);
      assert.deepEqual(f.stats(), { sends: 0, signs: 0 });
    } finally { if (publicServer?.listening) await stop(); await f.close(); }
  });
  test('compiled UI edits 5000 to 4000 sat, reconfirms and atomically rebuilds the same unsigned payment', driveUnsignedRevision);
  test('unsigned revision authenticates, rejects stale CAS and rolls back conflicting input reservations', async () => {
    const f = await instance();
    try {
      const first = (await f.api(f.prepare)).value;
      const request = { ...f.prepare.request, recipients: [{ ...f.prepare.request.recipients[0], bch: '0.00004' }] };
      const revise = { ...f.prepare, action: 'revise', id: first.id, revision: first.revision, capability: first.capability, request,
        expectedRequestDigest: createPaymentRequestDraft(request, Date.now()).draft.requestDigest };
      assert.equal((await f.api({ ...revise, capability: '00'.repeat(32) })).value.issue, 'CAPABILITY_REQUIRED');
      const replies = await Promise.all([f.api(revise), f.api(revise)]);
      assert.equal(replies.filter(r => r.http === 200).length, 1); assert.equal(replies.find(r => r.http === 409).value.issue, 'REVISION_CONFLICT');
      const revised = replies.find(r => r.http === 200).value;
      assert.equal((await f.api({ action: 'reserve', id: first.id, revision: first.revision, capability: first.capability, sequence: 1,
        sessionId: f.wallet.currentSessionId(), planDigest: first.plan.planDigest })).value.issue, 'REVISION_CONFLICT');
      // A separately inserted economic operation cannot steal this draft's inputs.
      const otherRequest = { ...request, requestId: 'different-economic-payment' };
      assert.equal((await f.api({ ...f.prepare, request: otherRequest, expectedRequestDigest: createPaymentRequestDraft(otherRequest, Date.now()).draft.requestDigest })).http, 409);
      f.options.fundingVariant = 1;
      const other = await f.api({ ...f.prepare, request: otherRequest, expectedRequestDigest: createPaymentRequestDraft(otherRequest, Date.now()).draft.requestDigest });
      assert.equal(other.http, 200); // B belongs to another economic identity.
      assert.equal((await f.api({ ...revise, revision: revised.revision })).http, 409);
      assert.equal(f.journal().get(first.id).revision, revised.revision);
      f.options.fundingVariant = 0;
      const thirdRequest = { ...request, requestId: 'third-economic-payment' };
      const third = { ...f.prepare, request: thirdRequest, expectedRequestDigest: createPaymentRequestDraft(thirdRequest, Date.now()).draft.requestDigest };
      assert.equal((await f.api(third)).http, 409); // Rollback kept original A reserved.
      await f.restart(); assert.equal(f.journal().get(first.id).revision, revised.revision);
      f.options.fundingVariant = 2;
      assert.equal((await f.api({ ...revise, revision: revised.revision })).http, 200); // A -> C atomically.
      f.options.fundingVariant = 0; assert.equal((await f.api(third)).http, 200); // Only now A is free.
      assert.deepEqual(f.stats(), { signs: 0, sends: 0 });
    } finally { await f.close(); }
  });
  test('signature reservation wins an in-flight unsigned revision; UNKNOWN stays original after restart', async () => {
    const f = await instance(); let release;
    try {
      const first = (await f.api(f.prepare)).value;
      const revise = { ...f.prepare, action: 'revise', id: first.id, revision: first.revision, capability: first.capability };
      let entered; const paused = new Promise(r => { entered = r; }), gate = new Promise(r => { release = r; });
      f.options.beforeFunding = async () => { entered(); await gate; };
      const pending = f.api(revise); await paused;
      const signing = (await f.api({ action: 'reserve', id: first.id, revision: first.revision, capability: first.capability, sequence: 1,
        sessionId: f.wallet.currentSessionId(), planDigest: first.plan.planDigest })).value;
      assert.equal(signing.state, 'SIGNING'); release(); assert.equal((await pending).value.issue, 'REVISION_CONFLICT');
      assert.equal((await f.api({ ...revise, revision: signing.revision })).http, 409);
      const unknown = (await f.api({ action: 'uncertain', id: first.id, revision: signing.revision, capability: first.capability })).value;
      await f.restart(); assert.equal((await f.api({ ...revise, revision: unknown.revision })).http, 409);
      assert.deepEqual(f.journal().get(first.id).envelope, signing.envelope); assert.deepEqual(f.stats(), { signs: 0, sends: 0 });
    } finally { release?.(); await f.close(); }
  });
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
