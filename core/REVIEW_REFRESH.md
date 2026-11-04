# Explicit read-only review refresh

This is local, read-only evidence coordination. It does not modify the simulation payment lifecycle, reserve coins, sign, broadcast, authorize spending or verify consensus. Every result retains `canSign=false`, `receiptValid=false` and `consensusVerified=false`.

## API and policy

- `review(input, signal?)` retains its original idempotent behavior. A repeated request returns the latest stored record with `STALE_RECHECK_REQUIRED`; it never silently fetches again.
- `refresh(input, expectedRevision, signal?)` is an explicit new collection for the same request. Only the latest completed `SYNTHETIC_MATCH` or `NODE_REPORTED` revision is eligible. `PENDING` and `UNKNOWN` can never be reset or refreshed by this API.
- The complete original intent, exact candidate, session identity, derivation paths, and captured source configuration must remain identical. Source configuration includes source/operator IDs, network, genesis/checkpoint pins, tip-age limits and declared source kind. Changed bindings fail without starting a collection.
- An expired intent cannot refresh. A backward clock before reservation cannot refresh. Cancellation before reservation does not change history.
- The coordinator obtains ownership from its configured session and invokes its configured evidence collector internally. Neither operation accepts an imported success report, ownership JSON, endpoint or lifecycle state.

## Revisions and concurrency

The first reservation is revision 0 (`PENDING`), with completion at revision 1. An explicit refresh reserves revision 2, then completes at revision 3, and so on. SQLite `BEGIN IMMEDIATE` plus expected-revision comparison serializes reservations across connections/processes. Reservation is durably committed before any awaited source request. Concurrent refreshes cannot both start collectors for the same head revision.

Each reservation and completion is appended to `review_history`; the current head is updated in the same transaction. History has checksums linked to the preceding entry, immutable-binding/transition validation, and update/delete rejection triggers. Reads validate the head and history in one SQLite snapshot. These protections detect corruption and invalid transitions; they are not authentication against an attacker controlling the local database or rollback to an old complete backup.

A cancelled or failed refresh ends at `UNKNOWN`. A process crash or uncertain persistence failure can leave `PENDING`. Neither restores the prior successful observation as the current result. Old observations remain accessible only as historical information. An error with an uncertain commit outcome must be followed by reopening/reading, not a blind retry.

The module retains at most 2,000 revisions per request and refuses another refresh at the limit. `history(requestKey, offset=0, limit=50)` returns frozen historical views, all marked `STALE_RECHECK_REQUIRED`; `limit` must be 1–100. The existing 64 MiB database and 8 KiB record limits remain. No automatic pruning exists.

## Freshness is not permission

Only a newly collected immediate return may carry `OBSERVED_DURING_CALL`. This describes an observation during that call, not ongoing validity or authorization. After persistence, the coordinator checks that the record is still the latest head, the journal is readable, the session/path capability still matches, the intent has not expired, the clock/collection window is valid, and every captured source tip-age policy still passes. If time/session freshness no longer passes, the view is stale. Journal integrity failures reject instead of returning a successful view.

`get`, `history`, repeated `review`, and reopening a journal always return stale views, even when the stored status was successful. Node-reported agreement is not SPV, consensus, signature verification or a payment receipt.

## Storage version boundary

New journals use storage schema **v2**. Record payloads retain their existing `schemaVersion: 1`; storage version and payload version are distinct.

Opening a v1 journal returns `REVIEW_MIGRATION_REQUIRED`. A read-only version inspection occurs before writable PRAGMAs, and no history or replacement journal is created. **Migration is not implemented.** Preserve the original journal; do not delete/recreate it or infer missing history. An explicit, separately reviewed migration is required before using old journals with this version.

## Local evidence

`npx tsc && node --test dist/core/review-coordinator.test.js` covers explicit refresh, immutable bindings, bounded stale history, competing connections, source/session/clock failures, cancellation and late results, real child-process SIGKILL during refresh, malformed history, forbidden UNKNOWN resets with recomputed checksums, and byte-for-byte unchanged v1 refusal. All transports and session data are synthetic. No live node, wallet, key generation, signing or network call is made by these tests.
