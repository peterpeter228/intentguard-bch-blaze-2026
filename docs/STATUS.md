# IntentGuard BCH status

## 2026-11-09 dedicated Chipnet identity / Q1=B — PRESEASON

The owner decision t292s1301 narrowly supersedes the old preparation-only signing
prohibition for ONE new dedicated Chipnet identity, Engine session and identity-only
Invitation. The original Opus/Astra plan PASS is reused as historical preparation
approval, not evidence that this path was already proved.

Actual pinned Engine identity signing and `serializeInvitation(stored.invitation)`
now produced one public shareable initial proposal. Existing offline CLI returned
REVIEW_REQUIRED, one commit, no issues, canSign=false; a one-nibble public signature
mutation returned REJECTED / CommitSignatureInvalidError. A separate offline-only
run repeated both results without opening a session or signing. No transaction
inputs/outputs, generated template secrets, payment, funding, broadcast or receipt.

The TLS root cause was literal version spelling: both bounded observations returned
Fulcrum `1.5` for requested `1.5.0`. The minimal transport repair accepts only those
equivalent spellings, preserving parser/TLS/deadline/token/unsupported-version rules.
Actual fixed-transport block 121957 matched the independent Chipnet hash pin.
The Engine uses its separate official WSS/checkpoint path, successfully connected
to chipnet.bch.ninja. Its first initialization returned before a wrapper hostname
check failed (SDK hostIdentifier omits the port). Original records show ZERO
signing attempts; a journal-SHA/operation-ID/public-identity-bound continuation
reused the same identity once, then made the SOLE signing call. No reset/re-sign.

Secret recovery and scanning occurred only inside the owned process; metadata
confirmed 0600 within 0700. Public export and exact template remain outside Git
under task bch-blaze-chipnet-20261109 artifacts. No owner wallet/token was accessed.
Final restored `npm run validate`: 258/258, typecheck/build passed. Official TLC
checked 65 states/158 steps; real guard removal produced the expected counterexample,
then restoration passed. This is a bounded lifecycle model, not whole-system proof.

Parent-owned fresh Astra static diff gate and independent public-artifact smoke
remain separate, NOT yet claimed. G1 remains IN_PROGRESS / PRESEASON; identity
signature is not an executed Invitation, mainnet readiness or bounty qualification.
See [scope, failures, commands and formal limits](../evidence/chipnet-identity-20261109/README.md).

## 2026-11-09 keyless preparation after host resume — PRESEASON

Source `a82807ae0293baee39a185e229f906718e095e59` on
`feat/openbot-bch-20261108`; prior revised preparation plan/Astra PASS reused,
not replanned. Current task: `bch-blaze-dev-20261109`. Exact candidate SHA is bound
in that task's `result.json` and post-commit `artifacts/final-result.json`, rather
than self-embedded in this commit. Fresh parent-owned Astra diff review and
independent inspection are separate required gates; no final PASS is claimed here.

Node24 clean install, native SQLite rebuild and fresh validate passed:
253/253 tests, zero failures/cancellations. Package and lock hashes unchanged.
Final exact-candidate validation is recorded separately in the current task's raw
`artifacts/final.log` and `artifacts/final-result.json`. No application path changed;
baseline tests are not a signed-Invitation positive or payment proof.

Each existing Chipnet endpoint was probed once using the unchanged 5s TLS
transport. Both returned `ELECTRUM_UNSUPPORTED_PROTOCOL`; no header result,
retry, protocol edit or IP/TLS/proxy bypass. This is not a DNS diagnosis or proof
that the different Engine network path fails. Static installed-source inspection
confirms Engine.create initializes network/storage and mnemonic-derived identity;
createInvitation performs a real identity signature even without funding.

G1 remains IN_PROGRESS / PRESEASON; authenticated integration is BLOCKED_EXTERNAL.
Wallet not created (unnecessary for this keyless outcome), public address
unavailable, current funding request **0 sat**. No Engine session, new signature,
signed fixture, funds, broadcast, payment, receipt, preview or deployment.
Guard/fees/expiry/ownership/UNKNOWN rules and the never-fundable tranche are unchanged.
Current-task QUESTIONS requests an existing shareable serialized Invitation with
exact template/network/independent pin/provenance (recommended), separate narrowly
scoped Chipnet session/identity-signature authorization, or defer. No account
backup, owner seed/key/token or private artifact upload is requested. All work
remains disclosed pre-event; no external ownership/status write or submission.

