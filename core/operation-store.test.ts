import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, lstatSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { operationIntentDigest, SimulationOperationStore, type SimulationEvent, type StoredOperation } from './operation-store.js';
import { verifyCandidate, type PaymentIntent } from './guard.js';
import { fixture as guardFixture } from './fixtures.js';

const intent: PaymentIntent = { network: 'chipnet', expiresAt: 1000, maxFeeSatoshis: '500', recipients: [{ script: '76a914' + '11'.repeat(20) + '88ac', satoshis: '10000' }], ownerScripts: ['76a914' + '22'.repeat(20) + '88ac'] };
const txid = 'ab'.repeat(32); const blockHash = 'cd'.repeat(32);
const input = (paymentRequestId = 'order1', sessionId = 'session1') => ({ paymentRequestId, sessionId, intent, requiredConfirmations: 2 });
function fixture(): { root: string; directory: string; store: SimulationOperationStore; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'intentguard-store-')); const directory = join(root, 'ledger');
  const store = SimulationOperationStore.create(directory);
  return { root, directory, store, cleanup: () => { store.close(); rmSync(root, { recursive: true, force: true }); } };
}
function event(store: SimulationOperationStore, op: StoredOperation, action: SimulationEvent, now = 10): StoredOperation { return store.importSimulationEvent(op.operationId, op.revision, action, now); }
function ready(store: SimulationOperationStore, key = 'order1'): StoredOperation {
  let op = store.createOperation(input(key));
  for (const type of ['confirm-intent', 'candidate-built', 'precheck-match'] as const) op = event(store, op, { type });
  return op;
}
function signing(store: SimulationOperationStore): StoredOperation { return event(store, ready(store), { type: 'request-signature' }); }
function broadcasting(store: SimulationOperationStore): StoredOperation {
  let op = signing(store); assert.ok(op.attempt);
  op = event(store, op, { type: 'signature-received', binding: op.attempt, txid });
  return event(store, op, { type: 'secondary-check-match' });
}

test('stable canonical digest, persistent economic tombstone, no raw payment/session data', () => {
  const f = fixture(); try {
    const op = f.store.createOperation(input()); assert.equal(op.revision, 0);
    assert.deepEqual(f.store.createOperation(input()), op);
    assert.equal(operationIntentDigest({ ownerScripts: intent.ownerScripts, recipients: intent.recipients, maxFeeSatoshis: intent.maxFeeSatoshis, expiresAt: intent.expiresAt, network: intent.network }), op.intentDigest);
    assert.notEqual(operationIntentDigest({ ...intent, expiresAt: 999 }), op.intentDigest);
    assert.throws(() => f.store.createOperation({ ...input(), intent: { ...intent, expiresAt: 999 } }), /ECONOMIC_KEY_CONFLICT/);
    assert.throws(() => f.store.createOperation(input('order1', 'different-session')), /ECONOMIC_KEY_CONFLICT/);
    f.store.close(); const reopened = SimulationOperationStore.open(f.directory);
    try { assert.deepEqual(reopened.get(op.operationId), op); assert.deepEqual(reopened.createOperation(input()), op); } finally { reopened.close(); }
    const disk = readFileSync(join(f.directory, 'operations.sqlite')).toString('utf8');
    for (const secret of ['order1', 'session1', intent.recipients[0]!.script, intent.ownerScripts[0]!]) assert.equal(disk.includes(secret), false);
    assert.equal(lstatSync(f.directory).mode & 0o777, 0o700); assert.equal(lstatSync(join(f.directory, 'operations.sqlite')).mode & 0o777, 0o600);
  } finally { f.cleanup(); }
});

