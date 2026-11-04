# Evidence boundary and durable operation lifecycle

Added November 4, 2026 as disclosed pre-event work. These modules do not connect a wallet, configure a public node, sign, transact, deploy or submit anything.

## Read-only evidence interface

`createEvidenceCollector` accepts application-owned source configuration and injected read transports. No URL/endpoint is accepted from the imported transaction. The production registry is deliberately unconfigured; `createEvidenceCollector([])` returns UNKNOWN/CONFIGURATION_REQUIRED without a request. Synthetic transports in tests are labeled SYNTHETIC_MATCH. NODE_REPORTED is only a statement about two configured node responses, never consensus/SPV proof or payment approval.

The collector checks distinct configured operator IDs, network/genesis/checkpoint pins, current tip consistency before/after each read, full parent transaction hashes, requested owner scripts, unspent output values and token metadata. Two source observations must agree. It does not silently drop a failed node and continue with one. Collection is bounded to 20 candidate inputs/owner scripts, 1,000 entries per requested UTXO list and a 10-second deadline; abort/timeout fails closed even if a transport ignores its signal. Response sizes at the wire must additionally be bounded by a future concrete transport.

`deriveSessionOwnership` uses the installed WizardConnect manager's real `hasPath`/`getPubkey` method signatures. It validates compressed public keys and derives the P2PKH script locally using libauth. It does not acquire a wallet session. The caller supplies already authenticated application session state. The result is an ephemeral WeakMap-backed capability, not an importable JSON assertion. The collector rechecks current session, paths, keys and age at the beginning and end. Public-key derivation alone is not a proof of private-key possession. No xpub or public key is persisted in the result.

Imported intent data is copied before asynchronous reads. Failure results are copied so ignored-cancellation callbacks cannot later mutate the returned status. Adapter errors are converted to static codes; raw endpoint/error text is not returned. Evidence binds the network, validated intent digest, structural transaction digest and hash-verified full parents. Observation metadata remains separate. `canSign` remains false.

## Durable local operation engine

`SimulationOperationStore.create(newPrivateDirectory)` creates a new private SQLite store exclusively. `open(existingDirectory)` refuses missing/corrupt stores rather than silently starting over. Only minimal digests, stable IDs, state and simulated observation metadata are retained, not raw transaction payloads, xpubs or secrets.

The event-import API is intentionally restricted to a trusted local harness. It is NOT a public API for setting payment status. SQLite BEGIN IMMEDIATE, revision compare-and-swap, unique economic keys and persisted session locks prevent racing or repeated in-flight attempts within the retained store. FULL sync commits before return. UNKNOWN does not unlock or reset an attempt. Recovery stays attached to the original known txid; late correctly bound responses are quarantined, never broadcast. Receipt state remains explicitly simulated, with receiptValid=false, chainVerified=false and canSign=false.

The stable economic identity includes network and caller-retained paymentRequestId. Different IDs, malicious local writers, rollback/deletion of the database, unsupported network filesystems or dishonest imported scenario facts are not solved by this ledger. A checksum detects accidental corruption, not malicious tampering. A future real orchestrator must authenticate consent, guard results, wallet responses and chain observations before supplying any event. No current event proves actual signing or payment.

## Verification and sources

Run `npm run validate` for the whole existing suite. Focused commands after build are:

```
node --test dist/core/evidence.test.js
node --test dist/core/operation-store.test.js
```

Evidence tests use two synthetic source adapters and a published public secp256k1 point, not generated keys or signed transactions. Store tests use actual private temporary SQLite files, separate processes, revision/session races, restart, corruption, missing/inode-changed paths and an interrupted transaction. None are real blockchain outcomes.

Official documents checked November 4:
- https://electrum-cash-protocol.readthedocs.io/en/latest/protocol-methods.html : read methods, token-inclusive unspent queries, genesis identity and raw transaction/header response shapes.
- https://docs.riftenlabs.com/wizardconnect/protocol/ : wallet-session protocol and signing separation; no signing path was executed.
- Installed pinned @wizardconnect/dapp declarations and @bitauth/libauth hash/key functions were compiled without custom SDK declarations or type suppression.
- https://nodejs.org/download/release/v24.22.1/docs/api/sqlite.html and https://www.sqlite.org/atomiccommit.html were checked as persistence references. The versioned Node page returned HTTP 200 through curl after the web extraction tool failed; installed Node is 24.22.1. Operational filesystem durability remains subject to their documented assumptions.

## Remaining real-integration gates

Two independently reviewed node operators/endpoints, correct network-specific checkpoint provenance, bounded concrete transport, authenticated read-only wallet session and verified ownership-path policy are still required. No current production source has been exercised. A later wallet connection requires the appropriate user authorization; signing/transactions remain outside this task. Fee-rate/dust policy, sighash/signature validation, public deployment, real mainnet function and contest submission remain incomplete.

## 2026-11-04 read-only transport continuation

The bounded concrete Node TLS transport and an explicitly opt-in public Chipnet candidate registry are now implemented; see TRANSPORT.md. Default UI remains offline. No successful production-node response was obtained: the first standalone capability diagnostic failed DNS EAI_AGAIN. This does not supersede the live-integration gates above. Tip freshness now requires bounded trusted maxTipAgeMs and checks header time at both collection start/end; a fresh retrieval timestamp alone cannot bless an old tip.

Post-signature expiry correction: secondary-check-match at or after expiresAt preserves the original txid in NEEDS_REVIEW and retains the session lock. Timely signature arrival alone does not permit starting even a simulated broadcast after expiry. Read-only observation of the pinned original may still be recorded; expiry cannot erase evidence of an independently observed transaction. No real broadcast authorization is supplied by this state engine.