Evidence: [actual baseline, raw probes, installed API boundaries and limits](../evidence/openbot-20261109/README.md).

## 2026-11-07 current XO compatibility and event evidence

Updated the engine from `0.1.0-next.17612568780` to the official npm `next`
observed today, `0.1.1-next.17778370827`. Directly substituting the new version
first failed typechecking at five sites. The minimal compatibility repair attaches
the already explicit offline/synthetic source label to merged variables. It does
not create commits, identities or signatures. Utils remains `0.0.10`, matching the
engine dependency. Guard, covenant, fee policy and authority flags are unchanged.

The fixed candidate passed typecheck/build and all 253 existing tests. A fresh
selected-source baseline install also passed the 16 existing public-vector tests.
This is dependency compatibility maintenance, not a new payment capability.
See [exact source, logs and limits](../evidence/upstream-next-20261107/README.md).

The new package still drops resolved zero-satoshi data outputs. Its source map
changes only merge/provenance code; transaction encoding and signing context are
unchanged. A new execution of the bounded pure reproduction confirms the blocker.
A newly discovered Paytaca historical sample is unsigned, token-free and lacks
the full raw parent, so it cannot close either signature-positive gap.
The permitted public Chipnet transport attempt returned no RPC response:
`ELECTRUM_CONNECTION_FAILED`, not verified node evidence or a specific DNS diagnosis.

The user-provided workshop screenshot reports "Roll call completed" and the user
reports seeing the token. This advances attendance evidence only, not every
eligibility, registration, Telegram, Mainnet or bounty gate. Exa and Parallel
research confirms multiple bounties may be entered if each independently qualifies.
Prioritize Mainnet plus Build with XO; Community Choice is conditional. Migrate,
Stablecoin Bridge and DID are not presently implemented or claimed.
See [current rules, freshness and source differences](../evidence/rules-20261107/track-matrix.md).

G1 remains IN_PROGRESS / PRESEASON; normal authenticated XO/payment integration
is BLOCKED_EXTERNAL. No new keys, signatures, wallet session, funds, transaction,
deployment, public sharing, submission, rights waiver or personal feedback was
created. An existing shareable Invitation plus exact template/network/independent
pin is still the smallest next input. Pre-event work remains disclosed, with the
November 14 14:00 UTC event-time fork/demo boundary and November 22 14:00 UTC
deadline preserved. Argon/Opus review still has no usable current report.

## 2026-11-05 startup failure repair and self-check

Fixed a real HTTP test hang after a server had already exited. Test-only lifecycle
management now captures close at spawn, bounds readiness/shutdown, and reports
the startup error. Both HTTP suites use it; seven actual-child-process regressions
were added. Corrected the top-level installation shortcut to include the existing
required native SQLite rebuild. Product/Guard/covenant/dependency-lock code is
unchanged. This is a reliability repair, not a new payment feature.

Local and independent fixed-candidate validation each passed typecheck/build and
253/253 tests. The original missing-native case now fails explicitly in under one
second with zero cancelled tests, rather than hanging. Both runs used selected
88-file copies and reused dependencies from this round's correct baseline install
and native rebuild; neither is claimed as a complete fresh-checkout candidate run.
See [exact evidence and limits](../evidence/lifecycle-repair-20261105/README.md).

G1 remains IN_PROGRESS / PRESEASON and real authenticated XO/payment integration
is BLOCKED_EXTERNAL. The November5 portal check hit an expired Human Verification
challenge; contestant identity and actual submission controls were not verified.
The published event window remains November14 14:00 UTC–November22 14:00 UTC.
Real execution, personal feedback, event-time fork/demonstration and eligibility
evidence remain incomplete. The bounty's material IP waiver requires personal
handling; no contest submission was made. Argon and the one Opus fallback produced
no review text, with fees unknown; do not mark external-model review as passed.

## 2026-11-05 recovery and current integration handoff

