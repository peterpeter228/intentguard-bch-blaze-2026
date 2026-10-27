/** All transaction/address data below is SYNTHETIC teaching data, never funded or broadcast. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { CashAddressType, encodeCashAddress, decodeCashAddress, encodeTransaction, decodeTransaction, hashTransaction, binToHex, hexToBin, type Transaction } from '@bitauth/libauth';
import { DappConnectionManager } from '@wizardconnect/dapp';
import type { SignTransactionRequest, SignTransactionResponse } from '@wizardconnect/core';
const tx: Transaction = { version: 2, locktime: 0, inputs: [{ outpointTransactionHash: new Uint8Array(32).fill(0x11), outpointIndex: 1, sequenceNumber: 0xffffffff, unlockingBytecode: new Uint8Array() }], outputs: [{ valueSatoshis: 9007199254740993n, lockingBytecode: hexToBin('76a914' + '22'.repeat(20) + '88ac'), token: { category: new Uint8Array(32).fill(0x33), amount: 9007199254740993n } }] };
test('synthetic CashTokens transaction byte roundtrip preserves bigint > 2^53', () => {
 const bytes = encodeTransaction(tx); const decoded = decodeTransaction(bytes);
 assert.notEqual(typeof decoded, 'string'); assert.deepEqual(decoded, tx);
 assert.equal(binToHex(encodeTransaction(tx)), binToHex(bytes));
});
test('SDK txid equals independent Node double-SHA256 UI byte order; not transaction hex', () => {
 const bytes = encodeTransaction(tx); const expected = Buffer.from(createHash('sha256').update(createHash('sha256').update(bytes).digest()).digest()).reverse().toString('hex');
 assert.equal(hashTransaction(bytes), expected); assert.equal(expected.length, 64); assert.notEqual(expected, binToHex(bytes));
});
test('truncated transaction is a decoder error, not a success object', () => { assert.equal(typeof decodeTransaction(encodeTransaction(tx).slice(0,-1)), 'string'); });
test('synthetic NFT structure is preserved by SDK decoding, not implicitly discarded', () => {
 const nftTx: Transaction = { ...tx, outputs: [{ ...tx.outputs[0]!, token: { category:new Uint8Array(32).fill(0x33),amount:0n,nft:{capability:'mutable',commitment:hexToBin('0102')} } }] };
 assert.deepEqual(decodeTransaction(encodeTransaction(nftTx)), nftTx);
});
for (const prefix of ['bitcoincash','bchtest'] as const) {
 for (const type of [CashAddressType.p2pkhWithTokens, CashAddressType.p2shWithTokens]) {
  test(`synthetic ${prefix} ${type} address roundtrip`, () => {
   const result = encodeCashAddress({prefix,type,payload:new Uint8Array(20).fill(0x22)});
   const decoded = decodeCashAddress(result.address); assert.notEqual(typeof decoded,'string');
   if(typeof decoded==='string') throw new Error(decoded);
   assert.equal(decoded.prefix,prefix); assert.equal(decoded.type,type); assert.deepEqual(decoded.payload,new Uint8Array(20).fill(0x22));
   assert.equal(typeof decodeCashAddress(result.address.slice(0,-1)+(result.address.endsWith('q')?'p':'q')),'string');
  });
 }
}
test('unpaired SDK manager has no derived pubkey/path or stored session', () => {
 const manager = new DappConnectionManager('G0 offline probe',undefined,{session:false});
 assert.equal(manager.getPubkey(0,0n),undefined); assert.equal(manager.hasPath(0),false); assert.equal(manager.loadStoredSession(),null); manager.destroy();
});
class OfflineManager extends DappConnectionManager {
 sent = 0; cancelled = 0;
 override nextSequence(): number { return 7; }
 override sendSignRequest(_request: SignTransactionRequest): Promise<SignTransactionResponse> { this.sent++; return new Promise(() => {}); }
 override async sendSignCancel(_sequence:number): Promise<void> { this.cancelled++; }
}
test('diagnostic: pre-aborted SDK request still invokes send before cancel (offline overridden transport)', async () => {
 const manager = new OfflineManager('G0 offline mock',undefined,{session:false}); const signal=AbortSignal.abort('probe');
 await assert.rejects(manager.signTransaction({transaction:{transaction:'00',sourceOutputs:[],broadcast:false},inputPaths:[]},{signal}),{name:'AbortError'});
 assert.equal(manager.sent,1); assert.equal(manager.cancelled,1); manager.destroy();
});
