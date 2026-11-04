/** Pure Node-only XO template compilation diagnostic. No Invitation is created,
 * accepted or authenticated. Offline funding claims remain unauthenticated. */
import { binToHex, decodeTransaction, hexToBin, sha256, type Output } from '@bitauth/libauth';
import { completeMergedOutput, buildInvitationTransactionFromMergedCommit, type MergedInvitation } from '@xo-cash/engine';
import { p2pkhTemplate } from '@xo-cash/templates';
import { generateTemplateIdentifier, parseTemplate } from '@xo-cash/utils';
import type { XOInvitationVariable } from '@xo-cash/types';
import { buildPaymentRequestPlan, type OfflineRequestPlanContext, type DeepReadonly } from './request-plan.js';
import type { UnsignedBuildResult } from './unsigned-builder.js';
import { verifyCandidate, type GuardReport, type GuardInput, type ExpectedOutput, type PaymentIntent } from './guard.js';

export const XO_P2PKH_TEMPLATE_IDENTIFIER = 'a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672';
export interface XoCandidateBinding {
  requestPlanDigest: string; contextDigest: string; templateIdentifier: string;
  actionIdentifier: 'sendSatoshis' | 'sendFungibleTokens'; candidateDigest: string; candidateBindingDigest: string;
}
interface XoCandidateReport {
  status: 'EXACT_MATCH_OFFLINE' | 'REJECTED'; issue: string | null; builderIssue: string | null;
  canSign: false; broadcastable: false; receiptValid: false; networkVerified: false; ownershipVerified: false;
  guard: GuardReport | null; outputSummary: UnsignedBuildResult['outputSummary'];
  feeSatoshis: string | null; candidateBytes: number | null; estimatedSignedBytes: UnsignedBuildResult['estimatedSignedBytes'];
  upstreamFeeEstimateSatoshis: string | null;
  exactBytesMatch: boolean; binding: XoCandidateBinding | null;
  capabilities: readonly string[]; limitations: readonly string[];
}
export type XoCandidateResult = DeepReadonly<XoCandidateReport>;
const CAPABILITIES = ['Single P2PKH BCH recipient or single fungible-token recipient.', 'Pinned official XO template resolves recipient script, BCH amount or fungible category/amount from request variables.', 'Independent planner supplies selected inputs, change and conservative fee budget.', 'Raw XO bytes are independently decoded by Guard and compared byte-for-byte to the plan.'] as const;
const LIMITATIONS = ['Offline compilation diagnostic only; no accepted or authenticated Invitation, novel template, wallet or network operation.', 'All parent bytes, unspent observations, owner scripts and fee assumptions are caller-supplied offline claims, not authenticated evidence.', 'Request digest equality is content binding, not proof of human consent or spending authorization.', 'The engine count-only fee estimate is not used; independent actual fees and conservative signed-size policy govern the plan.', 'No keys, signatures, input discovery, reservations, signing, broadcast, receipts or live spendability checks.'] as const;
const digest = (domain: string, value: unknown): string => binToHex(sha256.hash(new TextEncoder().encode(domain + '\0' + JSON.stringify(value))));
function freeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value as DeepReadonly<T>;
}
const output = (o: ExpectedOutput): Output => ({ lockingBytecode: hexToBin(o.script), valueSatoshis: BigInt(o.satoshis), ...(o.token ? { token: { category: hexToBin(o.token.category), amount: BigInt(o.token.amount) } } : {}) });
/** Low-level comparison, not an authority API. This never accepts an imported
 * verdict and always invokes Guard on raw bytes. Also used by adversarial tests. */