G1 remains IN_PROGRESS and normal authenticated XO integration is BLOCKED_EXTERNAL.
The branch was recovered at ee01a6f7156166976e0852b2eedb4b3d26c1a35b. Reconciled
the current core/lab capability summaries and separated historical next-action
checkpoints from today's real gates. Added a bounded handoff for an already existing
Invitation, optional parent/candidate exports and the separately scoped user-operated
session if no artifact exists. No new core feature, test fixture or runtime change
was made; no new product test/browser/chain result is claimed. Earlier 246-test
evidence remains attached to its exact earlier run and source commit.

Current deterministic planning, signed-byte verification and XO pure-function
comparison must not be confused with authenticated ownership, fresh chain evidence,
normal signed Invitation execution or real payment/receipt success. No account,
wallet, signature, RPC, funding, transaction, public deployment, outreach or contest
submission occurred. The experimental tranche still has no recovery and must not
be funded. See [VERIFICATION_HANDOFF.md](VERIFICATION_HANDOFF.md) and the
documentation-only reconciliation evidence for the exact scope and next stop.

Evidence: [readiness reconciliation](../evidence/readiness-reconciliation-20261105/README.md).

## Historical status entries

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

## 2026-11-04 15:52 UTC offline signatures and explicit evidence refresh

G1 remains IN_PROGRESS. Added a strictly separated stateless P2PKH signature verifier and full-plan binding verifier, using pinned libauth explicitBCH_2026_05 standard VM, minimal pushes/compressed keys, restrictive ALL|FORKID sighash, and token-bearingUTXOS requirement. The high layer reconstructs the plan with a trusted invocation clock, full hash-bound parent inputs, all non-unlocking bytes and actual fee/size checks. All authority/network/chain/receipt flags remainfalse. Two immutable BCHN published ECDSA/Schnorr examples pass the low stateless layer only; complete-parent integrated positive and strictP2PKH token/0x61 positive remainUNVERIFIED. No signing/key generation occurred.

Read-only review refresh now requires explicit expectedRevision and only a latest completed successful observation. Reservations/history are durable and append-only; UNKNOWN/PENDING cannot reset, prior success never becomes current after failed refresh, and all rereads/history remain stale. Storagev2 refuses oldv1 read-only with REVIEW_MIGRATION_REQUIRED, preserving original bytes; migration is not implemented.

Local complete validation:150/150 tests, typecheck/build exit0. Independent review additionally exercised public-vector mutations and competing refresh/UNKNOWN recovery. UI source and bundle are unchanged from the previous real-browser-tested slice; no new signature UI or new browser test is claimed. Exact remote verification is separately recorded in evidence/signature-20261104. No wallet/real chain/transaction/publication/contest-completion claim.

## 2026-11-04 16:08 UTC historical parent-bound positive and readable core results

Found an unchanged official Trezor complete raw parent and historical signed child, independently hash-bound and verified for bothP2PKH inputs. Added a shared intermediate parent-bound cryptographic verifier; the high-level plan verifier reuses it without weakening its version2 builder policy. The fixture is version1: it closes the parent-resolver positive gap but is not a version2 full-plan positive, current chain proof, wallet session or payment result. Upstream provenance/notices are retained.

Bounded official token/sighash research did not establish strictP2PKH0x61 success. The main-script all_utxos label in a complex vector does not describe its auxiliaryP2PKH0xc3 signatures; that vector stays rejected. No signatures or keys were generated and no valid bytes were edited to fit the application.

Product UI now shows readable requested recipient/token/change/fee summaries and specific refusal/incomplete-evidence explanations before optional technical details. It does not add signing controls or imply ownership from supplied scripts. Local157/157 tests/typecheck/build pass; final browser and exact remote verification are separately recorded under evidence/product-summary-20261104. G1 remainsIN_PROGRESS and all work is pre-event.

## Structured request continuation (2026-11-04, pre-event)

Added a structured local request form/import/review/export slice for PRD request/confirmation usability. Exact amounts, complete CashAddr and token category, original-case/checksum/type/network policy, fixed dust and bounded lifetime are validated. Imported flags/scripts/results are rejected; local review is never serialized as authority. Review found and repaired sparse/custom-prototype recipient array handling before persistence. Clean local rebuild and full validation exited0 with169/169 tests. Browser and exact remote-byte verification are separately recorded in evidence/request-20261104, not inferred from this local run. G1 remainsIN_PROGRESS; no wallet, transaction, network ownership, public demo or contest completion claim.

## 2026-11-04 explicit request-to-plan SDK continuation

