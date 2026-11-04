# Read-only evidence coordination

This pre-event slice joins the existing deterministic comparator and internal evidence collector to a durable **review journal**, not to a payment or signing state machine. It does not import a simulation event as a real fact. SimulationOperationStore remains separate and always explicitly simulated.

## Trust boundary

Trusted application code constructs ReadOnlyReviewCoordinator with source transports, a public-key session adapter and a clock. The request only contains a stable paymentRequestId, intent, candidateHex and derivation bindings. It cannot supply EvidenceResult, ownership/status assertions, endpoint URLs or signing permission. The coordinator copies the request, derives ownership internally and invokes createEvidenceCollector itself. Imported JSON is data to check, not a trusted report.

The request key binds network and stable caller paymentRequestId. A record binds validated intent digest, exact candidate bytes digest, session digest, paths/scripts digest and source-configuration digest (operator/network/genesis/checkpoint/freshness/kind). A different binding for the same key is a conflict, not a silent replacement. The configuration digest covers declared source metadata, not transport function code or an independently authenticated endpoint identity. Application adapters themselves remain a trust boundary; dishonest application configuration cannot be repaired by hashing labels.

## Durable operation

A private local SQLite reservation is committed before asynchronous collection. Another process/request sees PENDING rather than starting another collection. Completed, failed and interrupted records remain associated with the same key. Reopening/reading/repeating returns STALE_RECHECK_REQUIRED, never a new live capability. Explicit successful-observation refresh is now implemented with immutable revision history; see REVIEW_REFRESH.md for its narrow policy and v1 migration refusal. UNKNOWN/PENDING cannot reset. Changing request IDs is not evidence of a new human-approved payment.

Completion checks source/guard bindings, intent expiry, time window, cancellation and current session/path/pubkey state. The immediate successful result is only OBSERVED_DURING_CALL. This describes when evidence was observed, not consensus, spendability, consent or permission to sign. Persisted results contain only digests and bounded summaries, not raw transaction data, public keys, addresses or original session IDs; hashes can still correlate data.

Every record keeps canSign=false, receiptValid=false and consensusVerified=false. Status SYNTHETIC_MATCH explicitly identifies fixtures; NODE_REPORTED would only report configured node observations. No production node response or wallet session has been exercised by this slice.

## Limits

A corrupt, missing or replaced journal fails closed; do not silently make a fresh store. After uncertain write failure reopen/read before deciding whether anything committed. Local filesystem durability, malicious local writers, deleted/restored old databases and dishonest application/session adapters remain outside this journal's guarantees. No outcome authorizes submission, deployment, signing or broadcast.

The comparator separately adds token-aware dust at fixed1000 sat/1000bytes. Fee-rate caps, live relay/mempool conditions, final signed-size verification and unsigned payment building are not implemented by the coordinator. See FEE_DUST_REVIEW.md in this slice's evidence directory. These are deliberate remaining engineering gates, not successful validation claims.
