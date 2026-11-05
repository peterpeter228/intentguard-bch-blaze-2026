# Fixed-beneficiary finite tranches: bounded offline experiment

Design date: 2026-11-05. Baseline: `6f762050eee1c520b6b9f1ffb541c2aaf014a10a`. This subsequent bounded exploration permits a separate experimental covenant prototype, not integration into the existing payment Guard, production funding or a wider custody/trading product. Earlier reports correctly stopped implementation under the earlier unchanged-model scope.

## User hypothesis and real distinction

A donor could pre-fund a finite number of nonrevocable payments to a known beneficiary, separated by a minimum number of blocks. Anyone could relay a claim, but could not redirect it. This is a plausible use case, not evidence of interviewed users, customer demand, adoption or acceptable real-world financial terms.

The official faucet reference already demonstrates a signatureless CSV covenant. Its actual spend script preserves the faucet reserve and limits its decrement, but does not bind the payout recipient. Its source also explicitly notes that multiple faucet inputs can validate against one reserve output, permitting larger combined drips. This experiment specializes that idea with a fixed beneficiary, strict single-input shape, exact payout and fee, token exclusion, and a complete finite terminal branch. It is not an invention of time-locked covenants or evidence of global novelty. An identical-looking payment label or new template hash would not establish this difference; mutation tests must demonstrate it in executable locking bytecode.

## Contract to verify

Let P be the fixed beneficiary payment, F the exact per-claim fee, B=P+F, T the block interval and V the reserve UTXO value.

- One input only, index 0; no fungible tokens or NFTs.
- Version exactly 2, locktime 0, sequence exactly T, and actual CHECKSEQUENCEVERIFY on both branches. T is between 1 and 65,535.
- Immutable P2PKH beneficiary; The lab factory bounds P to 546 through 1,000,000,000 satoshis; 546 is the declared standard-policy baseline. This is an application policy assumption, not a universal consensus floor.
- V=N×B, integer N between 1 and 100. Reserve and beneficiary outputs must satisfy the declared byte-aware dust policy. Fixed F must cover measured transaction bytes at the experiment's fee-rate baseline, without being represented as a future relay guarantee.
- If N>1: exactly two outputs, index 0 returning V−B to the identical P2SH32 covenant and index 1 paying P to the beneficiary.
- If N=1: exactly one output paying P to the beneficiary. There is no zero-valued reserve placeholder.
- Every output is token-free and positive. Exact shape and amounts imply fee F. No other output, top-up input, withdrawal, redirect, revocation or refund path exists.

The narrower exact-multiple funding requirement was chosen instead of arbitrary-balance sweeping. Arbitrary reserves cannot always provide a strict payout cap, avoid dust and fully terminate under a single-input self-funded model. This experiment does not hide a final payout larger than P.

## Fatal funding and operational limitations

**Do not fund this experiment. Incorrectly sized, over-limit or token-bearing funding may be permanently unspendable. There is no recovery branch.** The offline factory's validation does not stop someone sending arbitrary funds to a derived script. No real funding address or funding transaction is exposed by the demonstration command.

An immutable wrong or lost beneficiary address, later fee/relay-policy changes, or insufficient miner fee could make the experiment unusable. The donor cannot revoke or reclaim a correctly funded reserve. There is no automatic scheduler or relay incentive. These issues need explicit product decisions and independent security review before any live-funds proposal.

The interval is relative to the confirmation of each reserve output. A continuation starts another wait. Missed intervals do not accumulate, and blocks are not calendar dates. Multiple separately funded valid reserve UTXOs can pay concurrently; there is no global per-person rate cap. A malformed separate UTXO cannot be combined with a good one because the spend script requires exactly one input, but that does not recover the malformed funds.

## Validation boundary

XO utilities must parse the actual template; pinned XO engine functions must compile the actual outputs and serialize the complete synthetic transaction. An independent decoder and explicit libauth BCH_2026_05 standard VM must evaluate those bytes against synthetic source outputs. Mutations must change actual bytes/source outputs, not just expected helper metadata.

