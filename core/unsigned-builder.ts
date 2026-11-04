/**
 * Deterministic OFFLINE unsigned P2PKH plan, never a signer or transaction sender.
 * Explicit selected outpoints only: this module does not select coins, fetch data,
 * authenticate ownership/unspent claims, reserve UTXOs, or consume spending consent.
 * All inputs retain EMPTY unlocking bytecode. No dummy signatures are generated.
 *
 * Order: txid string then numeric index; exact intent recipient order; fungible
 * change by category string; optional BCH change last. This is not a BIP69 claim.
 * No NFTs, minting, burns, undeclared categories or non-P2PKH scripts are supported.
 *
 * Fee rates are integer satoshis per 1000 serialized bytes, NOT sat/vbyte. Budget
 * uses ceil(rate * MAX declared signed bytes / 1000). Absolute intent cap and rate
 * cap (checked against MIN declared bytes) apply to the FINAL fee, including any
 * explicitly allowed remainder donation strictly below plain-output dust. Rates are application inputs, not
 * live relay quotes. The supported application range is 1..1000000 sat/1000 bytes.
 * Dust uses the existing Guard's fixed 1000 sat/1000-byte policy and full libauth
 * output serialization; it is distinct from the selected transaction fee rate.
 *
 * Compressed-key/minimal-push assumptions: Schnorr unlock=100 bytes (64-byte raw
 * signature + sighash + pushes + 33-byte key); strict-DER/low-S ECDSA unlock=44..107
 * bytes (raw DER=8..71, plus sighash/pushes/key). The minimum is a conservative
 * theoretical bound, NOT a typical estimate. Final signed bytes/signatures/rate
 * must be independently revalidated; these bounds do not authorize signing.
 */
import { binToHex, hexToBin, decodeTransaction, encodeTransaction, hashTransaction, sha256, getDustThreshold, type Transaction, type Output } from '@bitauth/libauth';
import { validatedIntentDigest, verifyCandidate, type PaymentIntent, type EvidenceSnapshot, type ExpectedOutput, type GuardReport } from './guard.js';

