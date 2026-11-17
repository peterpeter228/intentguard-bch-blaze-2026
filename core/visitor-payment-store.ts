import type { PaymentRequestWire } from './payment-request.js';
import type { UnsignedBuildInput, UnsignedBuildResult } from './unsigned-builder.js';
import type { SignEnvelope } from './wallet-adapter.js';
import type { PaymentObservation } from './payment-chain.js';
import { hashTransaction, hexToBin, binToHex, sha256 } from '@bitauth/libauth';

export interface VisitorOperation {
  id: string; revision: number; state: 'PREFLIGHTED' | 'SIGNING' | 'POSTCHECKED' | 'UNKNOWN' | 'NEEDS_REVIEW' | 'OBSERVED' | 'CONFIRMED_ON_CHAIN';
  request: PaymentRequestWire; requestDigest: string; build: UnsignedBuildInput; plan: UnsignedBuildResult; sourceDigest: string;
  envelope: SignEnvelope | null; signedHex: string | null; txid: string | null; handedOff: boolean;
  observation: PaymentObservation | null;
}
/** Same-origin retained IndexedDB only, NOT global exactly-once or wallet authority.
 * Every effect requires a successful strict-durability transaction; no memory fallback.
 * All economic/input tombstones survive uncertainty and new completed operations.
 */
