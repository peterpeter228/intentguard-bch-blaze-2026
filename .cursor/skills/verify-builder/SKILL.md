---
name: verify-builder
description: Check actual IntentGuard unsigned-builder output conservation, exact recipients and refusal boundaries; run its real bad-source negative control and bounded payment-state model after related changes.
---
# Property and harm
Every accepted unsigned plan preserves exact independently confirmed recipients, only owned change, empty unlocking scripts and capped conserved fees. A changed output can mispay even if an earlier Guard passed.
# Run
Node24 and locked esbuild/libauth dependencies; `npm run build` first.
`npm run builder:verify -- NEW_EVIDENCE_DIRECTORY` runs the actual builder, then a scratch SOURCE copy mutating returned transaction bytes after Guard, then restores and reruns. Candidate sources must retain identical hashes. `builder.json` must show the negative control detected recipient mismatch and both original/restored runs pass.
`npm run payment:statechart -- NEW_MODEL_DIRECTORY` exercises actual HTTP/SDK/journal paths and generates a finite code-anchored TLA+ abstraction. Read every TLA+ result using **/statechart**; follow that skill's CURRENT pinned official tool instructions with generated GuardedPayment.tla/cfg/view.mjs and a NEW report directory. Do not infer TLC PASS merely from generation. Retain report.md/tlc.out/chart.mmd. Replay any counterexample through the concrete endpoint/SDK harness before classifying a model mismatch or code bug. Do not weaken an invariant to pass.
# Bounds and assumptions
Builder sweep:1/2 inputs and recipients;545/546/1000sat recipients;546/1000/10000sat input values;cap0/219/600;two unsigned network labels;missing/stale/mismatched/token/NFT/unknown-owner inputs. It is generated-input runtime verification, not all JavaScript values. No mainnet signatures/keys/network effects.
State abstraction separates durable signature/send reservations from SDK/RPC effects. One economic operation, two networks, one edit, one browser+service restart, up to two callbacks, bounded good/bad/stale evidence and refused doubleclick. SQLite atomicity/local fsync and verifier correctness are explicit assumptions; actual full-parent crypto and stale/invalid fixture negatives are exercised separately. This is not an unbounded proof, SPV/consensus, SDK audit, browser or hardware proof.
# Coverage record
Actual `core/unsigned-builder.ts:buildUnsignedPlan`, `core/guard.ts:verifyCandidate`; model anchors PaymentFlow.handle/PaymentJournal.advance/ConnectedWallet.sign/PaymentChain.broadcast+observe/payment-ui invalidate+recover. Each run records exact source hashes; source-commit sync reference is in current PROGRESS.md and external candidate receipt, avoiding circular self-hash. Any changed covered source requires inspecting these anchors before advancing sync. Upstream generic workflow pin cursor/plugins6b0300214a09fd6029cfb7077043125758cd1fd2; task-local tools only. Use /maintain-formal-verification-skill after changes.
# Cleanup
Only generated temporary builder source copies are removed in finally. Evidence and candidate sources remain. No protected identity, live faucet, signing or send replay; empirical signatures are isolated ephemeral Chipnet-labelled fixtures.
