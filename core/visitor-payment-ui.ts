import { binToHex, sha256, hexToBin, hashTransaction, decodeTransaction } from '@bitauth/libauth';
import { ConnectedWallet, type SignEnvelope } from './wallet-adapter.js';
import { createPaymentRequestDraft, type PaymentRequestDraft } from './payment-request.js';
import { buildPaymentRequestPlan } from './request-plan.js';
import { verifySignedPlan, verifyParentBoundP2pkhSignatures } from './signed-verifier.js';
import { createEvidenceCollector, deriveSessionOwnership, type PathBinding, type SourceConfig } from './evidence.js';
import { VisitorPaymentStore, type VisitorOperation } from './visitor-payment-store.js';
import type { PaymentObservation } from './payment-chain.js';
import { buildUnsignedPlan } from './unsigned-builder.js';
import { structuralTransactionDigest } from './guard.js';

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const text = (id: string, value: unknown): void => { el(id).textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); };
const value = (id: string): string => el<HTMLInputElement>(id).value;
const enabled = (id: string, on: boolean): void => { el<HTMLButtonElement>(id).disabled = !on; };
const fields = ['network', 'chain-ack', 'recipient', 'amount', 'max-fee', 'target-rate', 'max-rate', 'ttl', 'receive-index', 'change-index', 'selected-outpoint'];
let epoch = 0, busy = false, confirmed = false, draft: PaymentRequestDraft | null = null, fingerprint = '', requestId: string = crypto.randomUUID();
let operation: VisitorOperation | null = null, store: VisitorPaymentStore | null = null, sourceIdentity = '', paths: PathBinding[] = [];
let controller = new AbortController(), expires: NodeJS.Timeout | undefined;
const wallet = new ConnectedWallet(() => {
  text('pairing', ''); el('pairing').hidden = true;
  text('wallet-state', wallet.currentSessionId() ? 'Fresh SDK session. Explicitly selected BCH mainnet; chain ID NOT authenticated by SDK.' : 'Disconnected / invalidated');
  invalidate();
}, undefined, (envelope, signedHex) => {
  void store?.signed(envelope.operationId, envelope, signedHex, false).catch(() => {});
}, 'mainnet');
async function api(body: unknown, signal?: AbortSignal): Promise<unknown> {
  const deadline = AbortSignal.timeout(20000);
  const response = await fetch('/api/payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, deadline]) : deadline });
  const raw = await response.text();
  if (raw.length > 1600000) throw Error('PAYMENT_RESPONSE_LIMIT');
  if (!response.ok) throw Error('PAYMENT_UNAVAILABLE_RECONCILE_ORIGINAL');
  return JSON.parse(raw) as unknown;
}
function currentFields(): string {
  return JSON.stringify(fields.map(id => [value(id), el<HTMLInputElement>(id).checked]).concat([[wallet.currentSessionId() ?? '', false]]));
}
function invalidate(): void {
  epoch++; confirmed = false; draft = null; controller.abort(); clearTimeout(expires);
  el<HTMLInputElement>('handoff-ack').checked = false; el('handoff').hidden = true; el<HTMLTextAreaElement>('signed-raw').value = '';
  for (const id of ['confirm', 'build', 'sign', 'broadcast', 'native-handoff', 'new-payment']) enabled(id, false);
  text('candidate', 'No current approval. Changed/stale/session-invalid terms require review.');
  if (operation && store && ['SIGNING', 'POSTCHECKED', 'OBSERVED', 'CONFIRMED_ON_CHAIN'].includes(operation.state)) {
    void store.uncertain(operation.id).catch(() => {});
    text('result', 'UNKNOWN — retain original operation/input reservations; NEVER re-sign or resend.');
  }
}
function assertCurrent(captured: number, session?: string): void {
  if (captured !== epoch || !confirmed || !draft || fingerprint !== currentFields() || draft.request.expiresAt <= Date.now() ||
      controller.signal.aborted || (session && wallet.currentSessionId() !== session)) throw Error('REQUEST_RECONFIRM_REQUIRED');
}
function owned(): string {
  if (value('network') !== 'mainnet' || !el<HTMLInputElement>('chain-ack').checked) throw Error('MAINNET_ACK_REQUIRED');
  const session = wallet.currentSessionId(); if (!session) throw Error('SESSION_UNAVAILABLE');
  paths = wallet.paths(Number(value('receive-index')), Number(value('change-index')));
  if (deriveSessionOwnership(wallet, session, paths, Date.now()).status !== 'SESSION_DERIVED') throw Error('OWNERSHIP_REQUIRED');
  return session;
}
async function sources(): Promise<SourceConfig[]> {
  const config = await api({ action: 'config' });
  if (!config || typeof config !== 'object' || !('mode' in config) || config.mode !== 'visitor-wallet' || !('sources' in config) || !Array.isArray(config.sources)) throw Error('SOURCE_CONFIGURATION');
  const identity = JSON.stringify(config.sources);
  if (sourceIdentity && sourceIdentity !== identity) { invalidate(); throw Error('SOURCE_CONFIGURATION_CHANGED'); }
  sourceIdentity = identity;
  return config.sources.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object' || !('id' in raw) || typeof raw.id !== 'string') throw Error('SOURCE_CONFIGURATION');
    const metadata = raw as Omit<SourceConfig, 'transport'>;
    return { ...metadata, transport: { request: (method, params) => api({ action: 'read', sourceId: metadata.id, method, params }) } };
  });
}
async function preflight(op: VisitorOperation, session: string, captured: number) {
  const configured = await sources(); assertCurrent(captured, session);
  const evidence = await createEvidenceCollector(configured)(op.build.intent, op.plan.unsignedHex!, deriveSessionOwnership(wallet, session, paths, Date.now()), controller.signal);
  assertCurrent(captured, session);
  if (evidence.status !== 'NODE_REPORTED' || !evidence.snapshot) throw Error(evidence.issue ?? 'FRESH_EVIDENCE_REQUIRED');
  return evidence.snapshot;
}
function action(id: string, run: () => Promise<void> | void): void {
  el(id).addEventListener('click', () => {
    if (busy) return;
    busy = true;
    void Promise.resolve().then(run).catch(error => {
      enabled('sign', false); enabled('broadcast', false); enabled('native-handoff', false);
      if (operation?.envelope && store) void store.uncertain(operation.id).catch(() => {});
      const code = error instanceof Error && /^[A-Z_]{1,80}$/.test(error.message) ? error.message : 'PAYMENT_UNAVAILABLE';
      text('result', (operation?.envelope ? 'UNKNOWN — observe ORIGINAL operation only. No retry, re-sign or resend. ' : 'REFUSED — no signing authorized. ') + code);
    }).finally(() => { busy = false; });
  });
}
for (const id of fields) el(id).addEventListener('input', () => { if (id === 'network') wallet.disconnect(); invalidate(); });
el('handoff-ack').addEventListener('input', () => { if (!el<HTMLInputElement>('handoff-ack').checked) invalidate(); });
el('disconnect').addEventListener('click', () => { invalidate(); wallet.disconnect(); });
window.addEventListener('pagehide', () => { invalidate(); wallet.disconnect(); store?.close(); });
window.addEventListener('focus', () => { if (operation?.envelope) invalidate(); });
for (const id of ['connect', 'confirm', 'build', 'sign', 'broadcast', 'native-handoff', 'new-payment']) enabled(id, false);
void (async () => {
  await sources(); store = await VisitorPaymentStore.open(); operation = await store.active();
  if (operation) {
    requestId = operation.request.requestId;
    if (['SIGNING', 'POSTCHECKED'].includes(operation.state)) operation = await store.uncertain(operation.id);
    text('result', { id: operation.id, state: operation.state, txid: operation.txid, note: 'Recovered original public record, NOT current receipt/consent. Read original evidence; no automatic effect.' });
  }
  enabled('connect', true);
})().catch(() => text('wallet-state', 'Source config / durable storage unavailable; wallet effects disabled. No memory fallback.'));
action('connect', () => {
  if (!store || value('network') !== 'mainnet' || !el<HTMLInputElement>('chain-ack').checked) throw Error('MAINNET_ACK_REQUIRED');
  const uri = wallet.connect('mainnet'); text('pairing', uri); el('pairing').hidden = false;
  text('wallet-state', 'Pair explicitly in your mainnet WizardConnect wallet. Private URI: never log/share/capture. Untested wallet compatibility remains UNVERIFIED.');
});
action('review', () => {
  invalidate();
  const ttl = Number(value('ttl'));
  if (value('network') !== 'mainnet' || !Number.isInteger(ttl) || ttl < 30 || ttl > 600 || !/^[1-9][0-9]{0,6}$/.test(value('target-rate')) || !/^[1-9][0-9]{0,6}$/.test(value('max-rate')) || BigInt(value('target-rate')) > BigInt(value('max-rate'))) throw Error('INVALID_LIMITS');
  const parsed = createPaymentRequestDraft({ schemaVersion: 1, kind: 'intentguard-payment-request', requestId, network: 'mainnet', expiresAt: Date.now() + ttl * 1000,
    maxFeeBch: value('max-fee'), recipients: [{ address: value('recipient'), bch: value('amount') }] }, Date.now());
  if (parsed.status !== 'DRAFT_READY') throw Error('INVALID_REQUEST');
  draft = parsed.draft; fingerprint = currentFields();
  text('terms-summary', { network: 'BCH MAINNET', recipients: draft.display.recipients, maxFeeSatoshis: draft.display.maxFeeSatoshis, targetRate: value('target-rate'), maximumRate: value('max-rate'), expiresAt: new Date(draft.request.expiresAt).toISOString(), agentMainnetCapSatoshis: '0' });
  enabled('confirm', true); expires = setTimeout(invalidate, ttl * 1000);
});
action('confirm', () => {
  if (!draft || fingerprint !== currentFields() || !el<HTMLInputElement>('chain-ack').checked) throw Error('REQUEST_RECONFIRM_REQUIRED');
  confirmed = true; controller = new AbortController(); enabled('build', true); text('result', 'Independent terms confirmed. Build does NOT prompt for signing.');
});
action('build', async () => {
  const captured = epoch, session = owned(); assertCurrent(captured, session);
  const d = draft!; const selected = value('selected-outpoint'); const match = /^([0-9a-f]{64}):(0|[1-9][0-9]{0,9})$/.exec(selected);
  if (selected && (!match || Number(match[2]) > 0xffffffff)) throw Error('INVALID_SELECTION');
  const feePolicy = { targetSatoshisPer1000Bytes: value('target-rate'), maxSatoshisPer1000Bytes: value('max-rate'), signatureModel: 'compressed-p2pkh-schnorr', allowBchDustToFee: false };
  const raw = await api({ action: 'prepare', request: d.request, expectedRequestDigest: d.requestDigest, scripts: paths.map(p => p.script), changeScript: paths[1]!.script, feePolicy,
    selectedOutpoint: match ? { txid: match[1], index: Number(match[2]) } : null });
  assertCurrent(captured, session);
  if (!raw || typeof raw !== 'object' || !('build' in raw) || !('plan' in raw) || !('sourceDigest' in raw) || typeof raw.sourceDigest !== 'string') throw Error('INVALID_CANDIDATE');
  const supplied = raw as Pick<VisitorOperation, 'build' | 'plan' | 'sourceDigest'>;
  const context = { ownerScripts: paths.map(p => p.script), changeScript: paths[1]!.script, snapshot: supplied.build.snapshot, selectedInputs: supplied.build.selectedInputs, feePolicy };
  const bound = buildPaymentRequestPlan(d.request, d.requestDigest, context, Date.now());
  if (!bound.plan?.unsignedHex || !bound.intent || bound.plan.planDigest !== supplied.plan.planDigest || bound.plan.unsignedHex !== supplied.plan.unsignedHex ||
      (match && (bound.plan.selectedInputs.length !== 1 || bound.plan.selectedInputs[0]?.txid !== match[1] || bound.plan.selectedInputs[0]?.index !== Number(match[2])))) throw Error('CANDIDATE_SUBSTITUTED');
  const build = { intent: { ...bound.intent, recipients: [...bound.intent.recipients], ownerScripts: [...bound.intent.ownerScripts] }, snapshot: context.snapshot, selectedInputs: context.selectedInputs, changeScript: context.changeScript, feePolicy: { ...feePolicy, signatureModel: bound.plan.estimatedSignedBytes!.signatureModel }, now: Date.now() };
  const plan = buildUnsignedPlan(build);
  if (plan.unsignedHex !== bound.plan.unsignedHex || plan.planDigest !== bound.plan.planDigest) throw Error('CANDIDATE_SUBSTITUTED');
  operation = await store!.prepare({ request: d.request, requestDigest: d.requestDigest, build, plan, sourceDigest: supplied.sourceDigest });
  assertCurrent(captured, session);
  text('candidate', { network: 'BCH MAINNET', inputs: operation.plan.selectedInputs, outputs: operation.plan.outputSummary, feeSatoshis: operation.plan.feeSatoshis, rateBounds: operation.plan.feeRateBounds, signedSizeBounds: operation.plan.estimatedSignedBytes, planDigest: operation.plan.planDigest });
  enabled('sign', true); enabled('build', false); text('result', 'Approve EVERY input/output/change, exact fee and BCH mainnet before sign-only. Delivery requires a separate approval.');
});
action('sign', async () => {
  if (!operation || !store) throw Error('INVALID_CANDIDATE');
  const captured = epoch, session = owned(), original = operation; assertCurrent(captured, session);
  const snapshot = await preflight(original, session, captured);
  const envelope: SignEnvelope = { operationId: original.id, attemptId: crypto.randomUUID(), revision: original.revision + 1, requestDigest: original.requestDigest,
    intentDigest: original.plan.intentDigest!, planDigest: original.plan.planDigest!, unsignedHash: hashTransaction(hexToBin(original.plan.unsignedHex!)), sessionId: session,
    sequence: wallet.nextSequence('mainnet', controller.signal), expiresAt: original.request.expiresAt };
  operation = await store.reserve(original, envelope); assertCurrent(captured, session); enabled('sign', false);
  let result: { envelope: SignEnvelope; signedHex: string };
  try { result = await wallet.sign('mainnet', envelope, original.plan, paths, controller.signal); }
  catch { await store.uncertain(original.id); throw Error('SIGNING_UNKNOWN'); }
  let valid = false;
  try {
    assertCurrent(captured, session);
    const checked = verifySignedPlan({ buildInput: { ...original.build, snapshot }, signedHex: result.signedHex }, Date.now());
    const tx = decodeTransaction(hexToBin(result.signedHex));
    valid = checked.status === 'SIGNED_PLAN_VALID_OFFLINE' && typeof tx !== 'string' && tx.inputs.every(i => i.unlockingBytecode[i.unlockingBytecode[0] ?? 0] === 0x61);
  } catch { /* Late bytes still attach only to the original attempt. */ }
  operation = await store.signed(original.id, result.envelope, result.signedHex, valid);
  assertCurrent(captured, session);
  if (!valid || operation.state !== 'POSTCHECKED') throw Error('POSTCHECK_FAILED');
  enabled('broadcast', true); enabled('native-handoff', true); text('result', { state: operation.state, txid: operation.txid, feeSatoshis: operation.plan.feeSatoshis, note: 'Exact signed bytes cryptographically checked. NOT sent. Approve ONE delivery option separately.' });
});
async function reserveDelivery(): Promise<VisitorOperation> {
  if (!operation || !store || !el<HTMLInputElement>('handoff-ack').checked) throw Error('NO_SEND_AUTHORITY');
  const captured = epoch, session = owned(), original = operation; assertCurrent(captured, session);
  const snapshot = await preflight(original, session, captured);
  const checked = original.signedHex && verifySignedPlan({ buildInput: { ...original.build, snapshot }, signedHex: original.signedHex }, Date.now());
  const tx = original.signedHex && decodeTransaction(hexToBin(original.signedHex));
  if (!original.signedHex || !original.txid || hashTransaction(hexToBin(original.signedHex)) !== original.txid || !checked || checked.status !== 'SIGNED_PLAN_VALID_OFFLINE' || checked.planDigest !== original.plan.planDigest || !tx || typeof tx === 'string' || !tx.inputs.every(i => i.unlockingBytecode[i.unlockingBytecode[0] ?? 0] === 0x61)) throw Error('POSTCHECK_FAILED');
  operation = await store.reserveDelivery(original);
  assertCurrent(captured, session); enabled('broadcast', false); enabled('native-handoff', false);
  return operation;
}
action('broadcast', async () => {
  const original = await reserveDelivery();
  const response = await api({ action: 'relay', request: original.request, expectedRequestDigest: original.requestDigest,
    scripts: original.build.intent.ownerScripts, changeScript: original.build.changeScript, feePolicy: original.build.feePolicy,
    selectedInputs: original.build.selectedInputs, planDigest: original.plan.planDigest, signedHex: original.signedHex, txid: original.txid }, controller.signal);
  if (!response || typeof response !== 'object' || !('status' in response) || response.status !== 'UNKNOWN' || !('txid' in response) || response.txid !== original.txid) throw Error('RELAY_UNKNOWN');
  text('result', { state: 'UNKNOWN', txid: original.txid, note: 'One app relay was attempted with the verified bytes. A node response is not a receipt. Observe the original hash; never resend or re-sign.' });
});
action('native-handoff', async () => {
  const original = await reserveDelivery();
  el<HTMLTextAreaElement>('signed-raw').value = original.signedHex!; el('handoff').hidden = false;
  text('result', { state: 'UNKNOWN', txid: original.txid, note: 'Native handoff reserved instead of app relay. Observe the original hash; do not use the other delivery option or re-sign.' });
});
action('recover', async () => {
  if (!store) throw Error('DURABLE_STORAGE_REQUIRED');
  invalidate(); const captured = epoch;
  operation = await store.active();
  if (captured !== epoch) throw Error('STALE_OBSERVATION');
  if (operation) operation = await store.uncertain(operation.id);
  if (!operation?.signedHex || !operation.txid) { text('result', 'Original transaction bytes or hash unavailable; read could not be completed. Operation stays reserved/UNKNOWN. No replacement or retry.'); return; }
  const original = operation;
  text('result', 'Reading ORIGINAL hash; previous receipt is stale until fresh agreement.');
  const binding = verifyParentBoundP2pkhSignatures({ signedHex: original.signedHex!, parentTransactionHexes: original.build.snapshot.parentTransactionHexes, signatureModel: original.build.feePolicy.signatureModel });
  if (binding.status !== 'SIGNATURES_VALID_PARENT_BOUND' || hashTransaction(hexToBin(original.signedHex!)) !== original.txid || structuralTransactionDigest(original.signedHex!) !== structuralTransactionDigest(original.plan.unsignedHex!)) throw Error('POSTCHECK_FAILED');
  const recoveredTransaction = decodeTransaction(hexToBin(original.signedHex!));
  if (typeof recoveredTransaction === 'string' || !recoveredTransaction.inputs.every(i => i.unlockingBytecode[i.unlockingBytecode[0] ?? 0] === 0x61)) throw Error('POSTCHECK_FAILED');
  const raw = await api({ action: 'observe', signedHex: original.signedHex, txid: original.txid, parents: original.build.snapshot.parentTransactionHexes });
  if (captured !== epoch) throw Error('STALE_OBSERVATION');
  if (!raw || typeof raw !== 'object' || !('status' in raw) || !['UNKNOWN', 'OBSERVED', 'CONFIRMED_ON_CHAIN'].includes(String(raw.status)) || !('observedAt' in raw) || !Number.isSafeInteger(raw.observedAt) || Date.now() - Number(raw.observedAt) > 10000 || Number(raw.observedAt) > Date.now() ||
      !('height' in raw) || !('blockHash' in raw) || (raw.status === 'CONFIRMED_ON_CHAIN' ? !Number.isSafeInteger(raw.height) || Number(raw.height) < 1 || typeof raw.blockHash !== 'string' || !/^[0-9a-f]{64}$/.test(raw.blockHash) : raw.height !== null || raw.blockHash !== null)) throw Error('INVALID_OBSERVATION');
  operation = await store.observed(original, raw as PaymentObservation);
  if (captured !== epoch) { await store.uncertain(original.id); throw Error('STALE_OBSERVATION'); }
  text('result', { state: operation.state, txid: operation.txid, observation: operation.observation, trust: raw.status === 'UNKNOWN'
    ? 'Original transaction read was inconclusive; no current receipt. Observe the original only; never resend or re-sign.'
    : raw.status === 'OBSERVED'
      ? 'Fresh two-node agreement on exact original transaction bytes; inclusion not established. NOT SPV/consensus. Re-read on conflict/reorg.'
      : 'Fresh two-node agreement on exact original transaction bytes and node-reported inclusion. NOT SPV/consensus. Re-read on conflict/reorg.' });
  enabled('new-payment', operation.state === 'CONFIRMED_ON_CHAIN');
  expires = setTimeout(() => { enabled('new-payment', false); text('result', 'Receipt observation stale; re-read ORIGINAL hash.'); }, 10000);
});
action('new-payment', async () => {
  if (!store || !operation?.observation || Date.now() - operation.observation.observedAt > 10000) throw Error('FRESH_EVIDENCE_REQUIRED');
  await store.newAfterConfirmed(); operation = null; requestId = crypto.randomUUID(); invalidate(); text('result', 'Distinct payment draft; prior operation and input tombstones retained. Review new terms explicitly.');
});