CSV evaluation in pinned libauth checks version, input sequence and flags. It does not have blockchain heights or establish that a UTXO really aged. Local success means only stateless script/transaction verification against the supplied synthetic source. It is not a confirmed parent, live unspent coin, authenticated ownership, safe funding, valid signed Invitation, node acceptance or a receipt.

Expected negative cases include changed beneficiary/payout/fee/reserve, changed covenant parameters, extra/missing/reordered outputs, multiple/appended inputs, premature termination, malformed or excessive reserve amounts, tokens including NFT-only outputs, sequence disable/time flags, wrong transaction version/locktime and altered redeem/unlocking bytes. Normal and final paths, parameter boundaries and a complete synthetic lineage must pass. The existing production Guard must continue rejecting unsupported covenant spends, without a new allowlist or bypass.

This is a standalone local SDK/CLI experiment. Existing UI/server/payment routes remain unchanged. No new browser, wallet or end-to-end payment result may be inferred from it.

## Official capability and contest evidence

Rechecked engine `next` remains `0.1.0-next.17612568780` (gitHead `18c44c1b0e9254882dbdbbc1e41bd559244bdda4`), templates latest `0.0.12` (`2e39bd00ed10fda7a2e4e180e4c693a2880c3d3a`). Existing exact dependencies are reused, not newly installed for this slice.

Official XO types support explicit input/output indices, sequence, version/locktime, locking/unlocking CashASM and follow-up action references. The faucet supplies a concrete covenant precedent; wrapping and multisig show P2SH support. Template conditions, role descriptions and supplied output fields are not substitutes for script constraints. The known nonpositive-output filter remains unpatched; this design uses separate strictly positive continuation/terminal output shapes.

The Build with XO bounty requires a novel functional contract and actual Chipnet/Mainnet execution through an inspectable Invitation, reproducible template/Invitation, applicable follow-up actions and human-written personal feedback. An offline prototype can support future engineering review, but cannot satisfy execution, human feedback or submission requirements. Normal account/Invitation handling and engine-managed follow-up discovery remain unverified until separately exercised. The current executeAction source does not itself invoke addChangeToInvitation, but a caller that invokes that change helper can append 600 satoshis on a continuation or 720 on termination when F=1000; those extra outputs violate this covenant. There is no safe fee-constant workaround implied by the count-only estimate. The experiment does not invoke or patch either account-level path. No bounty entry, IP waiver or legal agreement is accepted by this work.

## Sources and attribution

- [Official template-writing guidance](https://stack.xo.cash/blog/2026-08-24-Vision-to-Reality-6-Writing-Templates.html), including requirements, fixed indices, state and follow-up actions.
- [Pinned XO faucet source](https://gitlab.com/GeneralProtocols/xo/templates/-/blob/2e39bd00ed10fda7a2e4e180e4c693a2880c3d3a/source/faucet_cash.ts), including its explicit recipient and multiple-input limitations.
- [Original bitcoin-cash-faucet](https://github.com/2qx/bitcoin-cash-faucet), acknowledged by the official template.
- [Official template API](https://stack.xo.cash/api/@xo-cash/templates.html).
- [CashScript BCH timelocks, introspection and P2SH32](https://cashscript.org/docs/language/globals).
- [BIP68 relative lock-time specification](https://github.com/bitcoin/bips/blob/master/bip-0068.mediawiki), interpreted with the BCH-specific guidance above, not importing SegWit/PSBT assumptions.
- [Pinned output completion](https://gitlab.com/GeneralProtocols/xo/engine/-/blob/18c44c1b0e9254882dbdbbc1e41bd559244bdda4/source/invitation/merge/complete.ts) and [serialization](https://gitlab.com/GeneralProtocols/xo/engine/-/blob/18c44c1b0e9254882dbdbbc1e41bd559244bdda4/source/invitation/generation/transaction.ts).
- [Engine tags](https://registry.npmjs.org/-/package/@xo-cash%2fengine/dist-tags) and [template tags](https://registry.npmjs.org/-/package/@xo-cash%2ftemplates/dist-tags).
- [Current official bounty](https://bchblaze.cash/bounties/).

XO templates and exact engine/utilities/types dependencies are MIT; required copyright and permission notices must accompany copied or substantial adapted code. Identifying modifications is separate project provenance practice. No new dependency or production license decision is part of this experiment.