test('revision CAS and mutation of returned snapshots cannot mutate saved state', () => {
  const f = fixture(); try {
    const op = f.store.createOperation(input()); const second = SimulationOperationStore.open(f.directory);
    try {
      const saved = event(f.store, op, { type: 'confirm-intent' });
      assert.throws(() => event(second, op, { type: 'confirm-intent' }), /REVISION_CONFLICT/);
      saved.state = 'SIMULATED_CONFIRMED_ON_CHAIN'; assert.equal(second.get(op.operationId)?.state, 'CONFIRMED');
      assert.throws(() => event(second, { ...op, revision: 1 }, { type: 'confirm-observation', observation: { txid, confirmations: 99, blockHash, blockHeight: 1, observedAt: 1 } }), /INVALID_TRANSITION/);
    } finally { second.close(); }
  } finally { f.cleanup(); }
});

test('session lock survives restart and UNKNOWN has no reset, retry, or late-response escape', () => {
  const f = fixture(); try {
    let op = signing(f.store); assert.ok(op.attempt); const attempt = op.attempt;
    op = event(f.store, op, { type: 'signature-timeout', binding: attempt }); assert.equal(op.originalTxid, null);
    const other = ready(f.store, 'order2'); f.store.close(); const reopened = SimulationOperationStore.open(f.directory);
    try {
      assert.throws(() => event(reopened, other, { type: 'request-signature' }), /SESSION_LOCKED/);
      assert.throws(() => event(reopened, op, { type: 'observe', observation: { txid, confirmations: 0, blockHash: null, blockHeight: null, observedAt: 10 } }), /ORIGINAL_TXID_REQUIRED/);
      assert.throws(() => event(reopened, op, { type: 'request-signature' }), /INVALID_TRANSITION/);
      assert.equal(reopened.createOperation(input()).state, 'UNKNOWN');
      op = event(reopened, op, { type: 'needs-review' });
      assert.throws(() => event(reopened, op, { type: 'observe', observation: { txid, confirmations: 0, blockHash: null, blockHeight: null, observedAt: 10 } }), /ORIGINAL_TXID_REQUIRED/);
      op = event(reopened, op, { type: 'signature-received', binding: attempt, txid });
      assert.equal(op.state, 'NEEDS_REVIEW');
      assert.throws(() => event(reopened, op, { type: 'secondary-check-match' }), /INVALID_TRANSITION/);
      assert.throws(() => event(reopened, other, { type: 'request-signature' }), /SESSION_LOCKED/);
      op = event(reopened, op, { type: 'observe', observation: { txid, confirmations: 0, blockHash: null, blockHeight: null, observedAt: 10 } });
      assert.equal(op.state, 'OBSERVED'); assert.equal(op.chainVerified, false); assert.equal(op.receiptValid, false);
    } finally { reopened.close(); }
  } finally { f.cleanup(); }
});

test('all attempt bindings, expiry, cancelled late responses, and request sequence checked', () => {
  const f = fixture(); try {
    let op = signing(f.store); assert.ok(op.attempt);
    for (const bad of [{ ...op.attempt, attemptId: 'ef'.repeat(32) }, { ...op.attempt, requestSequence: 2 }, { ...op.attempt, sessionDigest: 'ef'.repeat(32) }, { ...op.attempt, intentDigest: 'ef'.repeat(32) }]) assert.throws(() => event(f.store, op, { type: 'signature-received', binding: bad, txid }), /ATTEMPT_MISMATCH/);
    const attempt = op.attempt; op = event(f.store, op, { type: 'signature-refused', binding: attempt });
    assert.throws(() => event(f.store, op, { type: 'signature-received', binding: attempt, txid }), /INVALID_TRANSITION/);
    assert.equal(f.store.createOperation(input()).state, 'CANCELLED');
    const next = event(f.store, ready(f.store, 'order2'), { type: 'request-signature' }); assert.equal(next.attempt?.requestSequence, 2);
  } finally { f.cleanup(); }
  const f2 = fixture(); try { const op = ready(f2.store); assert.throws(() => event(f2.store, op, { type: 'request-signature' }, 1000), /INTENT_EXPIRED/); assert.equal(f2.store.get(op.operationId)?.state, 'READY'); } finally { f2.cleanup(); }
});

