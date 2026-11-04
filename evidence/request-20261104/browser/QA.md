# Independent real-browser QA: structured payment request draft

Result: PASS for the exercised desktop flow. No new application blocker found.

## Environment and scope

- 2026-11-04, approximately 16:40–16:47 UTC, real cloud Chromium desktop through CUA. Local URL `http://127.0.0.1:8788/request`; prior inspector at `/`.
- Server started from `/workspace/shared/bch-clean-6d445a89` in our own second cloud Terminal tab with the installed Node executable. This avoids the separate shell/browser localhost namespaces.
- Tested `dist/core/request.js`: `ba4ca496c4517a5420bc09f6ab369ee996c8ef8fba88372d915e32f24647aa7f`.
- Existing `dist/core/app.js`: `5f9be1ef94f24b1e9e52a92b2cae4f06a8d0085a46c6b1c15bbc3bf1b13fccea`.
- Source and built-file hashes are in `tested-sha256.txt`. No application source was edited by QA. The developer reported the matching source commit as `3000ceba117232ec48780b429d361b8e3e69f737`; this QA establishes the local file hashes, not an independent remote commit audit.
- Only public CashTokens test-vector addresses, synthetic references and synthetic amounts were used. No wallet, signing, chain query, transaction, deployment, credential or customer data action occurred.

## Verified request flow

1. Initial state has no draft and local-review/download actions disabled.
2. Entered one BCH recipient, 0.00001000 BCH, 600 sat fee limit and valid UTC expiry. Review produced an UNCONFIRMED DRAFT with the full canonical address, locking script, 1000 sat recipient amount, total, fee limit, expiry and request digest.
3. The local review button changed the label to LOCALLY REVIEWED · NOT APPROVED TO PAY. Download became enabled. Identity, funds, network, authorization, signature, broadcast and receipt limitations remained explicit.
4. Actually clicked Download request JSON and parsed the completed download (`downloaded-unconfirmed-request.json`). It contains only schemaVersion, kind, requestId, network, expiresAt, maxFeeBch and recipients. It has the expected public address and normalized BCH amount, and no trust/review/signature/owner-script/receipt flags. The UI disclosed that this export contains addresses and payment terms.
5. Typing the actual download into import immediately invalidated prior state. Import yielded UNCONFIRMED DRAFT, local review enabled and download disabled. Review was not carried through the file.
6. Imported two recipients, one BCH and one token-aware. Both were fully displayed in order, including both full addresses and scripts. Amounts were 1000 + 651 = 1651 sat total; token category was 32 bytes of 0x22 and amount was 100 integer base units. No recipient was merged or hidden.
7. After locally reviewing that imported request, a form edit cleared summary/review state and disabled both actions.

## Negative paths and boundaries

- Malformed address and altered checksum: REQUEST_INVALID_ADDRESS.
- Mixed-case address: REQUEST_MIXED_CASE_ADDRESS. Valid all-uppercase input was accepted and displayed canonically in lowercase.
- Testnet-prefix address with mainnet selected: REQUEST_NETWORK_MISMATCH.
- Token request using ordinary CashAddr: REQUEST_TOKEN_AWARE_REQUIRED.
- Token-aware address with 651 sat carrier and 100 base units: accepted draft. 650 sat: REQUEST_DUST_OUTPUT. Fractional token base units: REQUEST_INVALID_TOKEN_AMOUNT.
- Already expired: REQUEST_EXPIRED. Expiry at current time +24 hours rounded down to seconds: accepted. +24 hours +60 seconds: REQUEST_EXPIRY_TOO_FAR. Impossible date: INVALID INPUT.
- A real short-lived draft was reviewed locally before its 16:43:18 UTC expiry. At 16:43:23.742 UTC, without a new review click, it had become NO DRAFT with an explicit expiry notice and both actions disabled. This was a real wall-clock check, not a mocked clock. An intermediate automation wait hit its own roughly five-second timeout before expiry; the later observed expired state established the result.
- Malformed JSON: REQUEST_INVALID_JSON. Imported `confirmed: true`: REQUEST_INVALID_SCHEMA. Duplicate decoded JSON key: REQUEST_DUPLICATE_JSON_KEY. 8193-byte input: REQUEST_TOO_LARGE.
- Clear blanked all text inputs and import text, cleared the summary and disabled review/download. Reload after local review did not retain draft or review state.
- All rejected/invalid cases left local review and download disabled. The raw observations are in `request-flow-results.json` (28 state observations).

## Existing inspector regression and separation

Used the page's actual navigation link to `/`. The inspector began NOT CHECKED / NOT BUILT with its own synthetic script/category, not the request address or imported token category.

- Original payment: MATCH_OFFLINE, fee 500, canSign false.
- Recipient replaced: REJECTED / RECIPIENT_MISMATCH, canSign false.
- Stale evidence: UNKNOWN / STALE_OR_INVALID_SNAPSHOT, canSign false.
- Token payment plan: BUILT_OFFLINE, fee 325, canSign/broadcastable/receiptValid all false.
- Fee cap too low: REJECTED / FEE_LIMIT, all authority flags false.

Used the actual link back to `/request`; it remained NO DRAFT and both actions were disabled. Exact results are in `old-inspector-regression.json` and `request-roundtrip.json`. Previous broader inspector/download coverage remains in the earlier slice evidence; this round did not re-run every earlier inspector case or its downloads.

## Evidence, console and cleanup

- Four application screenshots show the single draft, full two-recipient summary, non-token-aware rejection and expired state. DOM snapshots and actual download are included.
- Captured 151 warning/error entries during the request run; every entry was the known browser-extension metadata error, with a chrome-extension origin. No application-origin error was observed in this capture. `request-console.json` retains the actual observations.
- Stopped only our foreground server in the second Terminal tab with Ctrl+C. The shell prompt returned; `server-stopped.png` records it. No other user tab or session was closed.

## Limits

- Desktop coverage only. Mobile/responsive emulation NOT_RUN: prior DevTools access was explicitly denied by organization policy, and no retry or alternate bypass was attempted.
- No assertion of real payment safety, recipient identity, wallet network correctness, live policy, funding, chain inclusion, signed transaction, broadcast or receipt. This page is a local unconfirmed request draft, and local review is not payment approval.
- No other-browser/device coverage. Expiry tests use the recorded current date; replaying the saved request later should reject it as expired.

`evidence-sha256.txt` hashes every evidence file except itself. Its SHA-256 is the bundle fingerprint, reported separately to the developer.
