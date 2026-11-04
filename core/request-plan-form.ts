/** Form parsing for explicitly supplied OFFLINE funding claims. No discovery or proof. */
import { binToHex, cashAddressToLockingBytecode, decodeCashAddress, decodeTransaction, encodeTransaction, hashTransaction, hexToBin } from '@bitauth/libauth';
import type { OfflineRequestPlanContext, RequestPlanResult } from './request-plan.js';
export interface OfflineFundingFields {
  ownerAddress: string; changeAddress: string; parentHex: string; outputIndex: string;
  observedAtUtc: string; targetRate: string; maxRate: string; signatureModel: string; allowDustToFee: boolean;
}
export function parseUtcSecond(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) throw Error('FORM_UTC_REQUIRED');
  const n = Date.parse(value); if (!Number.isFinite(n) || new Date(n).toISOString().replace('.000Z', 'Z') !== value) throw Error('FORM_UTC_INVALID'); return n;
}
function script(address: string, network: 'mainnet' | 'chipnet'): string {
  if (typeof address !== 'string' || address.length > 120 || (address !== address.toLowerCase() && address !== address.toUpperCase())) throw Error('FORM_FUNDING_ADDRESS');
  const decoded = decodeCashAddress(address);
  if (typeof decoded === 'string' || decoded.prefix !== (network === 'mainnet' ? 'bitcoincash' : 'bchtest') || !['p2pkh', 'p2pkhWithTokens'].includes(decoded.type) || decoded.payload.length !== 20) throw Error('FORM_FUNDING_ADDRESS');
  const converted = cashAddressToLockingBytecode(address); if (typeof converted === 'string') throw Error('FORM_FUNDING_ADDRESS'); return binToHex(converted.bytecode);
}
/** One selected output from one full parent. User-entered addresses, source bytes,
 * observation time and asserted unspent state remain unverified offline data.
 */
export function contextFromFundingFields(fields: OfflineFundingFields, network: 'mainnet' | 'chipnet'): OfflineRequestPlanContext {
  const owner = script(fields.ownerAddress, network), change = script(fields.changeAddress, network);
  if (change !== owner) throw Error('FORM_CHANGE_OWNER_MISMATCH');
  if (!/^(0|[1-9][0-9]{0,9})$/.test(fields.outputIndex) || BigInt(fields.outputIndex) > 0xffffffffn) throw Error('FORM_OUTPUT_INDEX');
  const raw = fields.parentHex;
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 200000 || !/^(?:[0-9a-f]{2})+$/.test(raw)) throw Error('FORM_PARENT_HEX');
  const tx = decodeTransaction(hexToBin(raw)); if (typeof tx === 'string' || binToHex(encodeTransaction(tx)) !== raw) throw Error('FORM_PARENT_HEX');
  const index = Number(fields.outputIndex); const prevout = tx.outputs[index]; if (!prevout) throw Error('FORM_OUTPUT_MISSING');
  if (binToHex(prevout.lockingBytecode) !== owner) throw Error('FORM_INPUT_OWNER_MISMATCH');
  if (prevout.token?.nft) throw Error('FORM_NFT_UNSUPPORTED');
  if (fields.signatureModel !== 'compressed-p2pkh-schnorr' && fields.signatureModel !== 'compressed-p2pkh-low-s-ecdsa') throw Error('FORM_SIGNATURE_MODEL');
  const id = hashTransaction(hexToBin(raw));
  return { ownerScripts: [owner], changeScript: change, snapshot: { network, observedAt: parseUtcSecond(fields.observedAtUtc), parentTransactionHexes: [raw], unspentOutpoints: [`${id}:${index}`] }, selectedInputs: [{ txid: id, index }], feePolicy: { targetSatoshisPer1000Bytes: fields.targetRate, maxSatoshisPer1000Bytes: fields.maxRate, signatureModel: fields.signatureModel, allowBchDustToFee: fields.allowDustToFee } };
}
export function requestPlanSummary(r: RequestPlanResult, origin: 'synthetic-example' | 'supplied-offline'): string {
  if (r.status !== 'REQUEST_PLAN_BOUND_OFFLINE' || !r.plan || !r.binding || !r.intent) return 'No valid offline plan.';
  return [origin === 'synthetic-example' ? 'SYNTHETIC EXAMPLE: invented funding, no spendable coins.' : 'SUPPLIED OFFLINE CLAIMS: funding and ownership are not verified.',
    `Request: ${r.binding.requestId}`, `Requested network: ${r.intent.network} (not verified)`,
    ...r.plan.selectedInputs.map((i, n) => `Input ${n + 1}: ${i.txid}:${i.index}; ${i.sourceOutput.satoshis} satoshis; owner script ${i.sourceOutput.script}${i.sourceOutput.token ? `; token ${i.sourceOutput.token.category}; ${i.sourceOutput.token.amount} base units` : ''}`),
    ...r.plan.outputSummary.flatMap(o => [`Output ${o.index} (${o.role}): ${o.satoshis} satoshis`, `Script: ${o.script}`, ...(o.token ? [`Token category: ${o.token.category}`, `Token amount: ${o.token.amount} base units`] : [])]),
    `Transaction fee: ${r.plan.feeSatoshis} satoshis (request cap ${r.intent.maxFeeSatoshis})`,
    `Estimated signed size: ${r.plan.estimatedSignedBytes?.minimum}–${r.plan.estimatedSignedBytes?.maximum} bytes; model ${r.plan.estimatedSignedBytes?.signatureModel}`,
    `Dust remainder added to fee: ${r.plan.donatedRemainderSatoshis} satoshis`,
    `Request digest: ${r.binding.requestDigest}`, `Intent digest: ${r.binding.intentDigest}`, `Plan digest: ${r.binding.planDigest}`, `Planning policy digest: ${r.binding.planningPolicyDigest}`, `Request-plan binding: ${r.binding.requestPlanDigest}`,
    'NOT APPROVED TO PAY. No signing, broadcast, verified ownership, live network or receipt.',
    ...r.limitations].join('\n');
}
