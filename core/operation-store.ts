/**
 * LOCAL SIMULATION ONLY. This database imports untrusted scenario events; it never
 * calls a wallet/provider, signs, broadcasts, authenticates consent, or verifies a
 * chain receipt. Keep this write API off public/payment endpoints. Every result
 * has simulationOnly=true, chainVerified=false and canSign=false.
 *
 * Graph: DRAFT -> CONFIRMED -> BUILT -> READY -> SIGNING -> SIGNED ->
 * BROADCASTING -> OBSERVED -> SIMULATED_CONFIRMED_ON_CHAIN. BUILT/SIGNED may
 * become BLOCKED; SIGNING may become CANCELLED or UNKNOWN; BROADCASTING may
 * become UNKNOWN. UNKNOWN -> NEEDS_REVIEW or OBSERVED; NEEDS_REVIEW -> OBSERVED.
 * OBSERVED/ SIMULATED_CONFIRMED_ON_CHAIN -> CONFLICTED (receipt invalidated).
 * No reset, delete, replacement attempt or economic-key reuse exists. UNKNOWN
 * retains its session lock, including when no final txid is known. Recovery is
 * simulated observation of the original txid if known, never a new transaction.
 * Cancellation is accepted only as an explicit simulated refusal while SIGNING;
 * timeout is UNKNOWN, not cancellation. A signed BLOCKED operation remains locked.
 * A bound signature received after expiry or timeout is quarantined as NEEDS_REVIEW
 * with its original txid retained. It can only follow observation recovery, never
 * broadcast. Observation cannot bind an unknown txid: a matching attempt response
 * must first supply it. Incomplete recovery information keeps the session locked.
 *
 * SQLite BEGIN IMMEDIATE + revision CAS serialize writers across connections and
 * processes. DELETE journal/FULL sync commits before returning; private directory
 * and file permissions are checked. Missing/corrupt stores fail closed on open.
 * The caller must retain the store and a stable network-scoped payment request ID.
 * Different request IDs, restored old backups, deleted stores, malicious local
 * writers, unsupported/network filesystems and dishonest imported facts are NOT
 * solved by this ledger. Checksums detect accidental corruption, not tampering.
 * Filesystem durability assumes SQLite's documented local-filesystem guarantees.
 */
