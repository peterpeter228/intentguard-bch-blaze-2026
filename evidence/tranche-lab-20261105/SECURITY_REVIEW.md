# Independent bounded offline review — 2026-11-05

Scope: `preseason/allowance`, executable covenant and isolated synthetic harness. No keys, signatures, account, network, funding, live transaction or deployment was used. This is targeted engineering review, not production security certification.

Final frozen-source review rerun: 2026-11-05 03:14 UTC. Exact start/end timestamps are in `REVIEW_FINAL_TIMESTAMP.txt`; the focused test log is `REVIEW_ALLOWANCE_TESTS.log`. Source SHA256s are recorded in `independent-review-results.json`. This supersedes the earlier 13-test snapshot.

## Outcome

No payout-redirection, excess-payout, continuation-substitution, fee diversion, token bypass or premature terminal bypass was found in the reviewed bytecode. The scope is suitable only for the prominently labelled offline experiment. **Never fund it.** Incorrect funding, tokens, lost beneficiary access or changed fee policy can permanently strand funds. No recovery branch exists by design.

The factory checks plain own data properties without invoking accessors; rejects additional keys/symbols and noncanonical or out-of-range amounts; uses bigint for monetary values. It explicitly does not sandbox hostile Proxies. Returned report/limits/authority are frozen; mutable synthetic transaction/template objects are documented internal test facilities, not approvals or payment APIs.

Script inspection confirms fixed version/locktime/exact block sequence and CSV on both paths, exactly one input at index 0, source multiple and tranche bounds, same-source-script continuation, fixed recipient/amount, and exclusive terminal shape. Category introspection rejects FT and NFT-only sources/outputs, including empty-commitment immutable NFTs. Source range and quotient constrain intermediate arithmetic well below signed VM limits. P2SH32 redeem hash prevents substitution. Standard VM clean-stack enforcement rejects extra unlock items.

## Findings and disposition

1. **Source binding was absent from the stateless helper. Addressed at report boundary.** `verifySynthetic` can accept a wrong hash/index with supplied synthetic source outputs; libauth does not retrieve or authenticate parents. The implementation added `verifyParentBoundSynthetic`, checks index 0 and full synthetic parent hash, and routes the public report through it. The independent test deliberately retains the stateless-positive/parent-bound-negative demonstration. Parent validity, chain inclusion, current unspent status and actual CSV age remain unverified.
2. **Normal XO workflow is not established. Explicitly open.** The initial empty release/roles were replaced with actual `<covenant>` redeem push, relay role, input value variable, template-derived reserve amount and follow-up declarations. Utility compilation and pure output/transaction generation now exercise real template content. These do not establish signed Invitation participation, coin selection, normal unlocking discovery or automatic follow-up execution. CLI authority flags remain false.
3. **Calling standard change addition conflicts with this contract. Explicit integration gate.** Pinned `@xo-cash/engine/dist/index.mjs` lines 5883–5885 estimates fees as 160/input + 120/output. Its token-free `addChangeToInvitation` branch at 8027–8039 appends leftover minus this estimate. With F = 1000 it would append 600 sat for continuation or 720 sat for terminal, violating shape. `executeAction` at 6071–6104 does not itself call change, so this is not proof every normal execution automatically fails. F = 400 is not a supported fix: the same branch has no below-dust suppression and would append zero / 120 sat, relying on unrelated zero omission for one path and invalidating the other. No workaround or fee tuning was used.
4. **Dust and fee are bounded lab policy only.** Independent checks use libauth `getDustThreshold`: P2PKH 546 sat; token-free P2SH32 reserve 576 sat. Smallest reserve 1546 and smallest payout 546 satisfy this policy. Across tested script-number boundaries, actual serialized transactions are 289–351 bytes, below F 1000 at 1 sat/byte. This is not future relay or miner acceptance evidence.

## Reproduction and evidence

Working directory: `/workspace/shared/bch-allowance-lab-20261105`.

- `npm run allowance:test`: independently rerun, **14/14 tests passed**, including CLI, bound-parent checks, full synthetic lineage and unchanged Guard rejection.
- `node evidence/tranche-lab-20261105/independent-review.mjs`: **190 valid cases and 17 invalid mutations passed**, plus explicit source-binding boundary demonstration. Covers every N 1..100, payout extrema, ten script-number delay boundaries, actual serialization round trips, dust thresholds, output/change/token/unlocking/multiple-input mutations and three dishonest reserve variables.
- `evidence/tranche-lab-20261105/independent-review-results.json` records actual byte range and reviewed source SHA256s. The runner imports emitted `dist` code; run `npm run build` first when reproducing after source changes.

No existing Guard source was edited by this reviewer. No live beneficiary ownership, confirmed source, elapsed block delay, authenticated Invitation, normal account workflow, actual transaction or bounty eligibility is established by these results.

## Shipped static template check

At 2026-11-05 03:15:38 UTC, `node evidence/tranche-lab-20261105/static-template-review.mjs` separately read and parsed `preseason/allowance/synthetic-template.json`, asserted deep equality against `createTrancheTemplate({ payoutSatoshis: '1000', delayBlocks: 6 }).template`, and verified its generated identifier equals both the factory identifier and `d1797444959362d4059c5f2ccbb946b87db553b8a50bb83f389f64223675d9b5`. All assertions passed. Artifact SHA256 is `eb460db5c9599b3b4e13854e7a364ca1b3f539563e53d3cfae5c44e4aa94c856`. The machine-readable result is `static-template-review-results.json`. This is a direct artifact check, not an inference from factory tests.
