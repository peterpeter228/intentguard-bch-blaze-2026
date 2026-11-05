# IntentGuard BCH core: current capability and limits

Current state, 2026-11-05: **G1 IN_PROGRESS; real payment integration BLOCKED_EXTERNAL.**
This is a private, pre-event offline diagnostic application and SDK, not a wallet,
signed payment, confirmed receipt, public demo or completed contest entry.
The November 4 instruction to implement core superseded the earlier voluntary deferral.

## Local demonstration

With pinned dependencies and required native SQLite bindings installed:

```sh
npm run validate
npm run core:demo
npm run core:preview
# Open http://127.0.0.1:8788/request on the same machine.
```

Load a complete synthetic BCH or token example, review the request, separately
acknowledge the offline funding claims, build the plan, and optionally compare with
the actual official XO engine. Every output, token category, fee and binding is
shown. Editing, expiry, cancellation and stale asynchronous responses invalidate
prior results. Reports omit raw parent/candidate bytes and confer no authority.
See [the demonstrated flow and evidence](REQUEST_PLAN_UI.md).

The optional XO comparison sends data only to the same loopback server. It does
not persist it, contact a node, create an account or open a wallet. Do not expose
the preview publicly. Digests can still correlate transactions.

## Implemented, with limited claims

- **Request and Guard:** strict decimal-to-integer amounts, CashAddr/lifetime
  checks, full-parent hash binding, all-input/all-output comparison, exact
  recipients/token conservation, separately supplied owner-change scripts,
  duplicate/NFT/unknown-script rejection and token-aware dust. Ordinary payments
  support P2PKH, version 2, zero locktime and final sequences. `MATCH_OFFLINE`
  remains conditional comparison, never spending approval.
- **Unsigned planning:** deterministic selected inputs, token-preserving change,
  signed-size assumptions, integer fee budgeting and absolute/rate caps.
  Explicit dust donation is narrowly below 546 sat. No coin discovery or
  authenticated wallet capability is inferred. See [builder](UNSIGNED_BUILDER.md)
  and [request binding](REQUEST_PLAN.md).
- **Evidence and state:** bounded evidence interfaces, TLS read transport,
  source-derived Chipnet candidates and a durable review coordinator with
  reservations/revisions/uncertain-state handling. The separate operation store
  is simulated. No successful production node or authenticated wallet session is
  established. See [transport](TRANSPORT.md), [coordination](READ_ONLY_COORDINATION.md)
  and [refresh/migration limits](REVIEW_REFRESH.md).
- **Existing signed-byte verification:** stateless, full-parent-bound and
  full-plan verifiers exist. Published BCHN vectors and an unchanged historical
  Trezor version-1 fixture cover lower layers. Version-2 full-plan and strict
  P2PKH token/0x61 positives remain unverified. No keys/signatures were generated.
  See [signature scope](SIGNATURE_VERIFICATION.md).
- **Actual XO reference producer:** pinned official P2PKH compilation and
  unsigned transaction construction, followed by independent Guard/exact-plan
  checks. Single-recipient BCH/FT only. Not an authenticated Invitation, new
  contract or execution. See [XO integration](XO_CANDIDATE.md).

The earlier `compareSignedCandidate` helper checks structure/nonempty unlocking
only, not signatures. The later verifiers, imported success JSON and content
digests do not establish human consent, ownership, current spendability or authority.

Dust uses a fixed application baseline of 1000 sat/1000 bytes and the full
serialized output including tokens: ordinary P2PKH is 546 sat; the documented
100-unit FT example is 651 sat. Fee/size checks exist, but these are not live
policy quotes or guarantees of relay/miner acceptance.

## Material remaining gates

1. Authenticated current wallet/session/path ownership and separately permitted,
   independently sourced live network evidence.
2. Wallet no-broadcast behavior, supported signature capabilities and valid
   version-2/token signed-plan evidence.
3. Real payment orchestration, uncertain-response reconciliation and independent
   confirmed receipts. Simulated events/review journals cannot promote payment state.
4. For XO, an actual participant-controlled Invitation plus supported normal
   participation, exact change/fee, unlocking and follow-up behavior.
   `executeAction(false)` still signs/records identity results; it is not read-only.
5. Separately authorized useful real mainnet function, public deliverables,
   event-period improvements/disclosure, human attendance/feedback and rights/submission review.

Start from [the current next action](../docs/NEXT_ACTION.md) and
[bounded verification handoff](../docs/VERIFICATION_HANDOFF.md), not more generic
offline scaffolding. All report authority flags remain false.

The isolated [tranche experiment](../preseason/allowance/README.md) is rejected by
the ordinary-payment Guard. **Never fund it:** recovery is absent, beneficiary/fee
are immutable, and unsuitable deposits can permanently strand funds.

## Evidence belongs to its actual run

The latest recorded exact-source aggregate pass is 246/246 tests, typecheck/build
for source commit `56d2086d480b1216e3f36295a87d9f826d35198e`, November 5,
03:41:41–03:42:07 UTC. It used 133 selected files and reused pinned dependencies,
not a fresh full checkout/install. See [exact scope](../evidence/funding-safety-20261105/REMOTE_VERIFICATION.md).
This November 5 documentation reconciliation did not rerun product tests,
browser, wallet, chain, signing or execution and adds no runtime feature.