export type SignatureSizeModel = 'compressed-p2pkh-schnorr' | 'compressed-p2pkh-low-s-ecdsa';
export interface UnsignedFeePolicy {
  targetSatoshisPer1000Bytes: string; maxSatoshisPer1000Bytes: string;
  signatureModel: SignatureSizeModel; allowBchDustToFee: boolean;
}
export interface SelectedOutpoint { txid: string; index: number; }
export interface UnsignedBuildInput {
  intent: PaymentIntent; snapshot: EvidenceSnapshot; selectedInputs: readonly SelectedOutpoint[];
  changeScript: string; now: number; feePolicy: UnsignedFeePolicy;
}
export interface UnsignedBuildResult {
  status: 'BUILT_OFFLINE' | 'REJECTED'; canSign: false; broadcastable: false; receiptValid: false;
  issue: string | null; unsignedHex: string | null; intentDigest: string | null; planDigest: string | null;
  outputSummary: (ExpectedOutput & { index: number; role: 'recipient' | 'token-change' | 'bch-change' })[];
  feeRateBounds: { unit: 'satoshis-per-1000-bytes'; minimum: { numerator: string; denominator: string }; maximum: { numerator: string; denominator: string } } | null;
  feeSatoshis: string | null; budgetFeeSatoshis: string | null; donatedRemainderSatoshis: string | null;
  estimatedSignedBytes: { minimum: number; maximum: number; signatureModel: SignatureSizeModel } | null;
  selectedInputs: (SelectedOutpoint & { sourceOutput: ExpectedOutput })[];
  guard: GuardReport | null; limitations: readonly string[];
}
const MAX_MONEY = 2100000000000000n, TOKEN_MAX = 9223372036854775807n;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function keys(v: unknown, required: readonly string[], optional: readonly string[] = []): asserts v is Record<string, unknown> {
  if (!isObject(v) || required.some(k => !Object.hasOwn(v, k)) || Object.keys(v).some(k => !required.includes(k) && !optional.includes(k))) throw Error('INVALID_BUILD_SCHEMA');
}
const p2pkh = (v: unknown): v is string => typeof v === 'string' && /^76a914[0-9a-f]{40}88ac$/.test(v);
const hex64 = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const time = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
function integer(v: unknown, max: bigint): bigint { if (typeof v !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(v)) throw Error('INVALID_INTEGER'); const n = BigInt(v); if (n > max) throw Error('AMOUNT_RANGE'); return n; }
function decode(raw: unknown): Transaction {
  if (typeof raw !== 'string' || raw.length > 200000 || !/^([0-9a-f]{2})+$/.test(raw)) throw Error('INVALID_PARENT');
  const tx = decodeTransaction(hexToBin(raw)); if (typeof tx === 'string' || binToHex(encodeTransaction(tx)) !== raw) throw Error('INVALID_PARENT'); return tx;
}
function expected(o: Output): ExpectedOutput { return { script: binToHex(o.lockingBytecode), satoshis: o.valueSatoshis.toString(), ...(o.token ? { token: { category: binToHex(o.token.category), amount: o.token.amount.toString() } } : {}) }; }
function output(o: ExpectedOutput): Output { return { lockingBytecode: hexToBin(o.script), valueSatoshis: BigInt(o.satoshis), ...(o.token ? { token: { category: hexToBin(o.token.category), amount: BigInt(o.token.amount) } } : {}) }; }
function sizes(tx: Transaction, model: SignatureSizeModel): { minimum: number; maximum: number; signatureModel: SignatureSizeModel } {
  // Supported unlock lengths remain below CompactSize's 253-byte boundary. The
  // real unsigned encoding already includes every count and token-prefix byte.
  const unsigned = encodeTransaction(tx).length;
  return { minimum: unsigned + tx.inputs.length * (model === 'compressed-p2pkh-schnorr' ? 100 : 44), maximum: unsigned + tx.inputs.length * (model === 'compressed-p2pkh-schnorr' ? 100 : 107), signatureModel: model };
}
const feeBudget = (bytes: number, rate: bigint): bigint => (BigInt(bytes) * rate + 999n) / 1000n;
const ERRORS = new Set(['INVALID_BUILD_SCHEMA', 'INVALID_INTEGER', 'AMOUNT_RANGE', 'INVALID_PARENT', 'INVALID_INTENT', 'INVALID_RECIPIENT', 'INVALID_TOKEN', 'AMBIGUOUS_RECIPIENT_CHANGE', 'INVALID_CLOCK', 'INTENT_EXPIRED', 'INVALID_FEE_POLICY', 'INVALID_CHANGE_SCRIPT', 'INVALID_SELECTION', 'DUPLICATE_INPUT', 'DUPLICATE_PARENT', 'INVALID_SNAPSHOT', 'STALE_OR_INVALID_SNAPSHOT', 'NETWORK_MISMATCH', 'MISSING_OR_SPENT_PREVOUT', 'UNCONFIRMED_INPUT_OWNER', 'NFT_UNSUPPORTED', 'UNDECLARED_TOKEN', 'DUST_RECIPIENT', 'INSUFFICIENT_TOKEN', 'INSUFFICIENT_BCH', 'BCH_CHANGE_REQUIRES_DONATION', 'BCH_REMAINDER_NOT_DUST', 'FEE_LIMIT', 'FEE_RATE_LIMIT', 'GUARD_RECOMPARE_FAILED', 'PLAN_SIZE_LIMIT']);