import { createHash } from 'node:crypto';
import { closeSync, constants, fsyncSync, lstatSync, mkdirSync, openSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { validatedIntentDigest, type PaymentIntent } from './guard.js';

const STATES = ['DRAFT', 'CONFIRMED', 'BUILT', 'READY', 'SIGNING', 'SIGNED', 'BROADCASTING', 'UNKNOWN', 'NEEDS_REVIEW', 'OBSERVED', 'SIMULATED_CONFIRMED_ON_CHAIN', 'CANCELLED', 'BLOCKED', 'CONFLICTED'] as const;
export type OperationState = typeof STATES[number];
export interface AttemptBinding {
  attemptId: string; requestSequence: number; sessionDigest: string; intentDigest: string;
}
export interface SimulatedObservation {
  txid: string; confirmations: number; blockHash: string | null;
  blockHeight: number | null; observedAt: number;
}
export interface StoredOperation {
  schemaVersion: 1; simulationOnly: true; chainVerified: false; canSign: false;
  operationId: string; economicKey: string; intentDigest: string; sessionDigest: string;
  revision: number; state: OperationState; expiresAt: number; requiredConfirmations: number;
  attempt: AttemptBinding | null; originalTxid: string | null;
  observation: SimulatedObservation | null; receiptValid: false;
  /** Informational simulated status, never a verified receipt or entitlement. */
  simulatedReceiptStatus: 'NONE' | 'OBSERVED' | 'CONFIRMED' | 'INVALIDATED';
}
export type SimulationEvent =
  | { type: 'confirm-intent' | 'candidate-built' | 'precheck-match' | 'precheck-block' | 'request-signature' | 'secondary-check-match' | 'secondary-check-block' | 'broadcast-timeout' | 'needs-review' }
  | { type: 'signature-refused' | 'signature-timeout'; binding: AttemptBinding }
  | { type: 'signature-received'; binding: AttemptBinding; txid: string }
  | { type: 'observe' | 'confirm-observation'; observation: SimulatedObservation }
  | { type: 'conflict'; observedAt: number };

const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const digest = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function opaque(v: string): string { if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(v)) throw Error('INVALID_OPAQUE_ID'); return v; }
function requireDigest(v: string): string { if (!digest(v)) throw Error('INVALID_DIGEST'); return v; }
function requireInteger(v: number): number { if (!integer(v)) throw Error('INVALID_INTEGER'); return v; }
/** The exact same validated canonical digest used by verifyCandidate. */
export const operationIntentDigest = validatedIntentDigest;
function observation(v: unknown): v is SimulatedObservation {
  return record(v) && digest(v.txid) && integer(v.confirmations) && integer(v.observedAt) && (v.blockHash === null || digest(v.blockHash)) && (v.blockHeight === null || integer(v.blockHeight)) && (v.confirmations === 0 ? v.blockHash === null && v.blockHeight === null : digest(v.blockHash) && integer(v.blockHeight)) && Object.keys(v).sort().join(',') === 'blockHash,blockHeight,confirmations,observedAt,txid';
}
function binding(v: unknown): v is AttemptBinding {
  return record(v) && digest(v.attemptId) && integer(v.requestSequence) && v.requestSequence > 0 && digest(v.sessionDigest) && digest(v.intentDigest) && Object.keys(v).sort().join(',') === 'attemptId,intentDigest,requestSequence,sessionDigest';
}
function isOperation(v: unknown): v is StoredOperation {
  if (!record(v) || v.schemaVersion !== 1 || v.simulationOnly !== true || v.chainVerified !== false || v.canSign !== false || v.receiptValid !== false || !digest(v.operationId) || !digest(v.economicKey) || !digest(v.intentDigest) || !digest(v.sessionDigest) || !integer(v.revision) || !integer(v.expiresAt) || !integer(v.requiredConfirmations) || v.requiredConfirmations < 1 || !STATES.some(s => s === v.state) || (v.attempt !== null && !binding(v.attempt)) || (v.originalTxid !== null && !digest(v.originalTxid)) || (v.observation !== null && !observation(v.observation))) return false;
  if (Object.keys(v).sort().join(',') !== 'attempt,canSign,chainVerified,economicKey,expiresAt,intentDigest,observation,operationId,originalTxid,receiptValid,requiredConfirmations,revision,schemaVersion,sessionDigest,simulatedReceiptStatus,simulationOnly,state') return false;
  if (v.operationId !== hash('intentguard/operation/v1\0' + v.economicKey)) return false;
  if (v.requiredConfirmations > 100) return false;
  const beforeAttempt = ['DRAFT', 'CONFIRMED', 'BUILT', 'READY'].includes(String(v.state));
  if (beforeAttempt && (v.attempt !== null || v.originalTxid !== null)) return false;
  if (!beforeAttempt && v.state !== 'BLOCKED' && v.attempt === null) return false;
  if (['SIGNED', 'BROADCASTING', 'OBSERVED', 'SIMULATED_CONFIRMED_ON_CHAIN', 'CONFLICTED'].includes(String(v.state)) && v.originalTxid === null) return false;
  if (['SIGNING', 'CANCELLED'].includes(String(v.state)) && v.originalTxid !== null) return false;
  const receipt = v.state === 'OBSERVED' ? 'OBSERVED' : v.state === 'SIMULATED_CONFIRMED_ON_CHAIN' ? 'CONFIRMED' : v.state === 'CONFLICTED' ? 'INVALIDATED' : 'NONE';
  if (v.simulatedReceiptStatus !== receipt || (['OBSERVED', 'CONFIRMED'].includes(receipt) ? v.observation === null : v.observation !== null)) return false;
  if (v.attempt !== null && (v.attempt.intentDigest !== v.intentDigest || v.attempt.sessionDigest !== v.sessionDigest)) return false;
  if (v.observation !== null && v.observation.txid !== v.originalTxid) return false;
  if (v.state === 'SIMULATED_CONFIRMED_ON_CHAIN' && (v.observation === null || v.observation.confirmations < v.requiredConfirmations || v.simulatedReceiptStatus !== 'CONFIRMED')) return false;
  return true;
}
function locked(op: StoredOperation): number { return Number(op.attempt !== null && op.state !== 'CANCELLED' && op.state !== 'SIMULATED_CONFIRMED_ON_CHAIN'); }
function privatePath(path: string, directory: boolean): void {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()) || (stat.mode & 0o077) !== 0 || (typeof process.getuid === 'function' && stat.uid !== process.getuid()) || (!directory && stat.nlink !== 1)) throw Error('UNSAFE_STORE_PATH');
}
function syncDirectory(path: string): void { const fd = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY); try { fsyncSync(fd); } finally { closeSync(fd); } }

