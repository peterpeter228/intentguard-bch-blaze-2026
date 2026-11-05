import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {binToHex, hexToBin, encodeTransaction, decodeTransaction, getDustThreshold} from '@bitauth/libauth';
import {completeMergedOutput} from '@xo-cash/engine';
import {syntheticCase, verifySynthetic, verifyParentBoundSynthetic} from '../../dist/preseason/allowance/lab.js';
let positive=0, negative=0; const sizes=[];
for (const payoutSatoshis of ['546','1000','1000000000']) for(const delayBlocks of [1,16,17,127,128,255,256,32767,32768,65535]) for(const n of [1,2,100]) {
 const c=syntheticCase({payoutSatoshis,delayBlocks},n);
 assert.equal(verifySynthetic(c.transaction,[c.sourceOutput]),true);positive++;
 const raw=encodeTransaction(c.transaction), decoded=decodeTransaction(raw);assert.notEqual(typeof decoded,'string');
 assert.equal(raw.length,c.serializedBytes);assert.equal(binToHex(encodeTransaction(decoded)),binToHex(raw));
 assert(c.transaction.outputs.every(o=>o.valueSatoshis>=getDustThreshold(o)));assert(c.serializedBytes<=1000);sizes.push(c.serializedBytes);
}
for(const n of Array.from({length:100},(_,i)=>i+1)){const c=syntheticCase({payoutSatoshis:'546',delayBlocks:1},n);assert.equal(verifySynthetic(c.transaction,[c.sourceOutput]),true);positive++;}
for(const n of [1,2]) for(const attack of ['negative-source','huge-source','extra-redeem','output-token-balanced','alternate-beneficiary','extra-change','index-one']) {
 const c=syntheticCase({payoutSatoshis:'1000',delayBlocks:6},n);
 if(attack==='negative-source')c.sourceOutput.valueSatoshis=-1n;
 if(attack==='huge-source')c.sourceOutput.valueSatoshis=9223372036854775807n;
 if(attack==='extra-redeem')c.transaction.inputs[0].unlockingBytecode=Uint8Array.from([...c.transaction.inputs[0].unlockingBytecode,0x51]);
 if(attack==='output-token-balanced'){const t={category:new Uint8Array(32).fill(0x44),amount:0n,nft:{capability:'none',commitment:new Uint8Array([1,2,3])}};c.sourceOutput.token=t;c.transaction.outputs.at(-1).token=structuredClone(t);}
 if(attack==='alternate-beneficiary')c.transaction.outputs.at(-1).lockingBytecode=Uint8Array.from([0x51]);
 if(attack==='extra-change')c.transaction.outputs.push({valueSatoshis:n===1?720n:600n,lockingBytecode:c.transaction.outputs.at(-1).lockingBytecode});
 if(attack==='index-one'){c.transaction.inputs.unshift({...structuredClone(c.transaction.inputs[0]),outpointIndex:2,unlockingBytecode:new Uint8Array()});assert.notEqual(verifySynthetic(c.transaction,[{valueSatoshis:1n,lockingBytecode:Uint8Array.from([0x51])},c.sourceOutput]),true);negative++;continue;}
 assert.notEqual(verifySynthetic(c.transaction,[c.sourceOutput]),true,`${n} ${attack}`);negative++;
}
const c=syntheticCase({payoutSatoshis:'1000',delayBlocks:6},2);c.transaction.inputs[0].outpointTransactionHash.fill(0x33);c.transaction.inputs[0].outpointIndex=999;
assert.equal(verifySynthetic(c.transaction,[c.sourceOutput]),true,'Stateless VM cannot authenticate source/outpoint links; this must remain disclosed.');
assert.notEqual(verifyParentBoundSynthetic(c.transaction,c.parent),true);
for(const delta of [-1n,1n,2000n]){const c=syntheticCase({payoutSatoshis:'1000',delayBlocks:6},3);c.merged.variables[0].value+=delta;c.merged.outputs[0]=completeMergedOutput({outputIdentifier:'reserve',sourceCommitIdentifier:'offline'},0,c.merged.variables,c.template,'continue');const tx=decodeTransaction(hexToBin(c.build().serializedTransaction));assert.notEqual(verifySynthetic(tx,[c.sourceOutput]),true);negative++;}
console.log(JSON.stringify({positive,negative,byteRange:[Math.min(...sizes),Math.max(...sizes)],statelessWrongOutpointAccepted:true,sourceHashes:Object.fromEntries(['template.ts','lab.ts','lab.test.ts'].map(f=>[f,createHash('sha256').update(readFileSync(new URL('../../preseason/allowance/'+f,import.meta.url))).digest('hex')]))},null,2));