export function buildUnsignedPlan(input: UnsignedBuildInput): UnsignedBuildResult {
  const r: UnsignedBuildResult = { status: 'REJECTED', canSign: false, broadcastable: false, receiptValid: false, issue: null, unsignedHex: null, intentDigest: null, planDigest: null, outputSummary: [], feeRateBounds: null, feeSatoshis: null, budgetFeeSatoshis: null, donatedRemainderSatoshis: null, estimatedSignedBytes: null, selectedInputs: [], guard: null, limitations: [
    'Offline construction only; supplied ownership, network and unspent claims are not authenticated.',
    'The unsigned hash is not a final transaction ID; no wallet, signatures, consensus or relay acceptance was tested.',
    'Signed-size bounds assume the declared compressed-key P2PKH model and minimal pushes; independently revalidate final signed bytes and fees.',
    'Dust uses a fixed 1000 sat/1000-byte application baseline; fee rates are explicit policy, not a live network quote.'
  ] };
  try {
    keys(input, ['intent', 'snapshot', 'selectedInputs', 'changeScript', 'now', 'feePolicy']);
    keys(input.intent, ['network', 'expiresAt', 'maxFeeSatoshis', 'recipients', 'ownerScripts']);
    if (!Array.isArray(input.intent.recipients) || input.intent.recipients.length < 1 || input.intent.recipients.length > 20) throw Error('INVALID_INTENT');
    for (const recipient of input.intent.recipients) { keys(recipient, ['script', 'satoshis'], ['token']); if (Object.hasOwn(recipient, 'token')) keys(recipient.token, ['category', 'amount']); }
    r.intentDigest = validatedIntentDigest(input.intent);
    if (!time(input.now)) throw Error('INVALID_CLOCK'); if (input.now >= input.intent.expiresAt) throw Error('INTENT_EXPIRED');
    keys(input.feePolicy, ['targetSatoshisPer1000Bytes', 'maxSatoshisPer1000Bytes', 'signatureModel', 'allowBchDustToFee']);
    const policy = input.feePolicy, targetRate = integer(policy.targetSatoshisPer1000Bytes, 1000000n), maxRate = integer(policy.maxSatoshisPer1000Bytes, 1000000n);
    if (targetRate <= 0n || maxRate < targetRate || !['compressed-p2pkh-schnorr', 'compressed-p2pkh-low-s-ecdsa'].includes(policy.signatureModel) || typeof policy.allowBchDustToFee !== 'boolean') throw Error('INVALID_FEE_POLICY');
    if (!p2pkh(input.changeScript) || !input.intent.ownerScripts.includes(input.changeScript)) throw Error('INVALID_CHANGE_SCRIPT');
    keys(input.snapshot, ['network', 'observedAt', 'parentTransactionHexes', 'unspentOutpoints']);
    const snapshot = input.snapshot;
    if (snapshot.network !== input.intent.network) throw Error('NETWORK_MISMATCH');
    if (!time(snapshot.observedAt) || snapshot.observedAt > input.now || input.now - snapshot.observedAt > 120000) throw Error('STALE_OR_INVALID_SNAPSHOT');
    if (!Array.isArray(snapshot.parentTransactionHexes) || snapshot.parentTransactionHexes.length > 20 || snapshot.parentTransactionHexes.some(raw => typeof raw !== 'string' || raw.length > 200000) || snapshot.parentTransactionHexes.reduce((sum, raw) => sum + raw.length, 0) > 500000 || !Array.isArray(snapshot.unspentOutpoints) || snapshot.unspentOutpoints.length > 100 || snapshot.unspentOutpoints.some(o => typeof o !== 'string' || !/^[0-9a-f]{64}:(0|[1-9][0-9]{0,9})$/.test(o) || BigInt(o.split(':')[1]!) > 0xffffffffn) || new Set(snapshot.unspentOutpoints).size !== snapshot.unspentOutpoints.length) throw Error('INVALID_SNAPSHOT');
    if (!Array.isArray(input.selectedInputs) || input.selectedInputs.length < 1 || input.selectedInputs.length > 20) throw Error('INVALID_SELECTION');
    const selected = input.selectedInputs.map(o => { keys(o, ['txid', 'index']); if (!hex64(o.txid) || !time(o.index) || o.index > 0xffffffff) throw Error('INVALID_SELECTION'); return { txid: o.txid, index: o.index }; }).sort((a, b) => a.txid < b.txid ? -1 : a.txid > b.txid ? 1 : a.index - b.index);
    if (new Set(selected.map(o => `${o.txid}:${o.index}`)).size !== selected.length) throw Error('DUPLICATE_INPUT');
    const parents = new Map<string, Transaction>();
    for (const raw of snapshot.parentTransactionHexes) { const tx = decode(raw), id = hashTransaction(hexToBin(raw)); if (parents.has(id)) throw Error('DUPLICATE_PARENT'); parents.set(id, tx); }
    const recipients = input.intent.recipients.map(output); const tokenIn = new Map<string, bigint>(); const tokenOut = new Map<string, bigint>();
    const add = (map: Map<string, bigint>, category: string, amount: bigint): void => { const total = (map.get(category) ?? 0n) + amount; if (amount <= 0n || total > TOKEN_MAX) throw Error('AMOUNT_RANGE'); map.set(category, total); };
    let totalIn = 0n;
    const selectedWithOutputs = selected.map(o => {
      const prev = parents.get(o.txid)?.outputs[o.index]; if (!prev || !snapshot.unspentOutpoints.includes(`${o.txid}:${o.index}`)) throw Error('MISSING_OR_SPENT_PREVOUT');
      if (!p2pkh(binToHex(prev.lockingBytecode)) || !input.intent.ownerScripts.includes(binToHex(prev.lockingBytecode))) throw Error('UNCONFIRMED_INPUT_OWNER');
      totalIn += prev.valueSatoshis; if (prev.valueSatoshis > MAX_MONEY || totalIn > MAX_MONEY) throw Error('AMOUNT_RANGE');
      if (prev.token) { if (prev.token.nft) throw Error('NFT_UNSUPPORTED'); const category = binToHex(prev.token.category); if (!input.intent.recipients.some(x => x.token?.category === category)) throw Error('UNDECLARED_TOKEN'); add(tokenIn, category, prev.token.amount); }
      return { ...o, sourceOutput: expected(prev) };
    });
    for (const recipient of recipients) { if (recipient.valueSatoshis < getDustThreshold(recipient, 1000n)) throw Error('DUST_RECIPIENT'); if (recipient.token) add(tokenOut, binToHex(recipient.token.category), recipient.token.amount); }
    const changes: Output[] = [];
    for (const category of [...new Set([...tokenIn.keys(), ...tokenOut.keys()])].sort()) {
      const remaining = (tokenIn.get(category) ?? 0n) - (tokenOut.get(category) ?? 0n); if (remaining < 0n) throw Error('INSUFFICIENT_TOKEN');
      if (remaining > 0n) { const change: Output = { lockingBytecode: hexToBin(input.changeScript), valueSatoshis: 0n, token: { category: hexToBin(category), amount: remaining } }; change.valueSatoshis = getDustThreshold(change, 1000n); changes.push(change); }
    }
    const tx: Transaction = { version: 2, locktime: 0, inputs: selected.map(o => ({ outpointTransactionHash: hexToBin(o.txid), outpointIndex: o.index, sequenceNumber: 0xffffffff, unlockingBytecode: new Uint8Array() })), outputs: [...recipients, ...changes] };
    const baseOut = tx.outputs.reduce((sum, o) => sum + o.valueSatoshis, 0n); if (baseOut > MAX_MONEY) throw Error('AMOUNT_RANGE');
    const baseSize = sizes(tx, policy.signatureModel), baseBudget = feeBudget(baseSize.maximum, targetRate);
    const bchChange: Output = { lockingBytecode: hexToBin(input.changeScript), valueSatoshis: 0n };
    const withChangeSize = sizes({ ...tx, outputs: [...tx.outputs, bchChange] }, policy.signatureModel), withChangeBudget = feeBudget(withChangeSize.maximum, targetRate);
    const remainderWithChange = totalIn - baseOut - withChangeBudget;
    let fee: bigint; let budget: bigint; let donation: bigint; let size: ReturnType<typeof sizes>;
    if (remainderWithChange >= getDustThreshold(bchChange, 1000n)) { bchChange.valueSatoshis = remainderWithChange; tx.outputs.push(bchChange); fee = budget = withChangeBudget; donation = 0n; size = withChangeSize; }
    else {
      fee = totalIn - baseOut; budget = baseBudget; donation = fee - budget; size = baseSize;
      if (donation < 0n) throw Error('INSUFFICIENT_BCH'); if (donation > 0n && !policy.allowBchDustToFee) throw Error('BCH_CHANGE_REQUIRES_DONATION');
      // Dust-only consent does not cover non-dust change made uneconomic by the
      // incremental output fee. Such plans need a different explicitly approved policy.
      if (donation >= getDustThreshold(bchChange, 1000n)) throw Error('BCH_REMAINDER_NOT_DUST');
    }
    if (fee > BigInt(input.intent.maxFeeSatoshis)) throw Error('FEE_LIMIT');
    if (fee * 1000n > maxRate * BigInt(size.minimum)) throw Error('FEE_RATE_LIMIT');
    if (tx.outputs.length > 41 || size.maximum > 100000) throw Error('PLAN_SIZE_LIMIT');
    const unsignedHex = binToHex(encodeTransaction(tx));
    const guard = verifyCandidate({ intent: input.intent, snapshot, candidateHex: unsignedHex, now: input.now }); r.guard = guard;
    if (guard.status !== 'MATCH_OFFLINE' || guard.intentDigest !== r.intentDigest || guard.feeSatoshis !== fee.toString()) throw Error('GUARD_RECOMPARE_FAILED');
    r.outputSummary = tx.outputs.map((o, index) => ({ ...expected(o), index, role: index < recipients.length ? 'recipient' : o.token ? 'token-change' : 'bch-change' }));
    r.feeRateBounds = { unit: 'satoshis-per-1000-bytes', minimum: { numerator: (fee * 1000n).toString(), denominator: size.maximum.toString() }, maximum: { numerator: (fee * 1000n).toString(), denominator: size.minimum.toString() } };
    r.planDigest = binToHex(sha256.hash(new TextEncoder().encode(JSON.stringify({ domain: 'intentguard/unsigned-plan/v1', intentDigest: r.intentDigest, unsignedHex, feePolicy: { targetSatoshisPer1000Bytes: policy.targetSatoshisPer1000Bytes, maxSatoshisPer1000Bytes: policy.maxSatoshisPer1000Bytes, signatureModel: policy.signatureModel, allowBchDustToFee: policy.allowBchDustToFee } }))));
    r.status = 'BUILT_OFFLINE'; r.unsignedHex = unsignedHex; r.feeSatoshis = fee.toString(); r.budgetFeeSatoshis = budget.toString(); r.donatedRemainderSatoshis = donation.toString(); r.estimatedSignedBytes = size; r.selectedInputs = selectedWithOutputs; return r;
  } catch (error) { const code = error instanceof Error ? error.message : ''; r.issue = ERRORS.has(code) ? code : 'INVALID_BUILD_INPUT'; return r; }
}