test('broadcast recovery pins original txid; simulated receipt threshold and reorg invalidate', () => {
  const f = fixture(); try {
    let op = broadcasting(f.store); op = event(f.store, op, { type: 'broadcast-timeout' });
    const observed = { txid, confirmations: 1, blockHash, blockHeight: 123, observedAt: 11 };
    assert.throws(() => event(f.store, op, { type: 'observe', observation: { ...observed, txid: 'ef'.repeat(32) } }, 11), /ORIGINAL_TXID_MISMATCH/);
    op = event(f.store, op, { type: 'observe', observation: observed }, 11);
    assert.throws(() => event(f.store, op, { type: 'confirm-observation', observation: observed }, 11), /INSUFFICIENT_CONFIRMATIONS/);
    assert.throws(() => event(f.store, op, { type: 'confirm-observation', observation: { ...observed, confirmations: 2, observedAt: 10 } }, 11), /INVALID_OBSERVATION/);
    assert.throws(() => event(f.store, op, { type: 'confirm-observation', observation: { ...observed, confirmations: 2, blockHash: null } }, 11), /INVALID_OBSERVATION/);
    op = event(f.store, op, { type: 'confirm-observation', observation: { ...observed, confirmations: 2 } }, 11);
    assert.equal(op.state, 'SIMULATED_CONFIRMED_ON_CHAIN'); assert.equal(op.simulatedReceiptStatus, 'CONFIRMED'); assert.equal(op.receiptValid, false); assert.equal(op.chainVerified, false); assert.equal(op.canSign, false);
    assert.equal(f.store.createOperation(input()).state, 'SIMULATED_CONFIRMED_ON_CHAIN');
    const next = event(f.store, ready(f.store, 'order2'), { type: 'request-signature' }); assert.equal(next.attempt?.requestSequence, 2);
    op = event(f.store, op, { type: 'conflict', observedAt: 12 }, 12); assert.equal(op.observation, null); assert.equal(op.simulatedReceiptStatus, 'INVALIDATED');
    assert.throws(() => event(f.store, op, { type: 'observe', observation: observed }, 12), /INVALID_TRANSITION/);
    f.store.close(); const recovered = SimulationOperationStore.open(f.directory); try { assert.equal(recovered.get(op.operationId)?.state, 'CONFLICTED'); } finally { recovered.close(); }
  } finally { f.cleanup(); }
});

test('post-sign block retains session lock; pre-sign block is terminal without a lock', () => {
  const f = fixture(); try {
    let op = signing(f.store); assert.ok(op.attempt); op = event(f.store, op, { type: 'signature-received', binding: op.attempt, txid }); op = event(f.store, op, { type: 'secondary-check-block' });
    assert.throws(() => event(f.store, ready(f.store, 'order2'), { type: 'request-signature' }), /SESSION_LOCKED/);
    assert.throws(() => event(f.store, op, { type: 'precheck-match' }), /INVALID_TRANSITION/);
  } finally { f.cleanup(); }
});

test('missing/corrupted/insecure files never recreate an empty ledger; actual filesystem failures do not report saved', () => {
  const f = fixture(); try {
    const op = f.store.createOperation(input()); const file = join(f.directory, 'operations.sqlite');
    renameSync(file, file + '.removed'); assert.throws(() => event(f.store, op, { type: 'confirm-intent' }), /ENOENT/); assert.throws(() => SimulationOperationStore.open(f.directory), /ENOENT/);
    renameSync(file + '.removed', file); assert.equal(f.store.get(op.operationId)?.state, 'DRAFT');
    chmodSync(file, 0o644); assert.throws(() => SimulationOperationStore.open(f.directory), /UNSAFE_STORE_PATH/); chmodSync(file, 0o600);
    f.store.close(); writeFileSync(file, 'not a sqlite database'); assert.throws(() => SimulationOperationStore.open(f.directory)); assert.equal(readFileSync(file, 'utf8'), 'not a sqlite database');
    assert.throws(() => SimulationOperationStore.create(f.directory), /EEXIST/);
  } finally { f.cleanup(); }
});

