import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {binToHex,hexToBin,decodeTransaction,encodeTransaction,decodeTransactionOutputs,encodeTransactionOutputs,type Transaction,type Output} from '@bitauth/libauth';
import {verifyResolvedP2pkhSignatures,verifySignedPlan,type ResolvedSignatureInput} from './signed-verifier.js';
import {buildUnsignedPlan,type UnsignedBuildInput} from './unsigned-builder.js';import {fixture,owner} from './fixtures.js';
const vectors=JSON.parse(readFileSync('evidence/signature-20261104/bchn-p2pkh-public-vectors.json','utf8')) as string[][];
function vector(index=0):ResolvedSignatureInput{const v=vectors[index]!;return {signedHex:v[4]!,sourceOutputsHex:v[5]!,signatureModel:index===0?'compressed-p2pkh-schnorr':'compressed-p2pkh-low-s-ecdsa'};}
function tx(raw:string):Transaction{const t=decodeTransaction(hexToBin(raw));assert.notEqual(typeof t,'string');return t as Transaction;}
function outputs(raw:string):Output[]{const o=decodeTransactionOutputs(hexToBin(raw));assert.notEqual(typeof o,'string');return o as Output[];}
function mutate(input:ResolvedSignatureInput,fn:(t:Transaction)=>void):ResolvedSignatureInput{const t=tx(input.signedHex);fn(t);return {...input,signedHex:binToHex(encodeTransaction(t))};}
function buildInput():UnsignedBuildInput{const {input,candidate}=fixture(false),i=candidate.inputs[0]!;return {intent:input.intent,snapshot:input.snapshot,selectedInputs:[{txid:binToHex(i.outpointTransactionHash),index:i.outpointIndex}],changeScript:owner,now:input.now,feePolicy:{signatureModel:'compressed-p2pkh-schnorr',targetSatoshisPer1000Bytes:'1000',maxSatoshisPer1000Bytes:'3000',allowBchDustToFee:false}};}
function invalidTransplant(b:UnsignedBuildInput):string{const plan=buildUnsignedPlan(b);assert.equal(plan.status,'BUILT_OFFLINE');const t=tx(plan.unsignedHex!);t.inputs[0]!.unlockingBytecode=tx(vector().signedHex).inputs[0]!.unlockingBytecode;return binToHex(encodeTransaction(t));}

