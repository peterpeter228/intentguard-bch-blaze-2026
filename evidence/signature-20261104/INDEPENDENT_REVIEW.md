# Independent signed-verifier and refresh review

November 4, 2026, 15:49–15:52 UTC. Local workspace `bch-clean-c54f5481`. No implementation edits, external requests, key generation, signing, wallet access, broadcast or payment were performed. This report and local compilation/test artifacts were written.

## Result

No critical bypass found in the reviewed scope. This is a bounded implementation review, not certification or live-chain acceptance.

- Recompiled the final source and ran signed-verifier plus coordinator tests: **34 passed, 0 failed** (12 signature and 22 coordinator tests).
- Independently evaluated **522 signature cases**: two unchanged published positives, all 256 sighash-byte values for each positive, and version/locktime/outpoint-index/sequence mutations. Only the original 0x41 signatures passed. Replacing the suffix with allowed 0x61 did not manufacture a valid signature; all other suffixes failed the explicit allowlist.
- Independent two-connection refresh experiment: exactly one caller won revision-1 refresh; the other received REVIEW_REVISION_CONFLICT. A later source failure produced UNKNOWN revision 5, retained six historical rows, did not restore prior success, and prevented further refresh without any additional source calls. Repeated review remained UNKNOWN/stale and did not recollect. Error text did not expose the injected private diagnostic.

## Security boundaries inspected

The signature helper accepts only exact two minimally encoded direct pushes, a compressed-key shape with matching source P2PKH hash, declared signature model and explicit 0x41/0x61 allowlist. Token-bearing transactions require 0x61 as stricter application policy. Every input is verified by explicit pinned `createVirtualMachineBch2026(true).verify`, not the backwards-compatible default 2023 alias. Installed libauth CHECKSIG paths use `verifySignatureDERLowS` for ECDSA and the BCH Schnorr verifier. The helper's source outputs remain caller assertions, not parent/chain proofs.

The higher verifier rebuilds the unsigned plan from validated input, overrides JSON time with the invocation clock, compares all non-unlocking structure, resolves full hash-bound parents in exact input order, checks actual byte size and fee rates, and calls the helper. It reports a distinct status; neither layer grants signing, broadcast, receipts, chain or network authority.

Refresh captures immutable request/session/path/source-metadata bindings, durably reserves a generation before collection, uses revision CAS and linked append-only history, and never resets UNKNOWN/PENDING. Old observations remain stale. Immediate return checks latest head, session, intent, collection time and tip age; journal integrity failure rejects. Schema-v1 journals are refused before writable PRAGMAs; migration remains unimplemented. Source metadata hashes do not authenticate transport implementation/backend identity.

## Explicit remaining gaps

- No complete-parent positive fixture for `verifySignedPlan`; its integration success path is not positively established.
- No strict compressed-P2PKH 0x61 positive or token-input positive. The policy and rejection paths are tested, not positive compatibility.
- Published fixture bytes are synthetic official test transactions, not observed mainnet/Chipnet payments. This review used the locally supplied pinned subset and its recorded provenance; it did not independently fetch upstream again.
- No live source/wallet, UTXO availability, current network/relay acceptance, persistent payment authorization or actual broadcast was tested.
- Existing time inputs, session adapter and source configuration remain trusted application capabilities. These offline results must not become externally supplied authorization tokens.

## Actual commands

Executed twice after implementation was present, including once after the worker reported it frozen:

```sh
node_modules/.bin/tsc
node --test dist/core/signed-verifier.test.js dist/core/review-coordinator.test.js | tail -9
```

Final result: tests 34, pass 34, fail 0, skipped 0. Independent signature cases were run with:

```sh
node --input-type=module <<'JS'
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {verifyResolvedP2pkhSignatures} from './dist/core/signed-verifier.js';import {decodeTransaction,encodeTransaction,hexToBin,binToHex} from '@bitauth/libauth';
const vs=JSON.parse(readFileSync('evidence/signature-20261104/bchn-p2pkh-public-vectors.json','utf8'));let checks=0;
for(const [index,v] of vs.entries()){
 const base={signedHex:v[4],sourceOutputsHex:v[5],signatureModel:index===0?'compressed-p2pkh-schnorr':'compressed-p2pkh-low-s-ecdsa'};
 assert.equal(verifyResolvedP2pkhSignatures(base).status,'SIGNATURES_VALID_STATELESS');checks++;
 for(let f=0;f<256;f++){const tx=decodeTransaction(hexToBin(base.signedHex));assert.notEqual(typeof tx,'string');tx.inputs[0].unlockingBytecode[tx.inputs[0].unlockingBytecode[0]]=f;const r=verifyResolvedP2pkhSignatures({...base,signedHex:binToHex(encodeTransaction(tx))});if(f===65)assert.equal(r.status,'SIGNATURES_VALID_STATELESS');else assert.equal(r.status,'REJECTED');if(f!==65&&f!==97)assert.equal(r.issue,'UNSAFE_SIGHASH');checks++;}
 for(const field of ['version','locktime']){const tx=decodeTransaction(hexToBin(base.signedHex));tx[field]++;assert.equal(verifyResolvedP2pkhSignatures({...base,signedHex:binToHex(encodeTransaction(tx))}).status,'REJECTED');checks++;}
 for(const field of ['outpointIndex','sequenceNumber']){const tx=decodeTransaction(hexToBin(base.signedHex));tx.inputs[0][field]++;assert.equal(verifyResolvedP2pkhSignatures({...base,signedHex:binToHex(encodeTransaction(tx))}).status,'REJECTED');checks++;}
}
console.log(JSON.stringify({independentAssertions:checks,publicPositives:2,sighashMutations:512,result:'PASS',signingPerformed:false}));
JS
```

