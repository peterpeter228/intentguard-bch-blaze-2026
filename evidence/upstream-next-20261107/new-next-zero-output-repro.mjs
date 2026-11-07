/** 2026-11-07 bounded rerun of the exact November 5 pure reproduction against the new npm next package.
 * Uses synthetic public constants and pure functions. Never creates an Engine,
 * account, Invitation, wallet, key, signature, network request or broadcast.
 * The mutated reference template is a diagnostic fixture, NOT a novel product.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { binToHex, decodeTransaction, hexToBin } from '@bitauth/libauth';
import { completeMergedOutput, buildInvitationTransactionFromMergedCommit } from '../../node_modules/.xo-next-review/dist/index.mjs';
import { p2pkhTemplate } from '@xo-cash/templates';
import { parseTemplate, generateTemplateIdentifier } from '@xo-cash/utils';
import { fixture, merchant } from '../../dist/core/fixtures.js';
import { verifyCandidate } from '../../dist/core/guard.js';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const enginePath = new URL('../../node_modules/.xo-next-review/dist/index.mjs', import.meta.url);
const packagePath = name => new URL('../../node_modules/' + name + '/package.json', import.meta.url);
const versions = Object.fromEntries(['@xo-cash/engine', '@xo-cash/templates', '@xo-cash/utils', '@xo-cash/types'].map(name => [name, JSON.parse(readFileSync(name === '@xo-cash/engine' ? new URL('../../node_modules/.xo-next-review/package.json', import.meta.url) : packagePath(name), 'utf8')).version]));
assert.equal(versions['@xo-cash/engine'], '0.1.1-next.17778370827');
const f = fixture(false);
const marker = 'ab'.repeat(32); // Public test bytes, NOT a hash of an invoice.
const expectedDataScript = '6a20' + marker;
const raw = structuredClone(p2pkhTemplate);
raw.name = 'Synthetic zero-value output diagnostic, not a product';
raw.description = 'Only tests whether pure XO output resolution changes serialization.';
raw.scripts.diagnosticData = 'OP_RETURN <0x' + marker + '>';
raw.lockingScripts.diagnosticData = {
  name: 'Synthetic test data', description: 'Unspendable public constant', icon: 'data',
  lockingType: 'p2s', lockingBytecode: 'diagnosticData', actions: [],
};
raw.outputs.diagnosticDataOutput = {
  name: 'Synthetic zero-value data', description: 'Not invoice functionality', icon: 'data',
  lockingScript: 'diagnosticData', valueSatoshis: '0', token: null,
};
raw.transactions.transferSatoshisTransaction.outputs.push({ output: 'diagnosticDataOutput' });
const template = parseTemplate(JSON.stringify(raw));
const action = 'sendSatoshis';
const sourceCommitIdentifier = 'synthetic-diagnostic-not-an-authenticated-commit';
const variables = [
  { variableIdentifier: 'recipientLockingscript', value: merchant },
  { variableIdentifier: 'transferredSatoshis', value: 1000n },
];
const recipient = completeMergedOutput({ outputIdentifier: 'transferSatoshisOutput', sourceCommitIdentifier }, 0, variables, template, action);
const unresolvedData = { outputIdentifier: 'diagnosticDataOutput', sourceCommitIdentifier };
const resolvedData = completeMergedOutput(unresolvedData, 1, variables, template, action);
assert.equal(resolvedData.valueSatoshis, 0n);
assert.equal(binToHex(resolvedData.lockingBytecode), expectedDataScript);
assert.equal(resolvedData.token, undefined);
const inputs = f.candidate.inputs.map(i => ({ ...i, valueSatoshis: 10000n, sourceCommitIdentifier }));
const change = { ...f.candidate.outputs[1], sourceCommitIdentifier };

function build(outputs) {
  const built = buildInvitationTransactionFromMergedCommit({
    transactionVersion: 2, transactionLocktime: 0, inputs, outputs, variables,
  }, template, action);
  const transaction = decodeTransaction(hexToBin(built.serializedTransaction));
  assert.notEqual(typeof transaction, 'string');
  assert(transaction.inputs.every(i => i.unlockingBytecode.length === 0));
  const guard = verifyCandidate({ ...f.input, candidateHex: built.serializedTransaction });
  return {
    outputs: transaction.outputs.map(o => ({ satoshis: String(o.valueSatoshis), script: binToHex(o.lockingBytecode), hasToken: o.token !== undefined })),
    outputCount: transaction.outputs.length,
    dataOutputCount: transaction.outputs.filter(o => binToHex(o.lockingBytecode) === expectedDataScript).length,
    candidateSha256: hash(Buffer.from(built.serializedTransaction, 'hex')),
    candidateBytes: built.transactionByteLength,
    equalsOriginalPaymentBytes: built.serializedTransaction === f.input.candidateHex,
    guard: { status: guard.status, issues: guard.issues, feeSatoshis: guard.feeSatoshis, canSign: guard.canSign },
  };
}
const unresolvedPath = build([recipient, unresolvedData, change]);
const resolvedPath = build([recipient, resolvedData, change]);
const paymentControl = build([recipient, change]);
assert.equal(unresolvedPath.outputCount, 3);
assert.equal(unresolvedPath.dataOutputCount, 1);
assert.equal(unresolvedPath.guard.status, 'REJECTED');
assert(unresolvedPath.guard.issues.includes('UNSUPPORTED_OUTPUT_SCRIPT'));
assert.equal(resolvedPath.outputCount, 2);
assert.equal(resolvedPath.dataOutputCount, 0);
assert.equal(resolvedPath.guard.status, 'MATCH_OFFLINE');
assert.equal(resolvedPath.equalsOriginalPaymentBytes, true);
assert.deepEqual(resolvedPath, paymentControl);
assert.equal(f.candidate.inputs[0].unlockingBytecode.length, 0);
const result = {
  schema: 'intentguard/new-zero-value-reproduction/v1',
  executedAt: new Date().toISOString(),
  sourceCommit: '61e0895d21ab173a74cf5363a9392d73a3b2314f',
  provenance: 'EXISTING_PURE_REPRODUCTION_REBOUND_TO_NEW_OFFICIAL_NPM_PACKAGE',
  result: 'BLOCKER_REPRODUCED_NOT_FEATURE_SUCCESS',
  versions, engineSha256: hash(readFileSync(enginePath)),
  diagnosticTemplateIdentifier: generateTemplateIdentifier(template),
  markerMeaning: 'Constant public synthetic bytes, not an actual invoice commitment',
  unresolvedPath, resolvedPath, paymentControl,
  normalAccountFlow: 'NOT_EXECUTED: normal-flow implication requires separate source-trace review',
  canSign: false, broadcastable: false, receiptValid: false, networkVerified: false, ownershipVerified: false,
};
console.log(JSON.stringify(result, null, 2));
