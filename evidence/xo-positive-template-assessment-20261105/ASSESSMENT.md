# Positive-output XO alternatives: bounded feasibility assessment

Assessed 2026-11-05, beginning 02:53 UTC, against private working-branch baseline `11f3584ab31460ee5a881b90d6855ce22bd8fa80`. This is pre-event source research and design rejection, not a new template implementation, transaction execution, user interview or submission.

## Decision

**No prototype selected under the unchanged IntentGuard security model.** The inspected alternatives either duplicate ordinary payment behavior or require a different ownership, covenant, time-lock or historical-payment model. Positive satoshi outputs avoid the known zero-output omission but do not supply those missing guarantees. This is a bounded conclusion about the candidates below, not proof that no useful XO template can exist.

The PRD's actual primary user is a BCH dApp integrator needing correct intent-to-transaction checks. Merchant refunds are a P1 possibility; their demand is a hypothesis, not validated customer evidence. A separate allowance covenant, treasury or trading protocol would expand this product, and is not justified merely to pursue an additional bounty.

## Official baseline and item-by-item comparison

The current npm `latest` template tag is `0.0.12`; `development` is `0.0.12-development.17610008066`. Installed `0.0.12`, immutable upstream export index at `2e39bd00ed10fda7a2e4e180e4c693a2880c3d3a`, and current official API documentation agree on these five exports. This does not inventory every unpublished/community template or establish global novelty.

| Official export | Actual reference behavior | Business distinction required for a new direction | Fit with unchanged IntentGuard |
| --- | --- | --- | --- |
| `p2pkhTemplate` | Ordinary receive/request/send BCH and CashTokens, NFT and burn actions, plus sign/verify actions. Our integration supports only the narrower single BCH/FT send subset. | Another payment label, amount formula, fee cap or split is insufficient. | Existing reference producer already integrated; unsupported reference actions remain unsupported. |
| `multisigTemplate` | Experimental 2-of-3 vault; P2SH32 redeem script and two signer signatures. | A new business authorization rule must actually be enforced, not just renamed signer roles. | Unknown-script and ownership/signature model expansion required. |
| `faucetCashTemplate` | Public on-chain rate-limited payout. Relative sequence delay and return-script/value covenant preserve the reserve subject to its allowance. Rate limiting is per faucet UTXO, not per recipient; the covenant does not bind the payout recipient. | A recipient-bound recurring allowance would additionally constrain recipient, residual reserve, aggregate payout/fees and terminal recovery. | New covenant and non-final-sequence support required; not implemented. |
| `wrapBCHTemplate` | Mainnet BCH/wBCH conversion using a fixed category and covenant preserving script/category and BCH-plus-token reserve invariant. Bootstrap is not included. Reserve conservation alone does not enforce the intended recipient or economic outcome. | Another named reserve is not novel; an exchange needs distinct, correct asset/party rules. | P2SH covenant and reserve accounting unsupported. No funds or category use performed. |
| `wrapBCHChipnetTemplate` | Corresponding Chipnet wrapping/unwrapping reference with its test category. | Network change is not a distinct contract. | Same structural limitation; no live test or bootstrap performed. |

The template package and exact upstream source are MIT licensed; any copied/adapted code would need the required MIT notice preserved; project provenance should separately identify modifications. No template code, dependency or license was added here. Earlier license review remains in `../xo-zero-output-assessment-20261105/ASSESSMENT.md`.

## Candidate screen against actual user problems

