/** Synthetic unbroadcast transaction graph, no wallet or signing material. */
import {binToHex, encodeTransaction, hashTransaction,hexToBin,type Transaction} from '@bitauth/libauth';
import type {GuardInput} from './guard.js';
export const owner='76a914'+'11'.repeat(20)+'88ac';
export const merchant='76a914'+'22'.repeat(20)+'88ac';
export const stranger='76a914'+'33'.repeat(20)+'88ac';
export const category='44'.repeat(32);
export function fixture(withToken=false):{input:GuardInput;candidate:Transaction;parent:Transaction}{
 const parent:Transaction={version:2,locktime:0,inputs:[{outpointTransactionHash:new Uint8Array(32).fill(0x55),outpointIndex:1,sequenceNumber:0xffffffff,unlockingBytecode:hexToBin('00')}],outputs:[{valueSatoshis:10000n,lockingBytecode:hexToBin(owner),...(withToken?{token:{category:hexToBin(category),amount:500n}}:{})}]};
 const parentHex=binToHex(encodeTransaction(parent)); const id=hashTransaction(encodeTransaction(parent));
 const candidate:Transaction={version:2,locktime:0,inputs:[{outpointTransactionHash:hexToBin(id),outpointIndex:0,sequenceNumber:0xffffffff,unlockingBytecode:new Uint8Array()}],outputs:[{valueSatoshis:1000n,lockingBytecode:hexToBin(merchant),...(withToken?{token:{category:hexToBin(category),amount:100n}}:{})},{valueSatoshis:8500n,lockingBytecode:hexToBin(owner),...(withToken?{token:{category:hexToBin(category),amount:400n}}:{})}]};
 const input:GuardInput={now:1_800_000_000_000,intent:{network:'chipnet',expiresAt:1_800_000_060_000,maxFeeSatoshis:'600',ownerScripts:[owner],recipients:[{script:merchant,satoshis:'1000',...(withToken?{token:{category,amount:'100'}}:{})}]},candidateHex:binToHex(encodeTransaction(candidate)),snapshot:{network:'chipnet',observedAt:1_800_000_000_000,parentTransactionHexes:[parentHex],unspentOutpoints:[id+':0']}};
 return {input,candidate,parent};
}
