import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {binToHex,encodeTransaction} from '@bitauth/libauth';
import {syntheticCase} from '../../dist/preseason/allowance/lab.js';
import {AUTHORITY} from '../../dist/preseason/allowance/template.js';
import {inspectSyntheticFunding} from '../../dist/preseason/allowance/funding.js';
const results=[];
const make=(n=3,index=0,payout='1000',delay=6)=>{
 const c=syntheticCase({payoutSatoshis:payout,delayBlocks:delay},n);
 for(let i=0;i<index;i++)c.parent.outputs.unshift({valueSatoshis:1000n,lockingBytecode:new Uint8Array([0x51])});
 return {parent:c.parent,request:{parentTransactionHex:binToHex(encodeTransaction(c.parent)),outputIndex:index,parameters:{payoutSatoshis:payout,delayBlocks:delay},plannedTranches:n,policy:{feeSatPerKb:'1000',dustRelayFeeSatPerKb:'1000'}}};
};
const inspect=(name,request)=>{const started=performance.now();const r=inspectSyntheticFunding(request);assert(Object.isFrozen(r),name+' report frozen');for(const k of Object.keys(AUTHORITY))assert.equal(r[k],false,name+' '+k);const json=JSON.stringify(r);if(request?.parentTransactionHex?.length>64)assert(!json.includes(request.parentTransactionHex),name+' no parent bytes');assert(!/"(?:address|rawTransaction|serializedTransaction|lockingBytecode|unlockingBytecode)"/.test(json),name+' no spend payload');results.push({name,result:r,elapsedMs:Math.round(performance.now()-started)});return r;};
const good=inspect('three-tranche-baseline',make().request);
assert.equal(typeof good.status,'string');
const pass=(name,request)=>{const r=inspect(name,request);assert.equal(r.status,good.status,name);return r;};
const fail=(name,request)=>{const r=inspect(name,request);assert.notEqual(r.status,good.status,name);return r;};
pass('nonzero-output-index',make(3,2).request);
pass('terminal-minimum-payout',make(1,0,'546',1).request);
pass('maximum-count-and-parameters',make(100,0,'1000000000',65535).request);
for(const n of [1,2,4,100]){const {request}=make();request.plannedTranches=n;fail('intent-N-'+n,request);}
for(const amount of [0n,1n,1999n,2001n,202000n,18446744073709551615n]){const {parent,request}=make();parent.outputs[0].valueSatoshis=amount;request.parentTransactionHex=binToHex(encodeTransaction(parent));fail('invalid-source-'+amount,request);}
for(const capability of ['none','mutable','minting','FT']){const {parent,request}=make();parent.outputs[0].token={category:new Uint8Array(32).fill(0x44),amount:capability==='FT'?1n:0n,...(capability==='FT'?{}:{nft:{capability,commitment:new Uint8Array()}})};request.parentTransactionHex=binToHex(encodeTransaction(parent));fail('source-token-'+capability,request);}
for(const key of ['payoutSatoshis','delayBlocks']){const {request}=make();request.parameters[key]=key==='payoutSatoshis'?'1001':7;fail('mismatched-'+key,request);}
for(const index of [-1,0.5,NaN,Infinity,1,4294967295]){const {request}=make();request.outputIndex=index;fail('invalid-index-'+index,request);}
for(const hex of ['', '00', make().request.parentTransactionHex+'00','00'.repeat(65537)]){const {request}=make();request.parentTransactionHex=hex;fail('malformed-hex-length-'+hex.length,request);}
for(const path of ['root','parameters','policy']){const {request}=make();const target=path==='root'?request:request[path];let reads=0;Object.defineProperty(target,'injected',{get(){reads++;throw Error('getter executed');},enumerable:true});fail('accessor-'+path,request);assert.equal(reads,0);}
for(const path of ['root','parameters','policy']){const {request}=make();const target=path==='root'?request:request[path];target[Symbol('unknown')]=true;fail('symbol-'+path,request);}
for(const key of ['feeSatPerKb','dustRelayFeeSatPerKb'])for(const val of ['-1','1.0','1e3','01000','1000001',1000,null]){const {request}=make();request.policy[key]=val;fail('invalid-policy-'+key+'-'+String(val),request);}
for(const key of ['feeSatPerKb','dustRelayFeeSatPerKb']){const {request}=make();request.policy[key]='1000000';fail('policy-insufficient-'+key,request);}
// Each continuation is 333 bytes and terminal 289 at these fixed parameters.
const expectedMetrics={tranches:3,verifiedSteps:3,totalSerializedBytes:955,minimumSerializedBytes:289,maximumSerializedBytes:333,initialSatoshis:'6000',totalPaidSatoshis:'3000',totalFeeSatoshis:'3000',remainingReserveSatoshis:'0',feeFailingSteps:0,dustFailingSteps:0,minimumFeeHeadroomSatoshis:'667',maximumPayoutDustThresholdSatoshis:'546',maximumReserveDustThresholdSatoshis:'576'};for(const [key,val]of Object.entries(expectedMetrics))assert.equal(good.metrics[key],val,key);
assert(Object.isFrozen(good.metrics));assert(Object.isFrozen(good.policy));assert(Object.isFrozen(good.limits));
{const {request}=make();request.policy.feeSatPerKb='3003';const r=pass('exact-fee-floor-pass',request);assert.equal(r.metrics.minimumFeeHeadroomSatoshis,'0');}
{const {request}=make();request.policy.feeSatPerKb='3004';const r=fail('continuations-only-fee-failure',request);assert.equal(r.metrics.feeFailingSteps,2);assert.equal(r.metrics.verifiedSteps,3);}
{const {request}=make();request.policy.feeSatPerKb='3461';const r=fail('terminal-also-fee-failure',request);assert.equal(r.metrics.feeFailingSteps,3);}
{const {request}=make(3,0,'546');request.policy.dustRelayFeeSatPerKb='1011';const r=fail('every-payout-dust-failure',request);assert.equal(r.metrics.dustFailingSteps,3);}
{const {request}=make();request.policy={feeSatPerKb:'0',dustRelayFeeSatPerKb:'0'};fail('explicit-zero-policy',request);}
{const {request}=make(3,1);request.outputIndex=0;fail('wrong-valid-parent-output',request);}
{const {request}=make(1,0,'550000');request.policy.dustRelayFeeSatPerKb='1000000';fail('initial-source-dust-only',request);}
for(const val of [null,[],{},Object.create(null)])fail('non-schema-'+(val===null?'null':Array.isArray(val)?'array':'object'),val);
const files=['preseason/allowance/funding.ts','preseason/allowance/funding.test.ts','preseason/allowance/template.ts','preseason/allowance/lab.ts'];
console.log(JSON.stringify({timestamp:new Date().toISOString(),scope:'independent synthetic-only bounded probes',sourceHashes:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(new URL('../../'+f,import.meta.url))).digest('hex')])),assertions:{allReportsFrozen:true,allAuthorityFlagsFalse:true,noRawTransactionsScriptsOrAddresses:true,nestedSuccessReportFrozen:true,accessorsNotExecuted:true},results:results.map(({name,result,elapsedMs})=>({name,status:result.status,issue:result.issue,...(result.metrics?{metrics:result.metrics}:{}),elapsedMs}))},null,2));
