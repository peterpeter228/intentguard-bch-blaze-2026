# Independent unsigned-builder review

Reviewed November 4, 2026, 15:19–15:24 UTC. Workspace base: `bch-clean-1c215e20`.

## Finding and verified repair

The original `allowBchDustToFee` flag permitted non-dust BCH donation when creating another output was expensive. Independently reproduced using a synthetic 110000-satoshi parent, 1000-satoshi recipient, 109000 fee cap, compressed-P2PKH Schnorr model, target 500000 and maximum 1000000 satoshis/1000 bytes. With the flag true, the original returned `BUILT_OFFLINE`: fee 109000, budget 92500, donation **16500**. Absolute/rate caps held, but the donation exceeded the narrow dust-only policy.

The repaired code rejects donation >= the ordinary BCH change dust threshold (546 for the fixed policy), rather than widening the consent flag. Independent retest of freshly bundled source:

- Original reproduction: `REJECTED / BCH_REMAINDER_NOT_DUST`.
- Same input with flag false: `REJECTED / BCH_CHANGE_REQUIRES_DONATION`.
- Input 1730, target 1000, maximum 1000000: `BUILT_OFFLINE`, fee 730, budget 185, donation 545.
- Input 1731 with the same policy: `REJECTED / BCH_REMAINDER_NOT_DUST` (donation 546).

No other critical issue found within the declared offline scope. Exact recipients, explicitly selected inputs, token conservation, supported-script checks, token-aware output dust and independent guard recompare remain enforced. Maximum fee-rate comparison uses the minimum declared signed size; target budgeting uses the maximum. Signature-size assumptions still require future signed-transaction validation.

The UI uses textContent. Download uses an explicit summary field allowlist and omits unsigned raw transaction, outpoints, recipient/owner scripts, parent transactions and arbitrary input fields. The plan digest can still correlate data; the summary is not anonymous or payment authority.

## Commands actually executed

Before the repair, bundled source with the same esbuild command using `/tmp/review-bch-builder` and ran the reproduction shown below. Original bundled builder SHA-256: `7bedc4f2d564fb423b4cf03373e3e29b303b0bbeb7d71759b0578c6aedda2c86`. A later pre-fix source snapshot before the repair had SHA-256 `d744a5c599a44d98a1f151537c0047a73fd00115d1204ae57d265af843e4f079`; summary fields had been added between the first bundle and that snapshot.

After the repair:

```sh
node_modules/.bin/esbuild core/unsigned-builder.ts core/fixtures.ts --bundle --platform=node --format=esm --outdir=/tmp/review-bch-builder-fixed
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import {buildUnsignedPlan} from '/tmp/review-bch-builder-fixed/unsigned-builder.js';
import {fixture,owner} from '/tmp/review-bch-builder-fixed/fixtures.js';
import {encodeTransaction,binToHex,hashTransaction} from '@bitauth/libauth';
for(const [value,target,max,allow,want,issue] of [[110000n,'500000','1000000',true,'REJECTED','BCH_REMAINDER_NOT_DUST'],[110000n,'500000','1000000',false,'REJECTED',null],[1730n,'1000','1000000',true,'BUILT_OFFLINE',null],[1731n,'1000','1000000',true,'REJECTED','BCH_REMAINDER_NOT_DUST']]){
const {input,parent}=fixture();parent.outputs[0].valueSatoshis=value;const raw=binToHex(encodeTransaction(parent)),id=hashTransaction(encodeTransaction(parent));input.snapshot.parentTransactionHexes=[raw];input.snapshot.unspentOutpoints=[id+':0'];input.intent.maxFeeSatoshis='109000';
const r=buildUnsignedPlan({intent:input.intent,snapshot:input.snapshot,selectedInputs:[{txid:id,index:0}],changeScript:owner,now:input.now,feePolicy:{targetSatoshisPer1000Bytes:target,maxSatoshisPer1000Bytes:max,signatureModel:'compressed-p2pkh-schnorr',allowBchDustToFee:allow}});
console.log(JSON.stringify({inputSats:value.toString(),target,max,allow,status:r.status,issue:r.issue,fee:r.feeSatoshis,budget:r.budgetFeeSatoshis,donation:r.donatedRemainderSatoshis}));assert.equal(r.status,want);if(issue)assert.equal(r.issue,issue);
}
JS
node --test dist/core/unsigned-builder.test.js | tail -9
sha256sum core/unsigned-builder.ts core/unsigned-builder.test.ts core/guard.ts core/ui.ts core/index.html
```

All four independent assertions passed. Focused existing compiled suite: **20 tests, 20 passed, 0 failed**. That suite used the implementation worker's prior TypeScript build; the independent reproduction above freshly bundles reviewed source. Full validation and browser QA are separate evidence, not claimed here.

## Reviewed final file SHA-256

- `core/unsigned-builder.ts`: `51eed6aaca6d5c21248fdfc14dd0d128a12ff0933e4c93f88e0b7615ebb233b1`
- `core/unsigned-builder.test.ts`: `281f72024606ad683601b977b82448a94b6c27d67db58ff6b8ef9c91e5da16cf`
- `core/guard.ts`: `868b3206fe58877ffdfde429afd5fc41eb585f1da43fed5a2dabe4275ba97648`
- `core/ui.ts`: `7d0f33e98f996ae1e54a86919a69c3d108abe4f5a8e3c17cfc557cd488655d0a`
- `core/index.html`: `f55cec8e05f271fc6f33f8279fb7781cb94712cae2d0d154fea4e9d9af28aebf`

## Boundaries

All reproduction data are synthetic, unbroadcast and supplied locally. This review does not authenticate ownership/unspent status, exercise a live node/wallet, verify signatures, or establish consensus/relay acceptance. No network, signing, payment, deployment, repository publication or implementation edits were performed by this reviewer. Only this report and temporary local build artifacts were written. `canSign`, `broadcastable` and `receiptValid` remain false.
