/** Inspect-only synthetic source admission. Never fund this experimental covenant.
 * No keys, signatures, network, wallet, deployment or transaction-byte export.
 * Plain own data properties only; not a hostile-Proxy sandbox. */
import { binToHex, decodeTransaction, encodeTransaction, getDustThreshold, hashTransaction, hexToBin, type Transaction } from '@bitauth/libauth';
import { buildInvitationTransactionFromMergedCommit, compileLockingBytecodeFromTemplateLockingScriptIdentifier, completeMergedOutput, type MergedInvitation } from '@xo-cash/engine';
import { compileCashAssemblyString } from '@xo-cash/utils';
import { AUTHORITY, createTrancheTemplate, FEE_SATOSHIS, parameters } from './template.js';
import { verifySynthetic } from './lab.js';

export const MAX_SYNTHETIC_PARENT_BYTES = 65536;
const LIMITS = Object.freeze([
  'Never fund this experimental artifact. Synthetic inspection is not funding approval.',
  'Input provenance is not authenticated: supplied bytes do not prove a synthetic or real chain transaction.',
  'No parent validity, chain inclusion, unspentness, ownership, actual maturity or relay acceptance is established.',
  'Wrong amounts or tokens at this covenant may permanently strand funds; there is no recovery or revocation.',
  'Inspection cannot prevent unsolicited deposits; immutable beneficiary and fee can prevent future progress.',
  'An inaccessible beneficiary cannot be repaired. Normal authenticated Invitation execution remains unverified.',
  'Parent funding fee, other parent outputs and parent inputs are not validated.',
  'Policy results are local assumptions, not current or future node policy or consensus guarantees.'
]);
type Status = 'INPUT_REJECTED' | 'OUTPUT_MISMATCH' | 'CONTRACT_REJECTED' | 'PLAN_MISMATCH' | 'SIMULATION_REJECTED' | 'LOCAL_POLICY_REJECTED' | 'SYNTHETIC_CONTINUATION_VERIFIED';
interface Metrics {
  tranches: number; verifiedSteps: number; totalSerializedBytes: number; minimumSerializedBytes: number; maximumSerializedBytes: number;
  initialSatoshis: string; totalPaidSatoshis: string; totalFeeSatoshis: string; remainingReserveSatoshis: string;
  feeFailingSteps: number; dustFailingSteps: number; minimumFeeHeadroomSatoshis: string;
  sourceDustThresholdSatoshis: string; sourceBelowDust: boolean;
  maximumPayoutDustThresholdSatoshis: string; maximumReserveDustThresholdSatoshis: string;
}
function report(status: Status, issue: string | null, metrics: Metrics | null = null, policy: { feeSatPerKb: string; dustRelayFeeSatPerKb: string } | null = null) {
  return Object.freeze({ status, ...AUTHORITY, issue, metrics: metrics === null ? null : Object.freeze(metrics), policy: policy === null ? null : Object.freeze(policy), limits: LIMITS });
}
function data(value: unknown, names: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw Error('INVALID_REQUEST');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).length !== names.length || Object.keys(descriptors).sort().join(',') !== [...names].sort().join(',') || Object.values(descriptors).some(d => !('value' in d))) throw Error('INVALID_REQUEST');
  return Object.fromEntries(Object.entries(descriptors).map(([k, d]) => [k, d.value]));
}
function rate(value: unknown): string {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,6}$/.test(value) || BigInt(value) > 1000000n) throw Error('INVALID_POLICY');
  return value;
}
function parse(value: unknown) {
  const d = data(value, ['parentTransactionHex', 'outputIndex', 'parameters', 'plannedTranches', 'policy']);
  if (typeof d.parentTransactionHex !== 'string' || d.parentTransactionHex.length === 0 || d.parentTransactionHex.length > MAX_SYNTHETIC_PARENT_BYTES * 2 || !/^(?:[0-9a-fA-F]{2})+$/.test(d.parentTransactionHex)) throw Error('INVALID_PARENT_ENCODING');
  if (typeof d.outputIndex !== 'number' || !Number.isSafeInteger(d.outputIndex) || d.outputIndex < 0 || d.outputIndex > 0xffffffff || Object.is(d.outputIndex, -0)) throw Error('INVALID_OUTPUT_INDEX');
  if (typeof d.plannedTranches !== 'number' || !Number.isInteger(d.plannedTranches) || d.plannedTranches < 1 || d.plannedTranches > 100) throw Error('INVALID_PLANNED_TRANCHES');
  const p = parameters(d.parameters), policy = data(d.policy, ['feeSatPerKb', 'dustRelayFeeSatPerKb']);
  return { parentTransactionHex: d.parentTransactionHex, outputIndex: d.outputIndex, parameters: p, plannedTranches: d.plannedTranches, policy: { feeSatPerKb: rate(policy.feeSatPerKb), dustRelayFeeSatPerKb: rate(policy.dustRelayFeeSatPerKb) } };
}
/** Bounded pure diagnostic. Caller-supplied bytes never establish funding authority. */
export function inspectSyntheticFunding(value: unknown) {
  try { return inspect(value); } catch { return report('SIMULATION_REJECTED', 'LOCAL_INSPECTION_FAILED'); }
}
function inspect(value: unknown) {
  let request: ReturnType<typeof parse>;
  try { request = parse(value); } catch { return report('INPUT_REJECTED', 'INVALID_REQUEST'); }
  const parent = decodeTransaction(hexToBin(request.parentTransactionHex));
  if (typeof parent === 'string' || binToHex(encodeTransaction(parent)) !== request.parentTransactionHex.toLowerCase()) return report('INPUT_REJECTED', 'INVALID_OR_NONCANONICAL_PARENT');
  const selected = parent.outputs[request.outputIndex];
  if (!selected) return report('INPUT_REJECTED', 'OUTPUT_INDEX_MISSING');
  const artifact = createTrancheTemplate(request.parameters), { template } = artifact;
  const expectedScript = compileLockingBytecodeFromTemplateLockingScriptIdentifier(template, 'tranche', {});
  if (binToHex(selected.lockingBytecode) !== binToHex(expectedScript)) return report('OUTPUT_MISMATCH', 'EXPECTED_COVENANT_NOT_PRESENT');
  if (selected.token !== undefined) return report('CONTRACT_REJECTED', 'TOKEN_FUNDING_HAS_NO_RELEASE_PATH');
  const reserve = BigInt(request.parameters.payoutSatoshis) + FEE_SATOSHIS;
  if (selected.valueSatoshis % reserve !== 0n || selected.valueSatoshis < reserve || selected.valueSatoshis / reserve > 100n) return report('CONTRACT_REJECTED', 'AMOUNT_HAS_NO_RELEASE_PATH');
  const count = Number(selected.valueSatoshis / reserve);
  if (count !== request.plannedTranches) return report('PLAN_MISMATCH', 'ACTUAL_TRANCHES_DIFFER_FROM_PLAN');
  const release = hexToBin(compileCashAssemblyString({ cashAssemblyText: template.scripts.release!, variables: {}, evaluationDecodeMode: 'hex', templateScripts: template.scripts }));
  let previous: Transaction = parent, index = request.outputIndex;
  let paid = 0n, fees = 0n, totalBytes = 0, minBytes = Infinity, maxBytes = 0, feeFailures = 0, dustFailures = 0;
  let minHeadroom: bigint | undefined, payoutDust = 0n, reserveDust = 0n;
  for (let remaining = count; remaining >= 1; remaining--) {
    const source = previous.outputs[index]!;
    const action = remaining === 1 ? 'final' : 'continue';
    const variables = [{ variableIdentifier: 'reserveSatoshis', value: source.valueSatoshis }];
    const sourceCommitIdentifier = 'offline-synthetic-funding-inspection';
    const ids = remaining === 1 ? ['payout'] : ['reserve', 'payout'];
    const outputs = ids.map((outputIdentifier, outputIndex) => ({ ...completeMergedOutput({ outputIdentifier, sourceCommitIdentifier }, outputIndex, variables, template, action), sourceCommitIdentifier }));
    const parentHash = hashTransaction(encodeTransaction(previous));
    const merged: MergedInvitation = { transactionVersion: 2, transactionLocktime: 0, variables: variables.map(v => ({ ...v, sourceCommitIdentifier })), inputs: [{ sourceCommitIdentifier, outpointTransactionHash: hexToBin(parentHash), outpointIndex: index, sequenceNumber: request.parameters.delayBlocks, unlockingBytecode: release, valueSatoshis: source.valueSatoshis }], outputs };
    const built = buildInvitationTransactionFromMergedCommit(merged, template, action);
    const tx = decodeTransaction(hexToBin(built.serializedTransaction));
    if (typeof tx === 'string' || tx.inputs.length !== 1 || tx.inputs[0]!.outpointIndex !== index || binToHex(tx.inputs[0]!.outpointTransactionHash) !== parentHash || verifySynthetic(tx, [previous.outputs[index]!]) !== true) return report('SIMULATION_REJECTED', 'PARENT_BOUND_VM_REJECTED');
    const bytes = encodeTransaction(tx).length;
    const fee = source.valueSatoshis - tx.outputs.reduce((sum, o) => sum + o.valueSatoshis, 0n);
    if (fee !== FEE_SATOSHIS || bytes !== built.transactionByteLength || tx.outputs.length !== ids.length) return report('SIMULATION_REJECTED', 'EXACT_ACCOUNTING_FAILED');
    const headroom = fee - (BigInt(bytes) * BigInt(request.policy.feeSatPerKb) + 999n) / 1000n;
    if (headroom < 0n) feeFailures++;
    minHeadroom = minHeadroom === undefined || headroom < minHeadroom ? headroom : minHeadroom;
    let hasDust = false;
    for (let i = 0; i < tx.outputs.length; i++) {
      const output = tx.outputs[i]!, threshold = getDustThreshold(output, BigInt(request.policy.dustRelayFeeSatPerKb));
      if (output.valueSatoshis < threshold) hasDust = true;
      if (i === tx.outputs.length - 1) payoutDust = threshold > payoutDust ? threshold : payoutDust;
      else reserveDust = threshold > reserveDust ? threshold : reserveDust;
    }
    if (hasDust) dustFailures++;
    paid += tx.outputs.at(-1)!.valueSatoshis; fees += fee; totalBytes += bytes; minBytes = Math.min(minBytes, bytes); maxBytes = Math.max(maxBytes, bytes);
    previous = tx; index = 0;
  }
  if (paid !== BigInt(count) * BigInt(request.parameters.payoutSatoshis) || paid + fees !== selected.valueSatoshis || previous.outputs.length !== 1) return report('SIMULATION_REJECTED', 'TERMINAL_ACCOUNTING_FAILED');
  const sourceDustThreshold = getDustThreshold(selected, BigInt(request.policy.dustRelayFeeSatPerKb));
  const sourceBelowDust = selected.valueSatoshis < sourceDustThreshold;
  const metrics: Metrics = { sourceDustThresholdSatoshis: sourceDustThreshold.toString(), sourceBelowDust, tranches: count, verifiedSteps: count, totalSerializedBytes: totalBytes, minimumSerializedBytes: minBytes, maximumSerializedBytes: maxBytes, initialSatoshis: selected.valueSatoshis.toString(), totalPaidSatoshis: paid.toString(), totalFeeSatoshis: fees.toString(), remainingReserveSatoshis: '0', feeFailingSteps: feeFailures, dustFailingSteps: dustFailures, minimumFeeHeadroomSatoshis: minHeadroom!.toString(), maximumPayoutDustThresholdSatoshis: payoutDust.toString(), maximumReserveDustThresholdSatoshis: reserveDust.toString() };
  return report(feeFailures || dustFailures || sourceBelowDust ? 'LOCAL_POLICY_REJECTED' : 'SYNTHETIC_CONTINUATION_VERIFIED', feeFailures || dustFailures || sourceBelowDust ? 'DECLARED_LOCAL_POLICY_FAILED' : null, metrics, request.policy);
}
