# Independent browser QA: readable product summaries

Run: 2026-11-04 16:09–16:11 UTC. PASS for this desktop UI change. No application code edits.

## Environment and scope

Cloud Chromium/Linux through documented CUA APIs, desktop page viewport 1165×747. URL `http://127.0.0.1:8788/`; title `IntentGuard BCH · Transaction comparison`. Tested working export `/workspace/shared/bch-clean-7d2246cd` is not a Git checkout; no later commit identity is implied.

Tested bundle SHA256: `5f9be1ef94f24b1e9e52a92b2cae4f06a8d0085a46c6b1c15bbc3bf1b13fccea`. File identities are in `tested-sha256.txt`.

Flow: load → compare/build → read plain summaries → expand/collapse technical details → inspect rejection/UNKNOWN text → invalidate edits/errors → download both reports → reload/recover. Actual visible controls were operated; no direct application function calls replaced the browser test.

## Results

- PASS: nonblank page, correct identity, no framework overlay. Both technical details are collapsed on initial load, while summary areas are visible.
- PASS: original comparison says supplied data agrees, explicitly not payment approval; displays fee500 and no wallet/signature/live-chain/payment assertion.
- PASS: plan summary visibly shows full requested recipient script and token category,1000sat+100token base units; token change400units+657sat; BCH change8018sat; fee/budget325, donation0, assumed325–325byte Schnorr model. It explicitly says nothing is signed/sent and ownership/live funds/signatures/chain acceptance are not established.
- PASS: both technical disclosures expand and collapse, technical JSON retains MATCH_OFFLINE/BUILT_OFFLINE and plain summaries remain unchanged. No result loss observed.
- PASS: recipient substitution, wrong token, excessive fee, low builder cap and insufficient funds show explicit understandable reasons. Duplicate TOKEN_IMBALANCE technical codes are summarized once.
- PASS: stale observation and missing parent show UNKNOWN with “Evidence is incomplete. No successful comparison is established.” and fee not established, distinct from rejected candidates.
- PASS: editing while technical details are open clears the old technical result and plain summary, resets status and disables download. Clear empties the editor and does the same. Bad JSON produces the new explicit no-comparison/no-plan text; downloads stay disabled. Both panels were tested.
- PASS: both real browser downloads completed. Comparison report fee500/canSignfalse and plan report fee325/canSignfalse/broadcastablefalse/receiptValidfalse remain correct. Neither download contains raw transaction/input/output/script fields checked in `download-checks.json`.
- PASS: reload resets both summaries, statuses, collapsed disclosures and disabled downloads; recomputation restores MATCH_OFFLINE and BUILT_OFFLINE.
- PASS for app console: no application warnings/errors. All88 returned messages were known browser-extension metadata errors; full logs retained in `console.json`.

No blocking UI defect found. Long scripts/token identifiers wrap within the desktop summary without clipping; ordinary summaries are no longer limited to the technical JSON scroll pane.

## Evidence

Only three new screenshots were retained to avoid duplicate artifacts:

1. `positive-summaries.png` and `positive-summaries-dom.txt`: readable successful summaries and collapsed technical details.
2. `unknown-and-rejection.png` and `unknown-and-rejection-dom.txt`: UNKNOWN missing-parent comparison versus refused fee-cap plan.
3. `invalidated-summaries.png` and `invalidated-summaries-dom.txt`: explicit bad-input summaries, disabled downloads.

`summary-results.json`, `details-toggle-results.json` and `invalidation-results.json` contain actual observed text/states. `downloaded-comparison.json` and `downloaded-plan.json` are the actual downloaded files; `download-checks.json` records the checks.

## Remaining limits and cleanup

Mobile390×844, exact1366×768, other browsers/devices: NOT_RUN. The known organization policy blocking Chromium DevTools was not retried or bypassed. No wallet, signing, chain query, transaction, deployment or submission occurred. Backend signature verification/store/refresh paths are outside this UI scope. No claim is made that readable summaries strengthen the underlying validation or authorize payments.

Started the local server in the cloud desktop Terminal using the installed absolute Node runtime and `dist/core/server.js`. Stopped only this temporary server with Ctrl+C and visibly confirmed the shell prompt returned; other windows/sessions remained untouched.