The `independentAssertions` counter counts verification cases, not every individual assert invocation. Actual output: 522 cases, two positives, 512 sighash mutations, PASS, signingPerformed false.

Independent refresh experiment:

```sh
node --input-type=module <<'JS'
import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {ReadOnlyReviewCoordinator} from './dist/core/review-coordinator.js';import {fixture} from './dist/core/fixtures.js';import {binToHex,hexToBin,hash160,hash256,encodeTransaction,hashTransaction} from '@bitauth/libauth';
const f=fixture(),now=f.input.now,pub=hexToBin('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'),script='76a914'+binToHex(hash160(pub))+'88ac';f.input.intent.ownerScripts=[script];f.parent.outputs[0].lockingBytecode=hexToBin(script);f.candidate.outputs[1].lockingBytecode=hexToBin(script);const raw=binToHex(encodeTransaction(f.parent)),id=hashTransaction(encodeTransaction(f.parent));f.candidate.inputs[0].outpointTransactionHash=hexToBin(id);const hb=new Uint8Array(80);new DataView(hb.buffer).setUint32(68,now/1000,true);const h=binToHex(hb),hh=binToHex(hash256(hb).reverse());let fail=false,calls=0;
const request=async(m)=>{calls++;if(fail)throw Error('PRIVATE_DIAGNOSTIC');switch(m){case'server.features':return{genesis_hash:'11'.repeat(32),hash_function:'sha256',cashtokens:true};case'blockchain.block.header':return h;case'blockchain.headers.subscribe':return{height:100,hex:h};case'blockchain.transaction.get':return raw;case'blockchain.scripthash.listunspent':return[{height:99,tx_hash:id,tx_pos:0,value:10000}];}};
const config={clock:()=>now,session:{currentSessionId:()=> 'session',hasPath:n=>n===0,getPubkey:()=>pub},sources:['a','b'].map(x=>({id:x,operatorId:x,network:'chipnet',genesisHash:'11'.repeat(32),checkpoint:{height:90,hash:hh},maxTipAgeMs:7200000,kind:'synthetic',transport:{request}}))},input={paymentRequestId:'independent-review',intent:f.input.intent,candidateHex:binToHex(encodeTransaction(f.candidate)),bindings:[{childIndex:0,index:0,script}]};
const root=mkdtempSync(join(tmpdir(),'independent-refresh-')),dir=join(root,'journal');let a,b;try{a=ReadOnlyReviewCoordinator.create(dir,config);b=ReadOnlyReviewCoordinator.open(dir,config);const first=await a.review(input);assert.equal(first.revision,1);const raced=await Promise.allSettled([a.refresh(input,1),b.refresh(input,1)]);assert.equal(raced.filter(x=>x.status==='fulfilled').length,1);const error=raced.find(x=>x.status==='rejected');assert.match(error.reason.message,/REVIEW_REVISION_CONFLICT/);assert.equal(a.get(first.requestKey).revision,3);assert.equal(a.history(first.requestKey).length,4);assert(a.history(first.requestKey).every(x=>x.freshness==='STALE_RECHECK_REQUIRED'));
fail=true;const failed=await b.refresh(input,3);assert.equal(failed.status,'UNKNOWN');assert.equal(failed.revision,5);assert.equal(failed.freshness,'STALE_RECHECK_REQUIRED');assert(!JSON.stringify(failed).includes('PRIVATE_DIAGNOSTIC'));const before=calls;await assert.rejects(a.refresh(input,5),/REVIEW_REFRESH_NOT_ALLOWED/);assert.equal(calls,before);assert.equal((await a.review(input)).status,'UNKNOWN');assert.equal(calls,before);assert.equal(a.history(first.requestKey).length,6);console.log(JSON.stringify({raceWinners:1,latestRevision:5,latestStatus:failed.status,historyRows:6,failedRefreshCannotRestoreOldSuccess:true,noExtraSourceCalls:true,result:'PASS'}));}finally{a?.close();b?.close();rmSync(root,{recursive:true,force:true});}
JS
```

Actual output: raceWinners 1, latestRevision 5, latestStatus UNKNOWN, historyRows 6, failedRefreshCannotRestoreOldSuccess true, noExtraSourceCalls true, PASS. All transport responses were synthetic local functions.

## Final reviewed SHA-256

- `core/signed-verifier.ts`: `1c414965dfd0c200bd05e49578a432558f506cbd0cbf302a08de8057e1a82df8`
- `core/signed-verifier.test.ts`: `feeb1b0f7ed0ad8b72c4c3425bb79456ae0539d8e25dc2e8d063957ccb26bd7b`
- `core/review-coordinator.ts`: `ab06b88674f9afbc0a334bbcfa7186b1f82b68f18685bade85e5719728969790`
- `core/review-coordinator.test.ts`: `43c614c8264c108ad45ea58b67ace13a74917722a803bcd598a64c760b0af222`
- `evidence/signature-20261104/bchn-p2pkh-public-vectors.json`: `d0cb055fa0c8be94346bf5e001265c5d8dcea06f32a6214bfc84ad6ff0da0cb2`
