import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import shim from 'indexeddbshim';
import { hashTransaction, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { binToHex, decodeTransaction, encodeTransaction } from '@bitauth/libauth';
import { instance } from './payment-http.test.mjs';
import { VisitorPaymentStore } from '../dist/core/visitor-payment-store.js';
import { ConnectedWallet } from '../dist/core/wallet-adapter.js';
import { createPaymentRequestDraft } from '../dist/core/payment-request.js';
import { buildPaymentRequestPlan } from '../dist/core/request-plan.js';
import { verifySignedPlan } from '../dist/core/signed-verifier.js';
import { VisitorPaymentReader } from '../dist/core/visitor-payment-reader.js';
import { createPaymentServer } from '../dist/core/server.js';

/** Installed SQLite-backed IndexedDB API seam, NOT native-browser durability proof.
 * All actual signing is the existing isolated Chipnet fixture; mainnet UI only
 * verifies previously generated synthetic bytes. No chain connection or send.
 */
export async function driveVisitor() {
  const root = await mkdtemp(join(tmpdir(), 'intentguard-visitor-'));
  const originals = { document: globalThis.document, window: globalThis.window, location: globalThis.location, localStorage: globalThis.localStorage, fetch: globalThis.fetch };
  globalThis.window = globalThis; globalThis.location = { origin: 'https://visitor-fixture.invalid' };
  shim(globalThis, { databaseBasePath: root, checkOrigin: false });
  const f = await instance(), stores = [], prototypes = {};
  let server, originalHex;
  let cleanupUi;
  const clear = async () => {
    for (const s of stores.splice(0)) s.close();
    await new Promise((resolve, reject) => { const r = indexedDB.deleteDatabase('intentguard-visitor-payments-v1'); r.onsuccess = resolve; r.onerror = reject; });
  };
  try {
    const prepared = await f.api(f.prepare); assert.equal(prepared.http, 200);
    const saved = f.journal().get(prepared.value.id);
    const candidate = Object.fromEntries(['request', 'requestDigest', 'build', 'plan', 'sourceDigest'].map(k => [k, saved[k]]));
    const envelopeFor = (op, sequence = 1) => ({ operationId: op.id, attemptId: 'fixture-attempt', revision: op.revision + 1, requestDigest: op.requestDigest,
      intentDigest: op.plan.intentDigest, planDigest: op.plan.planDigest, unsignedHash: hashTransaction(hexToBin(op.plan.unsignedHex)), sessionId: f.wallet.currentSessionId(), sequence, expiresAt: op.request.expiresAt });
    const open = async () => { const s = await VisitorPaymentStore.open(); stores.push(s); return s; };
    let a = await open(), b = await open(), op = await a.prepare(candidate);
    const race = await Promise.allSettled([a.reserve(op, envelopeFor(op)), b.reserve(op, envelopeFor(op))]);
    assert.equal(race.filter(r => r.status === 'fulfilled').length, 1, 'two tabs reserve one invocation');
    op = await a.active(); assert.equal(op.state, 'SIGNING');
    await assert.rejects(b.prepare(candidate), /ORIGINAL_OPERATION_REQUIRED/);
    a.close(); a = await open(); op = await a.uncertain(op.id);
    const sequence = f.wallet.nextSequence('chipnet', new AbortController().signal);
    const response = await f.wallet.sign('chipnet', { ...op.envelope, sequence }, op.plan, f.bindings, new AbortController().signal);
    originalHex = response.signedHex;
    assert.equal(verifySignedPlan({ buildInput: op.build, signedHex: originalHex }).status, 'SIGNED_PLAN_VALID_OFFLINE');
    op = await a.signed(op.id, op.envelope, originalHex, true); assert.equal(op.state, 'NEEDS_REVIEW', 'late valid bytes never restore handoff authority');
    await assert.rejects(a.reserveDelivery(op), /NO_SEND_AUTHORITY/);
    await assert.rejects(a.reserve(op, envelopeFor(op)), /ATTEMPT_MISMATCH/);
    await assert.rejects(a.signed(op.id, op.envelope, originalHex, true), /ATTEMPT_MISMATCH/);
    await clear(); a = await open(); b = await open(); op = await a.prepare(candidate);
    op = await a.reserve(op, envelopeFor(op)); op = await a.signed(op.id, op.envelope, originalHex, true);
    assert.equal(op.state, 'POSTCHECKED');
    const handoffs = await Promise.allSettled([a.reserveDelivery(op), b.reserveDelivery(op)]);
    assert.equal(handoffs.filter(r => r.status === 'fulfilled').length, 1);
    op = await a.active(); assert.equal(op.state, 'UNKNOWN'); assert.equal(op.handedOff, true); assert.equal(op.signedHex, originalHex);
    a.close(); a = await open(); op = await a.active(); assert.equal(op.txid, hashTransaction(hexToBin(originalHex)));
    await assert.rejects(a.reserveDelivery(op), /NO_SEND_AUTHORITY/);
    await assert.rejects(a.newAfterConfirmed(), /ORIGINAL_OPERATION_REQUIRED/);
    op = await a.observed(op, { status: 'CONFIRMED_ON_CHAIN', height: 99, blockHash: '01'.repeat(32), observedAt: Date.now() });
    op = await a.observed(op, { status: 'UNKNOWN', height: null, blockHash: null, observedAt: Date.now() });
    assert.equal(op.state, 'UNKNOWN'); await assert.rejects(a.newAfterConfirmed(), /ORIGINAL_OPERATION_REQUIRED/);
    op = await a.observed(op, { status: 'CONFIRMED_ON_CHAIN', height: 99, blockHash: '01'.repeat(32), observedAt: Date.now() });
    await a.newAfterConfirmed();
    await assert.rejects(a.prepare({ ...candidate, request: { ...candidate.request, requestId: 'distinct-payment' } }), /INPUT_RESERVED/);
    a.close(); await assert.rejects(a.uncertain(op.id), /DURABLE_STORAGE_REQUIRED/);
    await clear();

    // Actual HTTP handler with two synthetic source transports and a fixture-only sender.
    const mainnetAddress = lockingBytecodeToCashAddress({ bytecode: hexToBin(candidate.build.intent.recipients[0].script), prefix: 'bitcoincash' }).address;
    const mainnetRequest = { ...candidate.request, network: 'mainnet', recipients: [{ address: mainnetAddress, bch: '0.00005' }] };
    const parsed = createPaymentRequestDraft(mainnetRequest, Date.now()); assert.equal(parsed.status, 'DRAFT_READY');
    let observationStatus = 'UNKNOWN'; const observationReads = [];
    const readChain = {
      sources: f.chain.sources.map(s => ({ ...s, network: 'mainnet', kind: 'node' })),
      read: (...args) => f.chain.read(...args),
      funding: async (...args) => { const funding = await f.chain.funding(...args); return { ...funding, snapshot: { ...funding.snapshot, network: 'mainnet' } }; },
      observe: async signedHex => { observationReads.push(signedHex); return { status: observationStatus, blockHash: observationStatus === 'CONFIRMED_ON_CHAIN' ? '01'.repeat(32) : null, height: observationStatus === 'CONFIRMED_ON_CHAIN' ? 99 : null, observedAt: Date.now() }; }
    };
    const relayCalls = [];
    const fixtureSender = async signedHex => { relayCalls.push(signedHex); return hashTransaction(hexToBin(signedHex)); };
    let reader = new VisitorPaymentReader(readChain, Date.now, fixtureSender);
    server = createPaymentServer(reader); await new Promise(r => server.listen(0, '127.0.0.1', r));
    let base = 'http://127.0.0.1:' + server.address().port;
    const call = async body => { const res = await originals.fetch(base + '/api/payment', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(body) }); return { status: res.status, value: await res.json() }; };
    const built = await call({ ...f.prepare, request: mainnetRequest, expectedRequestDigest: parsed.draft.requestDigest });
    assert.equal(built.status, 200); assert.equal(built.value.plan.unsignedHex, candidate.plan.unsignedHex);
    const relayRequest = { action: 'relay', request: mainnetRequest, expectedRequestDigest: parsed.draft.requestDigest,
      scripts: built.value.build.intent.ownerScripts, changeScript: built.value.build.changeScript, feePolicy: built.value.build.feePolicy,
      selectedInputs: built.value.build.selectedInputs, planDigest: built.value.plan.planDigest, signedHex: originalHex, txid: hashTransaction(hexToBin(originalHex)) };
    const alternateAddress = lockingBytecodeToCashAddress({ bytecode: hexToBin('76a914' + '33'.repeat(20) + '88ac'), prefix: 'bitcoincash' }).address;
    const requestChange = request => {
      const review = createPaymentRequestDraft(request, Date.now()); assert.equal(review.status, 'DRAFT_READY');
      return { ...relayRequest, request, expectedRequestDigest: review.draft.requestDigest };
    };
    const signedChange = change => {
      const tx = decodeTransaction(hexToBin(originalHex)); assert.notEqual(typeof tx, 'string'); change(tx);
      const signedHex = binToHex(encodeTransaction(tx)); return { ...relayRequest, signedHex, txid: hashTransaction(hexToBin(signedHex)) };
    };
    const rejected = {
      recipient: requestChange({ ...mainnetRequest, recipients: [{ address: alternateAddress, bch: '0.00005' }] }),
      amount: requestChange({ ...mainnetRequest, recipients: [{ address: mainnetAddress, bch: '0.00004' }] }),
      fee: requestChange({ ...mainnetRequest, maxFeeBch: '0.00000218' }),
      network: { ...relayRequest, request: f.prepare.request, expectedRequestDigest: f.prepare.expectedRequestDigest },
      tamperedBytes: signedChange(tx => { tx.outputs[0].valueSatoshis++; }),
      invalidSignature: signedChange(tx => { tx.inputs[0].unlockingBytecode[1] ^= 1; }),
      expired: { ...relayRequest, request: { ...mainnetRequest, expiresAt: Date.now() - 1 } }
    };
    for (const [scenario, payload] of Object.entries(rejected)) {
      assert.equal((await call(payload)).status, 409, scenario); assert.equal(relayCalls.length, 0, scenario);
    }
    let enterFunding, releaseFunding;
    const enteredFunding = new Promise(resolve => { enterFunding = resolve; });
    const fundingGate = new Promise(resolve => { releaseFunding = resolve; });
    const cancelledReader = new VisitorPaymentReader({ ...readChain, funding: async (...args) => { enterFunding(); await fundingGate; return readChain.funding(...args); } }, Date.now, fixtureSender);
    const cancellation = new AbortController(), cancelled = cancelledReader.handle(relayRequest, cancellation.signal);
    await enteredFunding; cancellation.abort(); releaseFunding();
    await assert.rejects(cancelled, /NO_SEND_AUTHORITY/); assert.equal(relayCalls.length, 0);
    for (const action of ['reserve', 'signed', 'broadcast', 'uncertain', 'get']) assert.equal((await call({ action })).status, 409);
    assert.equal((await call({ action: 'read', sourceId: 'evil', method: 'blockchain.transaction.broadcast', params: [originalHex] })).status, 409);

    // Actual compiled visitor UI handlers; synthetic signature bytes are verify-only.
    const elements = new Map(), events = new Map(); let uiSignCalls = 0, nativeHandoffs = 0, failRead = false, loseRelayResponse = false, withdrawOnRelay = false;
    class Element {
      value = ''; checked = false; disabled = false; hidden = false; textContent = ''; listeners = new Map();
      addEventListener(name, fn) { const list = this.listeners.get(name) ?? []; list.push(fn); this.listeners.set(name, list); }
      emit(name) { if (name === 'click' && this.disabled) return; for (const fn of this.listeners.get(name) ?? []) fn({ target: this }); }
    }
    const el = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
    const html = await readFile('core/payment.html', 'utf8');
    for (const tag of html.matchAll(/<[^>]+id="([^"]+)"[^>]*>/g)) { el(tag[1]).disabled = /\bdisabled\b/.test(tag[0]); el(tag[1]).value = tag[0].match(/\bvalue="([^"]*)"/)?.[1] ?? ''; }
    el('network').value = 'mainnet'; el('chain-ack').checked = true; el('recipient').value = mainnetAddress;
    globalThis.document = { getElementById: el };
    globalThis.window = { addEventListener(name, fn) { events.set(name, fn); } };
    cleanupUi = () => events.get('pagehide')?.();
    const originalFetch = originals.fetch;
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      if (failRead && body.action === 'read') return new Response('{}', { status: 503 });
      if (withdrawOnRelay && body.action === 'relay') { el('handoff-ack').checked = false; el('handoff-ack').emit('input'); }
      const response = await originalFetch(base + url, { ...options, headers: { ...options.headers, Origin: base } });
      if (loseRelayResponse && body.action === 'relay') { await response.arrayBuffer(); throw Error('FIXTURE_RESPONSE_LOST'); }
      return response;
    };
    const session = f.wallet.currentSessionId();
    const overrides = { currentSessionId: () => session, paths: () => f.bindings, getPubkey: f.wallet.getPubkey.bind(f.wallet), hasPath: f.wallet.hasPath.bind(f.wallet), nextSequence: () => 777,
      sign: async (network, envelope, plan) => { assert.equal(network, 'mainnet'); assert.equal(plan.unsignedHex, candidate.plan.unsignedHex); uiSignCalls++; return { envelope, signedHex: originalHex }; } };
    for (const [name, implementation] of Object.entries(overrides)) { prototypes[name] = ConnectedWallet.prototype[name]; ConnectedWallet.prototype[name] = implementation; }
    const wait = async predicate => { for (let i = 0; i < 500; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 5)); } throw Error('VISITOR_UI_TIMEOUT: ' + el('result').textContent); };
    const click = async id => { assert.equal(el(id).disabled, false, id); el(id).emit('click'); await new Promise(r => setTimeout(r, 0)); };
    const resetUi = async () => {
      events.get('pagehide')?.(); await clear(); elements.clear(); events.clear();
      for (const tag of html.matchAll(/<[^>]+id="([^"]+)"[^>]*>/g)) { el(tag[1]).disabled = /\bdisabled\b/.test(tag[0]); el(tag[1]).value = tag[0].match(/\bvalue="([^"]*)"/)?.[1] ?? ''; }
      el('network').value = 'mainnet'; el('chain-ack').checked = true; el('recipient').value = mainnetAddress; failRead = false;
    };
    await import(pathToFileURL(resolve('dist/core/visitor-payment-ui.js')).href + '?fixture=' + Date.now());
    await wait(() => !el('connect').disabled);
    await click('review'); assert.equal(el('build').disabled, true); assert.equal(uiSignCalls, 0); assert.equal(relayCalls.length, 0);
    await click('confirm'); await click('build'); await wait(() => !el('sign').disabled);
    assert.equal(uiSignCalls, 0); assert.match(el('candidate').textContent, /BCH MAINNET/);
    await click('sign'); await wait(() => !el('broadcast').disabled);
    assert.equal(uiSignCalls, 1); assert.equal(el('handoff').hidden, true); assert.equal(relayCalls.length, 0);
    el('handoff-ack').checked = true; el('broadcast').emit('click'); el('broadcast').emit('click');
    await wait(() => relayCalls.length === 1 && /UNKNOWN/.test(el('result').textContent));
    assert.deepEqual(relayCalls, [originalHex]); assert.equal(el('broadcast').disabled, true); assert.equal(el('native-handoff').disabled, true);
    assert.equal((await call(relayRequest)).status, 409); assert.equal(relayCalls.length, 1, 'duplicate HTTP request is not relayed');
    el('amount').value = '0.00004'; el('amount').emit('input'); assert.equal(el('handoff').hidden, true); assert.equal(el('signed-raw').value, '');
    await click('review'); await click('confirm'); await click('build'); await wait(() => /REFUSED|UNKNOWN/.test(el('result').textContent));
    assert.equal(uiSignCalls, 1); assert.equal(el('sign').disabled, true);
    await click('recover'); await wait(() => el('result').textContent.includes('"state": "UNKNOWN"'));
    let recovery = JSON.parse(el('result').textContent);
    assert.equal(recovery.observation.status, 'UNKNOWN');
    assert.match(recovery.trust, /inconclusive/i);
    assert.doesNotMatch(recovery.trust, /two[- ]node|exact[- ]raw|inclusion/i);
    for (const status of ['OBSERVED', 'CONFIRMED_ON_CHAIN', 'UNKNOWN']) {
      observationStatus = status;
      await click('recover'); await wait(() => el('result').textContent.includes(`"status": "${status}"`));
      recovery = JSON.parse(el('result').textContent);
      assert.equal(recovery.state, status);
      if (status === 'OBSERVED') {
        assert.match(recovery.trust, /two-node agreement on exact original transaction bytes/i);
        assert.match(recovery.trust, /inclusion not established/i);
      } else if (status === 'CONFIRMED_ON_CHAIN') {
        assert.match(recovery.trust, /two-node agreement on exact original transaction bytes and node-reported inclusion/i);
      } else {
        assert.match(recovery.trust, /inconclusive/i);
        assert.doesNotMatch(recovery.trust, /two[- ]node|exact[- ]raw|inclusion/i);
      }
      assert.equal(el('new-payment').disabled, status !== 'CONFIRMED_ON_CHAIN');
    }
    assert.deepEqual(observationReads, Array(4).fill(originalHex), 'recovery reads only original bytes');
    assert.equal(uiSignCalls, 1); assert.equal(relayCalls.length, 1);
    failRead = true; await click('recover'); await wait(() => observationReads.length === 5 && el('result').textContent.includes('"state": "UNKNOWN"'));
    assert.equal(el('new-payment').disabled, true); assert.equal(f.stats().sends, 0);
    // A prepared but unsigned operation has no original signed bytes to observe.
    await resetUi();
    await import(pathToFileURL(resolve('dist/core/visitor-payment-ui.js')).href + '?missing-original=' + Date.now());
    await wait(() => !el('connect').disabled);
    await click('review'); await click('confirm'); await click('build'); await wait(() => !el('sign').disabled);
    await click('recover'); await wait(() => el('result').textContent.includes('Original'));
    assert.match(el('result').textContent, /original transaction bytes or hash unavailable/i);
    assert.match(el('result').textContent, /read could not be completed/i);
    assert.equal(observationReads.length, 5, 'missing bytes must not call observe');
    assert.equal(uiSignCalls, 1); assert.equal(relayCalls.length, 1);
    // Run the same consumer with independently altered intent or wallet responses.
    const uiFailures = [];
    for (const scenario of ['late-callback', 'cancelled-response', 'network-changed', 'stale-envelope', 'invalid-signature', 'tampered-byte', 'recipient-mismatch', 'amount-mismatch', 'fee-mismatch', 'failed-storage']) {
      await resetUi();
      if (scenario === 'recipient-mismatch') el('recipient').value = alternateAddress;
      if (scenario === 'amount-mismatch') el('amount').value = '0.00004';
      if (scenario === 'fee-mismatch') el('target-rate').value = '2000';
      ConnectedWallet.prototype.sign = async (network, envelope) => {
        assert.equal(network, 'mainnet'); uiSignCalls++;
        if (scenario === 'late-callback') { el('amount').value = '0.00004'; el('amount').emit('input'); }
        if (scenario === 'cancelled-response') el('disconnect').emit('click');
        if (scenario === 'network-changed') { el('network').value = 'chipnet'; el('network').emit('input'); }
        let signedHex = originalHex;
        if (scenario === 'tampered-byte' || scenario === 'invalid-signature') {
          const tx = decodeTransaction(hexToBin(originalHex));
          if (scenario === 'tampered-byte') tx.outputs[0].valueSatoshis++;
          else tx.inputs[0].unlockingBytecode[1] ^= 1;
          signedHex = binToHex(encodeTransaction(tx));
        }
        return { envelope: scenario === 'stale-envelope' ? { ...envelope, sequence: envelope.sequence + 1 } : envelope, signedHex };
      };
      await import(pathToFileURL(resolve('dist/core/visitor-payment-ui.js')).href + '?scenario=' + scenario + Date.now());
      await wait(() => !el('connect').disabled);
      await click('review'); await click('confirm'); await click('build'); await wait(() => !el('sign').disabled);
      const signBefore = uiSignCalls;
      if (scenario === 'failed-storage') indexedDB.__forceClose('intentguard-visitor-payments-v1');
      await click('sign'); await wait(() => /UNKNOWN|REFUSED/.test(el('result').textContent));
      assert.equal(el('broadcast').disabled, true, scenario); assert.equal(el('native-handoff').disabled, true, scenario);
      assert.equal(el('signed-raw').value, ''); assert.equal(relayCalls.length, 1, scenario);
      assert.equal(uiSignCalls - signBefore, scenario === 'failed-storage' ? 0 : 1);
      uiFailures.push(scenario);
    }
    // Withdraw final approval immediately before the relay fetch leaves the UI.
    await resetUi(); ConnectedWallet.prototype.sign = overrides.sign;
    server.closeAllConnections(); await new Promise(r => server.close(r));
    reader = new VisitorPaymentReader(readChain, Date.now, fixtureSender); server = createPaymentServer(reader);
    await new Promise(r => server.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + server.address().port;
    await import(pathToFileURL(resolve('dist/core/visitor-payment-ui.js')).href + '?withdraw=' + Date.now());
    await wait(() => !el('connect').disabled); await click('review'); await click('confirm'); await click('build'); await wait(() => !el('sign').disabled);
    await click('sign'); await wait(() => !el('broadcast').disabled); el('handoff-ack').checked = true; withdrawOnRelay = true;
    await click('broadcast'); await wait(() => relayCalls.length > 1 || /UNKNOWN/.test(el('result').textContent));
    assert.equal(relayCalls.length, 1, 'withdrawn approval must not reach fixture relay'); withdrawOnRelay = false;
    // The fallback consumes the same one-time reservation instead of relaying.
    await resetUi(); ConnectedWallet.prototype.sign = overrides.sign;
    await import(pathToFileURL(resolve('dist/core/visitor-payment-ui.js')).href + '?native=' + Date.now());
    await wait(() => !el('connect').disabled); await click('review'); await click('confirm'); await click('build'); await wait(() => !el('sign').disabled);
    await click('sign'); await wait(() => !el('native-handoff').disabled); el('handoff-ack').checked = true; await click('native-handoff');
    await wait(() => !el('handoff').hidden); nativeHandoffs++;
    assert.equal(el('signed-raw').value, originalHex); assert.equal(el('broadcast').disabled, true); assert.equal(relayCalls.length, 1);
    // Fresh isolated service models a different run: a response lost after the fixture accepted bytes.
    await resetUi(); server.closeAllConnections(); await new Promise(r => server.close(r));
    reader = new VisitorPaymentReader(readChain, Date.now, fixtureSender); server = createPaymentServer(reader);
    await new Promise(r => server.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + server.address().port; loseRelayResponse = true;
    await import(pathToFileURL(resolve('dist/core/visitor-payment-ui.js')).href + '?loss=' + Date.now());
    await wait(() => !el('connect').disabled); await click('review'); await click('confirm'); await click('build'); await wait(() => !el('sign').disabled);
    const lossSignBefore = uiSignCalls; await click('sign'); await wait(() => !el('broadcast').disabled);
    el('handoff-ack').checked = true; el('broadcast').emit('click'); el('broadcast').emit('click');
    await wait(() => relayCalls.length === 2 && /UNKNOWN/.test(el('result').textContent));
    assert.equal(uiSignCalls - lossSignBefore, 1); assert.equal(relayCalls[1], originalHex);
    el('broadcast').emit('click'); el('sign').emit('click'); await click('recover'); await wait(() => el('result').textContent.includes('"state": "UNKNOWN"'));
    assert.equal(relayCalls.length, 2); assert.equal(uiSignCalls - lossSignBefore, 1); assert.equal(el('native-handoff').disabled, true);
    events.get('pagehide')?.();
    return { kind: 'MOCK_TRANSPORT_NO_CHAIN_TRANSACTION', storage: 'installed indexeddbshim + isolated SQLite; NOT native browser', actualSigningNetwork: 'chipnet fixture only', mainnetSignaturesGenerated: 0,
      verifyOnlyMainnetUiCallbacks: uiSignCalls, nativeHandoffs, fixtureRelayCalls: relayCalls.length, identicalBytes: relayCalls.every(raw => raw === originalHex), uiFailures,
      rejectedServerCases: Object.keys(rejected), cancelledDuringFunding: true, withdrawnBeforeRelay: true, responseLostNoResend: true, sdkChipnetSignCalls: f.stats().signs,
      liveWallet: 'UNVERIFIED', browser: 'NOT_RUN', checks: ['competing-tab reservation CAS', 'confirmed intent before sign-only', 'fresh server rebuild and full signature verification', 'one identical-byte fixture relay', 'exclusive optional native handoff', 'lost response and UNKNOWN original-only recovery', 'no replacement or resend'] };
  } finally {
    cleanupUi?.();
    for (const [name, implementation] of Object.entries(prototypes)) ConnectedWallet.prototype[name] = implementation;
    for (const s of stores) s.close();
    if (server) { server.closeAllConnections(); await new Promise(r => server.close(r)); }
    await f.close(); Object.assign(globalThis, originals); await rm(root, { recursive: true, force: true });
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) test('visitor verified relay and durable UNKNOWN boundaries (synthetic, NOT real wallet)', async () => { await driveVisitor(); });