Added a pure bridge between strict payment requests and the existing offline builder. It re-derives every recipient/amount/network/expiry/fee term, requires the application's expected reviewed request digest and an explicit separate bounded planning context, and binds request/intent/plan plus declared owner/change/fee policy. Request edits, stale observations, missing context, malformed objects and builder/Guard refusals yield no partial plan. All spending, broadcast, receipt, network and ownership flags remain false; content hashes are not consent, chain proof, freshness certificates or duplicate-payment protection.

Independent review found and repaired omitted change-policy binding for an exact no-change plan. The explicit policy digest now changes even when changing the chosen change script leaves transaction bytes unchanged. No existing builder policy was relaxed. Local and exact remote validation outcomes are recorded under evidence/request-plan-20261104 rather than inferred here. Browser UI is not integrated and its source remains unchanged; this is an SDK-level slice, not a new end-to-end payment completion. G1 remains IN_PROGRESS and all work is pre-event.

## 2026-11-04 clickable offline request-plan continuation

Connected the validated request-plan SDK to the local /request page through structured funding fields and complete explicit synthetic examples, without hand-editing JSON on the main demonstration path. Request review and funding acknowledgement are separate. The page shows every output/asset/amount, fees and bindings, revalidates before export, and has no signing or payment capability. Any request edit/import clears earlier funding; supplied parent/owner/unspent/observation values remain unverified claims.

Independent review reproduced missing-event and combined re-review cases that could retain old funding or an old export/summary. Added exact request/funding field comparisons, including observation timestamps, and clearing on every mismatch. Nine helper and eleven formal DOM-harness regressions exercise this state logic; the harness is not real-browser proof. Real-browser and complete final remote validation evidence is recorded separately in evidence/request-plan-ui-20261104. G1 remains IN_PROGRESS; this is pre-event offline functionality, not a real payment/receipt or completed entry.

## 2026-11-04 actual XO reference candidate integration

The current official bounty/API/package sources were rechecked. The pinned engine matches the public next tag. Added a narrow actual-engine path: a single reviewed BCH/FT request supplies variables to the official P2PKH template; the XO engine compiles the recipient and constructs transaction bytes, then independent Guard and exact-plan byte checks both must agree. Existing IntentGuard input/change/fee policy remains authoritative within this offline diagnostic. No Invitation, identity, key, signature or account is created.

The local request UI now explicitly invokes a bounded same-origin loopback endpoint, reports the actual engine comparison and exports only safe diagnostics. Delayed responses, edits, cancellation, expiry and malformed response fields cannot restore prior output or inject raw transaction payload into a download. Source review and final browser/remote verification are recorded in evidence/xo-candidate-20261104. This is reference integration, not novel-template qualification, authenticated participation, chain execution or a completed bounty. G1 remains IN_PROGRESS, all current work pre-event.


## 2026-11-05 new template-blocker reproduction

The exact nine Nov4 feasibility files and their blob map were unavailable in the resumed workspace; Notion/Linear retained conclusions, not the original bytes. Following approval to preserve the work, a new clearly dated reproduction was built from fixed remote 53b05b46. See evidence/template-reproduction-20261105/FINDINGS.md. This is not recovery of old scripts, logs or hashes.

The real pinned XO pure functions again demonstrate that unresolved zero-valued OP_RETURN is serialized, but resolving its amount to 0n first causes the builder to omit it. Normal account-path implications are source-trace inferences, not a real Invitation execution. Guard still rejects present data outputs; after omission it only recognizes the ordinary payment. No invoice template was implemented and no novelty/contest-success claim is made. G1 remains IN_PROGRESS.

87 selected remote source/build/docs/fixture blobs were verified byte-for-byte; this is not a full 380-file checkout. Fresh pinned dependencies plus standard sqlite3 rebuild enabled new 223/223 regression, typecheck/build and separate reproduction. Setup failures and the interrupted early run are disclosed, not counted as passes. Production sources/dependencies are unchanged. No new browser/mobile/real-chain run, wallet, signing, broadcast, deployment, public release, upstream outreach or restricted-image retry. Immutable remote publication is separately verified by the coordinator.


## 2026-11-05 official zero-output repair assessment

