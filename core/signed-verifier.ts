/** Offline stateless verification only. No wallet, signing, broadcast or receipt authority. */
import {binToHex,hexToBin,decodeTransaction,encodeTransaction,decodeTransactionOutputs,encodeTransactionOutputs,hashTransaction,hash160,isValidSignatureEncodingDER,createVirtualMachineBch2026,type Transaction} from '@bitauth/libauth';
import {buildUnsignedPlan,type UnsignedBuildInput,type SignatureSizeModel} from './unsigned-builder.js';
import {structuralTransactionDigest} from './guard.js';
export interface ResolvedSignatureInput { signedHex:string; sourceOutputsHex:string; signatureModel:SignatureSizeModel; }
export interface ResolvedSignatureReport {
 status:'SIGNATURES_VALID_STATELESS'|'REJECTED'; issue:string|null;
 checkedInputs:number; signedTransactionHash:string|null; vm:'libauth-3.1.0-next.8/BCH_2026_05/standard';
 canSign:false; broadcastable:false; receiptValid:false; networkVerified:false; chainVerified:false;
}
const model=(x:unknown):x is SignatureSizeModel=>x==='compressed-p2pkh-schnorr'||x==='compressed-p2pkh-low-s-ecdsa';
function keys(x:unknown,names:string[]):asserts x is Record<string,unknown>{if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join(',')!==[...names].sort().join(','))throw Error('INVALID_SIGNATURE_INPUT');}
function bytes(x:unknown,max:number):Uint8Array{if(typeof x!=='string'||!x.length||x.length>max*2||!/^([0-9a-f]{2})+$/.test(x))throw Error('INVALID_ENCODING');return hexToBin(x);}
function transaction(raw:unknown):Transaction{const b=bytes(raw,100000),tx=decodeTransaction(b);if(typeof tx==='string'||binToHex(encodeTransaction(tx))!==raw)throw Error('INVALID_TRANSACTION');return tx;}
const vm=createVirtualMachineBch2026(true);
/** Source outputs here are caller assertions, NOT hash-bound parents or live UTXOs.
 * This narrow layer exists for stateless validation and official public vectors.
 * It MUST NOT be used instead of verifySignedPlan for the full application binding.
 */
export function verifyResolvedP2pkhSignatures(input:ResolvedSignatureInput):ResolvedSignatureReport{
 const r:ResolvedSignatureReport={status:'REJECTED',issue:null,checkedInputs:0,signedTransactionHash:null,vm:'libauth-3.1.0-next.8/BCH_2026_05/standard',canSign:false,broadcastable:false,receiptValid:false,networkVerified:false,chainVerified:false};
 try{
  keys(input,['signedHex','sourceOutputsHex','signatureModel']);if(!model(input.signatureModel))throw Error('UNSUPPORTED_SIGNATURE_MODEL');
  const tx=transaction(input.signedHex);const sourceBytes=bytes(input.sourceOutputsHex,20000),sources=decodeTransactionOutputs(sourceBytes);
  if(typeof sources==='string'||binToHex(encodeTransactionOutputs(sources))!==input.sourceOutputsHex)throw Error('INVALID_SOURCE_OUTPUTS');
  if(tx.inputs.length<1||tx.inputs.length>20||sources.length!==tx.inputs.length||tx.outputs.length<1||tx.outputs.length>41)throw Error('INPUT_OUTPUT_LIMIT');
  if(sources.some(o=>o.token?.nft)||tx.outputs.some(o=>o.token?.nft))throw Error('NFT_UNSUPPORTED');
  const tokenBearing=sources.some(o=>o.token!==undefined)||tx.outputs.some(o=>o.token!==undefined);
  const seen=new Set<string>();
  for(const [index,i] of tx.inputs.entries()){
   const outpoint=binToHex(i.outpointTransactionHash)+':'+i.outpointIndex;if(seen.has(outpoint))throw Error('DUPLICATE_INPUT');seen.add(outpoint);
   const locking=binToHex(sources[index]!.lockingBytecode);if(!/^76a914[0-9a-f]{40}88ac$/.test(locking))throw Error('UNSUPPORTED_SOURCE_SCRIPT');
   const u=i.unlockingBytecode,n=u[0];
   if(n===undefined||n<9||n>72||u.length!==n+35||u[n+1]!==33)throw Error('NONMINIMAL_OR_MALFORMED_UNLOCK');
   const signature=u.slice(1,n+1),pubkey=u.slice(n+2);if(pubkey.length!==33||(pubkey[0]!==2&&pubkey[0]!==3))throw Error('UNCOMPRESSED_OR_INVALID_KEY');
   if(binToHex(hash160(pubkey))!==locking.slice(6,-4))throw Error('PUBKEY_HASH_MISMATCH');
   const flag=signature[signature.length-1];if(flag!==0x41&&flag!==0x61)throw Error('UNSAFE_SIGHASH');
   // Stronger application policy than BCH consensus: token-bearing plans must
   // commit to ALL source UTXOs as well as ALL outputs, never ANYONECANPAY.
   if(tokenBearing&&flag!==0x61)throw Error('TOKEN_UTXOS_SIGHASH_REQUIRED');
   if(input.signatureModel==='compressed-p2pkh-schnorr'?signature.length!==65:signature.length===65||signature.length<9||signature.length>72||!isValidSignatureEncodingDER(signature.slice(0,-1)))throw Error('SIGNATURE_MODEL_MISMATCH');
  }
  // Verify all inputs and standard stateless rules using the explicitly pinned
  // 2026 VM, not libauth's backwards-compatible default (2023) alias.
  if(vm.verify({transaction:tx,sourceOutputs:sources})!==true)throw Error('STATELESS_VM_REJECTED');
  r.checkedInputs=tx.inputs.length;r.signedTransactionHash=hashTransaction(encodeTransaction(tx));r.status='SIGNATURES_VALID_STATELESS';return r;
 }catch(e){const code=e instanceof Error?e.message:'';r.issue=signatureErrors.has(code)?code:'INVALID_SIGNATURE_INPUT';return r;}
}
const signatureErrors=new Set(['INVALID_SIGNATURE_INPUT','UNSUPPORTED_SIGNATURE_MODEL','INVALID_ENCODING','INVALID_TRANSACTION','INVALID_SOURCE_OUTPUTS','INPUT_OUTPUT_LIMIT','NFT_UNSUPPORTED','DUPLICATE_INPUT','UNSUPPORTED_SOURCE_SCRIPT','NONMINIMAL_OR_MALFORMED_UNLOCK','UNCOMPRESSED_OR_INVALID_KEY','PUBKEY_HASH_MISMATCH','UNSAFE_SIGHASH','TOKEN_UTXOS_SIGHASH_REQUIRED','SIGNATURE_MODEL_MISMATCH','STATELESS_VM_REJECTED']);
export interface ParentBoundSignatureInput {signedHex:string;parentTransactionHexes:readonly string[];signatureModel:SignatureSizeModel;}
export interface ParentBoundSignatureReport {
 status:'SIGNATURES_VALID_PARENT_BOUND'|'REJECTED';issue:string|null;resolvedParentCount:number;
 signatureReport:ResolvedSignatureReport|null;canSign:false;broadcastable:false;receiptValid:false;networkVerified:false;chainVerified:false;
}
/** Full parent content-hash binding, still not current UTXO/network or approved
 * business intent. Historical version1 vectors are permitted at this crypto-only
 * layer; the actual deterministic payment builder remains version2-only.
 */
