/**
 * Read-only evidence review, NOT a payment lifecycle or signing authorization.
 * Trusted application code supplies session/transport capabilities at construction;
 * request input cannot supply an EvidenceResult, ownership proof, endpoint or status.
 * The coordinator derives ownership and calls createEvidenceCollector internally.
 *
 * A stable request key is permanently bound to intent, exact candidate bytes,
 * session, derivation paths and source configuration. Reserve is committed before
 * awaiting sources. Repeated calls never recollect silently: all saved records,
 * including crashed PENDING records, return STALE_RECHECK_REQUIRED. Explicit
 * refresh requires the current successful revision and identical immutable inputs.
 * UNKNOWN/PENDING can never refresh. Every reservation/completion is retained in
 * append-only history; a failed refresh never restores the older success.
 * Node reports are not consensus or verified receipts. Storage schema v2 refuses
 * v1 journals unchanged; explicit migration is not implemented. Never reset them.
 *
 * Private local SQLite FULL-sync/CAS journal, separate from SimulationOperationStore.
 * Only hashes and bounded factual summaries are retained, not raw transactions,
 * addresses, public keys or session identifiers. Hashes can still correlate data.
 * Checksums detect accidents, not malicious edits, store deletion or old backups.
 * Local filesystem/SQLite durability assumptions apply. A write error may have an
 * uncertain commit outcome: reopen/read rather than blindly repeating the request.
 */
