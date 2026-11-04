# XO comparison browser acceptance

## Summary
PASS for the exercised real-browser offline flows on the frozen source. No source edits made by this tester. This is local synthetic/offline acceptance, not live wallet, network, signature, transaction, contest or deployment verification.

## Environment and target
2026-11-04 18:13–18:16 UTC; cloud Chrome through supported CUA browser DOM controls, desktop viewport approximately 1165 × 747. URL http://127.0.0.1:8788/request; title IntentGuard BCH · Payment request draft. Dedicated cloud terminal started the existing built server using preinstalled Node from /workspace/shared/bch-xo-candidate. Browser and server remained on the same cloud desktop. No alternate environment or security/network changes. Server stopped with Ctrl+C; shell prompt visibly returned.

Flow: request page → synthetic BCH/token example → Review draft → explicit local confirmation → separate funding acknowledgment → offline plan → official XO comparison → actual JSON download and invalidation.

## Frozen provenance
The four hashes in source-hashes.txt matched the parent's freeze before testing and were re-read after acceptance interactions. request-ui.ts = 60ea7e8ef2187e759576114397a96255db4c22c85e3be22aec4097004cc0d1b1; built request.js = baa9c564fbecd4e5edccdb531dc677462991d74f522746a74104223d74a3b441.

## Checks
- PASS page identity, meaningful initial content and no framework overlay.
- PASS actual BCH comparison: sendSatoshis, EXACT_MATCH_OFFLINE, fee 219 satoshis, unsigned candidate size 119 bytes.
- PASS actual token comparison: sendFungibleTokens, EXACT_MATCH_OFFLINE, fee 325 satoshis, unsigned size 225 bytes; 100 recipient token units, 400 token-change units.
- PASS repeated completed comparisons retain a fresh matching result.
- PASS actual download event/file for each BCH and token result. Downloaded JSON has all five authority flags false, nested Guard canSign false, and no raw parent/unsigned transaction fields or bytes. Safe summaries and digests remain. Original downloaded files copied unchanged as bch-download.json and token-download.json.
- PASS current comparison/export cleared after funding edit, request edit, Review draft, funding clear, request clear, import and reload. Request edit/import also removed funding owner. Import remained UNCONFIRMED DRAFT. Reload returned NO DRAFT.
- PASS natural funding timer: supplied observation 18:12:47Z; matching comparison at 18:14:27.888Z; at 18:14:50.414Z XO was NOT COMPARED, export disabled, and explicit two-minute observation expiry explanation displayed. No clock mocking.
- PASS natural request timer: expiry entered 18:16:11Z; matching comparison at 18:15:48.138Z; at 18:16:12.546Z request-expired explanation, NO PLAN, NOT COMPARED and export disabled. No clock mocking.
- PASS legacy inspector original candidate MATCH_OFFLINE; substituted recipient REJECTED; old unsigned builder BUILT_OFFLINE; navigation back to request and new actual comparison passed.
- PASS application console health: no app warn/error entries in captured latest 100 logs. Chrome extension metadata-delivery errors were present and identified by chrome-extension source URL; they were not application errors.
- PASS inspected desktop comparison section: readable wrapped summary and disclaimers, controls separated, no visible clipping/overlap in inspected viewport. Fresh transient screen inspection only. No images persisted or uploaded.

## Evidence and hashes
See dom-evidence.json for exact observed browser text and UI state, plus downloaded JSON files.
- bch-download.json SHA-256: 10989b99a48d715dba08b03e29cc3cd6e9324d4076c691f46ec7cab524275969
- token-download.json SHA-256: 4a670c4bfc36310027a36f483a0205dc24b795c85d3b6034ea57e676b73668a1

## Tools and recovery
Used supported locator click/fill/check/selectOption, DOM snapshots/read-only element evaluation, download event/path, console logs, dedicated terminal typing, and transient screen inspection. No page mutation/evaluate, interception, injected clock, or network throttling.
Initial terminal paste was unconfirmed and Return had not been sent. Clearing then typing produced a literal control-character prefix and a visible shell command-not-found error; after establishing non-execution and a clean prompt the command was entered once successfully. Initial localhost connection-refused preceded verified server startup. A clipboard-read attempt against the failed browser tab was denied by URL policy and never retried or rerouted. One later browser transport disconnect was recovered by observing unchanged DOM before continuing the known-unexecuted regression clicks.

## Remaining risk
Slow response, cancellation while in flight, out-of-order results and no-event DOM mutation races were not exercised in the real browser: the actual server completed promptly and supported controls expose no interception/throttling. These remain harness-only coverage; do not describe them as real-browser verified. Mobile was not retried because prior restrictions/unavailability remain. Only the inspected desktop region has visual acceptance; no full responsive or cross-browser claim. No screenshot artifacts exist by design.