Read-only current upstream, BCHN policy and exact dependency-license review found no published preserve-zero fix or supported alternative. A newer GitLab display-only unresolved merge API leaves the serializer filter unchanged. Upstream signing compilation uses merged outputs while serialization filters nonpositive outputs, so an encoder-only patch cannot establish normal signing correctness. This is a source-level concern, not an executed signature failure.

The bounded local offline-adapter option is technically possible but not selected: it would leave the material authenticated execution gate open and add a partial fork. No Guard or dependency behavior changed. The exact safe prospective OP_RETURN subset, BCH policy/consensus distinctions, libauth helper differences, MIT source notices and next evidence gate are recorded in evidence/xo-zero-output-assessment-20261105/ASSESSMENT.md. No new product tests or browser/chain results are claimed; prior 223-test evidence remains associated with its actual earlier run.


## 2026-11-05 positive-output template screen

Current official template tags, five reference exports, source semantics and bounty requirements were cross-checked. No alternative met both meaningful business distinction and the unchanged IntentGuard model. Sponsorship/exchange need separate participant accounting; recurring/revocable payments require covenant or timing support; refunds need authenticated historical terms and persistent accounting. No renamed transfer/split, fake enforceable conditions or new local fork was implemented.

This is a source/design assessment, not new executable functionality or a fresh 223-test result. Core sources, Guard, dependencies, UI and all authority flags are unchanged. Two independent reviews support the bounded stop; see evidence/xo-positive-template-assessment-20261105/ASSESSMENT.md. G1 remains IN_PROGRESS and real Invitation/execution/novelty gates remain open. No wallet, signing, chain operation, outreach, deployment, submission or restricted-image retry.


## 2026-11-05 bounded fixed-beneficiary tranche prototype

Added an isolated preseason/allowance typed XO template, static synthetic template, local report-only CLI and adversarial VM tests. The custom P2SH32 covenant fixes the beneficiary, exact tranche/fee, one-input shape, token exclusion, per-UTXO relative block delay and complete terminal payout. This differs from the public faucet's unbound beneficiary and multiple-input behavior, without claiming global novelty or validated demand. Existing core/Guard/UI/dependencies are unchanged and continue rejecting these unsupported covenant spends.

Final local typecheck/build and aggregate validation passed 237/237 at 03:13:50–03:14:09 UTC. Independent frozen-source focused tests passed 14/14, with a separate 190-positive/17-negative sweep and byte range 289–351. Exact remote-source verification is recorded separately rather than inferred. Every authority flag stays false. No new browser test, actual account/Invitation, signing, chain maturity, live transaction or receipt is established.

Never fund the experiment: wrong multiples, over-cap or token funding can permanently strand; beneficiary and fee are immutable with no recovery or revocation. Follow-up declarations exist, but normal signed Invitation/role/change/follow-up behavior is unverified. Calling standard addChange would conflict with exact shape; executeAction itself does not auto-call it. G1 remains IN_PROGRESS. See evidence/tranche-lab-20261105 and preseason/allowance/README.md.
## 2026-11-05 funding-risk inspection and recovery assessment

Added a bounded pure inspector and no-argument synthetic CLI that read the actual selected parent output, bind expected covenant parameters and intended tranche count, and generate/VM-verify every successor through terminal depletion. Actual fees and source/successor dust are checked under explicit local policy assumptions. Fixed a review finding where the initial P2SH32 output could be dust despite an acceptable terminal payout. All authority flags remain false; no address or raw transaction is exported by the report/CLI.

Frozen-source aggregate validation at 03:35:42–03:36:04 UTC passed typecheck/build and 246/246 tests. Independent review and fixed-remote-source evidence are recorded in evidence/funding-safety-20261105 rather than inferred from this local run. Existing covenant, synthetic template, ordinary payment Guard, UI and dependency versions/lock are unchanged. No new browser, wallet, chain, signing, authenticated Invitation or real execution is claimed.

Recovery is still unavailable. Wrong nonmultiple/over-cap/token funding has no valid release path; a valid but unintended multiple creates a different irrevocable number of payments. Separate deposits do not repair each other. Lost beneficiary access does not stop permissionless release but cannot redirect its payouts. Fixed fee and future dust policy can impair liveness. Refund, key rotation and flexible fee designs require a separate decision about changed guarantees. G1 remains IN_PROGRESS and funding remains prohibited.


