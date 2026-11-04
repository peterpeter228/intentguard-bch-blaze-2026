# Transport slice verification — 2026-11-04

Pre-event baseline parent: 4a93590de9c2f41a2db6b2c80b844d4dedc67aa5. This slice adds the explicit, bounded read-only TLS adapter, reviewed opt-in Chipnet source definitions and header-time freshness enforcement. It does not complete G1 or any contest chain requirement.

- `npm run validate` exit 0: strict typecheck, build and 93/93 tests, no skipped tests in that suite.
- 11 synthetic TLS tests cover method/parameter/config restrictions, version negotiation, framing, response limits, remote errors, TLS flags, abort/timeout and cleanup.
- Evidence tests add stale/future/agreed-tip rejection and expiration during collection.
- Registry test proves local immutable construction only, no external requests.
- Independent read-only reviewer identified start-only freshness and construction-time cancellation; both corrected and re-reviewed.
- Actual UI artifact SHA256 remains `2be301fda69811671fb1b65cecfa8bd2c2be3f5ed95d5b0a18518a5b8c13ae26`, identical to the previously real-browser-tested version. No new browser run is claimed; no visual code changed.
- First standalone external TLS capability diagnostic failed DNS EAI_AGAIN before TLS/RPC, saved in live-probe.json. This diagnostic preceded the final module. Actual node handshake/header/transaction/UTXO validation is NOT_RUN successfully, not passed.
- No wallet, account, key, signing, transaction, mainnet, deployment, public release, external message or submission action occurred.

Official research freshness is recorded in ENDPOINT_RESEARCH.md and source-fetch.json. Cached web extracts are not represented as fresh RPC evidence. The source pins establish expected identity only; no chain-of-work, SPV or actual independent-backend proof exists. Empty UTXOs are not a payment/nonexistence proof. Read TRANSPORT.md for deployment/SSRF/trusted-adapter boundaries.

Remaining next step: real low-frequency public Chipnet capability checks when network access allows them, followed by separately authorized wallet ownership integration. Do not clear UNKNOWN or turn synthetic lifecycle events into real receipts.