import { createHash } from 'node:crypto';
import { closeSync, constants, fsyncSync, lstatSync, mkdirSync, openSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { validatedIntentDigest, structuralTransactionDigest, type PaymentIntent } from './guard.js';
import { createEvidenceCollector, deriveSessionOwnership, type SourceConfig, type PublicKeySession, type PathBinding, type EvidenceResult } from './evidence.js';

export interface ReviewConfig { sources: readonly SourceConfig[]; session: PublicKeySession; clock?: () => number; }
export interface ReviewRequest { paymentRequestId: string; intent: PaymentIntent; candidateHex: string; bindings: readonly PathBinding[]; }
export interface ReviewRecord {
  schemaVersion: 1; requestKey: string; intentDigest: string; exactCandidateDigest: string;
  sessionDigest: string; bindingDigest: string; sourceConfigDigest: string;
  startedAt: number; expiresAt: number; completedAt: number | null; observedAt: number | null;
  revision: number; status: 'PENDING' | 'UNKNOWN' | 'SYNTHETIC_MATCH' | 'NODE_REPORTED';
  evidenceBindingDigest: string | null; issue: string | null;
  sourceIds: readonly string[]; chainTip: { height: number; hash: string; timestampMs: number } | null;
  canSign: false; receiptValid: false; consensusVerified: false;
}
export interface ReviewView extends ReviewRecord { freshness: 'OBSERVED_DURING_CALL' | 'STALE_RECHECK_REQUIRED'; }
const hash = (s: string): string => createHash('sha256').update(s).digest('hex');
const hex = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const time = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const MAX_DB_BYTES = 64 * 1024 * 1024;
const MAX_REVISION = 1999; // At most 1000 complete attempts; never prune history.
function requireTime(v: number): number { if (!time(v)) throw Error('REVIEW_INVALID_CLOCK'); return v; }
function validRecord(v: unknown): v is ReviewRecord {
  if (!object(v) || Object.keys(v).sort().join(',') !== 'bindingDigest,canSign,chainTip,completedAt,consensusVerified,evidenceBindingDigest,exactCandidateDigest,expiresAt,intentDigest,issue,observedAt,receiptValid,requestKey,revision,schemaVersion,sessionDigest,sourceConfigDigest,sourceIds,startedAt,status' || v.schemaVersion !== 1 || v.canSign !== false || v.receiptValid !== false || v.consensusVerified !== false) return false;
  if (![v.requestKey, v.intentDigest, v.exactCandidateDigest, v.sessionDigest, v.bindingDigest, v.sourceConfigDigest].every(hex) || !time(v.startedAt) || !time(v.expiresAt) || v.expiresAt <= v.startedAt) return false;
  if (!Array.isArray(v.sourceIds) || v.sourceIds.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(id))) return false;
  if (v.status === 'PENDING' || v.status === 'UNKNOWN') { if (v.sourceIds.length !== 0 || v.chainTip !== null) return false; }
  else if (v.sourceIds.length !== 2 || new Set(v.sourceIds).size !== 2 || !object(v.chainTip) || Object.keys(v.chainTip).sort().join(',') !== 'hash,height,timestampMs' || !time(v.chainTip.height) || !hex(v.chainTip.hash) || !time(v.chainTip.timestampMs)) return false;
  if (!time(v.revision) || v.revision > MAX_REVISION) return false;
  if (v.status === 'PENDING') return v.revision % 2 === 0 && v.completedAt === null && v.observedAt === null && v.evidenceBindingDigest === null && v.issue === null;
  if (v.revision % 2 !== 1 || !time(v.completedAt) || v.completedAt < v.startedAt) return false;
  if (v.status === 'UNKNOWN') return v.observedAt === null && v.evidenceBindingDigest === null && typeof v.issue === 'string' && /^[A-Z_]{1,80}$/.test(v.issue);
  return (v.status === 'SYNTHETIC_MATCH' || v.status === 'NODE_REPORTED') && time(v.observedAt) && v.observedAt >= v.startedAt && v.observedAt <= v.completedAt && v.completedAt < v.expiresAt && hex(v.evidenceBindingDigest) && v.issue === null;
}
function sameBinding(a: ReviewRecord, b: ReviewRecord): boolean { return a.requestKey === b.requestKey && a.intentDigest === b.intentDigest && a.exactCandidateDigest === b.exactCandidateDigest && a.sessionDigest === b.sessionDigest && a.bindingDigest === b.bindingDigest && a.sourceConfigDigest === b.sourceConfigDigest && a.expiresAt === b.expiresAt; }
function successful(r: ReviewRecord): boolean { return r.status === 'SYNTHETIC_MATCH' || r.status === 'NODE_REPORTED'; }
function privateStat(path: string, directory: boolean): { ino: number; dev: number } {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()) || (stat.mode & 0o077) !== 0 || (typeof process.getuid === 'function' && stat.uid !== process.getuid()) || (!directory && (stat.nlink !== 1 || stat.size > MAX_DB_BYTES))) throw Error('REVIEW_UNSAFE_STORE');
  return stat;
}
function syncDirectory(path: string): void { const fd = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY); try { fsyncSync(fd); } finally { closeSync(fd); } }
function view(record: ReviewRecord, freshness: ReviewView['freshness'] = 'STALE_RECHECK_REQUIRED'): ReviewView { return Object.freeze({ ...record, sourceIds: Object.freeze([...record.sourceIds]), chainTip: record.chainTip === null ? null : Object.freeze({ ...record.chainTip }), freshness }); }