test('logical document corruption and symlink paths fail closed', () => {
  const f = fixture(); try {
    f.store.createOperation(input()); f.store.close();
    const db = new DatabaseSync(join(f.directory, 'operations.sqlite')); db.exec("UPDATE operations SET document='{}'"); db.close();
    assert.throws(() => SimulationOperationStore.open(f.directory), /CORRUPT_OPERATION/);
    symlinkSync(f.directory, join(f.root, 'alias')); assert.throws(() => SimulationOperationStore.open(join(f.root, 'alias')), /UNSAFE_STORE_PATH/);
  } finally { f.cleanup(); }
});

function childResult(child: ChildProcess): Promise<unknown> {
  return new Promise((resolve, reject) => { let result: unknown; let got = false; let stderr = ''; child.stderr?.on('data', b => { stderr += String(b); }); child.on('message', message => { result = message; got = true; }); child.on('error', reject); child.on('exit', code => code === 0 && got ? resolve(result) : reject(Error(`child exit ${code}: ${stderr}`))); });
}
test('two real processes racing CAS: exactly one transition persists', async () => {
  const f = fixture(); try {
    const op = f.store.createOperation(input());
    const script = `import { SimulationOperationStore } from ${JSON.stringify(new URL('./operation-store.js', import.meta.url).href)}; const s=SimulationOperationStore.open(${JSON.stringify(f.directory)}); try { const o=s.importSimulationEvent(${JSON.stringify(op.operationId)},0,{type:'confirm-intent'},10); process.send({saved:o.revision}); } catch(e) { process.send({error:e.message}); } finally {s.close(); process.disconnect();}`;
    const run = (): Promise<unknown> => childResult(spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }));
    const results = await Promise.all([run(), run()]);
    assert.deepEqual(results.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), [{ error: 'REVISION_CONFLICT' }, { saved: 1 }]);
    assert.equal(f.store.get(op.operationId)?.revision, 1);
  } finally { f.cleanup(); }
});

test('killed writer before commit rolls back on reopen, preserving original revision', async () => {
  const f = fixture(); try {
    const op = f.store.createOperation(input()); f.store.close();
    const script = `import { DatabaseSync } from 'node:sqlite'; const db=new DatabaseSync(${JSON.stringify(join(f.directory, 'operations.sqlite'))}); db.exec("BEGIN IMMEDIATE; UPDATE operations SET revision=123"); process.send('uncommitted'); setInterval(()=>{},1000);`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    await new Promise<void>((resolve, reject) => { child.once('message', () => resolve()); child.once('error', reject); child.once('exit', () => reject(Error('writer exited early'))); });
    const stopped = new Promise<void>(resolve => child.once('exit', () => resolve())); child.kill('SIGKILL'); await stopped;
    const reopened = SimulationOperationStore.open(f.directory); try { assert.deepEqual(reopened.get(op.operationId), op); } finally { reopened.close(); }
  } finally { f.cleanup(); }
});

test('concurrent processes cannot start two operations in one session', async () => {
  const f = fixture(); try {
    const first = ready(f.store, 'first'); const second = ready(f.store, 'second');
    const run = (op: StoredOperation): Promise<unknown> => {
      const script = `import { SimulationOperationStore } from ${JSON.stringify(new URL('./operation-store.js', import.meta.url).href)}; const s=SimulationOperationStore.open(${JSON.stringify(f.directory)}); try { const o=s.importSimulationEvent(${JSON.stringify(op.operationId)},${op.revision},{type:'request-signature'},10); process.send({saved:o.state}); } catch(e) { process.send({error:e.message}); } finally {s.close(); process.disconnect();}`;
      return childResult(spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }));
    };
    const results = await Promise.all([run(first), run(second)]);
    assert.deepEqual(results.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), [{ error: 'SESSION_LOCKED' }, { saved: 'SIGNING' }]);
    assert.equal([f.store.get(first.operationId), f.store.get(second.operationId)].filter(o => o?.state === 'SIGNING').length, 1);
  } finally { f.cleanup(); }
});