| Candidate/problem | What would make it useful rather than a rename | Why not selected now |
| --- | --- | --- |
| Fee sponsorship for a token holder without enough BCH | Independent sponsor and payer ownership, explicit maximum sponsor contribution, distinct change and agreed exact recipients. | One declared owner-script set cannot represent independently controlled parties. Adding a sponsor's script to that set would misstate ownership. Payer-funded fees are already ordinary fee budgeting. |
| Exact atomic BCH/FT exchange | Both parties' contributed assets, consent, exchange amounts and change must be attributed independently. | Current model cannot accept true counterparty inputs as owner inputs or treat purchased assets sent to the owner as an ordinary external recipient. Global conservation is not per-party fairness. |
| Merchant refund verification | Bind original payment and an explicitly authorized refund destination; enforce original amount, cumulative refunds and duplicate handling. | Current request has no historical refund contract. A raw original payment/parent alone does not authenticate refund entitlement or destination. Automatically refunding an input address risks paying an exchange/service rather than the customer. A refund-labelled ordinary send adds none of these guarantees. |
| Recipient-bound periodic allowance | Unlike the public faucet, constrain a fixed beneficiary, payout/fee cap, interval, reserve preservation and final withdrawal/recovery. | Plausible contract-level difference, but requires a new covenant and lifecycle policy, independent adversarial VM verification and a separately justified product scope. Not safe to graft onto current Guard. |
| Revocable or delayed payout | Enforce release/refund branches and time conditions in the locking script, including mutual exclusivity and recovery. | Version 2 alone is insufficient: existing Guard requires zero locktime and final sequences, and accepts only P2PKH scripts. A display deadline is not a time-locked contract. |
| Self-consolidation or cash reserve sweep | Useful UTXO management, with explicit self-transfer and token-preservation policy. | Current intent requires an external recipient disjoint from owner scripts; pure self-consolidation is not supported. Consolidation while making a payment is existing selection/change behavior, not novel template semantics. |
| Batch allocation, capped invoice-like payout, tax/donation split | Explain a real allocation policy and the source of its trusted inputs. | Fixed multiple outputs or arithmetic over untrusted variables is ordinary split payment. Labels do not prove an obligation, limit entitlement or prevent repeating it. Excluded by this task's novelty criterion. |

No invoice commitment, positive-value OP_RETURN burn, fake NFT receipt, reference-template rename or local encoder fork was pursued.

## Enforcement evidence and limits

The existing `core/guard.ts` at the fixed baseline has these explicit boundaries:

- Lines 49–58: nonempty exact P2PKH recipients, positive BCH, valid FT amounts, owner scripts restricted to P2PKH, and recipient/owner disjointness (`AMBIGUOUS_RECIPIENT_CHANGE`).
- Line 91: version 2, locktime 0, final sequence and empty unlocking scripts.
- Lines 95–102: NFT refusal, complete parent/unspent claims, and every input script in the one owner set (`UNCONFIRMED_INPUT_OWNER`).
- Lines 104–118: exact ordered recipient outputs, only owner change, supported script and dust bounds, fee cap and global FT conservation.
- `core/xo-candidate.ts`: independent Guard acceptance plus exact original-plan byte equality are mandatory; all spending, network, ownership and receipt authority flags stay false.

These checks remain useful, but they neither authenticate the offline owner claims nor implement a multi-party ledger, refund history or covenant. Accepting all parties into one owner set, marking their outputs as change, skipping Guard or relying only on an upstream verdict would change the security model.

Pinned engine `completeMergedOutput` is a completion function, not a template-contract firewall: it resolves template satoshis only if `valueSatoshis` is missing, resolves the locking script only if bytecode is missing, and uses a supplied token object when present. Thus direct supplied fields are not proven equal to a template formula by that helper. This is a source-level observation, not a demonstrated end-to-end authenticated Invitation vulnerability. Existing independent exact-byte checks are still necessary. The types describe action `conditions` as availability conditions with a TODO; no claim that such conditions are consensus enforcement is justified.

The actual official faucet and wrapping references differ from ordinary P2PKH payments because their spend scripts enforce meaningful constraints. A novel JSON name, role, amount expression, output index or changing template identifier does not establish equivalent enforcement.

## Stop and reopening conditions

Stop this alternate-template exploration after the above official comparison and two independent source/design reviews. Do not create further isolated offline scaffolding simply to generate a green test count.

Reopen only for a concrete new contract requirement with an identified beneficiary and independently checkable invariant, plus one of:

