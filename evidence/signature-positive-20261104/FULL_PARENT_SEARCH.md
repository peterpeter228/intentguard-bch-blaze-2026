# Public full-parent BCH fixture search

## Result first

Found a complete, already-published raw parent and signed P2PKH child in official Trezor test data. **Independent verification succeeded without changing either transaction:** both child inputs reference the calculated parent txid at output indices 0 and 1, and the pinned BCH2026 standard VM verifies both signatures. No keys or signing APIs were used.

- Parent txid: `502e8577b237b0152843a416f8f1ab0c63321b1be7a8cad7bf5c5c216fcf062c`.
- Child txid: `5594fd9e5e26dcb4437cbbbba517401720849159bac4e2158e1e6401ffd5fdb7`.
- Child: version **1**, two compressed-P2PKH ECDSA inputs, final sequences, locktime 0, one P2PKH output, fee 34542 sats, both sighash suffixes **0x41**.
- Explicit `createVirtualMachineBch2026(true).verify`: **true**.
- Existing `verifyResolvedP2pkhSignatures`: **SIGNATURES_VALID_STATELESS**, checkedInputs 2, all authority/chain flags false.

This closes the lack of public bytes for a **full-parent-bound cryptographic fixture**. It does **not** supply a positive for the application's complete v2-only unsigned-plan verifier. Do not modify version, outpoints, outputs or signatures to force compatibility, and do not weaken the builder policy. A separate parent-resolving verification layer can legitimately reuse these exact bytes. Strict P2PKH 0x61/token-positive coverage remains unestablished here.

## Immutable source and extraction

[Official source](https://github.com/trezor/trezor-firmware/blob/6cd69cbc347dd622879cc9dccd53bf58e4026ab1/tests/device_tests/bitcoin/test_bcash.py).

Repository commit: `6cd69cbc347dd622879cc9dccd53bf58e4026ab1`.
Discovered source-file Git blob: `655a8a5d0ff81a7cd477233dfb01670840aa7d34`.

The first literal `tx_hex` in `test_send_bch_change` is the parent. The next literal `tx_hex` in `test_send_bch_nochange` is its child. The file itself names these same transaction hashes in historical `bch1.trezor.io` links. **Those explorer links were not queried**; no present chain inclusion or unspentness claim is made. The tests' existing signing call text was read as source only. No Python tests, signing code or wallet code were executed.

`trezor-public-parent-child.json` retains only the commit/path and the two exact published hex strings. No key, seed, mnemonic or private test material was copied. Subset SHA-256: `3cd840f388450800a8ac579d55cb3e0ddbb9fc68548d1c65f23fe55d227a4756`.

The source file has its own SatoshiLabs/contributors LGPLv3 notice. The monorepo LICENSE.md also documents GPLv3 defaults and individual-file exceptions. Preserve the source notice; do not relabel this extraction as project-authored MIT data. Included `TREZOR_SOURCE_NOTICE.txt`, upstream root `TREZOR_COPYING.txt` (GPLv3) and upstream `python/COPYING` as `TREZOR_LGPL3.txt` retain the notices/text rather than silently inferring a different license. This report is not a legal opinion.

## Search performed and stopping condition

Research window: November 4, 2026, approximately 16:03–16:06 UTC.

- General web/GitHub searches of libauth, CashScript and mainnet-js yielded APIs or dynamically constructed tests, not an immediately usable static parent-child pair. Installed libauth VMB generators were not executed.
- Read-only GitHub search/listing of official Ledger and Trezor repositories located the Trezor BCH test file. An initial guessed `test_signtx_bcash.py` URL returned 404; directory listing revealed `test_bcash.py`. This was a missing path, not a permission denial.
- Pinned Trezor main to the commit above before retrieving source. The four literal child results in this file all use version 1; duplicate alternate-address/presigned cases do not establish v2 coverage.
- Stopped after independently proving the complete parent linkage and two signatures. No speculative live-node probing, authentication, network restriction bypass, key generation, signing, broadcasting or new transactions occurred.

## Reproduction

After retrieving the pure-public JSON subset, commands actually executed included `node_modules/.bin/tsc` followed by equivalent verify-only Node code below. The first run printed the result; the second retained `trezor-verification-result.json` with the extra fee/sighash details.

```js
import {readFileSync,writeFileSync} from 'node:fs';
import {decodeTransaction,hexToBin,hashTransaction,binToHex,encodeTransactionOutputs,createVirtualMachineBch2026} from '@bitauth/libauth';
import {verifyResolvedP2pkhSignatures} from './dist/core/signed-verifier.js';
const path='evidence/signature-positive-20261104/';
const v=JSON.parse(readFileSync(path+'trezor-public-parent-child.json','utf8'));
const p=decodeTransaction(hexToBin(v.parentHex)),c=decodeTransaction(hexToBin(v.childHex));
const pid=hashTransaction(hexToBin(v.parentHex));
const sources=c.inputs.map(i=>{
  if(binToHex(i.outpointTransactionHash)!==pid)throw Error('HASH_MISMATCH');
  if(!p.outputs[i.outpointIndex])throw Error('OUTPOINT_MISSING');
  return p.outputs[i.outpointIndex];
});
const fee=sources.reduce((a,o)=>a+o.valueSatoshis,0n)-c.outputs.reduce((a,o)=>a+o.valueSatoshis,0n);
console.log({parentTxid:pid,childTxid:hashTransaction(hexToBin(v.childHex)),feeSatoshis:fee.toString(),
  vm:createVirtualMachineBch2026(true).verify({transaction:c,sourceOutputs:sources}),
  report:verifyResolvedP2pkhSignatures({signedHex:v.childHex,
    sourceOutputsHex:binToHex(encodeTransactionOutputs(sources)),
    signatureModel:'compressed-p2pkh-low-s-ecdsa'})});
```

No full-parent source ancestor is required to establish that this child's referenced outputs equal the supplied parent's committed contents. This does not independently prove the parent's own ancestors, present chain membership, or current spendability. The fixture is public verification evidence only.
