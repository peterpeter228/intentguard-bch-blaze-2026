import { hexToBin, hashTransaction } from '@bitauth/libauth';
import { ConnectedWallet, type SignEnvelope } from './wallet-adapter.js';
import { createPaymentRequestDraft, type PaymentRequestDraft } from './payment-request.js';
import { buildPaymentRequestPlan } from './request-plan.js';
import { verifySignedPlan } from './signed-verifier.js';
import { createEvidenceCollector, deriveSessionOwnership, type PathBinding, type SourceConfig } from './evidence.js';
import type { PaymentRecord } from './operation-store.js';

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const text = (id: string, value: unknown): void => { el(id).textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); };
const value = (id: string): string => el<HTMLInputElement>(id).value;
const enabled = (id: string, on: boolean): void => { el<HTMLButtonElement>(id).disabled = !on; };
const network = (): string => value('network');
let epoch = 0, draft: PaymentRequestDraft | null = null, fingerprint = '', confirmed = false;
let op: PaymentRecord | null = null, capability = '', paths: PathBinding[] = [], verified: { envelope: SignEnvelope; signedHex: string } | null = null;
let controller = new AbortController(), busy = false;
const wallet = new ConnectedWallet(() => {
  text('wallet-state', wallet.currentSessionId() ? 'Authenticated live SDK session (selected Chipnet; not chain proof)' : 'Disconnected / invalidated');
  text('pairing', ''); el('pairing').hidden = true;
  invalidate();
}, undefined, (envelope, signedHex) => {
  if (!op || !capability || op.id !== envelope.operationId) return;
  const original = op, token = capability;
  void (async () => {
    let current = acceptOperation(await api({ action: 'get', id: original.id }), original);
    if (current.state === 'SIGNING') current = acceptOperation(await api({ action: 'uncertain', id: current.id, revision: current.revision, capability: token }), current);
    if (current.state === 'UNKNOWN') await api({ action: 'signed', id: current.id, revision: current.revision, capability: token, envelope, signedHex });
    text('result', 'Late original signed bytes quarantined; NEVER auto-broadcast. Read original operation.');
  })().catch(() => text('result', 'UNKNOWN: preserve original operation; no replacement.'));
});
async function api(body: unknown): Promise<unknown> {
  const response = await fetch('/api/payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const raw = await response.text();
  if (raw.length > 1600000) throw Error('PAYMENT_RESPONSE_LIMIT');
  const result: unknown = JSON.parse(raw);
  if (!response.ok) {
    if (result && typeof result === 'object' && 'issue' in result && typeof result.issue === 'string' && /^[A-Z_]{1,80}$/.test(result.issue)) throw Error(result.issue);
    throw Error('PAYMENT_UNAVAILABLE_RECONCILE_ORIGINAL');
  }
  return result;
}
function fields(): string {
  return JSON.stringify(['network', 'recipient', 'amount', 'max-fee', 'target-rate', 'max-rate', 'ttl', 'receive-index', 'change-index', 'offline-context'].map(value).concat(String(el<HTMLInputElement>('chain-ack').checked), wallet.currentSessionId() ?? ''));
}
function invalidate(): void {
  epoch++; confirmed = false; draft = null; verified = null; controller.abort();
  for (const id of ['confirm', 'build', 'sign', 'broadcast']) enabled(id, false);
  text('terms-summary', 'Terms/session changed: review and confirm again.');
  if (op && capability && ['SIGNING', 'POSTCHECKED'].includes(op.state)) {
    const original = op;
    void api({ action: 'uncertain', id: original.id, revision: original.revision, capability }).then(() => text('result', 'UNKNOWN: reconcile ORIGINAL operation; never re-sign/resend.')).catch(() => text('result', 'UNKNOWN: reload/read original operation.'));
  }
}
function acceptOperation(raw: unknown, previous?: PaymentRecord): PaymentRecord {
  if (!raw || typeof raw !== 'object') throw Error('INVALID_PAYMENT_RESPONSE');
  const p = raw as PaymentRecord;
  if (!/^[0-9a-f]{64}$/.test(p.id) || !Number.isSafeInteger(p.revision) || !p.request || !p.plan || !p.build ||
      (previous && (p.id !== previous.id || p.requestDigest !== previous.requestDigest || p.plan.planDigest !== previous.plan.planDigest))) throw Error('INVALID_PAYMENT_RESPONSE');
  return p;
}
function owned(): string {
  const session = wallet.currentSessionId();
  if (network() !== 'chipnet' || !session || !el<HTMLInputElement>('chain-ack').checked) throw Error('CHIPNET_SESSION_REQUIRED');
  paths = wallet.paths(Number(value('receive-index')), Number(value('change-index')));
  if (deriveSessionOwnership(wallet, session, paths, Date.now()).status !== 'SESSION_DERIVED') throw Error('OWNERSHIP_REQUIRED');
  return session;
}
for (const id of ['network', 'chain-ack', 'recipient', 'amount', 'max-fee', 'target-rate', 'max-rate', 'ttl', 'receive-index', 'change-index', 'offline-context']) el(id).addEventListener('input', () => {
  if (id === 'network') { wallet.disconnect(); enabled('connect', network() === 'chipnet'); }
  invalidate();
});
function action(id: string, run: () => Promise<void> | void): void {
  el(id).addEventListener('click', () => {
    if (busy) return;
    busy = true;
    Promise.resolve().then(run).catch(error => {
      const code = error instanceof Error && /^[A-Z_]{1,80}$/.test(error.message) ? error.message : 'PAYMENT_UNAVAILABLE_RECONCILE_ORIGINAL';
      text('result', code); enabled('sign', false); enabled('broadcast', false);
    }).finally(() => { busy = false; });
  });
}
action('connect', () => {
  if (network() !== 'chipnet' || !el<HTMLInputElement>('chain-ack').checked) throw Error('CHIPNET_ACK_REQUIRED');
  const uri = wallet.connect(network());
  text('pairing', uri); el('pairing').hidden = false; text('wallet-state', 'Pair in a Chipnet-capable WizardConnect wallet. Private URI: do not capture/share it.');
});
el('disconnect').addEventListener('click', () => { controller.abort(); wallet.disconnect(); });
action('review', () => {
  const ttl = Number(value('ttl'));
  if (!Number.isInteger(ttl) || ttl < 30 || ttl > 600 || !/^[1-9][0-9]{0,6}$/.test(value('target-rate')) || !/^[1-9][0-9]{0,6}$/.test(value('max-rate')) || BigInt(value('target-rate')) > BigInt(value('max-rate'))) throw Error('INVALID_LIMITS');
  const key = 'intentguard/payment/' + network() + '/request-id';
  let requestId = localStorage.getItem(key);
  if (!requestId) { requestId = crypto.randomUUID(); localStorage.setItem(key, requestId); }
  const parsed = createPaymentRequestDraft({ schemaVersion: 1, kind: 'intentguard-payment-request', requestId, network: network(), expiresAt: Date.now() + ttl * 1000,
    maxFeeBch: value('max-fee'), recipients: [{ address: value('recipient'), bch: value('amount') }] }, Date.now());
  if (parsed.status !== 'DRAFT_READY') throw Error(parsed.issue);
  draft = parsed.draft; fingerprint = fields(); confirmed = false;
  text('terms-summary', { network: draft.request.network, recipients: draft.display.recipients, maxFeeSatoshis: draft.display.maxFeeSatoshis,
    targetRate: value('target-rate'), maximumRate: value('max-rate'), expiresAt: new Date(draft.request.expiresAt).toISOString(), mainnetCapSatoshis: '0' });
  enabled('confirm', true); enabled('build', false);
});
action('confirm', () => { if (!draft || fingerprint !== fields()) throw Error('REQUEST_RECONFIRM_REQUIRED'); confirmed = true; enabled('build', true); text('result', 'Confirmed independent terms. Build next; no wallet prompt yet.'); });
action('build', async () => {
  if (!confirmed || !draft || fingerprint !== fields()) throw Error('REQUEST_RECONFIRM_REQUIRED');
  const captured = epoch, d = draft;
  const policy = { targetSatoshisPer1000Bytes: value('target-rate'), maxSatoshisPer1000Bytes: value('max-rate'), signatureModel: 'compressed-p2pkh-schnorr', allowBchDustToFee: false };
  if (network() === 'mainnet') {
    const context: unknown = JSON.parse(value('offline-context'));
    if (!context || typeof context !== 'object' || Array.isArray(context)) throw Error('INVALID_OFFLINE_CONTEXT');
    const bound = buildPaymentRequestPlan(d.request, d.requestDigest, { ...context, feePolicy: policy }, Date.now());
    text('candidate', bound); text('result', 'UNSIGNED / OFFLINE ONLY — cap0. Supplied context is not chain or ownership evidence.'); return;
  }
  owned();
  const raw = await api({ action: 'prepare', request: d.request, expectedRequestDigest: d.requestDigest, scripts: paths.map(p => p.script), changeScript: paths[1]!.script, feePolicy: policy });
  const candidate = acceptOperation(raw);
  localStorage.setItem('intentguard/payment/original-id', candidate.id); // Public recovery ID only, before any prompt.
  if (!raw || typeof raw !== 'object' || !('capability' in raw) || typeof raw.capability !== 'string' || !/^[0-9a-f]{64}$/.test(raw.capability)) throw Error('CAPABILITY_REQUIRED');
  op = candidate; capability = raw.capability;
  if (captured !== epoch || fingerprint !== fields()) throw Error('REQUEST_RECONFIRM_REQUIRED');
  const bound = buildPaymentRequestPlan(d.request, d.requestDigest, { ownerScripts: paths.map(p => p.script), changeScript: paths[1]!.script, snapshot: candidate.build.snapshot,
    selectedInputs: candidate.build.selectedInputs, feePolicy: policy }, Date.now());
  if (bound.plan?.unsignedHex !== candidate.plan.unsignedHex || bound.plan?.planDigest !== candidate.plan.planDigest || candidate.requestDigest !== d.requestDigest) throw Error('CANDIDATE_SUBSTITUTED');
  if (!bound.plan || !bound.intent) throw Error('CANDIDATE_SUBSTITUTED');
  op = { ...candidate, plan: bound.plan, build: { ...candidate.build, intent: { ...bound.intent, recipients: [...bound.intent.recipients], ownerScripts: [...bound.intent.ownerScripts] } } };
  text('candidate', { inputs: candidate.plan.selectedInputs, outputs: candidate.plan.outputSummary, feeSatoshis: candidate.plan.feeSatoshis, signedSizeBounds: candidate.plan.estimatedSignedBytes, planDigest: candidate.plan.planDigest });
  enabled('sign', true); enabled('build', false); text('result', 'Exact candidate ready. Approve outputs/change/fee before sign-only.');
});
action('sign', async () => {
  if (!op || !capability || !confirmed || fingerprint !== fields()) throw Error('REQUEST_RECONFIRM_REQUIRED');
  const sessionId = owned(), captured = epoch, original = op;
  controller = new AbortController();
  const config = await api({ action: 'config' });
  if (!config || typeof config !== 'object' || !('sources' in config) || !Array.isArray(config.sources)) throw Error('SOURCE_CONFIGURATION');
  const sources: SourceConfig[] = config.sources.map(s => ({ ...s, transport: { request: (method, params) => api({ action: 'read', sourceId: s.id, method, params }) } }));
  const evidence = await createEvidenceCollector(sources)(original.build.intent, original.plan.unsignedHex!, deriveSessionOwnership(wallet, sessionId, paths, Date.now()), controller.signal);
  if (evidence.status !== 'NODE_REPORTED' || !evidence.snapshot || captured !== epoch || fingerprint !== fields()) throw Error('FRESH_EVIDENCE_REQUIRED');
  const sequence = wallet.nextSequence(network(), controller.signal);
  op = acceptOperation(await api({ action: 'reserve', id: original.id, revision: original.revision, capability, sequence, sessionId, planDigest: original.plan.planDigest }), original);
  if (captured !== epoch || controller.signal.aborted || !op.envelope) throw Error('SIGNING_UNKNOWN');
  enabled('sign', false);
  try {
    const result = await wallet.sign(network(), op.envelope, original.plan, paths, controller.signal);
    if (captured !== epoch || fingerprint !== fields() || wallet.currentSessionId() !== sessionId) throw Error('SIGNING_UNKNOWN');
    const checked = verifySignedPlan({ buildInput: { ...original.build, snapshot: evidence.snapshot }, signedHex: result.signedHex }, Date.now());
    op = acceptOperation(await api({ action: 'signed', id: op.id, revision: op.revision, capability, envelope: result.envelope, signedHex: result.signedHex }), op);
    if (checked.status !== 'SIGNED_PLAN_VALID_OFFLINE' || op.state !== 'POSTCHECKED' || op.txid !== hashTransaction(hexToBin(result.signedHex)) || captured !== epoch) throw Error('POSTCHECK_FAILED');
    verified = result; enabled('broadcast', true); text('result', { state: op.state, txid: op.txid, note: 'Signed bytes checked; NOT sent. Explicit Chipnet broadcast required.' });
  } catch {
    if (op.state === 'SIGNING') { try { op = acceptOperation(await api({ action: 'uncertain', id: op.id, revision: op.revision, capability }), op); } catch { /* Read original; never retry signing. */ } }
    throw Error('SIGNING_UNKNOWN');
  }
});
action('broadcast', async () => {
  if (network() !== 'chipnet' || !op || !verified || !confirmed || fingerprint !== fields() || owned() !== verified.envelope.sessionId) throw Error('NO_SEND_AUTHORITY');
  enabled('broadcast', false);
  op = acceptOperation(await api({ action: 'broadcast', id: op.id, revision: op.revision, capability }), op);
  text('result', { state: op.state, txid: op.txid, note: 'Reconcile ORIGINAL hash only; no resend on timeout.' });
  if (op.state === 'BROADCASTING') { op = acceptOperation(await api({ action: 'observe', id: op.id, revision: op.revision, capability }), op); text('result', { state: op.state, txid: op.txid, observation: op.observation, trust: 'Two node reports + inclusion header, not independent consensus/SPV.' }); }
});
action('recover', async () => {
  const id = localStorage.getItem('intentguard/payment/original-id');
  if (!id) { text('result', 'No original operation ID stored. Do not replace an uncertain payment.'); return; }
  const recovered = acceptOperation(await api({ action: 'get', id }));
  text('result', { id: recovered.id, state: recovered.state, txid: recovered.txid, observation: recovered.observation, recoveryObservation: 'recoveryObservation' in recovered ? recovered.recoveryObservation : null, recovery: 'Read-only ORIGINAL hash; no re-sign/resend. Lost mutation credentials cannot authorize a replacement.' });
  enabled('sign', false); enabled('broadcast', false);
});
window.addEventListener('pagehide', () => wallet.disconnect());
