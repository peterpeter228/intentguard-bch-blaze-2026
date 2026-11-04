/** Offline consumer of actual guard API. Synthetic bytes, never a wallet payment. */
import {binToHex,encodeTransaction,hexToBin} from '@bitauth/libauth';
import {verifyCandidate} from './guard.js';import {fixture,stranger} from './fixtures.js';
const normal=fixture(true), attack=fixture(true);
attack.candidate.outputs[0]!.lockingBytecode=hexToBin(stranger);attack.input.candidateHex=binToHex(encodeTransaction(attack.candidate));
console.log(JSON.stringify({evidence:'SYNTHETIC_UNBROADCAST',normal:verifyCandidate(normal.input),recipientReplaced:verifyCandidate(attack.input)},null,2));
