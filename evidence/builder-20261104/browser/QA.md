# Independent desktop browser QA: offline unsigned planner

Run: 2026-11-04 15:28–15:31 UTC. Result: PASS for the tested local browser slice. No application code was changed by this verifier.

## Environment

- Cloud Chromium on Linux, controlled through documented CUA native/browser APIs. Actual page viewport: 1165×747. No standalone Playwright or policy workaround.
- URL: http://127.0.0.1:8788/. Title: `IntentGuard BCH · Transaction comparison`.
- Exported working tree: `/workspace/shared/bch-clean-1c215e20`, not a Git checkout. A later persisted commit must be bound separately.
- Tested bundle SHA256: `89d41bf63bcbeae9fcd228cc3e6ff81d06e910d1d3c5b0901b17c00bbf0d4419`; exact source/server/lockfile hashes are in `tested-sha256.txt`.
- Started from the cloud desktop Terminal with the existing Node runtime: `cd /workspace/shared/bch-clean-1c215e20 && /opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node dist/core/server.js`.
- At completion the verifier stopped only this temporary server with Ctrl+C and visibly confirmed the shell prompt returned.

The flow under test is: open the existing comparison page → use the new offline plan builder → inspect positive and refused plans → edit/cancel stale results → export an allowlisted summary → regress the old comparator → reload and recover both panels.

## Required checks

| Check | Result and evidence |
| --- | --- |
| Identity | PASS: correct URL/title, original comparator plus new section 4 |
| Nonblank | PASS: populated synthetic inputs, explicit offline warnings and meaningful controls |
| Framework overlay | PASS: none observed |
| Console health | PASS for application: no app errors/warnings in returned logs. All 100 returned entries were browser-extension metadata errors, preserved in console.json |
| Screenshots | PASS: initial viewport, positive builder, low cap, insufficient funds and fee-rate refusal |
| Interaction | PASS: actual buttons and labeled textboxes operated, rendered output read after each action |

## Builder interaction results

| Interaction | Actual observed result |
| --- | --- |
| Initial page and each example selection | NOT BUILT, no current result, summary download disabled |
| Token payment plan → Build unsigned plan | BUILT_OFFLINE; fee/budget 325 sat; no donation; assumed size 325–325 bytes, compressed-p2pkh-schnorr |
| Exact positive output check | Merchant: 100 tokens + 1000 sat. Token change: 400 tokens + 657 sat. BCH change: 8018 sat |
| Positive guard recomputation | MATCH_OFFLINE, fee 325, no issues, canSign false |
| Fee cap too low → Build | REJECTED / FEE_LIMIT, no unsigned hex |
| Insufficient funds → Build | REJECTED / INSUFFICIENT_BCH, no unsigned hex |
| Edit a successful builder input | Immediately NOT BUILT, old plan removed, summary download disabled |
| Set signatureModel to compressed-p2pkh-low-s-ecdsa and maxSatoshisPer1000Bytes to 1000 | REJECTED / FEE_RATE_LIMIT, no unsigned hex |
| Malformed `{broken` | INVALID INPUT, download disabled |
| Valid JSON of wrong shape: null, [], {} | REJECTED / INVALID_BUILD_SCHEMA |
| Clear plan | Empty editor, NOT BUILT, download disabled |
| Build empty editor | INVALID INPUT, download disabled |
| Valid ASCII JSON padded to 600000 bytes | BUILT_OFFLINE |
| Same JSON padded to 600001 bytes | INVALID INPUT, download disabled |
| Restore example and download | Actual browser download completed and content parsed; verification below |
| Reload | Comparator NOT CHECKED and builder NOT BUILT; both downloads disabled |
| Recompute after reload | Comparator MATCH_OFFLINE and builder BUILT_OFFLINE restored independently |

Every structured builder result observed had `canSign:false`, `broadcastable:false` and `receiptValid:false`. Declared signature sizes are not verified wallet capabilities.

## Actual summary download

`downloaded-plan-summary.json` is copied from the completed browser download. It includes `OFFLINE_UNSIGNED_PLAN_NOT_PAYMENT_AUTHORITY`, BUILT_OFFLINE, the three false flags, fee/budget/donation values, declared size/model, rational fee-rate bounds, planDigest and limitations.

It excludes `unsignedHex`, `selectedInputs`, `outputSummary`, `parentTransactionHexes`, `ownerScripts`, `changeScript`, `sourceOutput`, and raw P2PKH script strings. The raw unsigned plan is visible locally in the result pane but is not included in the downloaded summary. The check was against the actual downloaded bytes, not merely the export handler's source.

## Existing comparator regression

All six existing buttons were exercised: original MATCH_OFFLINE; recipient replacement REJECTED/RECIPIENT_MISMATCH; wrong token REJECTED; excessive fee REJECTED/FEE_LIMIT; stale evidence UNKNOWN; missing parent UNKNOWN. The prior synthetic token dust fixtures were pasted through the comparator editor: 650 sat REJECTED/DUST_OUTPUT, 651 sat MATCH_OFFLINE. All comparator reports had canSign false. These actions did not mutate the separately built plan or its BUILT_OFFLINE status.

## Evidence

- `token-payment-plan.png` and `.txt`: positive plan and full DOM/result content.
- `fee-cap-too-low.png`, `insufficient-funds.png`: clear rejection states.
- `ecdsa-rate-rejected.png` and `.txt`: manually edited signature-size policy refuses the maximum rate.
- `builder-scenario-results.json`, `builder-edge-results.json`: exact rendered result values.
- `downloaded-plan-summary.json`: actual downloaded artifact.
- `comparator-regression-results.json`: existing comparison paths and dust boundary.
- `reload-recovery.json`, `final-regression-dom.txt`: both-panel reset/recovery.
- `initial.png`, `console.json`, `tested-sha256.txt`: environment and build evidence.

The result pane is intentionally scrollable; full-page screenshots show its viewport, while the DOM/JSON captures preserve all result fields including the fee and complete change outputs.

## Not verified / remaining risk

- Mobile 390×844, exact 1366×768, other browsers and devices: NOT_RUN. Prior Chromium DevTools organization-policy denial was not retried or bypassed.
- No wallet, signing, signature validity, chain state, relay acceptance, transaction, public deployment or submission was attempted or validated.
- No backend coordinator/store/transport state was exercised by the browser. This planner is an isolated offline panel and does not import its synthetic result into the evidence journal.
- Browser acceptance does not substitute for the independent security review, unit tests, exact remote-byte validation, live fee policy or final signed-size checks.
