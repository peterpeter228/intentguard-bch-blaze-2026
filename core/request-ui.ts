/** Explicit local request/plan review only. No wallet, storage, transport or payment API. */
import {createPaymentRequestDraft,parsePaymentRequestDraft,exportPaymentRequest} from './payment-request.js';
import {buildPaymentRequestPlan,type RequestPlanResult} from './request-plan.js';
import {contextFromFundingFields,requestPlanSummary,type OfflineFundingFields} from './request-plan-form.js';
import {syntheticRequestPlanningExample} from './request-plan-examples.js';
const element=(id:string)=>document.getElementById(id)!;
const field=(id:string)=>element(id) as HTMLInputElement;
const confirmButton=element('request-confirm') as HTMLButtonElement;
const exportButton=element('request-export') as HTMLButtonElement;
let current:ReturnType<typeof createPaymentRequestDraft>|null=null;
let expiryTimer:ReturnType<typeof setTimeout>|undefined;
let reviewedDigest:string|null=null;
let reviewedFormFingerprint:string|null=null;
let acknowledgedFundingFingerprint:string|null=null;
let loadedExampleRequestFingerprint:string|null=null;
let loadedExampleFundingFingerprint:string|null=null;
const requestFieldIds=['request-id','request-network','request-asset','request-address','request-bch','request-fee','request-category','request-token','request-expiry','request-import'] as const;
function requestFingerprint(){return JSON.stringify(requestFieldIds.map(id=>field(id).value));}
function fundingFingerprint(){return JSON.stringify(fundingFields());}
let activePlan:RequestPlanResult|null=null;
let planTimer:ReturnType<typeof setTimeout>|undefined;
let fundingOrigin:'none'|'synthetic-example'|'supplied-offline'='none';
const planButton=element('plan-build') as HTMLButtonElement;
const planExport=element('plan-export') as HTMLButtonElement;
const fundingIds=['funding-owner','funding-change','funding-parent','funding-index','funding-observed','funding-rate','funding-max-rate','funding-model'] as const;
function updatePlanButton(){planButton.disabled=!reviewedDigest||!field('funding-ack').checked;}
function clearPlan(message='No current offline plan. Review the request and supply the funding context.'){
 if(planTimer)clearTimeout(planTimer);planTimer=undefined;activePlan=null;planExport.disabled=true;
 element('plan-status').textContent='NO PLAN';element('plan-summary').textContent=message;element('plan-technical').textContent='';
 (element('plan-details') as HTMLDetailsElement).open=false;updatePlanButton();
}
function clearFunding(){
 for(const id of fundingIds)field(id).value='';field('funding-dust').checked=false;field('funding-ack').checked=false;
 acknowledgedFundingFingerprint=null;loadedExampleRequestFingerprint=null;loadedExampleFundingFingerprint=null;fundingOrigin='none';element('funding-origin').textContent='No funding context supplied. Nothing is fetched or inferred.';
}

