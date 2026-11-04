# Independent browser regression: token-aware dust

Run: 2026-11-04 14:53–14:56 UTC. Result: PASS for this desktop offline comparison slice. This does not verify the new backend operation coordinator, live network transport, wallets, payments or deployment.

## Environment and identity

- Cloud Chromium on Linux, operated through the documented CUA browser/native-app APIs. No standalone Playwright, external browser or DevTools fallback.
- URL: http://127.0.0.1:8788/. Title: `IntentGuard BCH · Transaction comparison`.
- Actual desktop page viewport screenshot: 1165×747. Full-page screenshots are also saved.
- Working directory: `/workspace/shared/bch-clean-3619c70`. This is an exported snapshot plus current working changes, not a Git checkout. No commit identity is claimed for the tested working state.
- Exact tested app.js SHA256: `7a647361af38b98277be90ca243e07c683fbe8f1ac504645c36abb6e67acef80`. Core, server, lockfile and synthetic input hashes are in `tested-sha256.txt`.
- Started using the installed Node runtime from the cloud desktop Terminal, because that desktop and the command executor have separate localhost contexts. Command: `cd /workspace/shared/bch-clean-3619c70 && /opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node dist/core/server.js`.
- The temporary server was stopped at the end with Ctrl+C, and the shell prompt visibly returned. Other sessions/windows were left alone.

The flow under test is: load offline demo → compare original and negative presets → enter exact synthetic dust-boundary inputs → edit/clear/recover → download a report → reload and compare again.

## Required browser checks

| Check | Observation | Result |
| --- | --- | --- |
| Page identity | Exact title and URL returned by browser | PASS |
| Nonblank meaningful UI | Header, offline disclaimer, scenarios, populated editor and result controls present | PASS |
| No framework overlay | No application/framework error overlay | PASS |
| Console | No app-origin warnings/errors; 78 extension-origin metadata errors recorded separately | PASS for app |
| Screenshot evidence | Initial screen, original result, 650/651 boundary, invalid-input screenshots saved | PASS |
| Interaction proof | Buttons and editable textbox used; rendered results read after each action | PASS |

`console.json` preserves all observed messages. Every recorded error in this fresh test tab came from the browser extension's `Error sending browser metadata to extension: Object`, not the local app. The previous WASM/CSP initialization defect did not recur. The new report's fixed `1000 sat/kB token-aware dust baseline` limitation text confirmed the revised bundle was rendering, rather than the older build.

## Results

| Actual UI action | Observed outcome | Result |
| --- | --- | --- |
| Initial load | NOT CHECKED, Download disabled | PASS |
| Original payment → Compare | MATCH_OFFLINE, fee 500, no issues, canSign false | PASS |
| Recipient replaced → Compare | REJECTED / RECIPIENT_MISMATCH | PASS |
| Wrong token → Compare | REJECTED / UNDECLARED_TOKEN, RECIPIENT_MISMATCH, TOKEN_IMBALANCE | PASS |
| Excessive fee → Compare | REJECTED / FEE_LIMIT, fee 1500 | PASS |
| Stale evidence → Compare | UNKNOWN / STALE_OR_INVALID_SNAPSHOT | PASS |
| Missing parent → Compare | UNKNOWN / MISSING_OR_SPENT_PREVOUT | PASS |
| Switch each preset | Prior result invalidated to NOT CHECKED; Download disabled before comparison | PASS |
| Paste token-dust-650.json → Compare | REJECTED, sole issue DUST_OUTPUT, canSign false | PASS |
| Paste token-dust-651.json → Compare | MATCH_OFFLINE, fee 500, no issues, canSign false | PASS |
| Edit matching 651 input by adding whitespace | Prior result removed; NOT CHECKED; Download disabled | PASS |
| `{broken` and `null` → Compare | INVALID INPUT, Download disabled | PASS |
| `[]` and `{}` → Compare | REJECTED / INVALID_INTENT, canSign false | PASS |
| Clear | Empty textbox; NOT CHECKED; Download disabled | PASS |
| Compare empty | INVALID INPUT; Download disabled | PASS |
| Valid ASCII JSON padded to exactly 600000 bytes | MATCH_OFFLINE | PASS |
| Same JSON padded to 600001 bytes | INVALID INPUT; Download disabled | PASS |
| Restore 651 input → Compare → Download | Actual browser download completed and was parsed | PASS |
| Reload after successful comparison | NOT CHECKED, Download disabled; compare restored original MATCH_OFFLINE | PASS |

All structured guard reports observed had `canSign:false`. Dust inputs supplied by the developer are explicit synthetic transactions, preserve a 500-satoshi fee and match the request amount to the candidate amount. The independent browser test used the public textbox and Compare button, not a direct guard invocation. The 650/651 test establishes this exact fungible-token example under the fixed local baseline, not every token encoding or a live node's relay policy.

## Export verification

`downloaded-report.json` is copied from the actual completed browser download for the 651-satoshi synthetic candidate. It contains `OFFLINE_COMPARISON_NOT_CHAIN_PROOF`, MATCH_OFFLINE, canSign false, fee 500 and the new token-aware dust limitation. It contains no fields named `candidateHex`, `parentTransactionHexes`, `ownerScripts` or `unspentOutpoints`. No raw transaction/evidence payload was exported.

## Evidence

- `initial.png`: first viewport and explicit offline/synthetic disclaimer.
- `original-match.png`: ordinary positive regression.
- `token-dust-650.png` and `.txt`: candidate and request both 650 satoshis, rejected for DUST_OUTPUT.
- `token-dust-651.png` and `.txt`: candidate and request both 651 satoshis, matched with fee 500 and canSign false.
- `invalid-input.png`: recoverable bad/empty input state.
- `scenario-results.json`, `dust-results.json`, `edge-results.json`: observed result values.
- `final-regression-dom.txt`: final recovered original comparison.
- `tested-sha256.txt`: exact source/bundle/lockfile/input identities.

## Limits and unresolved coverage

- Mobile 390×844, exact 1366×768 and other browsers: NOT_RUN. The prior run encountered an explicit organization-policy denial for Chromium DevTools; this run did not retry that denial or bypass it.
- No wallet connection, signing, transaction, broadcast, live node query, public deployment or submission was attempted.
- The backend coordinator/store/transport modules are not imported by this browser UI, so this QA does not claim to verify them.
- The broader node fee/relay policy and live dust acceptance remain unverified. This local fixed-rate test is not a consensus or payment approval.
- Preset explanatory prose remains static when a custom JSON input is pasted; the textbox and result are the evidence for the custom 650/651 cases. A future dynamic summary could make custom inputs easier to read, but no incorrect guard acceptance was observed.
