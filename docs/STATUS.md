# IntentGuard BCH status

Updated 2026-10-27 UTC. Stage: G0 PARTIAL — preseason preparation. Repository is private; not a public demo or submission.

- T00: local environment and remote initial baseline identified; final source upload/commit binding pending coordinator.
- T01: official main-site schedule/bounty research available; Dora detailed rules blocked by human verification in this run. Registration/roll call/Telegram/eligibility not evidenced.
- T02: new BCH project, no accessible IntentGuard-402; all current code is disclosed preseason.
- T03: clean install, strict typecheck, browser bundle, 10 offline SDK tests passed. WizardConnect npm license metadata is null, but exact upstream gitHeads now have verified LGPLv3 LICENSE.txt; concrete distribution obligations still need review (review/post-argon/).
- T04: actual wallet NOT_RUN; static types only and pre-abort send-before-cancel diagnostic reproduced. NOT cleared for payment.
- T05: independent published-template reference check completed; PARTIAL, no canonical current validator/Debug Tool closure or real Invitation/chain result established. XO deferred; see evidence/xo/REVIEW.md.
- T06: alternatives reviewed and falsifiable integration questions prepared in evidence/xo/REVIEW.md; no interviews sent, no user feedback or paid demand asserted.
- G1–G4: NOT_STARTED. No payment UI, Guard business logic, wallet signature, chain broadcast, mainnet receipt or public deployment.

Evidence index: evidence/validation/summary.md, evidence/dependencies.json, evidence/wallet/compatibility.md. No Argon review claimed by this worker; root coordinates any permitted one-call review after freeze.

## Persisted review baseline

Private draft PR: https://github.com/peterpeter228/intentguard-bch/pull/1 . Actual reviewed source commit: `955e5c0afebedb5931d24feaa4261917131f88a3`. One authorized Argon request completed HTTP 200 at 2026-10-27 08:52:44 UTC. Requested gemini-4-argon-high; response has no modelVersion, actual backend/model identity unverified; cost null/unknown. It read supplied source/evidence, did not execute tests. See review/argon/CLAIM_DISPOSITION.md for independent qualification and corrected claims.

This post-review documentation/evidence update was NOT re-reviewed by Argon. G0 remains PARTIAL, with all wallet/signature/chain/product/UI gates unchanged. Final post-review persistence SHA is to be recorded by coordinator, not guessed here.


## 2026-11-04 preseason XO laboratory supplement

Independent branch continues a304f8810c402fd29b105563a136379e42f246af. G0 remains PARTIAL; G1–G4 payment product remains NOT_STARTED. `preseason/xo/README.md` now documents an actual offline inspector using pinned engine0.1.0-next.17612568780, utils0.0.10, templates0.0.12 and types0.0.8. It is not the old0.0.1 probe, a new contract, real-chain result, or event-period implementation. No main changes, wallet creation, signing, transactions, deployment or submission.

Coordinator independently confirmed registration on Nov4; user reports Telegram group joined. Identity introduction/roll-call evidence remains pending. Complete qualification is not asserted.

Current commands and test evidence: `evidence/xo-20261104/`. Browser QA is separately recorded by the coordinator; do not infer it from unit or HTTP tests. Tests and fixes from this supplement do not retroactively validate old-wallet issues or payment behavior. No external model audit was run this round.

## 2026-11-04 12:07 UTC verification follow-up

31 tests/typecheck/build now pass; added boundedCLI and unmodified official legacy-Invitation rejection tests plus Host/body limitHTTP checks. No application/UI code changed. Public official sources checked at fixed commits did not provide a compatible valid-signature positive fixture; current gap remains, with an unsent precise maintainer question in evidence/xo-20261104-followup/PUBLIC_FIXTURE_SEARCH.md. G0 remainsPARTIAL, G1 unchanged and no external actions.

## 2026-11-04 13:22 UTC core development authorized

User explicitly requested core development now, superseding our earlier deferral strategy. G1 is now IN_PROGRESS, not DONE. First actual slice: core/guard.ts raw-transaction comparator, strict decimal amounts, complete parent-hash matching, all-output checks, confirmed-owner allowlists, fee cap, fungible-token conservation/NFT rejection, structural-only post-wallet comparison and a local browser demonstration. No wallet adapter, signature/chain success, persistence lifecycle, real receipts or public demo exists. MATCH_OFFLINE and canSign=false are intentional.

Baseline before core: 4bf2d146c701822526faa0622dd26772dc18c705. All current work is pre-event and must be disclosed. See core/README.md and evidence/core-20261104 for actual tests, browser evidence and limitations. XO signed-positive reference gap remains separate and does not prevent this pure comparison implementation.

