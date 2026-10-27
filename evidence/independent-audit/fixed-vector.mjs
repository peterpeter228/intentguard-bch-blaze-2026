import assert from 'node:assert/strict';

const sdk=await import('@bitauth/libauth');
// Hand-field-assembled synthetic serialization oracle, not chain history or a valid spend.
const raw='0200000001'+'11'.repeat(32)+'0100000000ffffffff01e8030000000000001976a914'+'22'.repeat(20)+'88ac00000000';
const decoded=sdk.decodeTransaction(sdk.hexToBin(raw));
assert.notEqual(typeof decoded,'string');
assert.equal(decoded.version,2);assert.equal(decoded.locktime,0);
assert.equal(decoded.inputs.length,1);assert.equal(decoded.inputs[0].outpointIndex,1);
assert.equal(decoded.outputs[0].valueSatoshis,1000n);
assert.equal(sdk.binToHex(decoded.outputs[0].lockingBytecode),'76a914'+'22'.repeat(20)+'88ac');
assert.equal(sdk.binToHex(sdk.encodeTransaction(decoded)),raw);
console.log(JSON.stringify({kind:'SYNTHETIC_FIXED_SERIALIZATION_VECTOR',pass:true,bytes:raw.length/2,raw,txid:sdk.hashTransaction(sdk.hexToBin(raw)),broadcast:false,consensus_validity:'NOT_TESTED'},null,2));
