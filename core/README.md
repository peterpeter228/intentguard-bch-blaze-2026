# Core transaction comparator — pre-event development

Current continuation: [offline unsigned builder](UNSIGNED_BUILDER.md), [offline signed verification](SIGNATURE_VERIFICATION.md), and [read-only coordination](READ_ONLY_COORDINATION.md). Earlier implementation snapshots below are historical; none imply real wallet or chain success.

The user explicitly requested core implementation on November 4, 2026. This supersedes our own earlier decision to defer G1 until November 14. These files are disclosed pre-event work, not event-period work or completed entry qualification.

## Run

```
npm run validate
npm run core:demo
npm run core:preview
# Open http://127.0.0.1:8788
```

`verifyCandidate` consumes an explicitly confirmed-intent-shaped record, unsigned raw BCH transaction and bounded evidence snapshot. It decodes with pinned libauth, binds each input to the full parent transaction by txid, compares every recipient output exactly, accepts only separately supplied owner-change scripts, computes total fee using bigint, and rejects duplicate inputs, NFTs, undeclared categories, token imbalance, unknown owners/scripts, expiry and stale/missing observations. Only P2PKH scripts, version 2, zero locktime and final sequences are supported.

The demo uses synthetic transaction graphs, a synthetic token category and fixed simulated clock. Parent hashes are cryptographically checked; network, ownership and unspent claims are still supplied evidence. No chain reader or wallet adapter has been implemented. MATCH_OFFLINE is conditional comparison only. Every result has canSign=false; this module must not be used as a spending authorization.

`parseUnits` accepts strict decimal strings and rejects excess precision; no Number arithmetic or rounding. `structuralTransactionDigest` excludes unlocking bytes only. It is NOT the complete network/source/consent commitment proposed in the architecture. `compareSignedCandidate` checks only structural sameness and nonempty unlocking scripts, NOT signature validity, sighash restrictions or a successful wallet operation. Its tests use dummy bytes, never real signatures.

The application runs entirely in the browser after loading static localhost assets, with connect-src none. It does not store input, open wallets, request accounts or query RPC. Editing invalidates the previous report/export. Download contains report/digests, not input documents; digests can nevertheless correlate transactions and should remain private unless deliberately shared.

## Still unfinished

- Independently verified wallet script/path ownership and human confirmation state.
- Trusted live chain reader, source disagreement/reorg handling, spendability and freshness evidence.
- Dynamic dust policy and fee-rate ceilings; current 546-satoshi minimum is merely a conservative supported-input rule, not sufficient relay-policy validation for token outputs.
- Signature/sighash validation and wallet non-broadcast behavior; signing and transactions remain prohibited for this work.
- Integrating the new local simulation operation store with authenticated real wallet/chain events; independent confirmed receipts remain unfinished.
- Public demo, mainnet functional proof, complete event rules/qualification/IP/license review and final submission.
- XO-specific novel contract and current signed-Invitation positive fixture are separate, still incomplete.

All current tests are local synthetic checks. They demonstrate deterministic rejection/matching behavior, not customer demand, real transaction success, or an award probability.

## Evidence/state continuation

[Evidence and durable-state interfaces](EVIDENCE_AND_STATE.md) now implement bounded source corroboration, session-derived ownership checks and actual local SQLite concurrency/recovery. Production transports remain unconfigured, and scenario events are not verified financial facts. The localhost UI bundle is unchanged by this continuation.

## Token-aware dust baseline

The comparator now checks each supported output against libauth's full serialized-output dust threshold at a fixed application relay baseline of1000 sat/1000 bytes. CashTokens prefix/amount CompactSize are included: ordinary P2PKH is546 sats, a P2PKH FT output with amount100 is651, and amount253 is657. Recipient and change outputs are both checked. This is not a live node policy quote, consensus guarantee or complete fee-rate policy. Total fee remains capped by the intent; final signed-size/fee-rate bounds and an unsigned payment builder are still pending. See evidence/coordination-20261104/FEE_DUST_REVIEW.md for the pinned BCHN formula and limitations.
