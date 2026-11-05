/** Offline-only finite pre-funded, fixed-beneficiary, block-delayed tranches.
 * No Engine instance, keys, signatures, accounts, networking, or funding export. */
import type { XOTemplate } from '@xo-cash/types';
import { parseTemplate, generateTemplateIdentifier } from '@xo-cash/utils';

export const SYNTHETIC_BENEFICIARY = '76a914' + '22'.repeat(20) + '88ac';
export const FEE_SATOSHIS = 1000n;
export interface Parameters { payoutSatoshis: string; delayBlocks: number }
export const AUTHORITY = Object.freeze({ canSign: false, broadcastable: false, networkVerified: false, ownershipVerified: false, receiptValid: false, liveSpendabilityVerified: false, fundingPermitted: false, invitationExecutionVerified: false, chainMaturityVerified: false } as const);
/** Plain own data properties only; this is not a hostile-Proxy sandbox. */
export function parameters(value: unknown): Parameters {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw Error('INVALID_PARAMETERS');
  const d = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).length !== 2 || Object.keys(d).sort().join(',') !== 'delayBlocks,payoutSatoshis' || Object.values(d).some(x => !('value' in x))) throw Error('INVALID_PARAMETERS');
  const payout: unknown = d.payoutSatoshis!.value, delay: unknown = d.delayBlocks!.value;
  if (typeof payout !== 'string' || !/^[1-9][0-9]{0,9}$/.test(payout) || BigInt(payout) < 546n || BigInt(payout) > 1000000000n) throw Error('INVALID_PAYOUT');
  if (typeof delay !== 'number' || !Number.isInteger(delay) || delay < 1 || delay > 65535) throw Error('INVALID_DELAY');
  return { payoutSatoshis: payout, delayBlocks: delay };
}
const noTokens = (i: number, side: 'UTXO' | 'OUTPUT') => `<${i}> OP_${side}TOKENCATEGORY OP_SIZE <0> OP_NUMEQUALVERIFY OP_DROP
<${i}> OP_${side}TOKENAMOUNT <0> OP_NUMEQUALVERIFY
<${i}> OP_${side}TOKENCOMMITMENT OP_SIZE <0> OP_NUMEQUALVERIFY OP_DROP`;

export function createTrancheTemplate(value: unknown): { template: XOTemplate; templateIdentifier: string; parameters: Parameters } {
  const p = parameters(value), payout = BigInt(p.payoutSatoshis), reserve = payout + FEE_SATOSHIS;
  // These are actual executable CashASM invariants, not XO UI conditions.
  const covenant = `OP_INPUTINDEX <0> OP_NUMEQUALVERIFY
OP_TXINPUTCOUNT <1> OP_NUMEQUALVERIFY
OP_TXVERSION <2> OP_NUMEQUALVERIFY
OP_TXLOCKTIME <0> OP_NUMEQUALVERIFY
<${p.delayBlocks}> OP_CHECKSEQUENCEVERIFY OP_DROP
<0> OP_INPUTSEQUENCENUMBER <${p.delayBlocks}> OP_NUMEQUALVERIFY
${noTokens(0, 'UTXO')}
<0> OP_UTXOVALUE <${reserve}> OP_MOD <0> OP_NUMEQUALVERIFY
<0> OP_UTXOVALUE <${reserve}> OP_DIV <1> <101> OP_WITHIN OP_VERIFY
<0> OP_UTXOVALUE <${reserve}> OP_GREATERTHAN
OP_IF
  OP_TXOUTPUTCOUNT <2> OP_NUMEQUALVERIFY
  <0> OP_OUTPUTVALUE <0> OP_UTXOVALUE <${reserve}> OP_SUB OP_NUMEQUALVERIFY
  <0> OP_OUTPUTBYTECODE <0> OP_UTXOBYTECODE OP_EQUALVERIFY
  ${noTokens(0, 'OUTPUT')}
  ${noTokens(1, 'OUTPUT')}
  <1> OP_OUTPUTVALUE <${payout}> OP_NUMEQUALVERIFY
  <1> OP_OUTPUTBYTECODE <0x${SYNTHETIC_BENEFICIARY}> OP_EQUALVERIFY
OP_ELSE
  OP_TXOUTPUTCOUNT <1> OP_NUMEQUALVERIFY
  ${noTokens(0, 'OUTPUT')}
  <0> OP_OUTPUTVALUE <${payout}> OP_NUMEQUALVERIFY
  <0> OP_OUTPUTBYTECODE <0x${SYNTHETIC_BENEFICIARY}> OP_EQUALVERIFY
OP_ENDIF
OP_1`;
  const view = (name: string) => ({ name, description: name });
  const template: XOTemplate = {
    $schema: 'https://libauth.org/schemas/wallet-template-v0.schema.json', ...view('Offline finite fixed-beneficiary tranches'), version: '1', supported: ['BCH_2026_05'], roles: { relay: view('Permissionless relay, no signing authority') }, start: [{ action: 'continue', role: 'relay' }, { action: 'final', role: 'relay' }],
    actions: { continue: { ...view('Continue'), transaction: 'continue', requirements: { variables: ['reserveSatoshis'], participants: [{ role: 'relay', slots: { min: 1, max: 1 } }] } }, final: { ...view('Final'), transaction: 'final', requirements: { variables: ['reserveSatoshis'], participants: [{ role: 'relay', slots: { min: 1, max: 1 } }] } } },
    transactions: {
      continue: { ...view('Continue'), version: 2, locktime: 0, composable: false, inputs: [{ input: 'coin', inputIndex: 0 }], outputs: [{ output: 'reserve', outputIndex: 0 }, { output: 'payout', outputIndex: 1 }] },
      final: { ...view('Final'), version: 2, locktime: 0, composable: false, inputs: [{ input: 'coin', inputIndex: 0 }], outputs: [{ output: 'payout', outputIndex: 0 }] }
    },
    inputs: { coin: { ...view('Synthetic covenant coin'), valueSatoshis: '$(<reserveSatoshis>)', token: null, sequenceNumber: p.delayBlocks, unlockingScript: 'release' } },
    outputs: { reserve: { ...view('Remaining reserve'), lockingScript: 'tranche', valueSatoshis: `$(<reserveSatoshis> <${reserve}> OP_SUB)`, token: null, actions: [{ action: 'continue', role: 'relay' }, { action: 'final', role: 'relay' }] }, payout: { ...view('Synthetic fixed beneficiary'), lockingScript: 'beneficiary', valueSatoshis: payout.toString(), token: null } },
    lockingScripts: { tranche: { ...view('Finite tranche covenant'), lockingType: 'p2sh', lockingBytecode: 'covenant', unlockingBytecode: 'release', selectable: false, actions: [{ action: 'continue', role: 'relay' }, { action: 'final', role: 'relay' }] }, beneficiary: { ...view('Synthetic beneficiary only'), lockingType: 'p2s', lockingBytecode: 'beneficiaryScript' } }, variables: { reserveSatoshis: { ...view('Untrusted source value; covenant independently checks it'), type: 'satoshis' } }, scripts: { release: '<covenant>', covenant, beneficiaryScript: `0x${SYNTHETIC_BENEFICIARY}` }
  };
  const parsed = parseTemplate(JSON.stringify(template));
  return { template: parsed, templateIdentifier: generateTemplateIdentifier(parsed), parameters: Object.freeze(p) };
}