export function verifyParentBoundP2pkhSignatures(input:ParentBoundSignatureInput):ParentBoundSignatureReport{
 const r:ParentBoundSignatureReport={status:'REJECTED',issue:null,resolvedParentCount:0,signatureReport:null,canSign:false,broadcastable:false,receiptValid:false,networkVerified:false,chainVerified:false};
 try{
  keys(input,['signedHex','parentTransactionHexes','signatureModel']);if(!model(input.signatureModel))throw Error('UNSUPPORTED_SIGNATURE_MODEL');
  if(!Array.isArray(input.parentTransactionHexes)||input.parentTransactionHexes.length<1||input.parentTransactionHexes.length>100||input.parentTransactionHexes.some(x=>typeof x!=='string')||input.parentTransactionHexes.reduce((n,x)=>n+x.length,0)>1000000)throw Error('INVALID_PARENTS');
  const signed=transaction(input.signedHex),parents=new Map<string,Transaction>();
  // Bound amplification BEFORE resolving/serializing source outputs. A small
  // candidate must not repeat a large source script thousands of times.
  if(signed.inputs.length<1||signed.inputs.length>20||signed.outputs.length<1||signed.outputs.length>41)throw Error('INPUT_OUTPUT_LIMIT');
  const outpoints=new Set<string>();for(const i of signed.inputs){const k=binToHex(i.outpointTransactionHash)+':'+i.outpointIndex;if(outpoints.has(k))throw Error('DUPLICATE_INPUT');outpoints.add(k);}
  for(const raw of input.parentTransactionHexes){const parent=transaction(raw),hash=hashTransaction(hexToBin(raw));if(parents.has(hash))throw Error('DUPLICATE_PARENT');parents.set(hash,parent);}
  const used=new Set<string>();const sources=signed.inputs.map(i=>{const id=binToHex(i.outpointTransactionHash),o=parents.get(id)?.outputs[i.outpointIndex];if(!o)throw Error('MISSING_BOUND_PARENT');if(!/^76a914[0-9a-f]{40}88ac$/.test(binToHex(o.lockingBytecode)))throw Error('UNSUPPORTED_SOURCE_SCRIPT');if(o.token?.nft)throw Error('NFT_UNSUPPORTED');used.add(id);return o;});
  const report=verifyResolvedP2pkhSignatures({signedHex:input.signedHex,sourceOutputsHex:binToHex(encodeTransactionOutputs(sources)),signatureModel:input.signatureModel});r.signatureReport=report;
  if(report.status!=='SIGNATURES_VALID_STATELESS')throw Error('SIGNATURE_VALIDATION_FAILED');
  r.status='SIGNATURES_VALID_PARENT_BOUND';r.resolvedParentCount=used.size;return r;
 }catch(e){const code=e instanceof Error?e.message:'';r.issue=parentErrors.has(code)?code:'INVALID_PARENT_BOUND_INPUT';return r;}
}
const parentErrors=new Set(['INPUT_OUTPUT_LIMIT','DUPLICATE_INPUT','UNSUPPORTED_SOURCE_SCRIPT','NFT_UNSUPPORTED','INVALID_SIGNATURE_INPUT','UNSUPPORTED_SIGNATURE_MODEL','INVALID_PARENTS','DUPLICATE_PARENT','MISSING_BOUND_PARENT','INVALID_ENCODING','INVALID_TRANSACTION','SIGNATURE_VALIDATION_FAILED']);
export interface SignedPlanInput {buildInput:UnsignedBuildInput;signedHex:string;}
export interface SignedPlanReport {
 status:'SIGNED_PLAN_VALID_OFFLINE'|'REJECTED';issue:string|null;planDigest:string|null;
 signatureReport:ResolvedSignatureReport|null;signedBytes:number|null;feeSatoshis:string|null;
 canSign:false;broadcastable:false;receiptValid:false;networkVerified:false;chainVerified:false;
 limitations:string[];
}
/** Trusted application supplies clock argument; JSON buildInput.now cannot freeze
 * verification time. Optional now exists for deterministic fixed-vector tests.
 */