export class VisitorPaymentStore {
  private constructor(private readonly db: IDBDatabase) {}
  static async open(): Promise<VisitorPaymentStore> {
    if (!globalThis.indexedDB) throw Error('DURABLE_STORAGE_REQUIRED');
    const { promise, resolve, reject } = Promise.withResolvers<VisitorPaymentStore>();
    const r = indexedDB.open('intentguard-visitor-payments-v1', 1);
    r.onupgradeneeded = () => {
      for (const name of ['operations', 'inputs', 'meta']) r.result.createObjectStore(name);
    };
    r.onerror = () => reject(Error('DURABLE_STORAGE_REQUIRED'));
    r.onblocked = () => reject(Error('DURABLE_STORAGE_BLOCKED'));
    r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); resolve(new VisitorPaymentStore(r.result)); };
    return promise;
  }
  close(): void { this.db.close(); }
  private transaction<T>(run: (stores: Record<'operations' | 'inputs' | 'meta', IDBObjectStore>, result: (value: T) => void, fail: (code: string) => void) => void): Promise<T> {
    const { promise, resolve, reject } = Promise.withResolvers<T>();
    let tx: IDBTransaction, output: T, failure = 'DURABLE_STORAGE_REQUIRED';
    try { tx = this.db.transaction(['operations', 'inputs', 'meta'], 'readwrite', { durability: 'strict' }); }
    catch { return Promise.reject(Error(failure)); }
    const fail = (code: string): void => { failure = code; tx.abort(); };
    tx.onabort = () => reject(Error(failure)); tx.onerror = () => { failure = 'DURABLE_STORAGE_REQUIRED'; };
    tx.oncomplete = () => resolve(output);
    try { run({ operations: tx.objectStore('operations'), inputs: tx.objectStore('inputs'), meta: tx.objectStore('meta') }, value => { output = value; }, fail); }
    catch { fail(failure); }
    return promise;
  }
  async active(): Promise<VisitorOperation | null> {
    return this.transaction((s, result) => {
      const r = s.meta.get('active'); r.onsuccess = () => {
        if (!r.result) { result(null); return; }
        const op = s.operations.get(r.result); op.onsuccess = () => result(op.result ?? null);
      };
    });
  }
  async prepare(candidate: Omit<VisitorOperation, 'id' | 'revision' | 'state' | 'envelope' | 'signedHex' | 'txid' | 'handedOff' | 'observation'>): Promise<VisitorOperation> {
    candidate = structuredClone(candidate); // Caller edits cannot race queued IDB callbacks.
    const id = binToHex(sha256.hash(new TextEncoder().encode('intentguard/visitor/v1\0' + candidate.request.network + '\0' + candidate.request.requestId)));
    return this.transaction((s, result, fail) => {
      const active = s.meta.get('active'); active.onsuccess = () => {
        if (active.result && active.result !== id) { fail('ORIGINAL_OPERATION_REQUIRED'); return; }
        const previous = s.operations.get(id); previous.onsuccess = () => {
          const old: VisitorOperation | undefined = previous.result;
          if (old && (old.state !== 'PREFLIGHTED' || old.envelope || old.signedHex)) { fail('ORIGINAL_OPERATION_REQUIRED'); return; }
          const keys = candidate.plan.selectedInputs.map(i => candidate.request.network + ':' + i.txid + ':' + i.index);
          let remaining = keys.length;
          if (!remaining) { fail('INVALID_SELECTION'); return; }
          for (const key of keys) {
            const input = s.inputs.get(key); input.onsuccess = () => {
              if (input.result && input.result !== id) { fail('INPUT_RESERVED'); return; }
              if (--remaining !== 0) return;
              if (old) for (const i of old.plan.selectedInputs) {
                const key = old.request.network + ':' + i.txid + ':' + i.index;
                if (!keys.includes(key)) s.inputs.delete(key); // Only never-invoked draft reservations can move.
              }
              const op: VisitorOperation = { ...candidate, id, revision: (old?.revision ?? -1) + 1, state: 'PREFLIGHTED', envelope: null, signedHex: null, txid: null, handedOff: false, observation: null };
              s.operations.put(op, id); s.meta.put(id, 'active'); for (const key of keys) s.inputs.put(id, key); result(op);
            };
          }
        };
      };
    });
  }
  private advance(id: string, revision: number | null, update: (op: VisitorOperation) => void): Promise<VisitorOperation> {
    return this.transaction((s, result, fail) => {
      const r = s.operations.get(id); r.onsuccess = () => {
        const op: VisitorOperation | undefined = r.result;
        if (!op || (revision !== null && op.revision !== revision)) { fail('REVISION_CONFLICT'); return; }
        try { update(op); } catch (e) { fail(e instanceof Error ? e.message : 'INVALID_TRANSITION'); return; }
        op.revision++; s.operations.put(op, id); result(op);
      };
    });
  }
  reserve(op: VisitorOperation, envelope: SignEnvelope): Promise<VisitorOperation> {
    envelope = { ...envelope }; // Snapshot before asynchronous IDB dispatch.
    return this.advance(op.id, op.revision, p => {
      if (p.state !== 'PREFLIGHTED' || p.envelope || p.signedHex || p.request.expiresAt <= Date.now() ||
          envelope.operationId !== p.id || envelope.revision !== p.revision + 1 || envelope.requestDigest !== p.requestDigest || envelope.planDigest !== p.plan.planDigest ||
          envelope.expiresAt !== p.request.expiresAt || !Number.isSafeInteger(envelope.sequence) || !envelope.sessionId ||
          envelope.intentDigest !== p.plan.intentDigest || envelope.unsignedHash !== hashTransaction(hexToBin(p.plan.unsignedHex!))) throw Error('ATTEMPT_MISMATCH');
      p.envelope = envelope; p.state = 'SIGNING';
    });
  }
  uncertain(id: string): Promise<VisitorOperation> {
    return this.advance(id, null, p => { if (['SIGNING', 'POSTCHECKED', 'OBSERVED', 'CONFIRMED_ON_CHAIN'].includes(p.state)) p.state = 'UNKNOWN'; p.observation = null; });
  }
  signed(id: string, envelope: SignEnvelope, signedHex: string, valid: boolean): Promise<VisitorOperation> {
    return this.advance(id, null, p => {
      if (!['SIGNING', 'UNKNOWN'].includes(p.state) || p.signedHex || JSON.stringify(p.envelope) !== JSON.stringify(envelope) ||
          signedHex.length > 200000 || !/^(?:[0-9a-f]{2})+$/.test(signedHex)) throw Error('ATTEMPT_MISMATCH');
      p.signedHex = signedHex; p.txid = hashTransaction(hexToBin(signedHex));
      p.state = valid && p.state === 'SIGNING' ? 'POSTCHECKED' : 'NEEDS_REVIEW';
    });
  }
  reserveDelivery(op: VisitorOperation): Promise<VisitorOperation> {
    return this.advance(op.id, op.revision, p => {
      if (p.state !== 'POSTCHECKED' || p.handedOff || !p.signedHex || p.txid !== hashTransaction(hexToBin(p.signedHex)) || p.request.expiresAt <= Date.now()) throw Error('NO_SEND_AUTHORITY');
      p.handedOff = true; p.state = 'UNKNOWN'; // One shared reservation for either relay or native handoff.
    });
  }
  observed(op: VisitorOperation, observation: PaymentObservation): Promise<VisitorOperation> {
    return this.advance(op.id, op.revision, p => {
      if (!p.signedHex || !p.txid || p.state === 'PREFLIGHTED' || p.state === 'SIGNING') throw Error('ORIGINAL_HASH_REQUIRED');
      p.observation = observation; p.state = observation.status;
    });
  }
  async newAfterConfirmed(): Promise<void> {
    return this.transaction((s, result, fail) => {
      const active = s.meta.get('active'); active.onsuccess = () => {
        if (!active.result) { result(undefined); return; }
        const r = s.operations.get(active.result); r.onsuccess = () => {
          if (r.result?.state !== 'CONFIRMED_ON_CHAIN' || !r.result.observation || Date.now() - r.result.observation.observedAt > 10000 || r.result.observation.observedAt > Date.now()) { fail('ORIGINAL_OPERATION_REQUIRED'); return; }
          s.meta.delete('active'); result(undefined);
        };
      };
    });
  }
}