test('runtime arbitrary status patches and injected observation payloads are rejected', () => {
  const f = fixture(); try {
    const initial = f.store.createOperation(input());
    assert.throws(() => Reflect.apply(f.store.importSimulationEvent, f.store, [initial.operationId, initial.revision, { type: 'set-status', state: 'SIMULATED_CONFIRMED_ON_CHAIN' }, 10]), /INVALID_EVENT/);
    assert.deepEqual(f.store.get(initial.operationId), initial);
    const op = broadcasting(f.store);
    assert.throws(() => Reflect.apply(f.store.importSimulationEvent, f.store, [op.operationId, op.revision, { type: 'observe', observation: { txid, confirmations: 0, blockHash: null, blockHeight: null, observedAt: 10, secret: 'must-not-persist' } }, 10]), /INVALID_OBSERVATION/);
    assert.equal(readFileSync(join(f.directory, 'operations.sqlite')).includes(Buffer.from('must-not-persist')), false);
  } finally { f.cleanup(); }
});

test('all successful lifecycle revisions survive reopen; cancelled economic key cannot restart', () => {
  const f = fixture(); let current = f.store;
  try {
    let op = current.createOperation(input());
    for (const type of ['confirm-intent', 'candidate-built', 'precheck-match', 'request-signature'] as const) {
      op = event(current, op, { type }); current.close(); current = SimulationOperationStore.open(f.directory); assert.deepEqual(current.get(op.operationId), op);
    }
    assert.ok(op.attempt); op = event(current, op, { type: 'signature-refused', binding: op.attempt });
    current.close(); current = SimulationOperationStore.open(f.directory);
    assert.deepEqual(current.createOperation(input()), op);
    assert.throws(() => event(current, op, { type: 'confirm-intent' }), /INVALID_TRANSITION/);
  } finally { current.close(); f.cleanup(); }
});

test('replaced database inode cannot be mistaken for the opened ledger', () => {
  const f = fixture(); try {
    const op = f.store.createOperation(input()); const file = join(f.directory, 'operations.sqlite'); const saved = readFileSync(file);
    renameSync(file, file + '.old'); writeFileSync(file, saved, { mode: 0o600 });
    assert.throws(() => event(f.store, op, { type: 'confirm-intent' }), /STORE_PATH_REPLACED/);
  } finally { f.cleanup(); }
});


test('expired bound signature retains original txid in durable non-broadcastable quarantine', () => {
  const f = fixture(); try {
    let op = signing(f.store); assert.ok(op.attempt);
    op = event(f.store, op, { type: 'signature-received', binding: op.attempt, txid }, 1000);
    assert.equal(op.state, 'NEEDS_REVIEW'); assert.equal(op.originalTxid, txid);
    assert.throws(() => event(f.store, op, { type: 'secondary-check-match' }, 1001), /INVALID_TRANSITION/);
    assert.throws(() => event(f.store, ready(f.store, 'order2'), { type: 'request-signature' }, 11), /SESSION_LOCKED/);
    f.store.close(); const reopened = SimulationOperationStore.open(f.directory);
    try {
      assert.deepEqual(reopened.get(op.operationId), op);
      assert.throws(() => event(reopened, op, { type: 'observe', observation: { txid: 'ef'.repeat(32), confirmations: 0, blockHash: null, blockHeight: null, observedAt: 1001 } }, 1001), /ORIGINAL_TXID_MISMATCH/);
      op = event(reopened, op, { type: 'observe', observation: { txid, confirmations: 0, blockHash: null, blockHeight: null, observedAt: 1001 } }, 1001);
      assert.equal(op.state, 'OBSERVED'); assert.equal(op.chainVerified, false);
    } finally { reopened.close(); }
  } finally { f.cleanup(); }
});

