import assert from 'node:assert/strict';
// Run from the repository root after npm run build. Only the path lookup was
// normalized from the independently executed scratch probe; behavior is unchanged.
const base=process.cwd();
const {syntheticRequestPlanningExample}=await import(base+'/dist/core/request-plan-examples.js');
const {contextFromFundingFields}=await import(base+'/dist/core/request-plan-form.js');
const {createPaymentRequestDraft}=await import(base+'/dist/core/payment-request.js');
const {buildPaymentRequestPlan}=await import(base+'/dist/core/request-plan.js');
const {compareXoCandidateBytes}=await import(base+'/dist/core/xo-candidate.js');
const {decodeTransaction,hexToBin}=await import(base+'/node_modules/@bitauth/libauth/build/index.js');
const {buildInvitationTransactionFromMergedCommit}=await import(base+'/node_modules/@xo-cash/engine/dist/index.mjs');
const {p2pkhTemplate}=await import(base+'/node_modules/@xo-cash/templates/dist/index.mjs');
const {parseTemplate}=await import(base+'/node_modules/@xo-cash/utils/dist/index.mjs');
const now=Date.now(),s=syntheticRequestPlanningExample(true,now),context=contextFromFundingFields(s.funding,'chipnet'),d=createPaymentRequestDraft(s.request,now),p=buildPaymentRequestPlan(s.request,d.draft.requestDigest,context,now);
assert.equal(p.status,'REQUEST_PLAN_BOUND_OFFLINE');
for(const kind of ['nonempty-unlocking','sequence','version','locktime','skip-zero-change','extra-change','fee-drift']){
 const tx=decodeTransaction(hexToBin(p.plan.unsignedHex));assert.notEqual(typeof tx,'string');
 if(kind==='nonempty-unlocking')tx.inputs[0].unlockingBytecode=new Uint8Array([0]);
 if(kind==='sequence')tx.inputs[0].sequenceNumber--;
 if(kind==='version')tx.version=1;
 if(kind==='locktime')tx.locktime=1;
 if(kind==='skip-zero-change')tx.outputs.at(-1).valueSatoshis=0n;
 if(kind==='extra-change')tx.outputs.push({...tx.outputs.at(-1),valueSatoshis:1n});
 if(kind==='fee-drift')tx.outputs.at(-1).valueSatoshis--;
 const built=buildInvitationTransactionFromMergedCommit({variables:[],transactionVersion:tx.version,transactionLocktime:tx.locktime,inputs:tx.inputs.map(x=>({...x,sourceCommitIdentifier:'independent-synthetic'})),outputs:tx.outputs.map(x=>({...x,sourceCommitIdentifier:'independent-synthetic'}))},parseTemplate(JSON.stringify(p2pkhTemplate)),'sendFungibleTokens');
 const c=compareXoCandidateBytes({intent:p.intent,snapshot:context.snapshot,candidateHex:built.serializedTransaction,now},p.plan.unsignedHex);
 assert.equal(c.exactBytesMatch,false,kind);console.log(kind, c.guard.status, 'exact mismatch');
}
