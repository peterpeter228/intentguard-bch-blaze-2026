/**
 * Explicit, offline request-to-plan binding. Nothing here authenticates human
 * consent, wallet ownership, sources or spendability. No fixtures are imported.
 * The caller retains the expected request digest from its own review state and
 * supplies a separate planning context. Imported results are never authority.
 */
import { binToHex, sha256 } from '@bitauth/libauth';
import { createPaymentRequestDraft, parsePaymentRequestDraft, type PaymentRequestDraft } from './payment-request.js';
import { validatedIntentDigest, type PaymentIntent, type EvidenceSnapshot } from './guard.js';
import { buildUnsignedPlan, type UnsignedBuildResult, type UnsignedFeePolicy, type SelectedOutpoint } from './unsigned-builder.js';

export interface OfflineRequestPlanContext {
  ownerScripts: readonly string[]; changeScript: string; snapshot: EvidenceSnapshot;
  selectedInputs: readonly SelectedOutpoint[]; feePolicy: UnsignedFeePolicy;
}
export type DeepReadonly<T> = T extends readonly (infer E)[] ? readonly DeepReadonly<E>[] : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export interface RequestPlanBinding {
  schemaVersion: 1; kind: 'intentguard-offline-request-plan'; requestId: string;
  requestDigest: string; intentDigest: string; planDigest: string; planningPolicyDigest: string; requestPlanDigest: string;
}
interface RequestPlanReport {
  status: 'REQUEST_PLAN_BOUND_OFFLINE' | 'REJECTED'; issue: string | null; builderIssue: string | null;
  canSign: false; broadcastable: false; receiptValid: false; networkVerified: false; ownershipVerified: false;
  draft: PaymentRequestDraft | null; intent: PaymentIntent | null; plan: UnsignedBuildResult | null;
  binding: RequestPlanBinding | null; limitations: readonly string[];
}
export type RequestPlanResult = DeepReadonly<RequestPlanReport>;
const LIMITATIONS = [
  'This binds request content to an offline plan, not human consent, recipient identity or payment authority.',
  'The expected request digest must come from application review state, not from the same untrusted request or an imported result.',
  'Owner scripts, selected inputs, source snapshots and fee models are supplied offline claims; no wallet, chain or ownership was authenticated.',
  'No UTXOs are discovered or reserved; no signatures, broadcasting, payment state or receipts are produced.',
  'The binding is an application content identifier, not a transaction ID, chain commitment or reusable authorization.'
] as const;
function contextError(): never { throw Error('REQUEST_PLAN_INVALID_CONTEXT'); }
function record(value: unknown, names: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) contextError();
  const keys = Reflect.ownKeys(value);
  if (keys.length !== names.length || keys.some(k => typeof k !== 'string' || !names.includes(k)) || names.some(k => !Object.hasOwn(value, k)) || Object.values(Object.getOwnPropertyDescriptors(value)).some(d => !('value' in d))) contextError();
}
function array(value: unknown, min: number, max: number): asserts value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length < min || value.length > max) contextError();
  if (Reflect.ownKeys(value).length !== value.length + 1 || Array.from({ length: value.length }, (_, i) => Object.getOwnPropertyDescriptor(value, String(i))).some(d => !d || !('value' in d))) contextError();
}
const p2pkh = (v: unknown): v is string => typeof v === 'string' && /^76a914[0-9a-f]{40}88ac$/.test(v);
const hex64 = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const time = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
function copyContext(value: unknown): OfflineRequestPlanContext {
  if (value === undefined || value === null) throw Error('REQUEST_PLAN_CONTEXT_REQUIRED');
  record(value, ['ownerScripts', 'changeScript', 'snapshot', 'selectedInputs', 'feePolicy']);
  array(value.ownerScripts, 1, 20); if (!value.ownerScripts.every(p2pkh) || new Set(value.ownerScripts).size !== value.ownerScripts.length || !p2pkh(value.changeScript)) contextError();
  const ownerScripts = [...value.ownerScripts]; const changeScript = value.changeScript;
  record(value.snapshot, ['network', 'observedAt', 'parentTransactionHexes', 'unspentOutpoints']); const s = value.snapshot;
  if ((s.network !== 'mainnet' && s.network !== 'chipnet') || !time(s.observedAt)) contextError();
  array(s.parentTransactionHexes, 1, 20); array(s.unspentOutpoints, 1, 100);
  if (!s.parentTransactionHexes.every((raw): raw is string => typeof raw === 'string' && raw.length > 0 && raw.length <= 200000 && /^(?:[0-9a-f]{2})+$/.test(raw)) || s.parentTransactionHexes.reduce((n, raw) => n + raw.length, 0) > 500000) contextError();
  if (!s.unspentOutpoints.every((outpoint): outpoint is string => typeof outpoint === 'string' && /^[0-9a-f]{64}:(0|[1-9][0-9]{0,9})$/.test(outpoint) && BigInt(outpoint.split(':')[1]!) <= 0xffffffffn)) contextError();
  const snapshot: EvidenceSnapshot = { network: s.network, observedAt: s.observedAt, parentTransactionHexes: [...s.parentTransactionHexes], unspentOutpoints: [...s.unspentOutpoints] };
  array(value.selectedInputs, 1, 20); const selectedInputs = value.selectedInputs.map(raw => { record(raw, ['txid', 'index']); if (!hex64(raw.txid) || !time(raw.index) || raw.index > 0xffffffff) contextError(); return { txid: raw.txid, index: raw.index }; });
  record(value.feePolicy, ['targetSatoshisPer1000Bytes', 'maxSatoshisPer1000Bytes', 'signatureModel', 'allowBchDustToFee']); const f = value.feePolicy;
  if (typeof f.targetSatoshisPer1000Bytes !== 'string' || !/^[1-9][0-9]{0,6}$/.test(f.targetSatoshisPer1000Bytes) || typeof f.maxSatoshisPer1000Bytes !== 'string' || !/^[1-9][0-9]{0,6}$/.test(f.maxSatoshisPer1000Bytes) || (f.signatureModel !== 'compressed-p2pkh-schnorr' && f.signatureModel !== 'compressed-p2pkh-low-s-ecdsa') || typeof f.allowBchDustToFee !== 'boolean') contextError();
  const feePolicy: UnsignedFeePolicy = { targetSatoshisPer1000Bytes: f.targetSatoshisPer1000Bytes, maxSatoshisPer1000Bytes: f.maxSatoshisPer1000Bytes, signatureModel: f.signatureModel, allowBchDustToFee: f.allowBchDustToFee };
  return { ownerScripts, changeScript, snapshot, selectedInputs, feePolicy };
}
function freeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value as DeepReadonly<T>;
}
/** now is invocation time from trusted application code, never request/context JSON.
 * expectedRequestDigest detects changes since local review; it is NOT proof that
 * a human reviewed anything. This synchronous API makes no external calls.
 */
