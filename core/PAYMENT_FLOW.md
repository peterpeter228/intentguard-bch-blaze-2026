# WPREV5 visitor-wallet flow — 2026-11

`visitor-wallet` is a stateless reader and fixed-source relay, not
PaymentFlow/PaymentJournal. It has no wallet, keys or original-journal access.
The relay endpoint accepts a signed transaction only with a request, selected
inputs and plan binding; it independently fetches fresh two-source funding,
rebuilds the plan and verifies the exact bytes, signatures, fee and network.
It cannot independently establish that a human clicked the browser confirmation.

Visitor: explicit network/recipient/amount/maximum-fee review -> confirm -> live
SDK paths and two attributed BCH sources -> independent deterministic plan ->
display all inputs/outputs/change/exact fee -> sign-only approval -> strict
IndexedDB input and invocation reservation -> wallet `broadcast:false` -> full
`verifySignedPlan`/0x61 -> persist exact signedHex/local txid -> fresh sources,
ownership and full postcheck -> separate approval -> strict shared delivery
reservation -> either app relay of identical bytes once or optional native
Electron Cash handoff, never both. Server rechecks the signed plan before the
single fixed-endpoint invocation. ACK, RPC success or error is not a receipt.

Failed/unknown/cancel/drop/reload/stale/changed session/terms/source or withdrawn
delivery approval after any possible effect: UNKNOWN, retain original identity and
input tombstones. Late callbacks are quarantined; duplicate callbacks/CAS losers
cannot re-sign or resend. Cancellation after relay starts cannot recall bytes already sent. Strict
same-origin retained IndexedDB is the primary reservation; the bounded server
dedupe is per-process only. Storage deletion/rollback, another origin/device,
server restart/instance or independent wallet use defeat global exactly-once.
Reopen restores public facts only, never wallet authority; no memory fallback.

Recovery reports an unsuccessful read when the original bytes or hash are
unavailable, and an inconclusive read for UNKNOWN. OBSERVED means both fixed
nodes agreed on the original transaction bytes, not that inclusion was found;
CONFIRMED_ON_CHAIN also requires matching node-reported merkle/header inclusion.
Recheck freshness and invalidate stale/conflict/reorg status. Sources are Kallisti
and Cyberbits Labs with TLS and BCHN Axion661648 pin; NOT SPV/consensus/collusion
proof. Real human wallet interoperability/payment remains UNVERIFIED.

Agent mainnet cap is 0 sat. Chipnet payment authorization is withdrawn; the
unavailable original row is a non-official engineering gap. Browser proof, owner
approval for the exact main change/deployment, owner-performed mainnet proof and
Rio submission are separate later gates. Historical flow below is not current
authority.

# Guarded payment — PRESEASON / task mainnet cap0

`/pay` uses the real pinned WizardConnect session, not XO server custody. Explicit Chipnet selection + fresh key exchange + live hdwalletv1 paths are required. Protocol has no authenticated chain ID; wallet network acknowledgement, fixed post-split Chipnet sources and exact current path-derived scripts are separate requirements. bchtest/xpub alone is not chain proof. Session/relay credentials remain in memory; only public economic/operation IDs enter localStorage.

## Ordering and authority