function invalidate(message='No current draft. Review again after any edit.',resetFunding=true){
 reviewedDigest=null;reviewedFormFingerprint=null;acknowledgedFundingFingerprint=null;if(resetFunding)clearFunding();field('funding-ack').checked=false;clearPlan();
 if(expiryTimer)clearTimeout(expiryTimer);expiryTimer=undefined;current=null;
 confirmButton.disabled=true;exportButton.disabled=true;element('request-status').textContent='NO DRAFT';
 element('request-summary').textContent=message;element('request-confirm-status').textContent='Not reviewed.';
}
function satoshisToBch(value:string):string{
 if(!/^(0|[1-9][0-9]{0,15})$/.test(value))throw Error('Enter a whole-number fee cap in satoshis.');
 const n=BigInt(value);return `${n/100000000n}.${(n%100000000n).toString().padStart(8,'0')}`;
}
function expiryValue(value:string):number{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value))throw Error('Use the exact UTC date format YYYY-MM-DDTHH:mm:ssZ.');
 const n=Date.parse(value);if(!Number.isFinite(n)||new Date(n).toISOString().replace('.000Z','Z')!==value)throw Error('Enter a real UTC date.');return n;
}
function createFromFields(){
 const token=field('request-asset').value==='token';
 return {schemaVersion:1,kind:'intentguard-payment-request',requestId:field('request-id').value,network:field('request-network').value,
 expiresAt:expiryValue(field('request-expiry').value),maxFeeBch:satoshisToBch(field('request-fee').value),
 recipients:[{address:field('request-address').value,bch:field('request-bch').value,...(token?{token:{category:field('request-category').value,amountAtomic:field('request-token').value}}:{})}]};
}
// Rendering and revalidation are completed below against the shared strict schema.
const issueText:Record<string,string>={
 REQUEST_INVALID_SCHEMA:'The document has unsupported or missing fields. Import only the request wire format, never a result or approval.',
 REQUEST_INVALID_ID:'Use a request reference of 1–80 letters, numbers, hyphens or underscores.',
 REQUEST_EXPIRED:'The request has expired.',REQUEST_EXPIRY_TOO_FAR:'Expiry must be within the next 24 hours.',
 REQUEST_INVALID_ADDRESS:'Enter a complete CashAddr with a valid checksum and explicit prefix.',
 REQUEST_MIXED_CASE_ADDRESS:'CashAddr cannot mix uppercase and lowercase characters.',
 REQUEST_NETWORK_MISMATCH:'The address prefix does not match the requested network.',
 REQUEST_UNSUPPORTED_ADDRESS_TYPE:'This slice supports only 20-byte P2PKH addresses.',
 REQUEST_TOKEN_AWARE_REQUIRED:'Token requests require an explicitly token-aware CashAddr.',
 REQUEST_INVALID_BCH_AMOUNT:'Use an exact non-negative BCH decimal string with at most 8 decimal places.',
 REQUEST_BCH_RANGE:'The BCH amount or total is outside the supported range.',
 REQUEST_INVALID_TOKEN_AMOUNT:'Token amounts must be positive integer base units, without decimals.',
 REQUEST_INVALID_TOKEN_CATEGORY:'Use the full 64-character lowercase hexadecimal token category.',
 REQUEST_TOKEN_RANGE:'Token amount is outside the supported range.',
 REQUEST_DUST_OUTPUT:'The recipient BCH is below this application’s fixed dust baseline. Include sufficient token carrying BCH.',
 REQUEST_TOO_LARGE:'The request exceeds the 8 KB import limit.',REQUEST_INVALID_JSON:'Enter valid request JSON.',
 REQUEST_DUPLICATE_JSON_KEY:'Duplicate JSON keys are ambiguous and are refused.',REQUEST_TOO_DEEP:'Nested request data exceeds the supported schema depth.'
};
function show(result:ReturnType<typeof createPaymentRequestDraft>){
 current=result;reviewedFormFingerprint=result.status==='DRAFT_READY'?requestFingerprint():null;
 if(result.status==='REJECTED'){
  element('request-status').textContent='REJECTED';element('request-summary').textContent=`${issueText[result.issue]??"Request not accepted."} (${result.issue}) No confirmation or payment occurred.`;return;
 }
 const d=result.draft;
 element('request-status').textContent='UNCONFIRMED DRAFT';
 element('request-summary').textContent=[`Reference: ${d.request.requestId}`,`Requested network: ${d.request.network} (not verified)`,
 `Expires: ${new Date(d.request.expiresAt).toISOString()}`,
 ...d.display.recipients.flatMap((r,i)=>[`Recipient ${i+1}: ${r.address}`,`Locking script: ${r.script}`,`BCH sent to this recipient: ${r.satoshis} satoshis`,...(r.token?[`Token category: ${r.token.category}`,`Token amount: ${r.token.amountAtomic} integer base units (decimals and symbol not verified)`]:['No tokens requested'])]),
 `Total recipient BCH: ${d.display.recipientSatoshis} satoshis`,`Maximum transaction fee: ${d.display.maxFeeSatoshis} satoshis`,
 `Request digest: ${d.requestDigest}`,'No funds, ownership or merchant identity verified. No signature, broadcast or receipt.',...d.limitations].join('\n');
 confirmButton.disabled=false;
 expiryTimer=setTimeout(()=>invalidate('Request expired. Create or import a fresh request; no payment occurred.'),Math.max(0,d.request.expiresAt-Date.now()));
}
function fail(message:string){invalidate();element('request-status').textContent='INVALID INPUT';element('request-summary').textContent=message;}
function revalidate(){
 if(current?.status!=='DRAFT_READY')return null;
 if(reviewedFormFingerprint!==requestFingerprint()){invalidate('Visible request fields changed. Review again; previous funding and plans were cleared.');return null;}
 const fresh=createPaymentRequestDraft(current.draft.request,Date.now());
 if(fresh.status!=='DRAFT_READY'){invalidate(`Request is no longer valid: ${fresh.issue}. Review a fresh request.`);return null;}
 if(fresh.draft.requestDigest!==current.draft.requestDigest){invalidate('Request details changed. Review again.');return null;}
 return fresh;
}
for(const id of ['request-id','request-network','request-address','request-bch','request-fee','request-category','request-token','request-expiry','request-import']){
 field(id).addEventListener('input',()=>invalidate());field(id).addEventListener('change',()=>invalidate());
}
field('request-asset').addEventListener('change',()=>{invalidate();const token=field('request-asset').value==='token';element('category-field').hidden=!token;element('token-field').hidden=!token;});
element('request-review').addEventListener('click',()=>{const previousFields=reviewedFormFingerprint??loadedExampleRequestFingerprint;if(previousFields!==null&&previousFields!==requestFingerprint())clearFunding();invalidate(undefined,false);try{show(createPaymentRequestDraft(createFromFields(),Date.now()));}catch(e){fail(e instanceof Error?e.message:'Invalid request fields.');}});
element('request-import-run').addEventListener('click',()=>{invalidate();show(parsePaymentRequestDraft(field('request-import').value,Date.now()));});
confirmButton.addEventListener('click',()=>{const fresh=revalidate();if(!fresh)return;element('request-status').textContent='LOCALLY REVIEWED · NOT APPROVED TO PAY';element('request-confirm-status').textContent='You reviewed these exact details in this tab. This is not a wallet authorization or proof of recipient identity.';exportButton.disabled=false;confirmButton.disabled=true;reviewedDigest=fresh.draft.requestDigest;updatePlanButton();});
exportButton.addEventListener('click',()=>{const fresh=revalidate();if(!fresh||exportButton.disabled)return;try{
 const json=exportPaymentRequest(fresh.draft.request,Date.now());const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='intentguard-unconfirmed-request.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch{invalidate('Request could not be exported. Review again.');}});
element('request-clear').addEventListener('click',()=>{for(const id of ['request-id','request-address','request-bch','request-fee','request-category','request-token','request-expiry','request-import'])field(id).value='';invalidate();});
window.addEventListener('focus',()=>{revalidate();checkPlanFreshness();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){revalidate();checkPlanFreshness();}});

const planningIssues:Record<string,string>={
 FORM_FUNDING_CHANGED:'Funding fields changed after acknowledgement. Check the current fields again and rebuild.',
 FORM_UTC_REQUIRED:'Enter the observation time as YYYY-MM-DDTHH:mm:ssZ in UTC.',FORM_UTC_INVALID:'Enter a real UTC observation date.',
 FORM_FUNDING_ADDRESS:'Funding and change need complete same-network P2PKH CashAddr addresses, without mixed case.',
 FORM_CHANGE_OWNER_MISMATCH:'This form only supports change to the same declared owner script.',FORM_OUTPUT_INDEX:'Enter a canonical whole-number output index.',
 FORM_PARENT_HEX:'Supply a complete canonical parent transaction as lowercase hexadecimal, at most 100 KB.',
 FORM_OUTPUT_MISSING:'That output index does not exist in the supplied parent.',FORM_INPUT_OWNER_MISMATCH:'The selected parent output does not match the declared owner address.',FORM_NFT_UNSUPPORTED:'NFT-bearing funding is not supported.',
 FORM_SIGNATURE_MODEL:'Choose an explicit signature-size assumption.',STALE_OR_INVALID_SNAPSHOT:'The supplied observation is future-dated or more than two minutes old. Update it explicitly; nothing is refreshed from a node.',
 FEE_LIMIT:'The constructed fee exceeds the request’s absolute fee cap.',FEE_RATE_LIMIT:'The conservative signed-size model exceeds the selected fee-rate cap.',
 INSUFFICIENT_BCH:'The selected output cannot cover the recipients, token carrying BCH and fee.',INSUFFICIENT_TOKEN:'The selected output has insufficient units of the requested token.',
 UNDECLARED_TOKEN:'The funding output contains a token category absent from the request.',AMBIGUOUS_RECIPIENT_CHANGE:'A recipient cannot also be the declared owner/change script.',
 INVALID_FEE_POLICY:'Enter supported positive integer rates and a maximum at least as high as the target.',INVALID_INTEGER:'Enter canonical integer fee-rate values.',
 BCH_CHANGE_REQUIRES_DONATION:'The remaining BCH cannot form change. Dust donation requires an explicit choice and still must pass all fee limits.',
 BCH_REMAINDER_NOT_DUST:'The remainder is not eligible for dust-only donation.',REQUEST_PLAN_REVIEW_CHANGED:'The request differs from the details reviewed in this tab.',
 REQUEST_PLAN_INVALID_CONTEXT:'Funding fields do not form a supported, bounded offline context.',REQUEST_EXPIRED:'The request has expired.'
};
function fundingFields():OfflineFundingFields{return {ownerAddress:field('funding-owner').value,changeAddress:field('funding-change').value,parentHex:field('funding-parent').value,outputIndex:field('funding-index').value,observedAtUtc:field('funding-observed').value,targetRate:field('funding-rate').value,maxRate:field('funding-max-rate').value,signatureModel:field('funding-model').value,allowDustToFee:field('funding-dust').checked};}
function fundingEdited(){acknowledgedFundingFingerprint=null;field('funding-ack').checked=false;fundingOrigin='supplied-offline';element('funding-origin').textContent='SUPPLIED OFFLINE CLAIMS. Values were entered or edited; no source, ownership or spendability was verified.';clearPlan('Funding context changed. Check it again and rebuild; the previous plan is invalid.');}
for(const id of [...fundingIds,'funding-dust']){field(id).addEventListener('input',fundingEdited);field(id).addEventListener('change',fundingEdited);}
field('funding-ack').addEventListener('change',()=>{if(field('funding-ack').checked&&(fundingOrigin==='none'||(fundingOrigin==='synthetic-example'&&loadedExampleFundingFingerprint!==fundingFingerprint()))){fundingOrigin='supplied-offline';element('funding-origin').textContent='SUPPLIED OFFLINE CLAIMS. Current fields differ from any loaded example; no source or ownership was verified.';}acknowledgedFundingFingerprint=field('funding-ack').checked?fundingFingerprint():null;clearPlan('Funding acknowledgement changed. Build again to obtain a current offline result.');});
element('funding-clear').addEventListener('click',()=>{clearFunding();clearPlan('Funding cleared. No current plan.');});
function loadExample(token:boolean){
 invalidate();const sample=syntheticRequestPlanningExample(token,Date.now());const r=sample.request,f=sample.funding;
 field('request-id').value=r.requestId;field('request-network').value=r.network;field('request-asset').value=token?'token':'bch';
 field('request-address').value=r.recipients[0]!.address;field('request-bch').value=r.recipients[0]!.bch;field('request-fee').value='600';
 field('request-category').value=r.recipients[0]!.token?.category??'';field('request-token').value=r.recipients[0]!.token?.amountAtomic??'';
 field('request-expiry').value=new Date(r.expiresAt).toISOString().replace('.000Z','Z');field('request-import').value='';element('category-field').hidden=!token;element('token-field').hidden=!token;
 for(const [id,value] of [['funding-owner',f.ownerAddress],['funding-change',f.changeAddress],['funding-parent',f.parentHex],['funding-index',f.outputIndex],['funding-observed',f.observedAtUtc],['funding-rate',f.targetRate],['funding-max-rate',f.maxRate],['funding-model',f.signatureModel]] as const)field(id).value=value;
 loadedExampleRequestFingerprint=requestFingerprint();loadedExampleFundingFingerprint=fundingFingerprint();fundingOrigin='synthetic-example';element('funding-origin').textContent='SYNTHETIC EXAMPLE. The entire request and invented funding context were replaced together. No coins, ownership or network evidence exist.';
 element('request-summary').textContent='Full synthetic example loaded. Review the request, then separately check the offline funding context. Editing any request field clears this example’s funding.';
}
element('example-bch').addEventListener('click',()=>loadExample(false));element('example-token').addEventListener('click',()=>loadExample(true));
function planFailure(code:string){clearPlan();field('funding-ack').checked=false;updatePlanButton();element('plan-status').textContent='REJECTED';element('plan-summary').textContent=`${planningIssues[code]??issueText[code]??'The offline plan was refused.'} (${code}) No signing or payment occurred.`;}
function computePlan():RequestPlanResult|null{
 const fresh=revalidate();if(!fresh||!reviewedDigest||fresh.draft.requestDigest!==reviewedDigest||!field('funding-ack').checked)return null;
 if(acknowledgedFundingFingerprint!==fundingFingerprint()){acknowledgedFundingFingerprint=null;planFailure('FORM_FUNDING_CHANGED');return null;}
 try{return buildPaymentRequestPlan(fresh.draft.request,reviewedDigest,contextFromFundingFields(fundingFields(),fresh.draft.request.network),Date.now());}catch(e){const code=e instanceof Error?e.message:'';planFailure(Object.hasOwn(planningIssues,code)?code:'REQUEST_PLAN_INVALID_CONTEXT');return null;}
}
function checkPlanFreshness(){
 if(!activePlan)return;const fresh=computePlan();
 if(!fresh||fresh.status!=='REQUEST_PLAN_BOUND_OFFLINE'||fresh.binding?.requestPlanDigest!==activePlan.binding?.requestPlanDigest){
  if(fresh?.status==='REJECTED')planFailure(fresh.builderIssue??fresh.issue??'REQUEST_PLAN_INVALID_CONTEXT');else clearPlan('The offline plan is no longer current. Review and build again.');
 }
}
planButton.addEventListener('click',()=>{
 clearPlan();const result=computePlan();if(!result)return;if(result.status!=='REQUEST_PLAN_BOUND_OFFLINE'){planFailure(result.builderIssue??result.issue??'REQUEST_PLAN_INVALID_CONTEXT');return;}
 activePlan=result;const origin=fundingOrigin==='synthetic-example'?'synthetic-example':'supplied-offline';element('plan-status').textContent='OFFLINE PLAN · NOT APPROVED TO PAY';element('plan-summary').textContent=requestPlanSummary(result,origin);
 element('plan-technical').textContent=JSON.stringify(result,null,2);planExport.disabled=false;
 const observed=contextFromFundingFields(fundingFields(),result.intent!.network).snapshot.observedAt;
 planTimer=setTimeout(()=>{field('funding-ack').checked=false;clearPlan('Offline observation expired after two minutes. Explicitly supply updated context and rebuild. No node was queried.');},Math.max(0,Math.min(result.intent!.expiresAt,observed+120001)-Date.now()));
});
planExport.addEventListener('click',()=>{
 if(!activePlan||planExport.disabled)return;const previous=activePlan;const fresh=computePlan();
 if(!fresh||fresh.status!=='REQUEST_PLAN_BOUND_OFFLINE'||fresh.binding?.requestPlanDigest!==previous.binding?.requestPlanDigest){if(fresh?.status==='REJECTED')planFailure(fresh.builderIssue??fresh.issue??'REQUEST_PLAN_INVALID_CONTEXT');else if(activePlan)clearPlan('The offline plan no longer matches the checked fields. Review and rebuild.');return;}
 const report={kind:'intentguard-offline-plan-report',generatedAt:Date.now(),contextKind:fundingOrigin,canSign:false,broadcastable:false,receiptValid:false,networkVerified:false,ownershipVerified:false,binding:fresh.binding,outputSummary:fresh.plan!.outputSummary,feeSatoshis:fresh.plan!.feeSatoshis,estimatedSignedBytes:fresh.plan!.estimatedSignedBytes,limitations:fresh.limitations};
 const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='intentguard-offline-plan-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
invalidate();
