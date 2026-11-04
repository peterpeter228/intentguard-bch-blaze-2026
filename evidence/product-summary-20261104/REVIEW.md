# Independent parent-bound verifier and presentation review

November 4, 2026, 16:07–16:10 UTC. Reviewed local workspace `bch-clean-7d2246cd`. Implementation was not edited by this reviewer.

## Finding, repair and independent retest

**Resource amplification before validation:** the initial parent-bound helper resolved and serialized source outputs before the lower-level verifier checked transaction input count, duplicate outpoints and supported source scripts. A bounded raw candidate could repeat a large parent output many times, producing an unnecessarily large intermediate encoded array before rejection. Static worst-case reasoning indicated hundreds of megabytes; that payload was **not executed**.

A safe, small derived negative using 100 inputs and a 1000-byte unsupported parent script independently reproduced the ordering problem: the original code returned `SIGNATURE_VALIDATION_FAILED` with nested `INVALID_ENCODING`, showing that expanded source data reached the lower-level 20 KB limit rather than failing the input-count limit first. This was a modified invalid test case, not a newly signed transaction; no signing or broadcast occurred.

The repair now checks 1–20 inputs and 1–41 outputs immediately after candidate decoding, rejects duplicate outpoints before parent parsing, then requires each resolved source to be P2PKH and NFT-free before serialization. Source expansion is therefore bounded by the supported input count and source shape.

Independent final retest after recompilation:

- Unmodified official Trezor parent/child: `SIGNATURES_VALID_PARENT_BOUND`; both inputs verify.
- Same small 100-input negative: `INPUT_OUTPUT_LIMIT`, nested verifier not reached.
- Duplicate outpoint: `DUPLICATE_INPUT`, nested verifier not reached.
- Two-input negative with a 1000-byte source script: `UNSUPPORTED_SOURCE_SCRIPT`, nested verifier not reached.
- Focused signature/presentation suite: **19 passed, 0 failed**.

No further critical issue found within the reviewed scope. The parent-bound helper is shared by the higher plan verifier, but does not weaken its version-2 builder policy or exact-plan checks. Historical version-1 cryptographic success is not full plan acceptance.

## Presentation review

`presentation.ts` formats internally computed results; it does not validate imported success objects. The UI calls the comparator/builder first, places summaries through `textContent`, retains full script/category/base-unit amounts, and invalidates summaries/results when input changes. Technical reports remain available in collapsed details. Plan export retains the explicit summary allowlist; it does not add raw transactions, outpoints, scripts or caller input. No live-chain/payment/wallet success is inferred from offline comparison or construction.

This was code-level review and focused tests, not independent browser visual QA. Upstream vector provenance and license notices are in `evidence/signature-positive-20261104/FULL_PARENT_SEARCH.md`.

## Commands actually executed

```sh
node_modules/.bin/tsc
node --input-type=module <<'JS'
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {decodeTransaction,encodeTransaction,hexToBin,binToHex,hashTransaction} from '@bitauth/libauth';import {verifyParentBoundP2pkhSignatures} from './dist/core/signed-verifier.js';
const v=JSON.parse(readFileSync('evidence/signature-positive-20261104/trezor-public-parent-child.json','utf8'));
for(const mode of ['original','100-input','duplicate','long-source']){const p=decodeTransaction(hexToBin(v.parentHex)),c=decodeTransaction(hexToBin(v.childHex));if(mode==='100-input'||mode==='long-source')p.outputs[0].lockingBytecode=new Uint8Array(1000).fill(0x51);const raw=binToHex(encodeTransaction(p)),id=hashTransaction(encodeTransaction(p));if(mode==='100-input')c.inputs=Array.from({length:100},()=>({...c.inputs[0],outpointTransactionHash:hexToBin(id),outpointIndex:0,unlockingBytecode:new Uint8Array()}));if(mode==='duplicate')c.inputs.push({...c.inputs[0]});if(mode==='long-source')c.inputs=c.inputs.map(i=>({...i,outpointTransactionHash:hexToBin(id)}));const r=verifyParentBoundP2pkhSignatures({signedHex:binToHex(encodeTransaction(c)),parentTransactionHexes:[raw],signatureModel:'compressed-p2pkh-low-s-ecdsa'});const want={original:null,'100-input':'INPUT_OUTPUT_LIMIT',duplicate:'DUPLICATE_INPUT','long-source':'UNSUPPORTED_SOURCE_SCRIPT'}[mode];assert.equal(r.issue,want);if(mode==='original')assert.equal(r.status,'SIGNATURES_VALID_PARENT_BOUND');else assert.equal(r.signatureReport,null);console.log(JSON.stringify({mode,status:r.status,issue:r.issue,nestedVerifierReached:r.signatureReport!==null}));}
JS
node --test dist/core/signed-verifier.test.js dist/core/presentation.test.js | tail -9
sha256sum core/signed-verifier.ts core/signed-verifier.test.ts core/presentation.ts core/presentation.test.ts core/ui.ts evidence/signature-positive-20261104/trezor-public-parent-child.json
```

The pre-repair reproduction used the same 100-input/1000-byte derived negative and printed `SIGNATURE_VALIDATION_FAILED / INVALID_ENCODING`. No large-memory stress test was run.

## Reviewed final SHA-256

- `core/signed-verifier.ts`: `f0f7d75847cd9e2525ec9b3636a8f159dd50c45ece3c86dda82c915e09fd96cf`
- `core/signed-verifier.test.ts`: `ee09b4518b6a93e557f5debc88ada7f50f0b2b5f5f1b54e454febc58d4a47f53`
- `core/presentation.ts`: `b88ea82a3c73302778ff9f6c91331331a038e601b2153c7fce0e615e97b43641`
- `core/presentation.test.ts`: `38f5aaee6d82f20a15c1dfab66b7139f8bffeb0f0a6590db6910bcd28be7d35a`
- `core/ui.ts`: `d3e427d8858c0cc7e8488377a49661388fb842ef7b41f41cf4d572df0ec9b5cb`
- Trezor public subset: `3cd840f388450800a8ac579d55cb3e0ddbb9fc68548d1c65f23fe55d227a4756`

## Remaining boundaries

No complete v2 application-plan positive, supported compressed-P2PKH 0x61/token-input positive, live chain query, wallet integration, key generation, signing, transaction submission or payment proof was established. Parent-content matching proves referenced bytes, not current UTXO state or chain provenance. All authority/chain flags remain false. Research used already-published public fixtures; review execution was local verify-only.