1. Independently review strict request recipient/amount/network/maximum fee/rates/expiry. Confirm before building. Any input, path, network or wallet-session edit invalidates confirmation and controls.
2. Node `PaymentChain.funding` verifies two fixed operator/config identities, post-split checkpoint, fresh stable tips, token-free confirmed UTXOs, full parent hashes/scripts/values. `buildPaymentRequestPlan`/Guard builds exact recipient/change/fee bytes. HTTP never imports an ownership/PASS flag. Browser independently reconstructs the exact plan and derives ownership from live SDK paths.
3. Private SQLite `PaymentJournal` (not SimulationOperationStore) retains the current request/build/plan and reserves input outpoints. Before ANY signature reservation, edits invalidate the visible candidate and require explicit reconfirmation. Authenticated `revise` retains the network+request/economic ID and capability, CAS-increments revision, rebuilds Guard-checked bytes with fresh funding, and atomically transfers this draft's input reservations; conflicts roll back both bytes and reservations. Replacement requires PREFLIGHTED with null envelope, signed bytes, txid and observation, rechecked inside the SQLite transaction after funding awaits. `reserve` permanently retains its envelope, so signing/UNKNOWN/late/signed/send states cannot be revised. FULL-sync signature reservation/envelope is durable before the SDK call. SDK sequence/session/generation/candidate envelope is checked locally; SDK response does not magically carry app fields.
4. Browser `createEvidenceCollector` repeats fresh live-session/two-source preflight. Wallet receives complete input+output prevouts, exact paths, `broadcast:false`; only 0x61 is accepted. SDK auto-replay is stopped by immediate invalidation and synchronous sendSignCancel pending deletion. Raw disconnect has no8s grace. Actual stock-wallet no-broadcast adherence remains NOT_RUN, not proved by a TypeScript flag.
5. `verifySignedPlan` compares every non-unlocking byte, hash-bound full parents, all VM signatures and actual fee/size. Invalid/late/cancelled bytes are NEEDS_REVIEW, never auto-sent. Persist original signed bytes/hash BEFORE any send. Explicit broadcast repeats fresh sources and cryptographic verification, then commits BROADCASTING BEFORE the one Chipnet RPC. Neither send nor ambiguous COMMIT is retried.
6. Restart recovery reads ORIGINAL operation/hash. No reset, replacement, re-sign or resend. Disappearing UTXOs are not payment. Observation compares exact original raw bytes on both nodes; confirmed reports also check matching merkle inclusion/header. This is bounded node trust, NOT header-chain/SPV/consensus verification. Conflict/reorg invalidates a recorded receipt. Read-only recovery works without restoring wallet/mutation credentials.
Read-only recovery returns a fresh effective state and `persistedState` as history: missing/conflicting confirmation evidence cannot display the old confirmed state as current. It does not reset the journal or restore mutation authority; the explicit nonce-bound observe path persists receipt invalidation.

## Runtime and HTTP

Node24 loopback8788, one persistent private local SQLite directory, fixed sources only. `INTENTGUARD_PAYMENT_DIR=/absolute/new/private/journal npm run core:preview -- --create-payment-journal` creates exclusively. Restart without create; missing/corrupt/replaced paths fail closed. No public signing/key route. No journal reset/migration of simulations. Body/UTF8/duplicate-key/origin/host/method/deadline/response/connection bounds remain. Per-operation random capability is checked for financial mutations, stored hashed; it is not wallet authentication. Public get/recovery is observational. Unknown operations retain input reservations. Local journal deletion/backup rollback/malicious local writers and hardware beyond SQLite assumptions are not solved.

Mainnet is hard-coded cap0 before wallet allocation, sign reservation and broadcast. `/pay` mainnet builds only explicit offline planning contexts; unsigned fixtures are not current funds. Server has no mainnet source/send configuration or wallet keys. Tokens/NFTs, unknown scripts/parents and guessed derivation refuse rather than disappear.

## Evidence and limitations

`npm run payment:verify -- NEW_DIRECTORY` runs compiled UI edit5000sat→reconfirm→rebuild4000sat via actual HTTP/builder/SQLite (zero sign/send), then actual SDK manager, HTTP routes, VM checks, durable reopen, racing send and response-loss recovery with **MOCK_TRANSPORT / NO_CHAIN_TRANSACTION**. Focused HTTP tests also race revision against signature reservation and verify input-transfer rollback and effect-state refusal. `npm run builder:verify -- NEW_DIRECTORY` runs finite actual builder inputs, scratch-source corruption detection and restoration. `npm run payment:statechart -- NEW_DIRECTORY` generates a code-anchored bounded abstraction including the concrete unsigned revision journey; separately run the pinned official /statechart tool and retain TLC/report/chart. Neither generation nor a mock tx hash is public-chain proof.

Public dedicated-address read on2026-11-09 returned NO_ORDINARY_CONFIRMED_FUNDS. Parent already saw faucet CAPTCHA/browser-check; no retries/bypass. WP2_BROADCAST_BLOCKED/Q_FAUCET only. No protected identity was opened or used. Stock wallet/live chain/mainnet/public deployment remain NOT_RUN. Parent owns actual public-only embedded-browser proof and fresh Astra acceptance. See task artifacts and owner questions; code readiness is not contest eligibility.
