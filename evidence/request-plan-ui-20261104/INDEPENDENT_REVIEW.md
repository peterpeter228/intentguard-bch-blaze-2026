# Independent request-to-plan UI safety review

Reviewed 2026-11-04 UTC against the coordinator's copied local workspace, declared private baseline `6de75464`. No `.git` directory exists here, so no independent Git HEAD/remote provenance assertion is made. Scope: request UI/HTML, form parser, examples, existing request-plan SDK, and helper tests. Reviewer changed no source files.

## Findings and resolution

1. **Resolved: stale output after export mismatch.** Silent funding-rate mutation initially suppressed download but retained old successful status, technical JSON and enabled export. The fixed export path clears prior output.
2. **Resolved: event-independent request validation.** Silent request amount mutation initially exported the cached old plan. A captured fingerprint of all request inputs, including import text, now detects divergence before confirm/build/export/focus and clears review, funding and plan.
3. **Resolved: literal funding acknowledgement binding.** Observation-time mutation can preserve content digests intentionally. A captured fingerprint of all acknowledged funding fields now detects even same-plan-content changes before compute/export and clears acknowledgement/output.

These were offline UI state-integrity issues, not signing or payment-authority escapes.

## Executed checks

- `node --test dist/core/request-plan.test.js`: **18/18 passed**.
- `node --test dist/core/request-plan-form.test.js`: **9/9 passed**.
- Inline bounded Node DOM shim against rebuilt `dist/core/request-ui.js`: **13 checks passed**. Explicit report download; silent funding-rate/request-amount/observation-time edits; ordinary funding/request edits; request clear; funding clear; scenario replacement; observation-expiry callback; focus revalidation; visibility revalidation; rejected import invalidation.
- Every stale-state case asserted disabled export, empty technical output, absence of successful plan status, and cleared funding acknowledgement. Silent mutations additionally asserted no download.
- This shim captured element handlers/Blob download clicks. It is **not browser QA**. Expiry callback was invoked directly; no real two-minute wait, browser autofill, reload, rendering or filesystem download result is claimed.

## Other conclusions and limits

Synthetic examples replace request and funding together only by explicit labelled actions. No fixture fallback exists in ordinary import/planning. Full canonical parent bytes, canonical bounded index, explicit same-network P2PKH addresses, same-owner change, actual selected parent output ownership script, NFT exclusion and exact UTC syntax are validated. SDK bounds rates, observation freshness and request expiry. Summaries use safe textContent and show all outputs/scripts/amounts/full token categories/fees. Authority flags remain false and supplied claims remain explicitly unverified.

No unresolved blocker found after fixes in this offline slice. Real-browser evidence and exact remote-byte verification remain separate gates. No wallets, keys, signatures, live chain, transactions, deployment, uploads or screenshots used.

Reviewed source SHA-256:
- request-ui.ts: `6b58bfe55d95076cd705fbaec99183f9035b7d952d54753f5039e19a893ab2c5`
- request.html: `14f8b33812fec1dda0aa532d1b5de87d72c8b56beb87943e96916cd09a4c96d5`
- request-plan-form.ts: `76258c78cae78f74ff1503c0c4efc302cf96a0422c03d72340ee37ddcb50bd30`
- request-plan-examples.ts: `1c3505f15ce046606b5a52a6adc892f8ef6574bc0ae5be107a32f274128af27e`
- request-plan.ts: `e6aafccf008281f292ef8ed74f8ca84606286fd5bdcac24f81cfa6951d62ef62`
- request-plan-form.test.ts: `7fe427038b8ce619a7d7ddb598e22bbe914b4c633771110eeee440620b83b5c1`


## Final pre-review/re-review follow-up (17:45 UTC)

The coordinator added initial synthetic request/funding fingerprints. Independent review then reproduced two composed paths that bypassed the first proposed fix: load example, silently edit request, emit a funding edit (changing origin), then Review; and an already reviewed request with supplied funding, silently edit request, then Review. Both initially retained funding because the check depended on synthetic origin.

**Resolved:** Review now compares the previous reviewed-or-loaded request fingerprint regardless of funding origin, clearing funding before re-review on any mismatch. Edited synthetic funding is labelled supplied offline claims before acknowledgement; silent edits cannot retain untouched-example provenance.

Final independent commands: `npx tsc && node --test core/request-ui.test.mjs dist/core/request-plan-form.test.js dist/core/request-plan.test.js` exited 0, **38/38 passed** (11 DOM event tests, 9 form tests, 18 SDK tests). The two composed paths above were additionally rerun in a bounded inline harness and both asserted empty funding successfully. The npm unknown http-proxy environment warning was non-fatal.

Final additional SHA-256:
- core/request-ui.test.mjs: `0598df5bae1ff58f07fdd99a12ac317247fd8e7fa3ce479174669f8cc6d585fa`
- dist/core/request.js: `2161674dfe740e25f82e700048cf282ba4bfea9e1e4f9a1ca07a9c348cde05dc`

**Freeze opinion:** no unresolved blocker in this reviewed offline scope at the hashes above; suitable to freeze for real-browser acceptance and exact remote-byte verification. This is not approval to sign, broadcast, deploy, merge or submit.
