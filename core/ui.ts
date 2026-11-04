import {binToHex,encodeTransaction,hexToBin} from '@bitauth/libauth';
import {verifyCandidate,type GuardInput,type GuardReport} from './guard.js';import {fixture,stranger} from './fixtures.js';
const byId=(s:string)=>document.getElementById(s)!;
const source=byId('source') as HTMLTextAreaElement;
const run=byId('run') as HTMLButtonElement;
const download=byId('download') as HTMLButtonElement;
let report:GuardReport|null=null;
function invalidate(){report=null;download.disabled=true;byId('result').textContent='No current result. Run the comparison after any edit.';byId('status').textContent='NOT CHECKED';byId('status').className='';}
function load(kind:string){const {input,candidate}=fixture(true);
 if(kind==='recipient')candidate.outputs[0]!.lockingBytecode=hexToBin(stranger);
 if(kind==='token')candidate.outputs[0]!.token!.category=hexToBin('66'.repeat(32));
 if(kind==='fee')candidate.outputs[1]!.valueSatoshis=7500n;
 if(kind==='stale')input.snapshot.observedAt-=120001;
 if(kind==='missing')input.snapshot.parentTransactionHexes=[];
 input.candidateHex=binToHex(encodeTransaction(candidate));source.value=JSON.stringify(input,null,2);invalidate();
}
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-scenario]'))button.addEventListener('click',()=>load(button.dataset.scenario!));
source.addEventListener('input',invalidate);
byId('clear').addEventListener('click',()=>{source.value='';invalidate();});
run.addEventListener('click',()=>{invalidate();try{if(new TextEncoder().encode(source.value).length>600000)throw Error('Input exceeds 600 KB');const input:unknown=JSON.parse(source.value);if(!input||typeof input!=='object')throw Error('Enter a comparison object');report=verifyCandidate(input as GuardInput);byId('status').textContent=report.status;byId('status').className=report.status==='REJECTED'?'rejected':report.status==='UNKNOWN'?'unknown':'match';byId('result').textContent=JSON.stringify(report,null,2);download.disabled=false;}catch{byId('status').textContent='INVALID INPUT';byId('result').textContent='Enter valid JSON within 600 KB. No transaction was sent.';}});
download.addEventListener('click',()=>{if(!report)return;const blob=new Blob([JSON.stringify({evidence:'OFFLINE_COMPARISON_NOT_CHAIN_PROOF',...report},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='intentguard-offline-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
load('normal');

// Separate hypothetical planner. No plan is imported into the evidence journal.
import {buildUnsignedPlan,type UnsignedBuildInput,type UnsignedBuildResult} from './unsigned-builder.js';
import {owner} from './fixtures.js';
const buildSource=byId('build-source') as HTMLTextAreaElement;
const buildDownload=byId('build-download') as HTMLButtonElement;
let plan:UnsignedBuildResult|null=null;
function invalidatePlan(){plan=null;buildDownload.disabled=true;byId('build-result').textContent='No current plan. Build again after any edit.';byId('build-status').textContent='NOT BUILT';byId('build-status').className='';}
function loadPlan(kind:string){const {input,candidate}=fixture(true);const first=candidate.inputs[0]!;
 const request:UnsignedBuildInput={intent:input.intent,snapshot:input.snapshot,selectedInputs:[{txid:binToHex(first.outpointTransactionHash),index:first.outpointIndex}],changeScript:owner,now:input.now,feePolicy:{targetSatoshisPer1000Bytes:'1000',maxSatoshisPer1000Bytes:'3000',signatureModel:'compressed-p2pkh-schnorr',allowBchDustToFee:false}};
 if(kind==='fee')request.intent.maxFeeSatoshis='1';
 if(kind==='funds')request.intent.recipients[0]!.satoshis='20000';
 buildSource.value=JSON.stringify(request,null,2);invalidatePlan();
}
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-build-scenario]'))button.addEventListener('click',()=>loadPlan(button.dataset.buildScenario!));
buildSource.addEventListener('input',invalidatePlan);
byId('build-clear').addEventListener('click',()=>{buildSource.value='';invalidatePlan();});
byId('build-run').addEventListener('click',()=>{invalidatePlan();try{
 if(new TextEncoder().encode(buildSource.value).length>600000)throw Error('Too large');
 const input:unknown=JSON.parse(buildSource.value);plan=buildUnsignedPlan(input as UnsignedBuildInput);
 byId('build-status').textContent=plan.status;byId('build-status').className=plan.status==='REJECTED'?'rejected':'match';byId('build-result').textContent=JSON.stringify(plan,null,2);buildDownload.disabled=false;
 }catch{byId('build-status').textContent='INVALID INPUT';byId('build-result').textContent='Enter valid JSON within 600 KB. No wallet was connected and no transaction was sent.';}
});
buildDownload.addEventListener('click',()=>{if(!plan)return;
 // Explicit allowlist: do not export raw transaction, outpoints, addresses,
 // caller input, ownership claims, or arbitrary future result fields.
 const summary={evidence:'OFFLINE_UNSIGNED_PLAN_NOT_PAYMENT_AUTHORITY',status:plan.status,issue:plan.issue,canSign:plan.canSign,broadcastable:plan.broadcastable,receiptValid:plan.receiptValid,feeSatoshis:plan.feeSatoshis,budgetFeeSatoshis:plan.budgetFeeSatoshis,donatedRemainderSatoshis:plan.donatedRemainderSatoshis,estimatedSignedBytes:plan.estimatedSignedBytes,feeRateBounds:plan.feeRateBounds,planDigest:plan.planDigest,limitations:plan.limitations};
 const url=URL.createObjectURL(new Blob([JSON.stringify(summary,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='intentguard-offline-plan-summary.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
loadPlan('normal');