export class SimulationOperationStore {
  private readonly db: DatabaseSync;
  private closed = false;
  private readonly directory: string;
  private readonly file: string;
  private readonly fileIdentity: { dev: number; ino: number };
  private readonly directoryIdentity: { dev: number; ino: number };
  /** No automatic creation on open: recovery must never create an empty ledger. */
  static open(directory: string): SimulationOperationStore { return new SimulationOperationStore(directory, false); }
  /** Creates a NEW private directory exclusively; an existing path is an error. */
  static create(directory: string): SimulationOperationStore { return new SimulationOperationStore(directory, true); }
  private constructor(directory: string, create: boolean) {
    this.directory = resolve(directory); this.file = join(this.directory, 'operations.sqlite');
    if (create) { mkdirSync(this.directory, { mode: 0o700 }); const fd = openSync(this.file, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600); closeSync(fd); }
    privatePath(this.directory, true); privatePath(this.file, false);
    this.fileIdentity = lstatSync(this.file); this.directoryIdentity = lstatSync(this.directory);
    this.db = new DatabaseSync(this.file, { enableForeignKeyConstraints: true, enableDoubleQuotedStringLiterals: false });
    try {
      this.db.exec('PRAGMA busy_timeout=1000; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA trusted_schema=OFF;');
      if (create) {
        this.db.exec(`BEGIN IMMEDIATE; CREATE TABLE metadata (version INTEGER NOT NULL CHECK(version=1)); INSERT INTO metadata VALUES(1); CREATE TABLE operations (id TEXT PRIMARY KEY, economic_key TEXT NOT NULL UNIQUE, session_key TEXT NOT NULL, revision INTEGER NOT NULL, locked INTEGER NOT NULL CHECK(locked IN(0,1)), document TEXT NOT NULL, checksum TEXT NOT NULL); COMMIT;`);
        syncDirectory(this.directory); syncDirectory(resolve(this.directory, '..'));
      }
      const checks = this.db.prepare('PRAGMA integrity_check').all();
      if (checks.length !== 1 || checks[0]?.integrity_check !== 'ok') throw Error('CORRUPT_STORE');
      const versions = this.db.prepare('SELECT version FROM metadata').all();
      if (versions.length !== 1 || versions[0]?.version !== 1) throw Error('UNSUPPORTED_STORE');
      this.scan();
    } catch (error) { this.db.close(); this.closed = true; throw error; }
  }
  close(): void { if (!this.closed) { this.db.close(); this.closed = true; } }
  private checkPath(): void {
    if (this.closed) throw Error('STORE_CLOSED'); privatePath(this.directory, true); privatePath(this.file, false);
    const file = lstatSync(this.file); const directory = lstatSync(this.directory);
    if (file.ino !== this.fileIdentity.ino || file.dev !== this.fileIdentity.dev || directory.ino !== this.directoryIdentity.ino || directory.dev !== this.directoryIdentity.dev) throw Error('STORE_PATH_REPLACED');
  }
  private scan(): StoredOperation[] {
    return this.db.prepare('SELECT * FROM operations').all().map(row => {
      if (typeof row.document !== 'string' || row.document.length > 8192 || row.checksum !== hash(row.document)) throw Error('CORRUPT_OPERATION');
      const value: unknown = JSON.parse(row.document);
      if (!isOperation(value) || value.operationId !== row.id || value.economicKey !== row.economic_key || value.sessionDigest !== row.session_key || value.revision !== row.revision || locked(value) !== row.locked) throw Error('CORRUPT_OPERATION');
      return value;
    });
  }
  private transaction<T>(work: () => T): T {
    this.checkPath(); this.db.exec('BEGIN IMMEDIATE');
    try { const result = work(); this.checkPath(); this.db.exec('COMMIT'); return result; }
    catch (error) { try { this.db.exec('ROLLBACK'); } catch { /* COMMIT may have failed or already completed; caller must re-open/read, never blindly replay. */ } throw error; }
  }
  get(operationId: string): StoredOperation | null { this.checkPath(); requireDigest(operationId); return this.scan().find(o => o.operationId === operationId) ?? null; }
  createOperation(input: { paymentRequestId: string; sessionId: string; intent: PaymentIntent; requiredConfirmations: number }): StoredOperation {
    const intentDigest = operationIntentDigest(input.intent);
    const economicKey = hash('intentguard/economic/v1\0' + input.intent.network + '\0' + opaque(input.paymentRequestId));
    const sessionDigest = hash('intentguard/session/v1\0' + opaque(input.sessionId));
    const requiredConfirmations = requireInteger(input.requiredConfirmations); if (requiredConfirmations < 1 || requiredConfirmations > 100) throw Error('INVALID_CONFIRMATION_POLICY');
    return this.transaction(() => {
      const existing = this.scan().find(o => o.economicKey === economicKey);
      if (existing) {
        if (existing.intentDigest !== intentDigest || existing.sessionDigest !== sessionDigest || existing.requiredConfirmations !== requiredConfirmations) throw Error('ECONOMIC_KEY_CONFLICT');
        return existing;
      }
      const op: StoredOperation = { schemaVersion: 1, simulationOnly: true, chainVerified: false, canSign: false, operationId: hash('intentguard/operation/v1\0' + economicKey), economicKey, intentDigest, sessionDigest, revision: 0, state: 'DRAFT', expiresAt: input.intent.expiresAt, requiredConfirmations, attempt: null, originalTxid: null, observation: null, receiptValid: false, simulatedReceiptStatus: 'NONE' };
      const document = JSON.stringify(op);
      this.db.prepare('INSERT INTO operations VALUES(?,?,?,?,?,?,?)').run(op.operationId, economicKey, sessionDigest, 0, 0, document, hash(document)); return op;
    });
  }
  /** Trusted local test harness only. Caller facts do not become verified facts.
   * On a write error, reopen/read before deciding what happened; never blindly
   * replay an action on the assumption that a failed COMMIT could not persist. */
  importSimulationEvent(operationId: string, expectedRevision: number, event: SimulationEvent, now: number): StoredOperation {
    requireDigest(operationId); requireInteger(expectedRevision); requireInteger(now);
    return this.transaction(() => {
      const all = this.scan(); const op = all.find(o => o.operationId === operationId);
      if (!op) throw Error('OPERATION_NOT_FOUND'); if (op.revision !== expectedRevision) throw Error('REVISION_CONFLICT');
      if (!event || typeof event.type !== 'string') throw Error('INVALID_EVENT');
      const from = (...states: OperationState[]): void => { if (!states.includes(op.state)) throw Error('INVALID_TRANSITION'); };
      const matchBinding = (b: AttemptBinding): void => { if (!binding(b) || !op.attempt || b.attemptId !== op.attempt.attemptId || b.requestSequence !== op.attempt.requestSequence || b.sessionDigest !== op.sessionDigest || b.intentDigest !== op.intentDigest) throw Error('ATTEMPT_MISMATCH'); };
      switch (event.type) {
        case 'confirm-intent': from('DRAFT'); op.state = 'CONFIRMED'; break;
        case 'candidate-built': from('CONFIRMED'); op.state = 'BUILT'; break;
        case 'precheck-match': from('BUILT'); op.state = 'READY'; break;
        case 'precheck-block': from('BUILT'); op.state = 'BLOCKED'; break;
        case 'request-signature': {
          from('READY'); if (now >= op.expiresAt) throw Error('INTENT_EXPIRED');
          if (all.some(o => o.operationId !== op.operationId && o.sessionDigest === op.sessionDigest && locked(o))) throw Error('SESSION_LOCKED');
          const sequence = all.filter(o => o.sessionDigest === op.sessionDigest).reduce((n, o) => Math.max(n, o.attempt?.requestSequence ?? 0), 0) + 1;
          requireInteger(sequence);
          op.attempt = { attemptId: hash(op.operationId + ':' + op.revision + ':' + sequence), requestSequence: sequence, sessionDigest: op.sessionDigest, intentDigest: op.intentDigest }; op.state = 'SIGNING'; break;
        }
        case 'signature-refused': from('SIGNING'); matchBinding(event.binding); op.state = 'CANCELLED'; break;
        case 'signature-timeout': from('SIGNING'); matchBinding(event.binding); op.state = 'UNKNOWN'; break;
        case 'signature-received': {
          from('SIGNING', 'UNKNOWN', 'NEEDS_REVIEW'); matchBinding(event.binding); requireDigest(event.txid);
          if (op.originalTxid !== null && op.originalTxid !== event.txid) throw Error('ORIGINAL_TXID_MISMATCH');
          const onTime = op.state === 'SIGNING' && now < op.expiresAt;
          op.originalTxid = event.txid; op.state = onTime ? 'SIGNED' : 'NEEDS_REVIEW'; break;
        }
        case 'secondary-check-block': from('SIGNED'); op.state = 'BLOCKED'; break;
        case 'secondary-check-match': from('SIGNED'); op.state = now < op.expiresAt ? 'BROADCASTING' : 'NEEDS_REVIEW'; break;
        case 'broadcast-timeout': from('BROADCASTING'); op.state = 'UNKNOWN'; break;
        case 'needs-review': from('UNKNOWN'); op.state = 'NEEDS_REVIEW'; break;
        case 'observe':
        case 'confirm-observation': {
          if (event.type === 'observe') from('BROADCASTING', 'UNKNOWN', 'NEEDS_REVIEW'); else from('OBSERVED');
          if (!observation(event.observation) || event.observation.observedAt > now || (op.observation !== null && event.observation.observedAt < op.observation.observedAt)) throw Error('INVALID_OBSERVATION');
          if (op.originalTxid === null) throw Error('ORIGINAL_TXID_REQUIRED');
          if (event.observation.txid !== op.originalTxid) throw Error('ORIGINAL_TXID_MISMATCH');
          if (event.type === 'confirm-observation' && event.observation.confirmations < op.requiredConfirmations) throw Error('INSUFFICIENT_CONFIRMATIONS');
          op.originalTxid = event.observation.txid; op.observation = { ...event.observation };
          op.state = event.type === 'observe' ? 'OBSERVED' : 'SIMULATED_CONFIRMED_ON_CHAIN';
          op.simulatedReceiptStatus = event.type === 'observe' ? 'OBSERVED' : 'CONFIRMED'; break;
        }
        case 'conflict': from('OBSERVED', 'SIMULATED_CONFIRMED_ON_CHAIN'); if (!integer(event.observedAt) || event.observedAt > now || (op.observation !== null && event.observedAt < op.observation.observedAt)) throw Error('INVALID_OBSERVATION'); op.observation = null; op.simulatedReceiptStatus = 'INVALIDATED'; op.state = 'CONFLICTED'; break;
        default: throw Error('INVALID_EVENT');
      }
      op.revision = requireInteger(op.revision + 1);
      if (!isOperation(op)) throw Error('INVALID_OPERATION');
      const document = JSON.stringify(op);
      const result = this.db.prepare('UPDATE operations SET revision=?,locked=?,document=?,checksum=? WHERE id=? AND revision=?').run(op.revision, locked(op), document, hash(document), operationId, expectedRevision);
      if (result.changes !== 1) throw Error('REVISION_CONFLICT'); return op;
    });
  }
}