test('unmodified immutable BCHN public Schnorr and ECDSA vectors pass only the stateless layer',()=>{
 for(const i of [0,1]){const input=vector(i),before=JSON.stringify(input),r=verifyResolvedP2pkhSignatures(input);assert.equal(r.status,'SIGNATURES_VALID_STATELESS');assert.equal(r.checkedInputs,1);assert.equal(r.vm,'libauth-3.1.0-next.8/BCH_2026_05/standard');for(const k of ['canSign','broadcastable','receiptValid','networkVerified','chainVerified'] as const)assert.equal(r[k],false);assert.equal(JSON.stringify(input),before);}
});
test('signature or transaction mutation invalidates the original public signature',()=>{
 for(const i of [0,1]){const input=vector(i);for(const fn of [(t:Transaction)=>{t.inputs[0]!.unlockingBytecode[10]=t.inputs[0]!.unlockingBytecode[10]!^1;},(t:Transaction)=>{t.locktime=1;},(t:Transaction)=>{t.inputs[0]!.sequenceNumber=1;},(t:Transaction)=>{t.outputs[0]!.valueSatoshis=1n;}])assert.equal(verifyResolvedP2pkhSignatures(mutate(input,fn)).status,'REJECTED');}
});
test('every unsafe or unknown sighash flag is rejected before VM acceptance',()=>{
 for(const flag of [0,1,0x42,0x43,0x81,0xc1,0xe1,0x21,0xff]){const r=verifyResolvedP2pkhSignatures(mutate(vector(),t=>{const u=t.inputs[0]!.unlockingBytecode;u[u[0]!]=flag;}));assert.equal(r.issue,'UNSAFE_SIGHASH');}
 // Changing 0x41 to allowed 0x61 does not create a valid UTXOS signature.
 assert.equal(verifyResolvedP2pkhSignatures(mutate(vector(),t=>{const u=t.inputs[0]!.unlockingBytecode;u[u[0]!]=0x61;})).issue,'STATELESS_VM_REJECTED');
});
test('source amount, owner hash, count and ordering cannot be replaced by imported assertions unnoticed',()=>{
 let input=vector(),o=outputs(input.sourceOutputsHex);o[0]!.valueSatoshis+=1n;assert.equal(verifyResolvedP2pkhSignatures({...input,sourceOutputsHex:binToHex(encodeTransactionOutputs(o))}).issue,'STATELESS_VM_REJECTED');
 o=outputs(input.sourceOutputsHex);o[0]!.lockingBytecode[5]=o[0]!.lockingBytecode[5]!^1;assert.equal(verifyResolvedP2pkhSignatures({...input,sourceOutputsHex:binToHex(encodeTransactionOutputs(o))}).issue,'PUBKEY_HASH_MISMATCH');
 assert.equal(verifyResolvedP2pkhSignatures({...input,sourceOutputsHex:'00'}).issue,'INPUT_OUTPUT_LIMIT');
 o=outputs(input.sourceOutputsHex);o.push(o[0]!);assert.equal(verifyResolvedP2pkhSignatures({...input,sourceOutputsHex:binToHex(encodeTransactionOutputs(o))}).issue,'INPUT_OUTPUT_LIMIT');
});
test('exact minimal two-push and compressed key/signature model boundary fails closed',()=>{
 const input=vector();for(const fn of [(t:Transaction)=>{t.inputs[0]!.unlockingBytecode=new Uint8Array();},(t:Transaction)=>{const u=t.inputs[0]!.unlockingBytecode;t.inputs[0]!.unlockingBytecode=Uint8Array.from([0x4c,...u]);},(t:Transaction)=>{const u=t.inputs[0]!.unlockingBytecode;t.inputs[0]!.unlockingBytecode=Uint8Array.from([...u,0]);},(t:Transaction)=>{const u=t.inputs[0]!.unlockingBytecode;u[u[0]!+2]=4;}])assert.equal(verifyResolvedP2pkhSignatures(mutate(input,fn)).status,'REJECTED');
 assert.equal(verifyResolvedP2pkhSignatures({...input,signatureModel:'compressed-p2pkh-low-s-ecdsa'}).issue,'SIGNATURE_MODEL_MISMATCH');
 assert.equal(verifyResolvedP2pkhSignatures({...vector(1),signatureModel:'compressed-p2pkh-schnorr'}).issue,'SIGNATURE_MODEL_MISMATCH');
});
test('token-bearing source requires stronger UTXOS sighash and NFTs are unsupported',()=>{
 const input=vector(),o=outputs(input.sourceOutputsHex);o[0]!.token={category:new Uint8Array(32).fill(4),amount:1n};
 assert.equal(verifyResolvedP2pkhSignatures({...input,sourceOutputsHex:binToHex(encodeTransactionOutputs(o))}).issue,'TOKEN_UTXOS_SIGHASH_REQUIRED');
 o[0]!.token!.nft={capability:'none',commitment:new Uint8Array()};assert.equal(verifyResolvedP2pkhSignatures({...input,sourceOutputsHex:binToHex(encodeTransactionOutputs(o))}).issue,'NFT_UNSUPPORTED');
});
test('duplicate inputs and a second malformed input cannot hide behind a valid first public vector',()=>{
 const input=vector(),o=outputs(input.sourceOutputsHex),t=tx(input.signedHex);t.inputs.push({...t.inputs[0]!});o.push(o[0]!);
 assert.equal(verifyResolvedP2pkhSignatures({...input,signedHex:binToHex(encodeTransaction(t)),sourceOutputsHex:binToHex(encodeTransactionOutputs(o))}).issue,'DUPLICATE_INPUT');
 t.inputs[1]!.outpointIndex=1;t.inputs[1]!.unlockingBytecode=new Uint8Array();assert.equal(verifyResolvedP2pkhSignatures({...input,signedHex:binToHex(encodeTransaction(t)),sourceOutputsHex:binToHex(encodeTransactionOutputs(o))}).issue,'NONMINIMAL_OR_MALFORMED_UNLOCK');
});
test('malformed, oversized, noncanonical and forged success JSON is rejected',()=>{
 for(const input of [null,{}, {...vector(),signedHex:'01'}, {...vector(),signedHex:'00'.repeat(100001)}, {...vector(),sourceOutputsHex:'00'.repeat(20001)}, {...vector(),status:'SIGNATURES_VALID_STATELESS'}, {...vector(),signatureModel:'unknown'}])assert.equal(verifyResolvedP2pkhSignatures(input as ResolvedSignatureInput).status,'REJECTED');
 const o=vector().sourceOutputsHex;assert.equal(verifyResolvedP2pkhSignatures({...vector(),sourceOutputsHex:'fd0100'+o.slice(2)}).status,'REJECTED');
});
test('high-level verifier does not accept a transplanted public signature as a bound payment',()=>{
 const b=buildInput(),r=verifySignedPlan({buildInput:b,signedHex:invalidTransplant(b)},b.now);assert.equal(r.status,'REJECTED');assert.equal(r.issue,'SIGNATURE_VALIDATION_FAILED');assert.equal(r.signatureReport?.issue,'PUBKEY_HASH_MISMATCH');assert.equal(r.broadcastable,false);assert.equal(r.chainVerified,false);
});
test('high-level exact plan structure, input bindings and network consistency are mandatory',()=>{
 const b=buildInput(),raw=invalidTransplant(b),t=tx(raw);t.outputs[0]!.valueSatoshis+=1n;
 assert.equal(verifySignedPlan({buildInput:b,signedHex:binToHex(encodeTransaction(t))},b.now).issue,'SIGNED_STRUCTURE_MISMATCH');
 const t2=tx(raw);t2.inputs[0]!.outpointIndex=1;assert.equal(verifySignedPlan({buildInput:b,signedHex:binToHex(encodeTransaction(t2))},b.now).issue,'SIGNED_STRUCTURE_MISMATCH');
 const wrong=structuredClone(b);wrong.snapshot.network='mainnet';assert.equal(verifySignedPlan({buildInput:wrong,signedHex:raw},b.now).issue,'BUILD_REJECTED');
 wrong.snapshot.network='chipnet';wrong.snapshot.parentTransactionHexes=[];assert.equal(verifySignedPlan({buildInput:wrong,signedHex:raw},b.now).issue,'BUILD_REJECTED');
});
test('trusted invocation clock overrides frozen JSON time, rejects expired/stale input and malformed plan',()=>{
 const b=buildInput(),raw=invalidTransplant(b);
 assert.equal(verifySignedPlan({buildInput:b,signedHex:raw},b.intent.expiresAt).issue,'BUILD_REJECTED');
 assert.equal(verifySignedPlan({buildInput:b,signedHex:raw},-1).issue,'INVALID_CLOCK');
 const stale=structuredClone(b);stale.intent.expiresAt=b.now+999999;assert.equal(verifySignedPlan({buildInput:stale,signedHex:raw},b.now+120001).issue,'BUILD_REJECTED');
 assert.equal(verifySignedPlan({...{buildInput:b,signedHex:raw},status:'BUILT_OFFLINE'} as never,b.now).status,'REJECTED');
});
test('actual signed size must stay inside the declared model even before cryptographic verification',()=>{
 const b=buildInput(),t=tx(invalidTransplant(b));t.inputs[0]!.unlockingBytecode=Uint8Array.from([...t.inputs[0]!.unlockingBytecode,0]);assert.equal(verifySignedPlan({buildInput:b,signedHex:binToHex(encodeTransaction(t))},b.now).issue,'SIGNED_SIZE_OUTSIDE_MODEL');
});
