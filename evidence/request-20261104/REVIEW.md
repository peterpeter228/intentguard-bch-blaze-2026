# Independent payment-request draft review

November 4, 2026, 16:29–16:39 UTC. Workspace `bch-clean-6d445a89`. No implementation edits. Public specification reads and local unsigned-data tests only: no fees, wallet access, key generation, signing, chain transaction, provider connection or external communication.

## Result

Final focused tests: **12/12 passed**, after fresh TypeScript compilation. An additional independent 14-case script passed: ordinary/uppercase/mixed-case CashAddr, ordinary versus token-aware FT destinations, expiry, aggregate BCH overflow, sparse/subclass arrays, forged review field, escaped duplicate JSON key, frozen normalized output, 8192-byte boundary and 20-recipient export/reimport.

The maximum-shape independent request (80-character ID, 20 token-aware recipients, separate 64-hex categories and maximum token amounts) exported to **5687 bytes**, below the 8192-byte limit, and reimported to the same digest. No further critical issue found within the draft-only scope.

## Findings and fixes

### Mixed-case decoder trap

The CashAddr specification rejects mixed case, but installed `@bitauth/libauth@3.1.0-next.8` lowercases inside `decodeCashAddressFormat`. Independently verified that `cashAddressToLockingBytecode('Bitcoincash:qr7fzmep8g7h7ymfxy74lgc0v950j3r2959lhtxxsl')` returns a decoded result.

This was identified during design review and reported before module completion. The module explicitly checks original-string case before invoking libauth. Final independent checks: all-uppercase accepted then canonicalized; mixed case rejected as `REQUEST_MIXED_CASE_ADDRESS`. No address correction or network-prefix guessing is performed.

### Sparse recipient array

The initial object API accepted `recipients: new Array(1)` because `.map()` skipped the hole. It returned DRAFT_READY with zero displayed recipients, total zero and a wire encoding containing `[null]`, which would not reimport. This was independently reproduced and reported. JSON itself cannot express array holes, so this was an object-API validation defect, not a demonstrated browser JSON exploit.

The fix requires ordinary Array.prototype, dense own data elements, and no extra/symbol/accessor elements before mapping. Sparse and custom-subclass inputs now reject as `REQUEST_INVALID_SCHEMA`; the subclass map override is not executed. Arrays cannot use these routes to bypass recipient validation.

### Size consistency

Initial UI/schema size limits differed while implementation was in progress. Final module uses 8192 bytes for import, canonical request and pretty export, with an export recheck. Ready drafts cannot become unimportable solely because pretty printing expands the document. The UI's 8 KB description now matches the module. This is an application limit, not a CashAddr protocol requirement.

## Specification grounding

- [Official CashAddr specification](https://github.com/bitcoincashorg/bitcoincash.org/blob/master/spec/cashaddr.md): checksum/version/payload validation is required; uppercase is valid, mixed case is not. Automatic correction is unsafe. This application additionally requires a complete prefix rather than guessing it.
- [CashTokens CashAddress token support](https://cashtokens.org/docs/spec/chip/#cashaddress-token-support): types 2/3 express token-aware P2PKH/P2SH. Token-aware software must not send tokens to ordinary or legacy addresses. Both ordinary and token-aware P2PKH can receive native BCH; token awareness does not change the underlying locking script. P2SH may be protocol-valid while unsupported by this project's P2PKH-only slice.
- [Official libauth conversion API](https://libauth.org/functions/cashAddressToLockingBytecode.html), plus the installed pinned declarations/source: conversion returns bytecode/prefix/tokenSupport or an error string. The pinned implementation was inspected directly because current hosted documentation is not a substitute for installed-version behavior.

Network prefixes are checked against the requested network label. The `bchtest` prefix alone does not establish Chipnet rather than another BCH test network. The code/UI correctly preserve `networkVerified=false` and explain this limit. Token categories/base units are explicit; a request does not establish ticker, decimals, issuer, token existence or market value.

## Schema and UI inspection

- Strict wire fields; imported script, digest, review/confirmation/authority fields are not accepted.
- BCH decimal strings convert through integer arithmetic; token amounts are canonical positive base-unit strings. Aggregate BCH plus fee and per-category token limits are checked.
- Address-derived script and token-aware metadata are recomputed. Token carrier BCH and fixed dust policy are shown explicitly.
- Expiry uses separately supplied application time, with a 24-hour maximum window. JSON size is checked before parsing; escaped duplicate keys and excessive nesting reject.
- Returned request/display structures are frozen and contain no wallet owner/change capability.
- UI input/change events clear current review and disable export. Import clears prior review. Confirm/export actions and focus/visibility recheck current time; a bounded expiry timer clears expired drafts.
- Export contains only normalized untrusted wire request. Import never restores local review, identity proof or spending authority. The explicit export warning states that address/payment terms are included.
- Display uses textContent. The new page stays separate from synthetic builder/evidence state.

UI statements here are source review, not independently performed browser QA. No draft-to-wallet authorization flow is implemented or approved by this review.

## Reproduction commands and key cases

Executed:

```sh
node_modules/.bin/tsc
node --test dist/core/payment-request.test.js | tail -9
sha256sum core/payment-request.ts core/payment-request.test.ts core/request-ui.ts core/request.html core/PAYMENT_REQUEST.md
```

The independent script used the official ordinary/token-aware pair above and `bitcoincash:zr7fzmep8g7h7ymfxy74lgc0v950j3r295z4y4gq0v`, with `now=1800000000000`, expiry `now+60000`, fee BCH `0.000006`, and recipient BCH `0.00001`. Minimal reproductions:

```js
const base = { schemaVersion:1, kind:'intentguard-payment-request', requestId:'review',
  network:'mainnet', expiresAt:now+60000, maxFeeBch:'0.000006',
  recipients:[{address,bch:'0.00001'}] };
createPaymentRequestDraft({...base,recipients:new Array(1)},now);
// Before fix: DRAFT_READY with no displayed recipients. Final: REQUEST_INVALID_SCHEMA.
createPaymentRequestDraft({...base,recipients:[{address:'Bitcoincash:'+address.split(':')[1],bch:'0.00001'}]},now);
// Final: REQUEST_MIXED_CASE_ADDRESS, although the raw pinned libauth converter accepts it.
```

Other independent assertions included duplicate `requestId` with an escaped `request\\u0049d`, forged `confirmed:true`, exact expiry, 21000000 BCH plus another recipient, deep freezing, roundtrip digest equality, 8193 ASCII bytes rejected, and the maximum-shape export described above. All were offline synthetic request-data tests; none involved funds or an on-chain claim.

## Final SHA-256

- `core/payment-request.ts`: `4943d6558a666b7279ad8e54dca90246b804ee8fd557726e0ddda3889cbd1478`
- `core/payment-request.test.ts`: `1835d4360d783f85190adbfd05629f25249d8851708160a9e6e6fd18ccecd931`
- `core/request-ui.ts`: `e9f00088586004c6dc80ce5ceb61afed96206f22851785496df75e38fc9ce450`
- `core/request.html`: `b77a50c06a389a3a090c3b934e522416b445348bf3d9325a73f20aec783d0d6a`
- `core/PAYMENT_REQUEST.md`: `c2295810521cc40f71eb3aed00a8bcf28f998d6e4ee1f3f68e27e9ce3178c046`
