/** Local synthetic-only review fixtures; no wallet, signing, or network activity. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, renameSync, chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { getEventListeners } from 'node:events';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { binToHex, hexToBin, hash160, hash256, hashTransaction, encodeTransaction } from '@bitauth/libauth';
import { fixture } from './fixtures.js';
import { validatedIntentDigest } from './guard.js';
import type { SourceConfig, ReadMethod, PublicKeySession } from './evidence.js';
import { ReadOnlyReviewCoordinator, type ReviewRequest, type ReviewConfig } from './review-coordinator.js';

const publicPoint = hexToBin('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');
const owned = '76a914' + binToHex(hash160(publicPoint)) + '88ac';
const initialNow = 1800000000000;
function setup() {
  const f = fixture(); f.input.intent.ownerScripts = [owned]; f.parent.outputs[0]!.lockingBytecode = hexToBin(owned); f.candidate.outputs[1]!.lockingBytecode = hexToBin(owned);
  const parentRaw = binToHex(encodeTransaction(f.parent)); const parentId = hashTransaction(encodeTransaction(f.parent));
  f.candidate.inputs[0]!.outpointTransactionHash = hexToBin(parentId); f.input.candidateHex = binToHex(encodeTransaction(f.candidate));
  const headerBytes = new Uint8Array(80); new DataView(headerBytes.buffer).setUint32(68, initialNow / 1000, true);
  const header = binToHex(headerBytes); const headerHash = binToHex(hash256(headerBytes).reverse()); const genesis = '11'.repeat(32);
  let now = initialNow; let sessionId: string | null = 'private-session-A'; let path = true;
  const session: PublicKeySession = { currentSessionId: () => sessionId, hasPath: n => path && n === 0, getPubkey: (_n, i) => path && i === 0n ? publicPoint : undefined };
  const calls: ReadMethod[] = [];
  const base = async (method: ReadMethod, params: readonly unknown[]): Promise<unknown> => {
    calls.push(method);
    switch (method) {
      case 'server.features': return { genesis_hash: genesis, hash_function: 'sha256', cashtokens: true };
      case 'blockchain.block.header': return header;
      case 'blockchain.headers.subscribe': return { height: 100, hex: header };
      case 'blockchain.transaction.get': assert.equal(params[0], parentId); return parentRaw;
      case 'blockchain.scripthash.listunspent': return [{ height: 99, tx_hash: parentId, tx_pos: 0, value: 10000 }];
    }
  };
  const sources: SourceConfig[] = ['one', 'two'].map(id => ({ id, operatorId: 'operator-' + id, network: 'chipnet', genesisHash: genesis, checkpoint: { height: 90, hash: headerHash }, maxTipAgeMs: 7200000, kind: 'synthetic', transport: { request: base } }));
  const config: ReviewConfig = { sources, session, clock: () => now };
  const request: ReviewRequest = { paymentRequestId: 'private-order-one', intent: f.input.intent, candidateHex: f.input.candidateHex, bindings: [{ childIndex: 0, index: 0, script: owned }] };
  const root = mkdtempSync(join(tmpdir(), 'intentguard-review-')); const directory = join(root, 'ledger');
  const handles: ReadOnlyReviewCoordinator[] = [];
  const create = () => { const c = ReadOnlyReviewCoordinator.create(directory, config); handles.push(c); return c; };
  const reopen = () => { const c = ReadOnlyReviewCoordinator.open(directory, config); handles.push(c); return c; };
  const cleanup = () => { handles.forEach(h => h.close()); rmSync(root, { recursive: true, force: true }); };
  return { config, request, directory, calls, base, sources, session, create, reopen, cleanup, candidate: f.candidate, setNow: (v: number) => { now = v; }, setSession: (v: string | null) => { sessionId = v; }, revokePath: () => { path = false; } };
}

test('internally collected review binds digests and observation time without payment authority; reopened success is stale', async () => {
  const s = setup(); try {
    const c = s.create(); const r = await c.review(s.request);
    assert.equal(r.status, 'SYNTHETIC_MATCH', r.issue ?? ''); assert.equal(r.freshness, 'OBSERVED_DURING_CALL');
    assert.equal(r.intentDigest, validatedIntentDigest(s.request.intent)); assert.match(r.exactCandidateDigest, /^[0-9a-f]{64}$/); assert.match(r.evidenceBindingDigest!, /^[0-9a-f]{64}$/);
    assert.deepEqual(r.sourceIds, ['one', 'two']); assert.equal(r.chainTip?.height, 100); assert.equal(r.chainTip?.timestampMs, initialNow); assert.equal(Object.isFrozen(r.sourceIds), true); assert.equal(Object.isFrozen(r.chainTip), true);
    assert.equal(r.observedAt, initialNow); assert.equal(r.completedAt, initialNow); assert.equal(r.revision, 1);
    assert.equal(r.canSign, false); assert.equal(r.receiptValid, false); assert.equal(r.consensusVerified, false);
    assert.equal(Object.isFrozen(r), true); c.close();
    const reopened = s.reopen(); const saved = reopened.get(r.requestKey); assert.equal(saved?.status, 'SYNTHETIC_MATCH'); assert.equal(saved?.freshness, 'STALE_RECHECK_REQUIRED');
    const calls = s.calls.length; const duplicate = await reopened.review(s.request); assert.deepEqual(duplicate, saved); assert.equal(s.calls.length, calls);
    const disk = readFileSync(join(s.directory, 'reviews.sqlite')).toString('utf8');
    for (const raw of [s.request.paymentRequestId, 'private-session-A', owned, s.request.candidateHex, binToHex(publicPoint)]) assert.equal(disk.includes(raw), false);
  } finally { s.cleanup(); }
});

test('request identity rejects changed intent, exact candidate, session, paths and source policy', async () => {
  const s = setup(); try {
    const c = s.create(); const saved = await c.review(s.request);
    await assert.rejects(c.review({ ...s.request, intent: { ...s.request.intent, maxFeeSatoshis: '601' } }), /REVIEW_REQUEST_CONFLICT/);
    const changed = structuredClone(s.candidate); changed.inputs[0]!.unlockingBytecode = hexToBin('00');
    await assert.rejects(c.review({ ...s.request, candidateHex: binToHex(encodeTransaction(changed)) }), /REVIEW_REQUEST_CONFLICT/);
    await assert.rejects(c.review({ ...s.request, bindings: [{ ...s.request.bindings[0]!, index: 1 }] }), /REVIEW_REQUEST_CONFLICT/);
    s.setSession('another-session'); await assert.rejects(c.review(s.request), /REVIEW_REQUEST_CONFLICT/); s.setSession('private-session-A');
    c.close(); s.sources[0]!.maxTipAgeMs = 1000; const reopened = s.reopen(); await assert.rejects(reopened.review(s.request), /REVIEW_REQUEST_CONFLICT/);
    assert.equal(reopened.get(saved.requestKey)?.status, 'SYNTHETIC_MATCH');
  } finally { s.cleanup(); }
});

test('concurrent connections dedupe before awaiting and do not run the same collection twice', async () => {
  const s = setup(); let release: () => void = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
  try {
    s.sources[0]!.transport = { request: async (m, p) => { await gate; return s.base(m, p); } };
    const first = s.create(); const second = s.reopen(); const pending = first.review(s.request);
    const duplicate = await second.review(s.request); assert.equal(duplicate.status, 'PENDING'); assert.equal(duplicate.freshness, 'STALE_RECHECK_REQUIRED'); assert.equal(duplicate.revision, 0); assert.equal(s.calls.length, 0);
    await assert.rejects(second.review({ ...s.request, intent: { ...s.request.intent, maxFeeSatoshis: '601' } }), /REVIEW_REQUEST_CONFLICT/);
    release(); const result = await pending; assert.equal(result.status, 'SYNTHETIC_MATCH'); assert.equal(s.calls.filter(m => m === 'server.features').length, 2);
    assert.equal(second.get(result.requestKey)?.revision, 1);
  } finally { release(); s.cleanup(); }
});

test('input and trusted source metadata are captured before awaits', async () => {
  const s = setup(); try {
    const original = structuredClone(s.request);
    s.sources[0]!.transport = { request: async (m, p) => { s.request.intent.maxFeeSatoshis = '0'; s.request.candidateHex = '00'; s.request.bindings[0]!.index = 55; return s.base(m, p); } };
    const c = s.create(); s.sources[0]!.operatorId = 'mutated'; s.sources[0]!.checkpoint.hash = 'ab'.repeat(32); s.sources[0]!.kind = 'node';
    const r = await c.review(s.request); assert.equal(r.status, 'SYNTHETIC_MATCH', r.issue ?? ''); assert.equal(r.intentDigest, validatedIntentDigest(original.intent));
    assert.deepEqual(await c.review(original), c.get(r.requestKey));
  } finally { s.cleanup(); }
});

test('caller success/ownership JSON cannot be injected, and unknown paths cannot collect', async () => {
  const s = setup(); try {
    const c = s.create();
    await assert.rejects(Reflect.apply(c.review, c, [{ ...s.request, evidence: { status: 'NODE_REPORTED' } }]), /REVIEW_INVALID_INPUT/);
    await assert.rejects(Reflect.apply(c.review, c, [{ ...s.request, ownership: { status: 'SESSION_DERIVED' } }]), /REVIEW_INVALID_INPUT/);
    assert.equal(s.calls.length, 0); s.revokePath(); const r = await c.review(s.request); assert.equal(r.status, 'UNKNOWN'); assert.equal(r.evidenceBindingDigest, null); assert.equal(r.freshness, 'STALE_RECHECK_REQUIRED'); assert.equal(s.calls.length, 0);
  } finally { s.cleanup(); }
});

test('session revocation, same-session public-path changes, source failures and expiry fail closed', async () => {
  for (const mode of ['session', 'path', 'source', 'expiry', 'backward']) {
    const s = setup(); try {
      s.sources[1]!.transport = { request: async (m, p) => {
        if (mode === 'session') s.setSession(null); if (mode === 'path') s.revokePath(); if (mode === 'expiry') s.setNow(s.request.intent.expiresAt); if (mode === 'backward') s.setNow(initialNow - 1); if (mode === 'source') throw Error('SECRET_PATH_AND_CREDENTIAL'); return s.base(m, p);
      } };
      const c = s.create(); const r = await c.review(s.request); assert.equal(r.status, 'UNKNOWN', mode); assert.equal(r.observedAt, null); assert.equal(r.evidenceBindingDigest, null); assert.equal(r.freshness, 'STALE_RECHECK_REQUIRED'); assert(!JSON.stringify(r).includes('SECRET'));
      assert.equal(c.get(r.requestKey)?.status, 'UNKNOWN');
    } finally { s.cleanup(); }
  }
});

test('pre-abort does not reserve; in-flight cancellation persists UNKNOWN and ignores late source results', async () => {
  const s = setup(); let release: (v: unknown) => void = () => {};
  try {
    s.sources[0]!.transport = { request: () => new Promise(resolve => { release = resolve; }) };
    const c = s.create(); await assert.rejects(c.review(s.request, AbortSignal.abort()), /REVIEW_ABORTED/);
    const controller = new AbortController(); const pending = c.review(s.request, controller.signal); controller.abort('SECRET_REASON');
    const r = await pending; assert.equal(r.status, 'UNKNOWN'); assert.equal(r.issue, 'REVIEW_ABORTED'); const saved = JSON.stringify(c.get(r.requestKey));
    release({ genesis_hash: '11'.repeat(32), hash_function: 'sha256', cashtokens: true }); await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(JSON.stringify(c.get(r.requestKey)), saved);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0); const calls = s.calls.length; assert.equal((await c.review(s.request)).freshness, 'STALE_RECHECK_REQUIRED'); assert.equal(s.calls.length, calls);
  } finally { s.cleanup(); }
});

test('closing during collection preserves PENDING across restart instead of inventing recovered success', async () => {
  const s = setup(); try {
    s.sources[0]!.transport = { request: () => new Promise(() => {}) };
    const c = s.create(); const pending = c.review(s.request); c.close(); await assert.rejects(pending, /REVIEW_STORE_CLOSED/);
    const reopened = s.reopen(); const r = await reopened.review(s.request); assert.equal(r.status, 'PENDING'); assert.equal(r.completedAt, null); assert.equal(r.freshness, 'STALE_RECHECK_REQUIRED'); assert.equal(s.calls.length, 0);
  } finally { s.cleanup(); }
});

test('filesystem failure during collection cannot return a saved success', async () => {
  const s = setup(); try {
    let moved = false; const file = join(s.directory, 'reviews.sqlite');
    s.sources[1]!.transport = { request: async (m, p) => { if (!moved) { renameSync(file, file + '.moved'); moved = true; } return s.base(m, p); } };
    const c = s.create(); await assert.rejects(c.review(s.request), /REVIEW_STORE_UNAVAILABLE/); renameSync(file + '.moved', file); c.close();
    const reopened = s.reopen(); const r = await reopened.review(s.request); assert.equal(r.status, 'PENDING'); assert.equal(r.freshness, 'STALE_RECHECK_REQUIRED');
  } finally { s.cleanup(); }
});

test('corrupt and insecure journals fail closed rather than being recreated', async () => {
  const s = setup(); try {
    const c = s.create(); await c.review(s.request); c.close(); const file = join(s.directory, 'reviews.sqlite');
    chmodSync(file, 0o644); assert.throws(() => s.reopen()); chmodSync(file, 0o600);
    const db = new DatabaseSync(file); db.exec("UPDATE reviews SET document='{}'"); db.close(); assert.throws(() => s.reopen(), /REVIEW_CORRUPT_STORE/);
    writeFileSync(file, 'broken database'); assert.throws(() => s.reopen(), /REVIEW_CORRUPT_STORE/); assert.equal(readFileSync(file, 'utf8'), 'broken database');
    assert.throws(() => s.create());
  } finally { s.cleanup(); }
});

test('invalid or expired input and missing session fail before sources', async () => {
  const s = setup(); try {
    const c = s.create(); await assert.rejects(c.review({ ...s.request, candidateHex: '00' }), /REVIEW_INVALID_INPUT/);
    await assert.rejects(c.review({ ...s.request, intent: { ...s.request.intent, expiresAt: initialNow } }), /REVIEW_INTENT_EXPIRED/);
    s.setSession(null); await assert.rejects(c.review(s.request), /REVIEW_SESSION_UNAVAILABLE/); assert.equal(s.calls.length, 0);
  } finally { s.cleanup(); }
});


test('return-time tip expiry after persistence downgrades the view, not a fresh capability', async () => {
  const s = setup(); try {
    for (const source of s.sources) source.maxTipAgeMs = 1000;
    // coordinator start, collector start/end, coordinator end, then after commit.
    let ticks = 0; s.config.clock = () => ++ticks >= 5 ? initialNow + 1001 : initialNow;
    const c = s.create(); const r = await c.review(s.request);
    assert.equal(r.status, 'SYNTHETIC_MATCH'); assert.equal(r.completedAt, initialNow); assert.equal(r.chainTip?.timestampMs, initialNow);
    assert.equal(r.freshness, 'STALE_RECHECK_REQUIRED'); assert.equal(r.canSign, false); assert.equal(r.receiptValid, false);
    assert.equal(c.get(r.requestKey)?.freshness, 'STALE_RECHECK_REQUIRED');
  } finally { s.cleanup(); }
});


test('SIGKILL after durable reservation leaves an incomplete review that never auto-restarts', async () => {
  const s = setup(); try {
    const c = s.create();
    const metadata = s.sources.map(({ transport: _transport, ...source }) => source);
    const script = `import { ReadOnlyReviewCoordinator } from ${JSON.stringify(new URL('./review-coordinator.js', import.meta.url).href)};
      const sources=${JSON.stringify(metadata)}.map(s=>({...s,transport:{request:()=>new Promise(()=>{})}}));
      const session={currentSessionId:()=>"private-session-A",hasPath:n=>n===0,getPubkey:(_n,i)=>i===0n?Uint8Array.from(${JSON.stringify([...publicPoint])}):undefined};
      const c=ReadOnlyReviewCoordinator.open(${JSON.stringify(s.directory)},{sources,session,clock:()=>${initialNow}});
      void c.review(${JSON.stringify(s.request)}).catch(()=>{}); process.send('reserved');`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    try {
      await new Promise<void>((resolve, reject) => { child.once('message', () => resolve()); child.once('error', reject); child.once('exit', () => reject(Error('child exited before reservation'))); });
      const pending = await c.review(s.request); assert.equal(pending.status, 'PENDING'); assert.equal(s.calls.length, 0);
      const exited = new Promise<void>(resolve => child.once('exit', () => resolve())); child.kill('SIGKILL'); await exited;
      c.close(); const reopened = s.reopen(); const recovered = await reopened.review(s.request);
      assert.deepEqual(recovered, pending); assert.equal(recovered.freshness, 'STALE_RECHECK_REQUIRED'); assert.equal(s.calls.length, 0);
    } finally { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
  } finally { s.cleanup(); }
});


test('explicit refresh appends durable revisions and never relabels old views as current', async () => {
  const s = setup(); try {
    const c = s.create(); const first = await c.review(s.request); const oldView = JSON.stringify(first); const oldCalls = s.calls.length;
    s.setNow(initialNow + 10); const refreshed = await c.refresh(s.request, first.revision);
    assert.equal(refreshed.revision, 3); assert.equal(refreshed.status, 'SYNTHETIC_MATCH'); assert.equal(refreshed.observedAt, initialNow + 10); assert.equal(refreshed.freshness, 'OBSERVED_DURING_CALL');
    assert.equal(s.calls.length, oldCalls * 2); assert.equal(JSON.stringify(first), oldView);
    const history = c.history(first.requestKey); assert.deepEqual(history.map(r => [r.revision, r.status]), [[0, 'PENDING'], [1, 'SYNTHETIC_MATCH'], [2, 'PENDING'], [3, 'SYNTHETIC_MATCH']]);
    assert(history.every(r => r.freshness === 'STALE_RECHECK_REQUIRED' && !r.canSign && !r.receiptValid));
    assert.deepEqual(history[1], { ...first, freshness: 'STALE_RECHECK_REQUIRED' }); assert.equal(Object.isFrozen(history), true);
    assert.deepEqual(c.history(first.requestKey, 1, 2).map(r => r.revision), [1, 2]);
    assert.throws(() => c.history(first.requestKey, 0, 101), /REVIEW_INVALID_HISTORY_RANGE/);
    const calls = s.calls.length; await assert.rejects(c.refresh(s.request, 1), /REVIEW_REVISION_CONFLICT/); assert.equal(s.calls.length, calls);
    c.close(); const reopened = s.reopen(); assert.deepEqual(reopened.history(first.requestKey), history); assert.equal((await reopened.review(s.request)).freshness, 'STALE_RECHECK_REQUIRED'); assert.equal(s.calls.length, calls);
  } finally { s.cleanup(); }
});

test('concurrent refresh CAS reserves once and concurrent replay sees PENDING, not old success', async () => {
  const s = setup(); let block = false; let release: () => void = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
  try {
    s.sources[0]!.transport = { request: async (m, p) => { if (block) await gate; return s.base(m, p); } };
    const c = s.create(); const first = await c.review(s.request); const other = s.reopen(); const calls = s.calls.length; block = true;
    const pending = c.refresh(s.request, first.revision); const duplicate = await other.review(s.request);
    assert.equal(duplicate.status, 'PENDING'); assert.equal(duplicate.revision, 2); assert.equal(duplicate.freshness, 'STALE_RECHECK_REQUIRED');
    await assert.rejects(other.refresh(s.request, first.revision), /REVIEW_REVISION_CONFLICT/);
    await assert.rejects(other.refresh(s.request, duplicate.revision), /REVIEW_REFRESH_NOT_ALLOWED/); assert.equal(s.calls.length, calls);
    release(); const finished = await pending; assert.equal(finished.revision, 3); assert.equal(finished.status, 'SYNTHETIC_MATCH'); assert.equal(s.calls.length, calls * 2);
    assert.equal(other.history(first.requestKey).length, 4);
  } finally { release(); s.cleanup(); }
});

test('UNKNOWN and interrupted PENDING cannot be reset by refresh', async () => {
  const s = setup(); try {
    s.revokePath(); const c = s.create(); const unknown = await c.review(s.request);
    await assert.rejects(c.refresh(s.request, unknown.revision), /REVIEW_REFRESH_NOT_ALLOWED/); assert.equal(c.history(unknown.requestKey).length, 2); assert.equal(s.calls.length, 0);
  } finally { s.cleanup(); }
  const p = setup(); try {
    p.sources[0]!.transport = { request: () => new Promise(() => {}) }; const c = p.create(); const pending = c.review(p.request); c.close(); await assert.rejects(pending, /REVIEW_STORE_CLOSED/);
    const reopened = p.reopen(); const head = await reopened.review(p.request); await assert.rejects(reopened.refresh(p.request, head.revision), /REVIEW_REFRESH_NOT_ALLOWED/); assert.equal(reopened.history(head.requestKey).length, 1);
  } finally { p.cleanup(); }
});

test('failed or cancelled refresh preserves old success only as history and locks the new UNKNOWN', async () => {
  const s = setup(); let blocked = false; let release: (v: unknown) => void = () => {};
  try {
    s.sources[0]!.transport = { request: (m, p) => blocked ? new Promise(resolve => { release = resolve; }) : s.base(m, p) };
    const c = s.create(); const first = await c.review(s.request); const oldHistory = c.history(first.requestKey);
    await assert.rejects(c.refresh(s.request, 1, AbortSignal.abort()), /REVIEW_ABORTED/); assert.deepEqual(c.history(first.requestKey), oldHistory);
    blocked = true; const controller = new AbortController(); const pending = c.refresh(s.request, 1, controller.signal); controller.abort();
    const failed = await pending; assert.equal(failed.status, 'UNKNOWN'); assert.equal(failed.revision, 3); assert.equal(failed.issue, 'REVIEW_ABORTED'); assert.equal(c.get(first.requestKey)?.status, 'UNKNOWN');
    await assert.rejects(c.refresh(s.request, 3), /REVIEW_REFRESH_NOT_ALLOWED/);
    release({ genesis_hash: '11'.repeat(32), hash_function: 'sha256', cashtokens: true }); await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(c.get(first.requestKey)?.revision, 3); assert.equal(c.get(first.requestKey)?.status, 'UNKNOWN'); assert.deepEqual(c.history(first.requestKey, 0, 2), oldHistory);
  } finally { s.cleanup(); }
});

test('refresh rejects changed binding, forged evidence, missing key and expired/backward clocks before reads', async () => {
  const s = setup(); try {
    const c = s.create(); const first = await c.review(s.request); const calls = s.calls.length;
    await assert.rejects(c.refresh({ ...s.request, paymentRequestId: 'missing' }, 1), /REVIEW_NOT_FOUND/);
    await assert.rejects(c.refresh({ ...s.request, intent: { ...s.request.intent, maxFeeSatoshis: '601' } }, 1), /REVIEW_REQUEST_CONFLICT/);
    const changed = structuredClone(s.candidate); changed.inputs[0]!.unlockingBytecode = hexToBin('00');
    await assert.rejects(c.refresh({ ...s.request, candidateHex: binToHex(encodeTransaction(changed)) }, 1), /REVIEW_REQUEST_CONFLICT/);
    await assert.rejects(c.refresh({ ...s.request, bindings: [{ ...s.request.bindings[0]!, index: 1 }] }, 1), /REVIEW_REQUEST_CONFLICT/);
    s.setSession('other'); await assert.rejects(c.refresh(s.request, 1), /REVIEW_REQUEST_CONFLICT/); s.setSession('private-session-A');
    await assert.rejects(Reflect.apply(c.refresh, c, [{ ...s.request, evidence: { status: 'NODE_REPORTED' } }, 1]), /REVIEW_INVALID_INPUT/);
    await assert.rejects(c.refresh(s.request, NaN), /REVIEW_INVALID_REVISION/);
    s.setNow(initialNow - 1); await assert.rejects(c.refresh(s.request, 1), /REVIEW_CLOCK_WINDOW/);
    s.setNow(s.request.intent.expiresAt); await assert.rejects(c.refresh(s.request, 1), /REVIEW_INTENT_EXPIRED/);
    assert.equal(s.calls.length, calls); assert.equal(c.history(first.requestKey).length, 2);
    s.setNow(initialNow); c.close(); s.sources[0]!.maxTipAgeMs = 1000; const reopened = s.reopen(); await assert.rejects(reopened.refresh(s.request, 1), /REVIEW_REQUEST_CONFLICT/);
  } finally { s.cleanup(); }
});

test('refresh return-time tip expiry and session revocation cannot produce current authority', async () => {
  const s = setup(); try {
    for (const source of s.sources) source.maxTipAgeMs = 1000;
    let ticks = 0; s.config.clock = () => ++ticks >= 10 ? initialNow + 1001 : initialNow;
    const c = s.create(); const first = await c.review(s.request); const refreshed = await c.refresh(s.request, first.revision);
    assert.equal(refreshed.status, 'SYNTHETIC_MATCH'); assert.equal(refreshed.revision, 3); assert.equal(refreshed.freshness, 'STALE_RECHECK_REQUIRED'); assert.equal(refreshed.canSign, false);
  } finally { s.cleanup(); }
  const r = setup(); let revoke = false;
  try {
    r.sources[1]!.transport = { request: async (m, p) => { if (revoke) r.revokePath(); return r.base(m, p); } };
    const c = r.create(); const first = await c.review(r.request); revoke = true; const failed = await c.refresh(r.request, first.revision);
    assert.equal(failed.status, 'UNKNOWN'); assert.equal(failed.freshness, 'STALE_RECHECK_REQUIRED'); assert.equal(c.history(first.requestKey)[1]?.status, 'SYNTHETIC_MATCH');
  } finally { r.cleanup(); }
});

test('v1 journal refusal is byte-for-byte unchanged and never creates replacement history', async () => {
  const s = setup(); try {
    const c = s.create(); const first = await c.review(s.request); c.close(); const file = join(s.directory, 'reviews.sqlite');
    rmSync(file); const old = new DatabaseSync(file);
    old.exec('CREATE TABLE metadata(version INTEGER NOT NULL CHECK(version=1)); INSERT INTO metadata VALUES(1); CREATE TABLE reviews(request_key TEXT PRIMARY KEY,revision INTEGER NOT NULL,document TEXT NOT NULL,checksum TEXT NOT NULL);');
    const { freshness: _freshness, ...record } = first; const document = JSON.stringify(record); old.prepare('INSERT INTO reviews VALUES(?,?,?,?)').run(record.requestKey, record.revision, document, createHash('sha256').update(document).digest('hex')); old.close(); chmodSync(file, 0o600);
    const before = readFileSync(file); assert.throws(() => s.reopen(), /REVIEW_MIGRATION_REQUIRED/); assert.deepEqual(readFileSync(file), before);
    const inspect = new DatabaseSync(file, { readOnly: true }); try { assert.equal(inspect.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='review_history'").get()?.n, 0); } finally { inspect.close(); }
  } finally { s.cleanup(); }
});

test('append-only history rejects writes, missing links and recomputed-checksum UNKNOWN reset', async () => {
  const s = setup(); try {
    s.revokePath(); const c = s.create(); const head = await c.review(s.request); c.close(); const db = new DatabaseSync(join(s.directory, 'reviews.sqlite'));
    try {
      assert.throws(() => db.exec("UPDATE review_history SET document='{}'"), /IMMUTABLE_HISTORY/);
      assert.throws(() => db.exec('DELETE FROM review_history'), /IMMUTABLE_HISTORY/);
      const row = db.prepare('SELECT document,checksum FROM reviews WHERE request_key=?').get(head.requestKey); assert.equal(typeof row?.document, 'string'); assert.equal(typeof row?.checksum, 'string');
      if (!row || typeof row.document !== 'string' || typeof row.checksum !== 'string') throw Error('missing fixture');
      const parsed: unknown = JSON.parse(row.document); assert.ok(parsed && typeof parsed === 'object' && !Array.isArray(parsed));
      const illegal = { ...parsed, revision: 2, status: 'PENDING', completedAt: null, observedAt: null, evidenceBindingDigest: null, issue: null };
      const document = JSON.stringify(illegal), checksum = createHash('sha256').update(document).digest('hex');
      db.prepare('INSERT INTO review_history VALUES(?,?,?,?,?)').run(head.requestKey, 2, document, checksum, row.checksum);
      db.prepare('UPDATE reviews SET revision=2,document=?,checksum=? WHERE request_key=?').run(document, checksum, head.requestKey);
    } finally { db.close(); }
    assert.throws(() => s.reopen(), /REVIEW_CORRUPT_STORE/);
  } finally { s.cleanup(); }
  const gap = setup(); try {
    const c = gap.create(); await c.review(gap.request); c.close(); const db = new DatabaseSync(join(gap.directory, 'reviews.sqlite'));
    db.exec('DROP TRIGGER immutable_history_delete; DELETE FROM review_history WHERE revision=0;'); db.close(); assert.throws(() => gap.reopen(), /REVIEW_CORRUPT_STORE/);
  } finally { gap.cleanup(); }
});

test('SIGKILL during refresh preserves reserved generation and old history without replay', async () => {
  const s = setup(); try {
    const c = s.create(); const first = await c.review(s.request); const oldHistory = c.history(first.requestKey);
    const metadata = s.sources.map(({ transport: _transport, ...source }) => source);
    const script = `import { ReadOnlyReviewCoordinator } from ${JSON.stringify(new URL('./review-coordinator.js', import.meta.url).href)};
      const sources=${JSON.stringify(metadata)}.map(s=>({...s,transport:{request:()=>new Promise(()=>{})}}));
      const session={currentSessionId:()=>"private-session-A",hasPath:n=>n===0,getPubkey:(_n,i)=>i===0n?Uint8Array.from(${JSON.stringify([...publicPoint])}):undefined};
      const c=ReadOnlyReviewCoordinator.open(${JSON.stringify(s.directory)},{sources,session,clock:()=>${initialNow}});
      void c.refresh(${JSON.stringify(s.request)},1).catch(()=>{}); process.send('reserved');`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    try {
      await new Promise<void>((resolve, reject) => { child.once('message', () => resolve()); child.once('error', reject); child.once('exit', () => reject(Error('child exited early'))); });
      assert.equal(c.get(first.requestKey)?.revision, 2); const exited = new Promise<void>(resolve => child.once('exit', () => resolve())); child.kill('SIGKILL'); await exited; c.close();
      const reopened = s.reopen(); const recovered = await reopened.review(s.request); assert.equal(recovered.status, 'PENDING'); assert.equal(recovered.revision, 2); assert.equal(recovered.freshness, 'STALE_RECHECK_REQUIRED');
      assert.deepEqual(reopened.history(first.requestKey, 0, 2), oldHistory); await assert.rejects(reopened.refresh(s.request, 2), /REVIEW_REFRESH_NOT_ALLOWED/);
    } finally { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
  } finally { s.cleanup(); }
});