export function verifySignedPlan(input:SignedPlanInput,now:number=Date.now()):SignedPlanReport{
 const r:SignedPlanReport={status:'REJECTED',issue:null,planDigest:null,signatureReport:null,signedBytes:null,feeSatoshis:null,canSign:false,broadcastable:false,receiptValid:false,networkVerified:false,chainVerified:false,limitations:[
  'Cryptographic/stateless validation is not live ownership, unspent state, consensus acceptance or payment authorization.',
  'Network labels are checked for consistency only. BCH signatures do not bind a chain ID and can be replayable across compatible networks.',
  'No wallet behavior, no-broadcast signing flow, actual chain transaction or receipt is verified.',
  'The application requires ALL|FORKID, and additionally UTXOS for token-bearing plans; actual node policy can differ.'
 ]};
 try{
  keys(input,['buildInput','signedHex']);if(!Number.isSafeInteger(now)||now<0)throw Error('INVALID_CLOCK');
  if(!input.buildInput||typeof input.buildInput!=='object'||Array.isArray(input.buildInput))throw Error('BUILD_REJECTED');
  const build=buildUnsignedPlan({...input.buildInput,now});
  if(build.status!=='BUILT_OFFLINE'||!build.unsignedHex||!build.estimatedSignedBytes||!build.feeSatoshis)throw Error('BUILD_REJECTED');
  r.planDigest=build.planDigest;
  transaction(input.signedHex);
  if(structuralTransactionDigest(input.signedHex)!==structuralTransactionDigest(build.unsignedHex))throw Error('SIGNED_STRUCTURE_MISMATCH');
  const signedSize=input.signedHex.length/2,range=build.estimatedSignedBytes;
  if(signedSize<range.minimum||signedSize>range.maximum)throw Error('SIGNED_SIZE_OUTSIDE_MODEL');
  const fee=BigInt(build.feeSatoshis),policy=input.buildInput.feePolicy;
  if(fee*1000n>BigInt(policy.maxSatoshisPer1000Bytes)*BigInt(signedSize)||fee*1000n<BigInt(policy.targetSatoshisPer1000Bytes)*BigInt(signedSize)||fee>BigInt(input.buildInput.intent.maxFeeSatoshis))throw Error('SIGNED_FEE_POLICY');
  const bound=verifyParentBoundP2pkhSignatures({signedHex:input.signedHex,parentTransactionHexes:input.buildInput.snapshot.parentTransactionHexes,signatureModel:policy.signatureModel});r.signatureReport=bound.signatureReport;
  if(bound.status!=='SIGNATURES_VALID_PARENT_BOUND')throw Error('SIGNATURE_VALIDATION_FAILED');
  r.signedBytes=signedSize;r.feeSatoshis=fee.toString();r.status='SIGNED_PLAN_VALID_OFFLINE';return r;
 }catch(e){const code=e instanceof Error?e.message:'';r.issue=planErrors.has(code)?code:'INVALID_SIGNED_PLAN';return r;}
}
const planErrors=new Set(['INVALID_CLOCK','BUILD_REJECTED','SIGNED_STRUCTURE_MISMATCH','SIGNED_SIZE_OUTSIDE_MODEL','SIGNED_FEE_POLICY','MISSING_BOUND_PARENT','SIGNATURE_VALIDATION_FAILED','INVALID_ENCODING','INVALID_TRANSACTION','INVALID_SIGNATURE_INPUT']);
