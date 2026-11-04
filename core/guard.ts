/** Deterministic transaction comparison, not a signer, node, or spending authorization. */
import { binToHex, hexToBin, decodeTransaction, encodeTransaction, hashTransaction, sha256, type Transaction, type Output } from '@bitauth/libauth';
export interface ExpectedOutput { script: string; satoshis: string; token?: { category: string; amount: string }; }
export interface PaymentIntent {
  network: 'chipnet' | 'mainnet'; expiresAt: number; maxFeeSatoshis: string;
  /** Exact ordered recipient outputs; additional outputs must be confirmed owner change. */
  recipients: ExpectedOutput[];
  /** Independently confirmed wallet scripts, never learned from the candidate transaction. */
  ownerScripts: string[];
}
export interface EvidenceSnapshot {
  network: 'chipnet' | 'mainnet'; observedAt: number;
  /** Full parent transactions, whose txids must match actual input outpoints. */
  parentTransactionHexes: string[];
  /** Independent source's claimed currently-unspent outpoints, txid:index. Not proof of consensus. */
  unspentOutpoints: string[];
}
export interface GuardInput { intent: PaymentIntent; candidateHex: string; snapshot: EvidenceSnapshot; now: number; }
export interface GuardReport {
  status: 'MATCH_OFFLINE' | 'REJECTED' | 'UNKNOWN'; canSign: false;
  issues: string[]; feeSatoshis: string | null; candidateTxid: string | null;
  intentDigest: string | null; structuralTransactionDigest: string | null;
  limitations: string[];
}
const MAX_BYTES = 100_000;
const MAX_MONEY = 2_100_000_000_000_000n;
const TOKEN_MAX = 9223372036854775807n;
const hex = (s: unknown, bytes?: number): s is string => typeof s === 'string' && s.length > 0 && s.length % 2 === 0 && /^[0-9a-f]+$/.test(s) && (bytes === undefined || s.length === bytes * 2);
const script = (s: unknown): s is string => typeof s === 'string' && /^76a914[0-9a-f]{40}88ac$/.test(s);
function integer(s: unknown, max: bigint): bigint {
  if (typeof s !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(s)) throw Error('INVALID_INTEGER');
  const v = BigInt(s); if (v > max) throw Error('AMOUNT_RANGE'); return v;
}
/** Strict decimal entry: no exponent, signs, rounding or floating point. */
export function parseUnits(s: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18 || typeof s !== 'string' || s.length > 80 || !/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(s)) throw Error('INVALID_AMOUNT');
  const [whole, fraction = ''] = s.split('.');
  if (fraction.length > decimals) throw Error('EXCESS_PRECISION');
  const result = BigInt(whole!) * 10n ** BigInt(decimals) + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0');
  if (result > TOKEN_MAX) throw Error('AMOUNT_RANGE'); return result;
}
function decode(s: unknown): Transaction {
  if (!hex(s) || s.length > MAX_BYTES * 2) throw Error('INVALID_TRANSACTION');
  const tx = decodeTransaction(hexToBin(s)); if (typeof tx === 'string') throw Error('INVALID_TRANSACTION');
  if (binToHex(encodeTransaction(tx)) !== s) throw Error('NONCANONICAL_TRANSACTION');
  return tx;
}
function digest(s: string): string { return binToHex(sha256.hash(new TextEncoder().encode(s))); }
function normalizedIntent(i: PaymentIntent): PaymentIntent {
  if (!i || (i.network !== 'mainnet' && i.network !== 'chipnet') || !Number.isSafeInteger(i.expiresAt) || i.expiresAt < 0 || !Array.isArray(i.recipients) || !i.recipients.length || i.recipients.length > 20 || !Array.isArray(i.ownerScripts) || !i.ownerScripts.length || i.ownerScripts.length > 100 || i.ownerScripts.some(x => !script(x)) || new Set(i.ownerScripts).size !== i.ownerScripts.length) throw Error('INVALID_INTENT');
  integer(i.maxFeeSatoshis, MAX_MONEY);
  const recipients = i.recipients.map(o => {
    if (!o || !script(o.script) || integer(o.satoshis, MAX_MONEY) < 546n) throw Error('INVALID_RECIPIENT');
    if (o.token && (!hex(o.token.category,32) || integer(o.token.amount,TOKEN_MAX) <= 0n)) throw Error('INVALID_TOKEN');
    return {script:o.script,satoshis:o.satoshis,...(o.token ? {token:{category:o.token.category,amount:o.token.amount}} : {})};
  });
  if (recipients.some(o=>i.ownerScripts.includes(o.script))) throw Error('AMBIGUOUS_RECIPIENT_CHANGE');
  return {network:i.network,expiresAt:i.expiresAt,maxFeeSatoshis:i.maxFeeSatoshis,recipients,ownerScripts:[...i.ownerScripts].sort()};
}
function outputKey(o: Output): string {
  return JSON.stringify({script:binToHex(o.lockingBytecode),satoshis:o.valueSatoshis.toString(),...(o.token ? {token:{category:binToHex(o.token.category),amount:o.token.amount.toString()}} : {})});
}
export function structuralTransactionDigest(raw: string): string {
  const tx=decode(raw); return hashTransaction(encodeTransaction({...tx,inputs:tx.inputs.map(i=>({...i,unlockingBytecode:new Uint8Array()}))}));
}
/** Structural comparison only. Does NOT verify signatures or sighash flags. */
export function compareSignedCandidate(approvedUnsigned: string, returnedCandidate: string): boolean {
  const before=decode(approvedUnsigned), after=decode(returnedCandidate);
  if (before.inputs.some(i=>i.unlockingBytecode.length) || !after.inputs.length || after.inputs.some(i=>!i.unlockingBytecode.length)) return false;
  return structuralTransactionDigest(approvedUnsigned) === structuralTransactionDigest(returnedCandidate);
}
export function verifyCandidate(input: GuardInput): GuardReport {
  const r: GuardReport = {status:'UNKNOWN',canSign:false,issues:[],feeSatoshis:null,candidateTxid:null,intentDigest:null,structuralTransactionDigest:null,limitations:[
    'MATCH_OFFLINE means supplied evidence and candidate agree; it is not payment approval.',
    'Network and unspent status are asserted by the supplied snapshot; no live chain or ownership proof is fetched.',
    'Signatures, consensus validity, relay policy, dust policy and wallet behavior are not validated.',
    'Only P2PKH, fungible tokens, final sequence, version 2 and zero locktime are supported. No NFT or minting.'
  ]};
  const reject=(code:string)=>{r.issues.push(code);r.status='REJECTED';};
  try {
    const i=normalizedIntent(input.intent); r.intentDigest=digest(JSON.stringify(i));
    if (!Number.isSafeInteger(input.now) || input.now < 0) throw Error('INVALID_CLOCK');
    if (i.expiresAt <= input.now) {reject('INTENT_EXPIRED');return r;}
    const s=input.snapshot;
    if (!s || s.network!==i.network) {reject('NETWORK_MISMATCH');return r;}
    if (!Number.isSafeInteger(s.observedAt) || s.observedAt < 0 || s.observedAt > input.now || input.now-s.observedAt > 120_000) {r.issues.push('STALE_OR_INVALID_SNAPSHOT');return r;}
    if (!Array.isArray(s.parentTransactionHexes) || s.parentTransactionHexes.length > 100 || !Array.isArray(s.unspentOutpoints) || s.unspentOutpoints.length > 100 || s.unspentOutpoints.some(x=>typeof x!=='string')) throw Error('INVALID_SNAPSHOT');
    const tx=decode(input.candidateHex);r.candidateTxid=hashTransaction(hexToBin(input.candidateHex));r.structuralTransactionDigest=structuralTransactionDigest(input.candidateHex);
    if(tx.version!==2 || tx.locktime!==0 || !tx.inputs.length || tx.inputs.length>100 || !tx.outputs.length || tx.outputs.length>100 || tx.inputs.some(x=>x.sequenceNumber!==0xffffffff || x.unlockingBytecode.length!==0)) {reject('UNSUPPORTED_TRANSACTION');return r;}
    const parents=new Map<string,Transaction>();
    for(const raw of s.parentTransactionHexes){const parent=decode(raw),id=hashTransaction(hexToBin(raw));if(parents.has(id))throw Error('DUPLICATE_PARENT');parents.set(id,parent);}
    const used=new Set<string>(); const tokenIn=new Map<string,bigint>(),tokenOut=new Map<string,bigint>(); let totalIn=0n,totalOut=0n;
    const addToken=(o:Output,map:Map<string,bigint>)=>{if(o.token){if(o.token.nft){reject('NFT_UNSUPPORTED');return;}const key=binToHex(o.token.category);if(!i.recipients.some(x=>x.token?.category===key))reject('UNDECLARED_TOKEN');map.set(key,(map.get(key)??0n)+o.token.amount);}};
    for(const x of tx.inputs){
      const id=binToHex(x.outpointTransactionHash), key=`${id}:${x.outpointIndex}`;
      if(used.has(key)){reject('DUPLICATE_INPUT');return r;}used.add(key);
      const parent=parents.get(id), prev=parent?.outputs[x.outpointIndex];
      if(!prev || !s.unspentOutpoints.includes(key)){r.issues.push('MISSING_OR_SPENT_PREVOUT');return r;}
      if(!i.ownerScripts.includes(binToHex(prev.lockingBytecode))){reject('UNCONFIRMED_INPUT_OWNER');return r;}
      if(prev.valueSatoshis>MAX_MONEY){reject('AMOUNT_RANGE');return r;}totalIn+=prev.valueSatoshis;addToken(prev,tokenIn);
    }
    if(tx.outputs.length<i.recipients.length){reject('MISSING_RECIPIENT');return r;}
    for(const [index,o] of tx.outputs.entries()){
      const sc=binToHex(o.lockingBytecode);if(!script(sc)){reject('UNSUPPORTED_OUTPUT_SCRIPT');return r;}
      if(o.valueSatoshis<546n || o.valueSatoshis>MAX_MONEY){reject('OUTPUT_AMOUNT_RANGE');return r;}
      totalOut+=o.valueSatoshis;addToken(o,tokenOut);
      if(index<i.recipients.length){if(outputKey(o)!==JSON.stringify(i.recipients[index]))reject('RECIPIENT_MISMATCH');}
      else if(!i.ownerScripts.includes(sc))reject('UNCONFIRMED_CHANGE');
    }
    if(totalIn>MAX_MONEY || totalOut>MAX_MONEY){reject('AMOUNT_RANGE');return r;}
    const fee=totalIn-totalOut;r.feeSatoshis=fee.toString();
    if(fee<0n)reject('VALUE_CREATION');else if(fee>BigInt(i.maxFeeSatoshis))reject('FEE_LIMIT');
    for(const k of new Set([...tokenIn.keys(),...tokenOut.keys()])) if((tokenIn.get(k)??0n)!==(tokenOut.get(k)??0n))reject('TOKEN_IMBALANCE');
    if(!r.issues.length)r.status='MATCH_OFFLINE';
  }catch(e){reject(e instanceof Error ? e.message : 'INVALID_INPUT');}
  return r;
}