## 2026-11-04 13:56 UTC evidence and durable-state slice

G1 remains IN_PROGRESS. Added core/evidence.ts and a local SimulationOperationStore: application-pinned source identities, checkpoint/tip consistency, raw-parent and UTXO/token checks, ephemeral session-derived ownership evidence, deadlines/cancellation, shared validated intent digest, SQLite CAS/economic tombstones/session locks and UNKNOWN/late-response recovery. 78 tests/typecheck/build passed. Actual database file/process tests include restart, race, SIGKILL rollback and corruption failures; chain and lifecycle events are synthetic, not real payments.

No production transport/endpoint or wallet is configured. Reports remain canSign=false; stored receiptValid=false/chainVerified=false. UI bundle SHA is unchanged from the independently tested previous commit. Details and exact remaining integration gates: core/EVIDENCE_AND_STATE.md and evidence/state-20261104/README.md.

## 2026-11-04 14:10 UTC bounded node transport

G1 remains IN_PROGRESS. Implemented strict Node TLS read transport with fixed protocol 1.5.0 handshake, five read-only methods, bounded response/deadline, cancellation cleanup and no retries. Added opt-in Chipnet candidates with fixed BCHN identity pin and operator/source provenance; these are not verified live backends. First standalone public TLS diagnostic failed DNS EAI_AGAIN before any RPC response. No IP/TLS/proxy workaround. Collector now rejects stale/future tip headers at start and completion. Core browser UI remains unchanged and offline; no wallet/payment/contest success claimed. Actual validation and remaining limits are recorded in evidence/transport-20261104 and core/TRANSPORT.md.

## 2026-11-04 14:40 UTC remote-integrity correction

Independent review found remote613397f9 core/evidence.test.ts was binary-corrupted; the earlier local93-test pass did not validate that remote commit. This was a verification failure. Repair3619c70 restores the intended UTF-8 file and adds fail-closed post-sign/pre-broadcast expiry quarantine. Every one of186 files was downloaded from that fixed remote commit into an empty directory and Git blob hashed; npm run validate in that remote snapshot exited0 with94/94 tests, typecheck and build. Dependencies were reused, not freshly installed. See evidence/repair-20261104 for exact manifests/logs and remaining gates. G1 remainsIN_PROGRESS.

## 2026-11-04 14:58 UTC read-only review coordination

G1 remains IN_PROGRESS. Added a separate persistent read-only review coordinator: it captures the intent/exact candidate/session/derivation/source metadata, derives ownership and invokes collection internally, commits a reservation before awaits, and refuses imported success JSON. Duplicate/reopened/interrupted records always require recheck; none become payment authority. Source IDs/tip are bounded summaries, canSign/receiptValid/consensusVerified remain false. Independent review's post-persistence tip-age gap was fixed and tested.

The guard now checks token-aware serialized-output dust at a fixed1000sat/1000bytes application baseline, not a live node rule. Local full validation passed109 tests/typecheck/build. Real desktop browser verified original6 scenarios, FT dust650 rejection/651 match, edits, malformed input, Clear/reload, size boundary and actual download. Mobile remainsNOT_RUN under previously observed organization policy. Remote-byte validation for this slice is separately recorded with its fixed source commit; do not infer it from this local result. No wallet/chain/transaction/deployment/submission occurred.

## 2026-11-04 15:24 UTC deterministic unsigned planning

G1 remains IN_PROGRESS. Added an offline selected-input P2PKH/BCH/fungible-token planner, deterministic ordering, full-parent/owner-claim checks, exact recipient outputs, token-preserving change, complete serialized dust, declared signed-size envelopes, integer fee budgeting and worst-case fee-rate/absolute caps. It automatically recomputes the candidate through the Guard; no keys, signatures, wallet, provider or payment-state promotion occurs. The declared Schnorr/low-S ECDSA models are assumptions, not authenticated wallet capabilities.

Independent review found that an early dust-donation opt-in could absorb a non-dust remainder made uneconomic by a high requested fee rate. It was fixed before persistence: only remainder strictly below546 sat can be donated, with explicit opt-in and renewed caps. Independent reproduction confirmed the16500-sat exploit now rejects;545/546 boundaries are covered. Local full validation exited0 with129/129 tests, typecheck and build. New browser flow and exact remote snapshot verification are separately documented in evidence/builder-20261104; do not infer their outcome from local tests. No real transaction or contest-completion claim.