export function buildPaymentRequestPlan(request: unknown, expectedRequestDigest: string, context: unknown, now: number = Date.now()): RequestPlanResult {
  const report: RequestPlanReport = { status: 'REJECTED', issue: null, builderIssue: null, canSign: false, broadcastable: false, receiptValid: false, networkVerified: false, ownershipVerified: false, draft: null, intent: null, plan: null, binding: null, limitations: LIMITATIONS };
  try {
    const parsed = typeof request === 'string' ? parsePaymentRequestDraft(request, now) : createPaymentRequestDraft(request, now);
    if (parsed.status !== 'DRAFT_READY') { report.issue = parsed.issue; return freeze(report); }
    if (!hex64(expectedRequestDigest)) throw Error('REQUEST_PLAN_REVIEW_DIGEST_REQUIRED');
    if (expectedRequestDigest !== parsed.draft.requestDigest) throw Error('REQUEST_PLAN_REVIEW_CHANGED');
    const c = copyContext(context); const d = parsed.draft;
    const intent: PaymentIntent = { network: d.request.network, expiresAt: d.request.expiresAt, maxFeeSatoshis: d.display.maxFeeSatoshis, recipients: d.display.recipients.map(r => ({ script: r.script, satoshis: r.satoshis, ...(r.token ? { token: { category: r.token.category, amount: r.token.amountAtomic } } : {}) })), ownerScripts: [...c.ownerScripts].sort() };
    const plan = buildUnsignedPlan({ intent, snapshot: c.snapshot, selectedInputs: c.selectedInputs, changeScript: c.changeScript, feePolicy: c.feePolicy, now });
    if (plan.status !== 'BUILT_OFFLINE') { report.issue = 'REQUEST_PLAN_BUILD_REJECTED'; report.builderIssue = plan.issue; return freeze(report); }
    const intentDigest = validatedIntentDigest(intent);
    if (!plan.planDigest || plan.intentDigest !== intentDigest || plan.guard?.status !== 'MATCH_OFFLINE' || plan.guard.intentDigest !== intentDigest || !plan.unsignedHex) throw Error('REQUEST_PLAN_BINDING_FAILED');
    const planningPolicyDigest = binToHex(sha256.hash(new TextEncoder().encode('intentguard/request-planning-policy/v1\0' + JSON.stringify({ ownerScripts: intent.ownerScripts, changeScript: c.changeScript, feePolicy: c.feePolicy }))));
    const bound = { schemaVersion: 1 as const, kind: 'intentguard-offline-request-plan' as const, requestId: d.request.requestId, requestDigest: d.requestDigest, intentDigest, planDigest: plan.planDigest, planningPolicyDigest };
    const requestPlanDigest = binToHex(sha256.hash(new TextEncoder().encode('intentguard/request-plan/v1\0' + JSON.stringify(bound))));
    report.status = 'REQUEST_PLAN_BOUND_OFFLINE'; report.draft = d; report.intent = intent; report.plan = plan; report.binding = { ...bound, requestPlanDigest }; return freeze(report);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    report.issue = ['REQUEST_PLAN_CONTEXT_REQUIRED', 'REQUEST_PLAN_INVALID_CONTEXT', 'REQUEST_PLAN_REVIEW_DIGEST_REQUIRED', 'REQUEST_PLAN_REVIEW_CHANGED', 'REQUEST_PLAN_BINDING_FAILED'].includes(code) ? code : 'REQUEST_PLAN_INVALID_CONTEXT';
    return freeze(report);
  }
}