export function compareXoCandidateBytes(input: GuardInput, expectedHex: string): { guard: GuardReport; exactBytesMatch: boolean } {
  return { guard: verifyCandidate(input), exactBytesMatch: input.candidateHex === expectedHex };
}
/** now must be supplied by trusted application invocation, never imported JSON. */
export function buildXoTemplateCandidate(request: unknown, expectedRequestDigest: string, context: unknown, now: number = Date.now()): XoCandidateResult {
  const report: XoCandidateReport = { status: 'REJECTED', issue: null, builderIssue: null, canSign: false, broadcastable: false, receiptValid: false, networkVerified: false, ownershipVerified: false, guard: null, outputSummary: [], feeSatoshis: null, candidateBytes: null, estimatedSignedBytes: null, upstreamFeeEstimateSatoshis: null, exactBytesMatch: false, binding: null, capabilities: CAPABILITIES, limitations: LIMITATIONS };
  try {
    const requestPlan = buildPaymentRequestPlan(request, expectedRequestDigest, context, now);
    if (requestPlan.status !== 'REQUEST_PLAN_BOUND_OFFLINE') { report.issue = requestPlan.issue; report.builderIssue = requestPlan.builderIssue; return freeze(report); }
    if (!requestPlan.intent || !requestPlan.plan?.unsignedHex || !requestPlan.binding) throw Error('XO_PLAN_BINDING_FAILED');
    if (requestPlan.intent.recipients.length !== 1) throw Error('XO_SINGLE_RECIPIENT_REQUIRED');
    // Success above validates every own data property and copies the complete
    // context. No asynchronous gap or user callback occurs before this copy.
    const c = structuredClone(context) as OfflineRequestPlanContext;
    const intent: PaymentIntent = { ...requestPlan.intent, recipients: requestPlan.intent.recipients.map(r => ({ ...r, ...(r.token ? { token: { ...r.token } } : {}) })), ownerScripts: [...requestPlan.intent.ownerScripts] };
    const plan = requestPlan.plan;
    const transaction = decodeTransaction(hexToBin(requestPlan.plan.unsignedHex));
    if (typeof transaction === 'string' || transaction.inputs.some(i => i.unlockingBytecode.length !== 0)) throw Error('XO_PLAN_BINDING_FAILED');
    const template = parseTemplate(JSON.stringify(p2pkhTemplate));
    if (generateTemplateIdentifier(template) !== XO_P2PKH_TEMPLATE_IDENTIFIER) throw Error('XO_TEMPLATE_IDENTITY_MISMATCH');
    const recipient = intent.recipients[0]!;
    const actionIdentifier: XoCandidateBinding['actionIdentifier'] = recipient.token ? 'sendFungibleTokens' : 'sendSatoshis';
    const variables: XOInvitationVariable[] = [{ variableIdentifier: 'recipientLockingscript', value: recipient.script }, ...(recipient.token ? [{ variableIdentifier: 'transferredTokenCategory', value: recipient.token.category }, { variableIdentifier: 'transferredTokenAmount', value: BigInt(recipient.token.amount) }] : [{ variableIdentifier: 'transferredSatoshis', value: BigInt(recipient.satoshis) }])];
    // An explicitly local provenance label, NOT an actual signed commit ID.
    // No XOInvitation, unsigned commit, entity or random identity is fabricated.
    const sourceCommitIdentifier = 'offline-diagnostic:' + requestPlan.binding.requestPlanDigest;
    const compiledRecipient = completeMergedOutput({ outputIdentifier: recipient.token ? 'transferFungibleTokensOutput' : 'transferSatoshisOutput', ...(recipient.token ? { valueSatoshis: BigInt(recipient.satoshis) } : {}), sourceCommitIdentifier }, 0, variables, template, actionIdentifier);
    const merged: MergedInvitation = { transactionVersion: transaction.version, transactionLocktime: transaction.locktime, variables,
      inputs: transaction.inputs.map((i, index) => { const source = plan.selectedInputs[index]!.sourceOutput; return { ...i, valueSatoshis: BigInt(source.satoshis), ...(source.token ? { token: { category: hexToBin(source.token.category), amount: BigInt(source.token.amount) } } : {}), sourceCommitIdentifier }; }),
      outputs: [{ ...compiledRecipient, sourceCommitIdentifier }, ...plan.outputSummary.filter(o => o.role !== 'recipient').map(o => ({ ...output(o), sourceCommitIdentifier }))] };
    const built = buildInvitationTransactionFromMergedCommit(merged, template, actionIdentifier);
    const check = compareXoCandidateBytes({ intent, snapshot: c.snapshot, candidateHex: built.serializedTransaction, now }, requestPlan.plan.unsignedHex);
    report.guard = check.guard; report.exactBytesMatch = check.exactBytesMatch;
    if (check.guard.status !== 'MATCH_OFFLINE' || check.guard.intentDigest !== requestPlan.binding.intentDigest || check.guard.feeSatoshis !== plan.feeSatoshis) throw Error('XO_GUARD_REJECTED');
    if (!check.exactBytesMatch) throw Error('XO_EXACT_BYTES_MISMATCH');
    const contextDigest = digest('intentguard/xo-offline-context/v1', { ownerScripts: c.ownerScripts, changeScript: c.changeScript, snapshot: { network: c.snapshot.network, observedAt: c.snapshot.observedAt, parentTransactionHexes: c.snapshot.parentTransactionHexes, unspentOutpoints: c.snapshot.unspentOutpoints }, selectedInputs: c.selectedInputs, feePolicy: c.feePolicy });
    const bound = { requestPlanDigest: requestPlan.binding.requestPlanDigest, contextDigest, templateIdentifier: XO_P2PKH_TEMPLATE_IDENTIFIER, actionIdentifier, candidateDigest: digest('intentguard/xo-candidate-bytes/v1', built.serializedTransaction) };
    report.binding = { ...bound, candidateBindingDigest: digest('intentguard/xo-candidate-binding/v1', bound) };
    report.outputSummary = plan.outputSummary.map(o => ({ ...o, ...(o.token ? { token: { ...o.token } } : {}) }));
    report.feeSatoshis = check.guard.feeSatoshis; report.candidateBytes = built.transactionByteLength; report.estimatedSignedBytes = plan.estimatedSignedBytes ? { ...plan.estimatedSignedBytes } : null;
    report.upstreamFeeEstimateSatoshis = String(built.estimatedFeeSatoshis); report.status = 'EXACT_MATCH_OFFLINE';
    return freeze(report);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    report.issue = ['XO_PLAN_BINDING_FAILED', 'XO_SINGLE_RECIPIENT_REQUIRED', 'XO_TEMPLATE_IDENTITY_MISMATCH', 'XO_GUARD_REJECTED', 'XO_EXACT_BYTES_MISMATCH'].includes(code) ? code : 'XO_COMPILATION_FAILED';
    return freeze(report);
  }
}
