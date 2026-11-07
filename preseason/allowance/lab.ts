import { binToHex, createVirtualMachineBch2026, decodeTransaction, encodeDataPush, encodeTransaction, hashTransaction, hexToBin, type Output, type Transaction } from '@bitauth/libauth';
import { buildInvitationTransactionFromMergedCommit, compileLockingBytecodeFromTemplateLockingScriptIdentifier, completeMergedOutput, type MergedInvitation } from '@xo-cash/engine';
import { compileCashAssemblyString } from '@xo-cash/utils';
import { AUTHORITY, createTrancheTemplate, FEE_SATOSHIS } from './template.js';

/** Internal synthetic test harness. Bytes are deliberately not returned by the public report API/CLI. */
export function syntheticCase(value: unknown, tranches: number) {
  if (!Number.isInteger(tranches) || tranches < 1 || tranches > 100) throw Error('INVALID_TRANCHE_COUNT');
  const artifact = createTrancheTemplate(value), { template, parameters } = artifact;
  const lockingBytecode = compileLockingBytecodeFromTemplateLockingScriptIdentifier(template, 'tranche', {});
  if (lockingBytecode.length !== 35 || lockingBytecode[0] !== 0xaa || lockingBytecode[1] !== 32 || lockingBytecode[34] !== 0x87) throw Error('P2SH32_REQUIRED');
  const redeemTemplate = structuredClone(template);
  redeemTemplate.lockingScripts.tranche!.lockingType = 'p2s';
  const redeem = compileLockingBytecodeFromTemplateLockingScriptIdentifier(redeemTemplate, 'tranche', {});
  const reserve = BigInt(parameters.payoutSatoshis) + FEE_SATOSHIS;
  const sourceOutput: Output = { lockingBytecode, valueSatoshis: reserve * BigInt(tranches) };
  const parent: Transaction = { version: 2, locktime: 0, inputs: [{ outpointTransactionHash: new Uint8Array(32).fill(0x55), outpointIndex: 1, unlockingBytecode: new Uint8Array([0]), sequenceNumber: 0xffffffff }], outputs: [sourceOutput] };
  const variables = [{ variableIdentifier: 'reserveSatoshis', value: sourceOutput.valueSatoshis }];
  const release = hexToBin(compileCashAssemblyString({ cashAssemblyText: template.scripts.release!, variables: {}, evaluationDecodeMode: 'hex', templateScripts: template.scripts }));
  if (binToHex(release) !== binToHex(encodeDataPush(redeem))) throw Error('UNLOCKING_SCRIPT_MISMATCH');
  const action = tranches === 1 ? 'final' : 'continue';
  const sourceCommitIdentifier = 'offline-synthetic-tranche-test';
  const outputs = tranches === 1 ? [completeMergedOutput({ outputIdentifier: 'payout', sourceCommitIdentifier }, 0, variables, template, action)] : [completeMergedOutput({ outputIdentifier: 'reserve', sourceCommitIdentifier }, 0, variables, template, action), completeMergedOutput({ outputIdentifier: 'payout', sourceCommitIdentifier }, 1, variables, template, action)];
  const merged: MergedInvitation = { transactionVersion: 2, transactionLocktime: 0, variables: variables.map(v => ({ ...v, sourceCommitIdentifier })), inputs: [{ sourceCommitIdentifier, outpointTransactionHash: hexToBin(hashTransaction(encodeTransaction(parent))), outpointIndex: 0, sequenceNumber: parameters.delayBlocks, unlockingBytecode: release, valueSatoshis: sourceOutput.valueSatoshis }], outputs: outputs.map(o => ({ ...o, sourceCommitIdentifier })) };
  const build = () => buildInvitationTransactionFromMergedCommit(merged, template, action);
  const built = build(), transaction = decodeTransaction(hexToBin(built.serializedTransaction));
  if (typeof transaction === 'string') throw Error('XO_DECODE_FAILED');
  return { ...artifact, parent, sourceOutput, transaction, merged, build, redeem, serializedBytes: built.transactionByteLength };
}
export function verifySynthetic(transaction: Transaction, sourceOutputs: Output[]): true | string {
  return createVirtualMachineBch2026(true).verify({ transaction, sourceOutputs });
}
/** Only binds synthetic parent bytes; not evidence of a live, unspent or aged coin. */
export function verifyParentBoundSynthetic(transaction: Transaction, parent: Transaction): true | string {
  if (transaction.inputs.length !== 1) return 'SYNTHETIC_PARENT_INPUT_COUNT';
  const input = transaction.inputs[0]!;
  if (input.outpointIndex !== 0 || binToHex(input.outpointTransactionHash) !== hashTransaction(encodeTransaction(parent))) return 'SYNTHETIC_PARENT_OUTPOINT_MISMATCH';
  const source = parent.outputs[0];
  if (!source) return 'SYNTHETIC_PARENT_OUTPUT_MISSING';
  return verifySynthetic(transaction, [source]);
}
export function runTrancheLab(value: unknown, tranches: number) {
  const c = syntheticCase(value, tranches);
  const fee = c.sourceOutput.valueSatoshis - c.transaction.outputs.reduce((sum, o) => sum + o.valueSatoshis, 0n);
  const verified = verifyParentBoundSynthetic(c.transaction, c.parent);
  if (verified !== true) throw Error('VM_REJECTED: ' + verified);
  if (fee !== FEE_SATOSHIS || fee < BigInt(c.serializedBytes)) throw Error('LAB_FEE_BASELINE_FAILED');
  return Object.freeze({ status: 'SYNTHETIC_VM_VERIFIED' as const, ...AUTHORITY, templateIdentifier: c.templateIdentifier, tranchesBefore: tranches, tranchesAfter: tranches - 1, payoutSatoshis: c.parameters.payoutSatoshis, delayBlocks: c.parameters.delayBlocks, feeSatoshis: fee.toString(), serializedBytes: c.serializedBytes, outputCount: c.transaction.outputs.length, feeBaseline: '1 sat/actual serialized byte; not a relay guarantee', limits: Object.freeze(['Synthetic source only; no chain age, ownership or chain acceptance proof.', 'Per-UTXO block delay; not a calendar schedule or global allowance.', 'Wrong amounts or token funding may permanently strand funds; no recovery or revocation.', 'Beneficiary and fee are immutable; future fee policy may prevent progress.', 'Normal Invitation execution and actual chain maturity are unverified. Never fund this experimental artifact.']) });
}
