# Independent browser QA: IntentGuard BCH offline core

Run: 2026-11-04 13:28–13:32 UTC. Independent verifier; browser actions used the CUA cloud Chromium runtime, not a direct unit-test call or standalone Playwright. URL: http://127.0.0.1:8788/. Page title: `IntentGuard BCH · Transaction comparison`. Initial repository HEAD was `5bc7cee2f435511527bb97ea90a38b6e3f544f35`; the tested core was an uncommitted working-tree addition. Final tested file identities are recorded in `final-tested-source-sha256.txt`; this report does not invent a commit identity.

The flow under test is: open the offline demo → compare the original synthetic request → select adversarial and incomplete-evidence scenarios → inspect rejection/unknown results → edit and clear inputs → recover → download a report → reload and compare again.

## Summary

PASS for the tested desktop offline comparison slice after one real browser defect was fixed. NOT a payment, wallet, chain, receipt, deployment, contest-completion, or mobile-device acceptance.

## Finding and fix

The first page load rendered HTML, but left the editor empty and all comparison controls inert. Console evidence showed `WebAssembly.instantiate` failing under `script-src 'self'`, during libauth SHA initialization. The developer changed only this relevant CSP portion to permit `'wasm-unsafe-eval'`, retaining no JavaScript `'unsafe-eval'` and `connect-src 'none'`. The local service was restarted and the complete interaction set rerun. Evidence: `01-initial-csp-block.png`, `01-initial-console.json`, `01-initial-dom.txt`; successful replacement evidence follows below.

The cloud desktop Terminal did not have npm on PATH. The server was started using the already installed runtime: `/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node dist/core/server.js`, with `/workspace/shared/intentguard-bch` as cwd. No dependency installation or browser-policy change was performed.

## Environment and required checks

- Cloud Chromium on Linux. Native browser window: 1212×886. Desktop page screenshot width: 1165 px (initial visible screenshot 1165×747); full-page screenshots retain complete content.
- Browser control available through CUA. No standalone Playwright or external browser fallback.
- Page identity: PASS, exact local URL and title checked.
- Nonblank meaningful UI: PASS, header, explicit offline/synthetic warnings, six scenarios, editor, actions and result.
- Framework error overlay: PASS, none after correction.
- Console: PASS for app-origin errors after the fix. The browser extension repeatedly logged `Error sending browser metadata to extension: Object`; these are preserved in `post-fix-console.json`, identified by `chrome-extension://...` source, and not attributed to this app. The initial app WASM failure is preserved separately.
- Screenshot evidence: PASS, before-fix, normal, rejected, unknown, invalid input and final regression captures.
- Interaction proof: PASS, actual visible controls clicked and resulting DOM/result read.

## Interaction results

| Action | Observed result | Result |
| --- | --- | --- |
| Initial load | `NOT CHECKED`; Download report disabled | PASS |
| Original payment → Compare | `MATCH_OFFLINE`, `canSign:false`, fee `500`, no issues | PASS |
| Recipient replaced → Compare | `REJECTED`, `RECIPIENT_MISMATCH`, `canSign:false` | PASS |
| Wrong token → Compare | `REJECTED`, `UNDECLARED_TOKEN`, `RECIPIENT_MISMATCH`, two `TOKEN_IMBALANCE` entries, `canSign:false` | PASS |
| Excessive fee → Compare | `REJECTED`, `FEE_LIMIT`, fee `1500`, `canSign:false` | PASS |
| Stale evidence → Compare | `UNKNOWN`, `STALE_OR_INVALID_SNAPSHOT`, `canSign:false` | PASS |
| Missing parent → Compare | `UNKNOWN`, `MISSING_OR_SPENT_PREVOUT`, `canSign:false` | PASS |
| Each scenario selection after a prior result | `NOT CHECKED`, download disabled before rerun | PASS |
| Edit successful input by adding whitespace | Old success cleared; `NOT CHECKED`; download disabled | PASS |
| Malformed `{broken` or `null` → Compare | `INVALID INPUT`, no send claim, download disabled | PASS |
| Structurally invalid `[]` or `{}` → Compare | `REJECTED` with `INVALID_INTENT`, `canSign:false` | PASS |
| Clear | Empty editor; `NOT CHECKED`; download disabled | PASS |
| Compare empty | `INVALID INPUT` | PASS |
| Restore Original → Compare → Download report | Real browser download completed and parsed | PASS |
| Download contents | `OFFLINE_COMPARISON_NOT_CHAIN_PROOF`, `MATCH_OFFLINE`, `canSign:false`; no `candidateHex`, `parentTransactionHexes`, `ownerScripts` or `unspentOutpoints` fields | PASS |
| Reload after successful report | Reset to `NOT CHECKED`, download disabled; rerun restored `MATCH_OFFLINE` | PASS |

The downloaded JSON is `downloaded-report.json`. Scenario and edge observations are `scenario-results.json` and `edge-results.json`. DOM snapshots retain visible synthetic sample values and rendered outcomes.

## Remaining risk and untested items

- 390×844 mobile simulation: NOT_RUN / BLOCKED_EXTERNAL. Opening Chromium responsive developer tools displayed an explicit organization-policy denial (screenshot `mobile-devtools-policy-block.png`). The notice was dismissed; the policy was not bypassed, no alternate browser-control stack was used, and mobile support is not claimed.
- Exact required 1366×768 viewport, actual mobile hardware, other browsers and accessibility-assistive-device flows were not run.
- No wallet connection, signature, transaction, chain access, live provenance/ownership check, deployment or submission was attempted. All scenario inputs were synthetic and locally provided.
- This does not validate all guard unit-test cases through the UI, the >600 KB boundary, dynamic dust/fee rate, genuine signed transactions, recovery of real broadcasts, or any public source/demo links. No wallet/receipt controls or such links exist in this isolated slice.
- The Wrong token report repeats `TOKEN_IMBALANCE` without identifying the category in each entry. This did not affect safe rejection; richer per-category diagnostics would improve explainability.

## Key evidence

- `final-regression.png`: corrected full desktop page with offline disclaimer, populated editor, enabled report download and `MATCH_OFFLINE` / `canSign:false` result.
- `recipient-replaced.png`: substituted-recipient rejection.
- `stale-evidence.png`: incomplete trust/evidence state shown as `UNKNOWN` rather than success.
- `invalid-input.png`: malformed/empty-input failure.
- `final-tested-source-sha256.txt`: exact tested source and served bundle hashes.