export class ReadOnlyReviewCoordinator {
  #db: DatabaseSync; #closed = false; #directory: string; #file: string;
  #directoryIdentity: { ino: number; dev: number }; #fileIdentity: { ino: number; dev: number };
  #session: PublicKeySession; #clock: () => number; #configDigest: string;
  #collect: ReturnType<typeof createEvidenceCollector>;
  #sourceIds: readonly string[]; #maxTipAges: readonly number[];
  #controllers = new Set<AbortController>();
  static create(directory: string, config: ReviewConfig): ReadOnlyReviewCoordinator { return new ReadOnlyReviewCoordinator(directory, config, true); }
  static open(directory: string, config: ReviewConfig): ReadOnlyReviewCoordinator { return new ReadOnlyReviewCoordinator(directory, config, false); }
  private constructor(directory: string, config: ReviewConfig, create: boolean) {
    // Capture trusted config metadata explicitly; never serialize adapter functions.
    if (!Array.isArray(config.sources) || config.sources.length !== 2) throw Error('REVIEW_CONFIGURATION_REQUIRED');
    const sources = config.sources.map(c => ({ id: c.id, operatorId: c.operatorId, network: c.network, genesisHash: c.genesisHash, checkpoint: { ...c.checkpoint }, maxTipAgeMs: c.maxTipAgeMs, kind: c.kind, transport: { request: c.transport.request.bind(c.transport) } }));
    if (sources.some(s => typeof s.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(s.id) || typeof s.operatorId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(s.operatorId) || !['chipnet', 'mainnet'].includes(s.network) || !hex(s.genesisHash) || !time(s.checkpoint.height) || !hex(s.checkpoint.hash) || !time(s.maxTipAgeMs) || s.maxTipAgeMs < 1000 || s.maxTipAgeMs > 86400000 || !['node', 'synthetic'].includes(s.kind))) throw Error('REVIEW_INVALID_CONFIG');
    this.#configDigest = hash('intentguard/review-sources/v1\0' + JSON.stringify(sources.map(({ transport: _transport, ...metadata }) => metadata)));
    this.#sourceIds = Object.freeze(sources.map(s => s.id)); this.#maxTipAges = Object.freeze(sources.map(s => s.maxTipAgeMs));
    this.#session = config.session;
    this.#clock = config.clock ?? Date.now;
    this.#collect = createEvidenceCollector(sources, () => this.#now());
    this.#directory = resolve(directory); this.#file = join(this.#directory, 'reviews.sqlite');
    if (create) { mkdirSync(this.#directory, { mode: 0o700 }); const fd = openSync(this.#file, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600); closeSync(fd); }
    this.#directoryIdentity = privateStat(this.#directory, true); this.#fileIdentity = privateStat(this.#file, false);
    // Read-only version inspection precedes ALL writable PRAGMAs. An old journal
    // is not migrated, recovered into a replacement, or modified on refusal.
    if (!create) {
      const inspection = new DatabaseSync(this.#file, { readOnly: true });
      try {
        const versions = inspection.prepare('SELECT version FROM metadata').all();
        if (versions.length === 1 && versions[0]?.version === 1) throw Error('REVIEW_MIGRATION_REQUIRED');
        if (versions.length !== 1 || versions[0]?.version !== 2) throw Error('REVIEW_CORRUPT_STORE');
      } catch (error) { if (error instanceof Error && error.message === 'REVIEW_MIGRATION_REQUIRED') throw error; throw Error('REVIEW_CORRUPT_STORE'); }
      finally { inspection.close(); }
    }
    this.#db = new DatabaseSync(this.#file, { enableForeignKeyConstraints: true, enableDoubleQuotedStringLiterals: false });
    try {
      this.#db.exec('PRAGMA busy_timeout=1000; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA trusted_schema=OFF;');
      if (create) {
        this.#db.exec(`BEGIN IMMEDIATE; CREATE TABLE metadata(version INTEGER NOT NULL CHECK(version=2)); INSERT INTO metadata VALUES(2); CREATE TABLE reviews(request_key TEXT PRIMARY KEY, revision INTEGER NOT NULL, document TEXT NOT NULL, checksum TEXT NOT NULL); CREATE TABLE review_history(request_key TEXT NOT NULL, revision INTEGER NOT NULL, document TEXT NOT NULL, checksum TEXT NOT NULL, previous_checksum TEXT, PRIMARY KEY(request_key,revision)); CREATE TRIGGER immutable_history_update BEFORE UPDATE ON review_history BEGIN SELECT RAISE(ABORT,'IMMUTABLE_HISTORY'); END; CREATE TRIGGER immutable_history_delete BEFORE DELETE ON review_history BEGIN SELECT RAISE(ABORT,'IMMUTABLE_HISTORY'); END; COMMIT;`);
        syncDirectory(this.#directory); syncDirectory(resolve(this.#directory, '..'));
      }
      const integrity = this.#db.prepare('PRAGMA integrity_check').all(); const versions = this.#db.prepare('SELECT version FROM metadata').all();
      if (integrity.length !== 1 || integrity[0]?.integrity_check !== 'ok' || versions.length !== 1 || versions[0]?.version !== 2) throw Error('REVIEW_CORRUPT_STORE');
      this.#scan();
    } catch { this.#db.close(); this.#closed = true; throw Error('REVIEW_CORRUPT_STORE'); }
  }
  #now(): number { try { return requireTime(this.#clock()); } catch { throw Error('REVIEW_INVALID_CLOCK'); } }
  #check(): void {
    if (this.#closed) throw Error('REVIEW_STORE_CLOSED');
    try {
      const directory = privateStat(this.#directory, true); const file = privateStat(this.#file, false);
      if (directory.ino !== this.#directoryIdentity.ino || directory.dev !== this.#directoryIdentity.dev || file.ino !== this.#fileIdentity.ino || file.dev !== this.#fileIdentity.dev) throw Error('replaced');
    } catch { throw Error('REVIEW_STORE_UNAVAILABLE'); }
  }
  #scan(): { heads: ReviewRecord[]; history: Map<string, ReviewRecord[]> } {
    // One SQL snapshot prevents false corruption alarms during another writer's
    // atomic head/history update. FULL JOIN also exposes orphan heads/history.
    const rows = this.#db.prepare(`SELECT r.request_key AS head_key,r.revision AS head_revision,r.document AS head_document,r.checksum AS head_checksum,h.request_key,h.revision,h.document,h.checksum,h.previous_checksum FROM reviews r FULL OUTER JOIN review_history h ON r.request_key=h.request_key ORDER BY COALESCE(r.request_key,h.request_key),h.revision`).all();
    const history = new Map<string, ReviewRecord[]>(); const checksums = new Map<string, string>();
    const headRows = new Map<string, { revision: number; document: string }>();
    for (const row of rows) {
      if (typeof row.document !== 'string' || row.document.length > 8192 || row.checksum !== hash(row.document) || typeof row.head_document !== 'string' || row.head_document.length > 8192 || row.head_checksum !== hash(row.head_document) || !time(row.head_revision)) throw Error('REVIEW_CORRUPT_STORE');
      const parsed: unknown = JSON.parse(row.document);
      if (!validRecord(parsed) || parsed.requestKey !== row.request_key || parsed.requestKey !== row.head_key || parsed.revision !== row.revision) throw Error('REVIEW_CORRUPT_STORE');
      const entries = history.get(parsed.requestKey) ?? []; const previous = entries.at(-1);
      if (parsed.revision !== entries.length || entries.length > MAX_REVISION || row.previous_checksum !== (checksums.get(parsed.requestKey) ?? null)) throw Error('REVIEW_CORRUPT_STORE');
      if (previous) {
        if (!sameBinding(previous, parsed)) throw Error('REVIEW_CORRUPT_STORE');
        if (parsed.status === 'PENDING') { if (!successful(previous) || parsed.startedAt < previous.completedAt!) throw Error('REVIEW_CORRUPT_STORE'); }
        else if (previous.status !== 'PENDING' || previous.startedAt !== parsed.startedAt) throw Error('REVIEW_CORRUPT_STORE');
        const firstSuccess = entries.find(successful);
        if (successful(parsed) && firstSuccess && (parsed.status !== firstSuccess.status || JSON.stringify(parsed.sourceIds) !== JSON.stringify(firstSuccess.sourceIds))) throw Error('REVIEW_CORRUPT_STORE');
      } else if (parsed.status !== 'PENDING') throw Error('REVIEW_CORRUPT_STORE');
      entries.push(parsed); history.set(parsed.requestKey, entries); checksums.set(parsed.requestKey, row.checksum);
      headRows.set(parsed.requestKey, { revision: row.head_revision, document: row.head_document });
    }
    const heads: ReviewRecord[] = [];
    for (const [key, entries] of history) {
      const head = headRows.get(key)!; const latest = entries.at(-1)!;
      if (head.revision !== latest.revision || head.document !== JSON.stringify(latest)) throw Error('REVIEW_CORRUPT_STORE');
      heads.push(latest);
    }
    return { heads, history };
  }
  #append(record: ReviewRecord): void {
    const previous = this.#db.prepare('SELECT checksum FROM reviews WHERE request_key=?').get(record.requestKey);
    const document = JSON.stringify(record);
    this.#db.prepare('INSERT INTO review_history VALUES(?,?,?,?,?)').run(record.requestKey, record.revision, document, hash(document), previous?.checksum ?? null);
  }
  #transaction<T>(work: () => T): T {
    this.#check();
    try {
      this.#db.exec('BEGIN IMMEDIATE');
      try { const result = work(); this.#check(); this.#db.exec('COMMIT'); return result; }
      catch (error) { try { this.#db.exec('ROLLBACK'); } catch { /* Read before retry after an uncertain commit. */ } throw error; }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (['REVIEW_REQUEST_CONFLICT', 'REVIEW_REVISION_CONFLICT', 'REVIEW_CORRUPT_STORE', 'REVIEW_STORE_UNAVAILABLE', 'REVIEW_REFRESH_NOT_ALLOWED', 'REVIEW_NOT_FOUND', 'REVIEW_HISTORY_LIMIT', 'REVIEW_CLOCK_WINDOW'].includes(message)) throw Error(message);
      throw Error('REVIEW_STORE_WRITE_FAILED');
    }
  }
  #reserve(proposed: ReviewRecord, expectedRevision?: number): { record: ReviewRecord; created: boolean } {
    return this.#transaction(() => {
      const existing = this.#scan().heads.find(r => r.requestKey === proposed.requestKey);
      if (existing && !sameBinding(existing, proposed)) throw Error('REVIEW_REQUEST_CONFLICT');
      if (expectedRevision !== undefined) {
        if (!existing) throw Error('REVIEW_NOT_FOUND');
        if (existing.revision !== expectedRevision) throw Error('REVIEW_REVISION_CONFLICT');
        if (!successful(existing)) throw Error('REVIEW_REFRESH_NOT_ALLOWED');
        if (existing.revision >= MAX_REVISION) throw Error('REVIEW_HISTORY_LIMIT');
        if (proposed.startedAt < existing.completedAt!) throw Error('REVIEW_CLOCK_WINDOW');
        proposed = { ...proposed, revision: existing.revision + 1 };
      } else if (existing) return { record: existing, created: false };
      if (!validRecord(proposed)) throw Error('REVIEW_CORRUPT_STORE');
      this.#append(proposed); const document = JSON.stringify(proposed);
      if (existing) {
        const updated = this.#db.prepare('UPDATE reviews SET revision=?,document=?,checksum=? WHERE request_key=? AND revision=?').run(proposed.revision, document, hash(document), proposed.requestKey, expectedRevision!);
        if (updated.changes !== 1) throw Error('REVIEW_REVISION_CONFLICT');
      } else this.#db.prepare('INSERT INTO reviews VALUES(?,?,?,?)').run(proposed.requestKey, 0, document, hash(document));
      return { record: proposed, created: true };
    });
  }
  #complete(record: ReviewRecord): void {
    this.#transaction(() => {
      const previous = this.#scan().heads.find(r => r.requestKey === record.requestKey);
      if (!previous || previous.status !== 'PENDING' || record.revision !== previous.revision + 1 || previous.startedAt !== record.startedAt || !sameBinding(previous, record) || !validRecord(record)) throw Error('REVIEW_REVISION_CONFLICT');
      this.#append(record); const document = JSON.stringify(record);
      const result = this.#db.prepare('UPDATE reviews SET revision=?,document=?,checksum=? WHERE request_key=? AND revision=?').run(record.revision, document, hash(document), record.requestKey, previous.revision);
      if (result.changes !== 1) throw Error('REVIEW_REVISION_CONFLICT');
    });
  }
  /** Bounded historical pages, always stale and never authorization capabilities. */
  history(requestKey: string, offset = 0, limit = 50): readonly ReviewView[] {
    this.#check(); if (!hex(requestKey)) throw Error('REVIEW_INVALID_KEY');
    if (!time(offset) || offset > MAX_REVISION || !time(limit) || limit < 1 || limit > 100) throw Error('REVIEW_INVALID_HISTORY_RANGE');
    try { return Object.freeze((this.#scan().history.get(requestKey) ?? []).slice(offset, offset + limit).map(r => view(r))); }
    catch { throw Error('REVIEW_CORRUPT_STORE'); }
  }
  get(requestKey: string): ReviewView | null {
    this.#check(); if (!hex(requestKey)) throw Error('REVIEW_INVALID_KEY');
    try { const saved = this.#scan().heads.find(r => r.requestKey === requestKey); return saved ? view(saved) : null; }
    catch { throw Error('REVIEW_CORRUPT_STORE'); }
  }
  close(): void { if (!this.#closed) { for (const c of this.#controllers) c.abort(); this.#db.close(); this.#closed = true; } }
  /** No caller-provided evidence/ownership/status can be submitted here. */
  async review(input: ReviewRequest, signal?: AbortSignal): Promise<ReviewView> { return await this.#run(input, signal); }
  /** Explicit refresh only; UNKNOWN/PENDING cannot be reset or superseded. */
  async refresh(input: ReviewRequest, expectedRevision: number, signal?: AbortSignal): Promise<ReviewView> {
    if (!time(expectedRevision) || expectedRevision > MAX_REVISION) throw Error('REVIEW_INVALID_REVISION');
    return await this.#run(input, signal, expectedRevision);
  }
  async #run(input: ReviewRequest, signal?: AbortSignal, expectedRevision?: number): Promise<ReviewView> {
    this.#check();
    if (!object(input) || Object.keys(input).sort().join(',') !== 'bindings,candidateHex,intent,paymentRequestId' || typeof input.paymentRequestId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(input.paymentRequestId) || typeof input.candidateHex !== 'string' || input.candidateHex.length > 200000 || !/^([0-9a-f]{2})+$/.test(input.candidateHex) || !Array.isArray(input.bindings) || input.bindings.length < 1 || input.bindings.length > 100 || (signal !== undefined && !(signal instanceof AbortSignal))) throw Error('REVIEW_INVALID_INPUT');
    if (signal?.aborted) throw Error('REVIEW_ABORTED');
    let captured: ReviewRequest; let intentDigest: string;
    try { captured = structuredClone(input); intentDigest = validatedIntentDigest(captured.intent); structuralTransactionDigest(captured.candidateHex); }
    catch { throw Error('REVIEW_INVALID_INPUT'); }
    const startedAt = this.#now(); if (startedAt >= captured.intent.expiresAt) throw Error('REVIEW_INTENT_EXPIRED');
    let sessionId: string | null;
    try { sessionId = this.#session.currentSessionId(); } catch { throw Error('REVIEW_SESSION_UNAVAILABLE'); }
    if (typeof sessionId !== 'string' || sessionId.length < 1 || sessionId.length > 128) throw Error('REVIEW_SESSION_UNAVAILABLE');
    const bindings = captured.bindings.map(b => {
      if (!object(b) || Object.keys(b).sort().join(',') !== 'childIndex,index,script' || !time(b.childIndex) || !time(b.index) || b.childIndex >= 0x80000000 || b.index >= 0x80000000 || typeof b.script !== 'string' || !/^76a914[0-9a-f]{40}88ac$/.test(b.script)) throw Error('REVIEW_INVALID_INPUT');
      return { childIndex: b.childIndex, index: b.index, script: b.script };
    });
    const reserved = this.#reserve({ schemaVersion: 1, requestKey: hash('intentguard/review-request/v1\0' + captured.intent.network + '\0' + captured.paymentRequestId), intentDigest, exactCandidateDigest: hash('intentguard/exact-candidate/v1\0' + captured.candidateHex), sessionDigest: hash('intentguard/review-session/v1\0' + sessionId), bindingDigest: hash('intentguard/review-paths/v1\0' + JSON.stringify(bindings)), sourceConfigDigest: this.#configDigest, startedAt, expiresAt: captured.intent.expiresAt, completedAt: null, observedAt: null, revision: 0, status: 'PENDING', evidenceBindingDigest: null, issue: null, sourceIds: [], chainTip: null, canSign: false, receiptValid: false, consensusVerified: false }, expectedRevision);
    if (!reserved.created) return view(reserved.record);
    const controller = new AbortController(); const onAbort = (): void => controller.abort();
    this.#controllers.add(controller); signal?.addEventListener('abort', onAbort, { once: true }); if (signal?.aborted) controller.abort();
    const completed: ReviewRecord = { ...reserved.record, revision: reserved.record.revision + 1, status: 'UNKNOWN', issue: 'REVIEW_UNAVAILABLE' };
    try {
      const ownership = deriveSessionOwnership(this.#session, sessionId, bindings, startedAt);
      const evidence: EvidenceResult = await this.#collect(captured.intent, captured.candidateHex, ownership, controller.signal);
      const end = this.#now(); completed.completedAt = Math.max(end, startedAt);
      const finalOwnership = deriveSessionOwnership(this.#session, sessionId, bindings, end);
      if (controller.signal.aborted) completed.issue = 'REVIEW_ABORTED';
      else if (end < startedAt || end - startedAt > 10000) completed.issue = 'REVIEW_CLOCK_WINDOW';
      else if (end >= captured.intent.expiresAt) completed.issue = 'REVIEW_INTENT_EXPIRED';
      else if (finalOwnership.status !== 'SESSION_DERIVED') completed.issue = 'REVIEW_SESSION_CHANGED';
      else if (evidence.status === 'UNKNOWN') completed.issue = evidence.issue && /^[A-Z_]{1,80}$/.test(evidence.issue) ? evidence.issue : 'REVIEW_SOURCE_UNAVAILABLE';
      else if (evidence.guard?.status !== 'MATCH_OFFLINE' || evidence.guard.intentDigest !== intentDigest || evidence.guard.structuralTransactionDigest !== structuralTransactionDigest(captured.candidateHex) || !time(evidence.observedAt) || evidence.observedAt < startedAt || evidence.observedAt > end || !hex(evidence.sourceBindingDigest) || JSON.stringify(evidence.sourceIds) !== JSON.stringify(this.#sourceIds) || !evidence.chainTip || !time(evidence.chainTip.height) || !hex(evidence.chainTip.hash) || !time(evidence.chainTip.timestampMs) || evidence.chainTip.timestampMs > end + 120000 || this.#maxTipAges.some(age => end - evidence.chainTip!.timestampMs > age)) completed.issue = 'REVIEW_EVIDENCE_MISMATCH';
      else { completed.status = evidence.status; completed.issue = null; completed.observedAt = evidence.observedAt; completed.evidenceBindingDigest = evidence.sourceBindingDigest; completed.sourceIds = [...this.#sourceIds]; completed.chainTip = { height: evidence.chainTip.height, hash: evidence.chainTip.hash, timestampMs: evidence.chainTip.timestampMs }; }
    } catch { completed.completedAt = startedAt; completed.issue = controller.signal.aborted ? 'REVIEW_ABORTED' : 'REVIEW_UNAVAILABLE'; }
    finally { signal?.removeEventListener('abort', onAbort); this.#controllers.delete(controller); }
    this.#complete(completed);
    // A saved observation is never resurrected as a live capability. Recheck even
    // the immediate return if clock/session changed during synchronous persistence.
    this.#check();
    let stillLatest: boolean;
    try { stillLatest = this.#scan().heads.find(r => r.requestKey === completed.requestKey)?.revision === completed.revision; }
    catch { throw Error('REVIEW_CORRUPT_STORE'); }
    let usableNow = false;
    try { const now = this.#now(); usableNow = stillLatest && now >= completed.completedAt! && now < captured.intent.expiresAt && now - startedAt <= 10000 && completed.chainTip !== null && completed.chainTip.timestampMs <= now + 120000 && this.#maxTipAges.every(age => now - completed.chainTip!.timestampMs <= age) && !signal?.aborted && deriveSessionOwnership(this.#session, sessionId, bindings, now).status === 'SESSION_DERIVED'; } catch { /* Historical view only. */ }
    return view(completed, usableNow && (completed.status === 'NODE_REPORTED' || completed.status === 'SYNTHETIC_MATCH') ? 'OBSERVED_DURING_CALL' : 'STALE_RECHECK_REQUIRED');
  }
}
