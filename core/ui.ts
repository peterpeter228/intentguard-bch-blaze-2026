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