1. A separately approved and reviewed multi-party input ownership, contribution, consent and change model for sponsorship/exchange.
2. A separately approved product/security design for a narrow covenant family, including complete lifecycle, fee/dust/terminal-state rules and adversarial VM evidence.
3. Authenticated original-payment/refund-destination evidence and durable refund accounting for a refund workflow. This can deliver application value, but is not automatically a novel XO contract.
4. A newly supported upstream capability that satisfies those semantics without weakening the existing Guard. The previously rejected zero-output patch remains stopped.

An actual signed Invitation supplied under appropriate verification scope can advance the existing real-integration gate, but would not by itself make an ordinary template novel. Wallet/session, signing, current chain evidence, execution, public release and any upstream contact require their applicable permissions and separate evidence. None is implied by these reopening criteria.

## Validation and contest boundary

Read-only installed source/type inspection and official source retrieval completed. Two independent reviews approved the bounded decision and reviewed this report; their factual precision suggestions about MIT notices, faucet limits and wrapping guarantees were incorporated. A small local export catalog read was corrected after plain JSON serialization encountered a BigInt; the final read listed the five exports and their actions. It did not construct a transaction or test a product path. No runtime changes, new template, browser test, chain check or new product test pass is claimed. The prior 223-test run remains historical evidence for its original fixed source, not a fresh result here.

The current official Build with XO bounty still requires a novel functional contract, an actual Chipnet/Mainnet execution using an inspectable Invitation, reproduction instructions, applicable follow-up actions, and personally written human feedback. This assessment satisfies none of those execution/novelty gates. It is not a human experience essay. No submission or legal agreement was accepted; the bounty's IP waiver remains a separate submission decision.

## Primary sources

- Current template tags: https://registry.npmjs.org/-/package/@xo-cash%2ftemplates/dist-tags
- Official API export list: https://stack.xo.cash/api/@xo-cash/templates.html
- Immutable export index: https://gitlab.com/GeneralProtocols/xo/templates/-/blob/2e39bd00ed10fda7a2e4e180e4c693a2880c3d3a/source/index.ts
- P2PKH reference: https://gitlab.com/GeneralProtocols/xo/templates/-/blob/2e39bd00ed10fda7a2e4e180e4c693a2880c3d3a/source/p2pkh.ts
- Multisig reference: https://gitlab.com/GeneralProtocols/xo/templates/-/blob/2e39bd00ed10fda7a2e4e180e4c693a2880c3d3a/source/experimental/multisig.ts
- Faucet reference: https://gitlab.com/GeneralProtocols/xo/templates/-/blob/2e39bd00ed10fda7a2e4e180e4c693a2880c3d3a/source/faucet_cash.ts
- Wrapping references: https://gitlab.com/GeneralProtocols/xo/templates/-/blob/2e39bd00ed10fda7a2e4e180e4c693a2880c3d3a/source/wrapped_cash.ts and https://gitlab.com/GeneralProtocols/xo/templates/-/blob/2e39bd00ed10fda7a2e4e180e4c693a2880c3d3a/source/wrapped_cash_chipnet.ts
- Output completion: https://gitlab.com/GeneralProtocols/xo/engine/-/blob/18c44c1b0e9254882dbdbbc1e41bd559244bdda4/source/invitation/merge/complete.ts
- Transaction serialization: https://gitlab.com/GeneralProtocols/xo/engine/-/blob/18c44c1b0e9254882dbdbbc1e41bd559244bdda4/source/invitation/generation/transaction.ts
- Action type: https://gitlab.com/GeneralProtocols/xo/types/-/blob/e2cea7226b16759cd41e7af1cfb393d4fbd6afc4/source/template.ts
- Product constraints: https://github.com/peterpeter228/intentguard-bch/blob/11f3584ab31460ee5a881b90d6855ce22bd8fa80/core/guard.ts and `docs/03_PRD.md` at that same commit.
- Official bounty: https://bchblaze.cash/bounties/

