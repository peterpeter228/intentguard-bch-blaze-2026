/** Isolated request drafts only. No wallet, storage, transport, or payment API. */
import {createPaymentRequestDraft,parsePaymentRequestDraft,exportPaymentRequest} from './payment-request.js';
const element=(id:string)=>document.getElementById(id)!;
const field=(id:string)=>element(id) as HTMLInputElement;
const confirmButton=element('request-confirm') as HTMLButtonElement;
const exportButton=element('request-export') as HTMLButtonElement;
let current:ReturnType<typeof createPaymentRequestDraft>|null=null;
let expiryTimer:ReturnType<typeof setTimeout>|undefined;
function invalidate(message='No current draft. Review again after any edit.'){
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
 current=result;
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
 const fresh=createPaymentRequestDraft(current.draft.request,Date.now());
 if(fresh.status!=='DRAFT_READY'){invalidate(`Request is no longer valid: ${fresh.issue}. Review a fresh request.`);return null;}
 if(fresh.draft.requestDigest!==current.draft.requestDigest){invalidate('Request details changed. Review again.');return null;}
 return fresh;
}
for(const id of ['request-id','request-network','request-address','request-bch','request-fee','request-category','request-token','request-expiry','request-import']){
 field(id).addEventListener('input',()=>invalidate());field(id).addEventListener('change',()=>invalidate());
}
field('request-asset').addEventListener('change',()=>{invalidate();const token=field('request-asset').value==='token';element('category-field').hidden=!token;element('token-field').hidden=!token;});
element('request-review').addEventListener('click',()=>{invalidate();try{show(createPaymentRequestDraft(createFromFields(),Date.now()));}catch(e){fail(e instanceof Error?e.message:'Invalid request fields.');}});
element('request-import-run').addEventListener('click',()=>{invalidate();show(parsePaymentRequestDraft(field('request-import').value,Date.now()));});
confirmButton.addEventListener('click',()=>{const fresh=revalidate();if(!fresh)return;element('request-status').textContent='LOCALLY REVIEWED · NOT APPROVED TO PAY';element('request-confirm-status').textContent='You reviewed these exact details in this tab. This is not a wallet authorization or proof of recipient identity.';exportButton.disabled=false;confirmButton.disabled=true;});
exportButton.addEventListener('click',()=>{const fresh=revalidate();if(!fresh||exportButton.disabled)return;try{
 const json=exportPaymentRequest(fresh.draft.request,Date.now());const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='intentguard-unconfirmed-request.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch{invalidate('Request could not be exported. Review again.');}});
element('request-clear').addEventListener('click',()=>{for(const id of ['request-id','request-address','request-bch','request-fee','request-category','request-token','request-expiry','request-import'])field(id).value='';invalidate();});
window.addEventListener('focus',()=>{revalidate();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)revalidate();});
invalidate();