test('store and Guard share the same validated intent digest and strict limits', () => {
  for (const withToken of [false, true]) {
    const { input } = guardFixture(withToken);
    assert.equal(operationIntentDigest(input.intent), verifyCandidate(input).intentDigest);
    assert.throws(() => operationIntentDigest({ ...input.intent, maxFeeSatoshis: '2100000000000001' }), /AMOUNT_RANGE/);
    assert.throws(() => operationIntentDigest({ ...input.intent, ownerScripts: [input.intent.recipients[0]!.script] }), /AMBIGUOUS_RECIPIENT_CHANGE/);
    assert.throws(() => operationIntentDigest({ ...input.intent, ownerScripts: [...input.intent.ownerScripts, ...input.intent.ownerScripts] }), /INVALID_INTENT/);
  }
});


test('timeout late signature is quarantined, pinned, durable, and never becomes broadcastable', () => {
  const f = fixture(); try {
    let op = signing(f.store); assert.ok(op.attempt); const binding = op.attempt;
    op = event(f.store, op, { type: 'signature-timeout', binding });
    const before = op;
    assert.throws(() => event(f.store, op, { type: 'observe', observation: { txid, confirmations: 20, blockHash, blockHeight: 1, observedAt: 10 } }), /ORIGINAL_TXID_REQUIRED/);
    assert.deepEqual(f.store.get(op.operationId), before);
    assert.throws(() => event(f.store, op, { type: 'signature-received', binding: { ...binding, requestSequence: 42 }, txid }), /ATTEMPT_MISMATCH/);
    op = event(f.store, op, { type: 'signature-received', binding, txid });
    assert.equal(op.state, 'NEEDS_REVIEW'); assert.equal(op.originalTxid, txid);
    assert.throws(() => event(f.store, op, { type: 'secondary-check-match' }), /INVALID_TRANSITION/);
    assert.throws(() => event(f.store, op, { type: 'signature-received', binding, txid: 'ef'.repeat(32) }), /ORIGINAL_TXID_MISMATCH/);
    assert.throws(() => event(f.store, ready(f.store, 'order2'), { type: 'request-signature' }), /SESSION_LOCKED/);
    f.store.close(); const reopened = SimulationOperationStore.open(f.directory);
    try {
      assert.deepEqual(reopened.get(op.operationId), op);
      op = event(reopened, op, { type: 'observe', observation: { txid, confirmations: 0, blockHash: null, blockHeight: null, observedAt: 10 } });
      assert.equal(op.state, 'OBSERVED'); assert.equal(op.receiptValid, false);
    } finally { reopened.close(); }
  } finally { f.cleanup(); }
});


test('expiry at the pre-broadcast boundary quarantines the signed original and keeps session locked', () => {
 for(const at of [999,1000,1001]) {
  const f=fixture();try {
   let op=signing(f.store);op=event(f.store,op,{type:'signature-received',binding:op.attempt!,txid},999);
   op=event(f.store,op,{type:'secondary-check-match'},at);
   assert.equal(op.state,at<1000?'BROADCASTING':'NEEDS_REVIEW');assert.equal(op.originalTxid,txid);assert.equal(op.canSign,false);assert.equal(op.receiptValid,false);
   const next=ready(f.store,'other-order');assert.throws(()=>event(f.store,next,{type:'request-signature'},at<1000?at:999),/SESSION_LOCKED/);
   if(at>=1000)assert.throws(()=>event(f.store,op,{type:'secondary-check-match'},at),/INVALID_TRANSITION/);
   f.store.close();const reopened=SimulationOperationStore.open(f.directory);try {assert.equal(reopened.get(op.operationId)?.state,op.state);assert.equal(reopened.get(op.operationId)?.originalTxid,txid);}finally{reopened.close();}
  }finally{f.cleanup();}
 }
});
