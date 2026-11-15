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
    await assert.rejects(a.handoff(op), /NO_SEND_AUTHORITY/);
    await assert.rejects(a.reserve(op, envelopeFor(op)), /ATTEMPT_MISMATCH/);
    await assert.rejects(a.signed(op.id, op.envelope, originalHex, true), /ATTEMPT_MISMATCH/);
    await clear(); a = await open(); b = await open(); op = await a.prepare(candidate);
    op = await a.reserve(op, envelopeFor(op)); op = await a.signed(op.id, op.envelope, originalHex, true);
    assert.equal(op.state, 'POSTCHECKED');
    const handoffs = await Promise.allSettled([a.handoff(op), b.handoff(op)]);
    assert.equal(handoffs.filter(r => r.status === 'fulfilled').length, 1);
    op = await a.active(); assert.equal(op.state, 'UNKNOWN'); assert.equal(op.handedOff, true); assert.equal(op.signedHex, originalHex);
    a.close(); a = await open(); op = await a.active(); assert.equal(op.txid, hashTransaction(hexToBin(originalHex)));
    await assert.rejects(a.handoff(op), /NO_SEND_AUTHORITY/);
    await assert.rejects(a.newAfterConfirmed(), /ORIGINAL_OPERATION_REQUIRED/);
    op = await a.observed(op, { status: 'CONFIRMED_ON_CHAIN', height: 99, blockHash: '01'.repeat(32), observedAt: Date.now() });
    op = await a.observed(op, { status: 'UNKNOWN', height: null, blockHash: null, observedAt: Date.now() });
    assert.equal(op.state, 'UNKNOWN'); await assert.rejects(a.newAfterConfirmed(), /ORIGINAL_OPERATION_REQUIRED/);
    op = await a.observed(op, { status: 'CONFIRMED_ON_CHAIN', height: 99, blockHash: '01'.repeat(32), observedAt: Date.now() });
    await a.newAfterConfirmed();
    await assert.rejects(a.prepare({ ...candidate, request: { ...candidate.request, requestId: 'distinct-payment' } }), /INPUT_RESERVED/);
    a.close(); await assert.rejects(a.uncertain(op.id), /DURABLE_STORAGE_REQUIRED/);
    await clear();

    // Real stateless HTTP consumer: valid mainnet unsigned construction, no sender.
    const mainnetAddress = lockingBytecodeToCashAddress({ bytecode: hexToBin(candidate.build.intent.recipients[0].script), prefix: 'bitcoincash' }).address;
    const mainnetRequest = { ...candidate.request, network: 'mainnet', recipients: [{ address: mainnetAddress, bch: '0.00005' }] };
    const parsed = createPaymentRequestDraft(mainnetRequest, Date.now()); assert.equal(parsed.status, 'DRAFT_READY');
    const readChain = {
      sources: f.chain.sources.map(s => ({ ...s, network: 'mainnet', kind: 'node' })),
      read: (...args) => f.chain.read(...args),
      funding: async (...args) => { const funding = await f.chain.funding(...args); return { ...funding, snapshot: { ...funding.snapshot, network: 'mainnet' } }; },
      observe: async () => ({ status: 'UNKNOWN', blockHash: null, height: null, observedAt: Date.now() })
    };
    const reader = new VisitorPaymentReader(readChain);
    server = createPaymentServer(reader); await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = 'http://127.0.0.1:' + server.address().port;
    const call = async body => { const res = await originals.fetch(base + '/api/payment', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(body) }); return { status: res.status, value: await res.json() }; };
    const built = await call({ ...f.prepare, request: mainnetRequest, expectedRequestDigest: parsed.draft.requestDigest });
    assert.equal(built.status, 200); assert.equal(built.value.plan.unsignedHex, candidate.plan.unsignedHex);
    for (const action of ['reserve', 'signed', 'broadcast', 'uncertain', 'get']) assert.equal((await call({ action })).status, 409);
    assert.equal((await call({ action: 'read', sourceId: 'evil', method: 'blockchain.transaction.broadcast', params: [originalHex] })).status, 409);

    // Actual compiled visitor UI handlers; existing Chipnet bytes are verify-only.
    const elements = new Map(), events = new Map(); let uiSignCalls = 0, nativeHandoffs = 0, failRead = false;
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
      return originalFetch(base + url, { ...options, headers: { ...options.headers, Origin: base } });
    };
    const session = f.wallet.currentSessionId();
    const overrides = { currentSessionId: () => session, paths: () => f.bindings, getPubkey: f.wallet.getPubkey.bind(f.wallet), hasPath: f.wallet.hasPath.bind(f.wallet), nextSequence: () => 777,
      sign: async (network, envelope, plan) => { assert.equal(network, 'mainnet'); assert.equal(plan.unsignedHex, candidate.plan.unsignedHex); uiSignCalls++; return { envelope, signedHex: originalHex }; } };
    for (const [name, implementation] of Object.entries(overrides)) { prototypes[name] = ConnectedWallet.prototype[name]; ConnectedWallet.prototype[name] = implementation; }
    const wait = async predicate => { for (let i = 0; i < 500; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 5)); } throw Error('VISITOR_UI_TIMEOUT: ' + el('result').textContent); };
    const click = async id => { assert.equal(el(id).disabled, false, id); el(id).emit('click'); await new Promise(r => setTimeout(r, 0)); };
    await import(pathToFileURL(resolve('dist/core/visitor-payment-ui.js')).href + '?fixture=' + Date.now());
    await wait(() => !el('connect').disabled);
    await click('review'); await click('confirm'); await click('build'); await wait(() => !el('sign').disabled);
    assert.equal(uiSignCalls, 0); assert.match(el('candidate').textContent, /BCH MAINNET/);
    await click('sign'); await wait(() => !el('broadcast').disabled);
    assert.equal(uiSignCalls, 1); assert.equal(el('handoff').hidden, true);
    el('handoff-ack').checked = true; await click('broadcast'); await wait(() => !el('handoff').hidden); nativeHandoffs++;
    assert.equal(el('signed-raw').value, originalHex); assert.match(el('result').textContent, /UNKNOWN/); assert.equal(el('broadcast').disabled, true);
    el('amount').value = '0.00004'; el('amount').emit('input'); assert.equal(el('handoff').hidden, true); assert.equal(el('signed-raw').value, '');
    await click('review'); await click('confirm'); await click('build'); await wait(() => /REFUSED|UNKNOWN/.test(el('result').textContent));
    assert.equal(uiSignCalls, 1); assert.equal(el('sign').disabled, true);
    await click('recover'); await wait(() => el('result').textContent.includes('"state": "UNKNOWN"'));
    failRead = true; await click('recover'); await wait(() => el('result').textContent.includes('UNKNOWN'));
    assert.equal(el('new-payment').disabled, true); assert.equal(f.stats().sends, 0);
    // Same compiled handlers: late valid callback and substituted output cannot
    // produce native handoff; no new mainnet signature is ever generated.
    const uiFailures = [];
    for (const scenario of ['late-callback', 'substituted-output', 'failed-storage']) {
      events.get('pagehide')?.(); await clear(); elements.clear(); events.clear();
      for (const tag of html.matchAll(/<[^>]+id="([^"]+)"[^>]*>/g)) { el(tag[1]).disabled = /\bdisabled\b/.test(tag[0]); el(tag[1]).value = tag[0].match(/\bvalue="([^"]*)"/)?.[1] ?? ''; }
      el('network').value = 'mainnet'; el('chain-ack').checked = true; el('recipient').value = mainnetAddress; failRead = false;
      ConnectedWallet.prototype.sign = async (network, envelope) => {
        assert.equal(network, 'mainnet'); uiSignCalls++;
        if (scenario === 'late-callback') { el('amount').value = '0.00004'; el('amount').emit('input'); }
        let signedHex = originalHex;
        if (scenario === 'substituted-output') { const tx = decodeTransaction(hexToBin(originalHex)); tx.outputs[0].valueSatoshis++; signedHex = binToHex(encodeTransaction(tx)); }
        return { envelope, signedHex };
      };
      await import(pathToFileURL(resolve('dist/core/visitor-payment-ui.js')).href + '?scenario=' + scenario + Date.now());
      await wait(() => !el('connect').disabled);
      await click('review'); await click('confirm'); await click('build'); await wait(() => !el('sign').disabled);
      const signBefore = uiSignCalls;
      if (scenario === 'failed-storage') indexedDB.__forceClose('intentguard-visitor-payments-v1');
      await click('sign'); await wait(() => /UNKNOWN|REFUSED/.test(el('result').textContent));
      assert.equal(el('broadcast').disabled, true); assert.equal(el('signed-raw').value, '');
      assert.equal(uiSignCalls - signBefore, scenario === 'failed-storage' ? 0 : 1);
      uiFailures.push(scenario);
    }
    events.get('pagehide')?.();
    return { kind: 'MOCK_TRANSPORT_NO_CHAIN_TRANSACTION', storage: 'installed indexeddbshim + isolated SQLite; NOT native browser', actualSigningNetwork: 'chipnet', mainnetSignaturesGenerated: 0,
      verifyOnlyMainnetUiCallbacks: uiSignCalls, nativeHandoffs, identicalBytes: true, uiFailures, appServerMainnetSends: 0, sdkChipnetSignCalls: f.stats().signs, liveWallet: 'UNVERIFIED', browser: 'PARENT_REQUIRED',
      checks: ['atomic competing-tab signature/handoff CAS', 'original reservations across reopen', 'late bytes quarantine', 'duplicates refused', 'confirmed conflict invalidation', 'input tombstones', 'storage failure no fallback', 'stateless HTTP mainnet build and forbidden send', 'compiled visitor UI confirmation/sign-only/postcheck/native handoff', 'edit/UNKNOWN no replacement'] };
  } finally {
    cleanupUi?.();
    for (const [name, implementation] of Object.entries(prototypes)) ConnectedWallet.prototype[name] = implementation;
    for (const s of stores) s.close();
    if (server) { server.closeAllConnections(); await new Promise(r => server.close(r)); }
    await f.close(); Object.assign(globalThis, originals); await rm(root, { recursive: true, force: true });
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) test('visitor exact-byte handoff and durable UNKNOWN boundaries (synthetic, NOT real wallet)', async () => { await driveVisitor(); });
