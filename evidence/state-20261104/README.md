# Evidence/state slice — November 4, 2026

Baseline: 277c23a896896ada22a57454a767378dd7c7e462. All additions remain pre-event work. The task allowed interface and local persistence development, not wallet connection, signing, transactions, deployment or submission.

## Actual validation

- `npm run validate`: exit 0, strict typecheck, both existing browser builds and all 78 tests pass.
- Evidence interface: 14 new tests with synthetic read transports and a fixed public curve point. No keys generated, signatures made or public nodes queried by the implementation.
- SQLite operation store: 17 tests using actual temporary private files and separate processes, including restart, revision/session races, SIGKILL rollback, corrupt/missing/replaced paths and UNKNOWN-lock recovery. Scenario events do not constitute real wallet/chain outcomes.
- No new UI controls or browser behavior. `dist/core/app.js` SHA256 remains 2be301fda69811671fb1b65cecfa8bd2c2be3f5ed95d5b0a18518a5b8c13ae26, exactly matching the previously independently browser-tested bundle. No fresh visual or mobile pass is claimed.

See validation.log for actual output; builtin node:sqlite emits its runtime experimental warning, which was not suppressed.

## Independent review and fixes

Read-only review identified ownership expiry at collection end, raw transport error exposure and loss of a correctly bound late-response txid. All were fixed with end-time/session/key rechecks, fixed error codes and persistent NEEDS_REVIEW quarantine. Additional integration review rejected observation-based recovery while the original txid is unknown and retained correct late-response binding after timeout. The state engine now refuses unpinned observation, preserves unknown locks and cannot turn a late response directly into broadcasting.

The operation digest now reuses Guard's validatedIntentDigest rather than maintaining a weaker parallel canonicalization. This addition does not change the browser bundle.

## Scope and trust roots

Source identities/operator separation/genesis/checkpoint pins come from trusted application configuration, not imported candidate JSON. The collector currently has no concrete live transport or production registry. Distinct operator strings alone do not independently prove organizational independence; that review is a remaining deployment prerequisite. A node-reported consistent response is not SPV or consensus proof. Session-derived public-key scripts do not prove private-key possession.

Production use needs reviewed source endpoints and network-specific checkpoints, a wire-size-bounded transport and an authenticated wallet session. The SQLite event-import API is deliberately simulation-only and must not be attached to a public payment/status API. Independent real-event authentication and an orchestrator remain unimplemented. Current records always retain canSign=false, chainVerified=false and receiptValid=false.

Official sources: Electrum Cash protocol method reference, WizardConnect protocol, pinned installed package declarations, Node24.22.1 SQLite API and SQLite atomic-commit documentation. The versioned Node page was inaccessible to web extraction but a read-only curl request returned HTTP200; no alternate credentials or permissions were used.
