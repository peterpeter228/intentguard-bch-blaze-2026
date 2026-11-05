# Bounded tranche prototype result

2026-11-05. Base: `6f762050eee1c520b6b9f1ffb541c2aaf014a10a`. Status: **OFFLINE_CUSTOM_TEMPLATE_PROTOTYPE_ONLY**. G1 remains in progress.

## Delivered result

`preseason/allowance/` contains a typed XO factory, a concrete synthetic template, a bounded report-only CLI and tests. Unlike the official public faucet, the actual P2SH32 spend script fixes the beneficiary and payout, forbids input aggregation and all tokens, preserves the exact reserve script, fixes fee and block interval, and terminates after the last exact tranche. No ordinary payment label or template-name change supplies these guarantees.

The lab fixes a public synthetic beneficiary and a 1000-sat fee. P ranges from 546 to 1,000,000,000 satoshis, T from 1 to 65,535 blocks, and reserves contain 1 to 100 exact P+F budgets. Both continuation and terminal paths contain an actual CSV check and exact sequence. All serialized outputs are positive. There is no OP_RETURN, NFT, key, signature, upstream patch or zero-output workaround.

Actual pinned XO functions parse/identify the template, compile P2SH32 and its redeem push, resolve template-driven recipient/reserve outputs, and serialize synthetic transaction bytes. Explicit libauth BCH_2026_05 standard VM checks those bytes. A small synthetic-parent helper binds hash/index to the local source bytes; it does not establish a real parent, live UTXO or maturity. Tests demonstrate that the lower stateless VM alone accepts mismatched outpoints when handed matching source claims, while the parent-bound layer refuses the mismatch.

The default static template identifier is `d1797444959362d4059c5f2ccbb946b87db553b8a50bb83f389f64223675d9b5`. The demo shows a three-tranche synthetic reserve advancing to two, paying 1000 sat and consuming a 1000-sat fee in 333 bytes. The CLI emits no funding address or raw transaction. Signing, broadcast, funding, network, ownership, receipt, maturity and Invitation-execution flags are all false.

## Validation actually performed

- 95 selected source/docs/build/fixture files were verified against the fixed base tree before work. This is not a complete download of all historical evidence/images.
- Exact pinned dependencies are reused from the earlier fresh Nov5 setup; this is not another fresh install. No manifest dependency or lockfile changes.
- Definitive `npm run validate`, 03:13:50–03:14:09 UTC: strict typecheck, build and **237/237 tests passed**, exit 0. `VALIDATION.log` includes command/timestamps. Early corrected compile/type errors and superseded runs are disclosed in `REPRODUCTION.md`.
- Independent frozen-source `npm run allowance:test`, 03:14:37–03:14:50 UTC: **14/14 passed**. Separate independent runner: **190 valid cases and 17 negative mutations**, plus explicit stateless/parent-binding boundary checks. These are additional probe cases, not 207 extra named aggregate tests.
- Actual transaction sizes across tested parameter boundaries: **289–351 bytes**. Tested outputs meet the lab's byte-aware dust assumptions (P2PKH 546 sat, token-free P2SH32 576 sat); smallest valid reserve is 1546 sat. F=1000 exceeds the 1 sat/byte lab baseline. No current/future node fee promise is made.
- Mutations target actual outputs, values, recipient/reserve scripts, sequence flags, transaction shape, source amounts, token/NFT injection, redeem scripts and dishonest template values. A complete N=3 synthetic lineage terminates with no stranded valid remainder. Existing payment Guard still rejects the covenant transaction.
- No browser/UI path changed or new browser run occurred. No real node/chain/wallet test, signature, account, normal signed Invitation or deployment occurred. Remote preservation/readback/CI checks are separate from these local results.

## Open risks and exact stopping point

**Never fund this experiment.** Wrong-size, excessive or token-bearing funding can be permanently unspendable. Correctly funded reserves also have immutable recipient and fee, no recovery/revocation, and no guaranteed relayer. Multiple reserve coins can pay concurrently. CSV is per confirmed reserve UTXO, not a calendar scheduler, accumulated entitlement or global beneficiary cap.

Normal account/Invitation, role participation, input discovery, unlocking discovery and engine-managed follow-up execution remain unverified. The template declares a relay and continue/final follow-ups; synthetic lineage is not proof of the account lifecycle. The engine's optional `addChangeToInvitation` path would add 600/720 sat change under the count estimate and violate this contract; `executeAction` itself does not call that helper, so universal execution failure is not established. No unsafe omit-change workaround or fee tuning was used.

Stop at the reviewed offline prototype. Before any live proposal, resolve supported normal Invitation/change behavior, safe funding and recovery policy, real beneficiary/fee risks, actual chain maturity evidence and the applicable permissions. Real execution and human feedback remain separate bounty gates; no qualification or production-safety claim is made.

See `DESIGN.md` for primary sources and user hypothesis, `SECURITY_REVIEW.md` for independent findings, and `preseason/allowance/README.md` for reproduction and limitations. Official faucet inspiration is attributed; the implementation is separately written and pinned dependency notices remain intact.
