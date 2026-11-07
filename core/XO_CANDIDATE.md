# Offline XO template candidate adapter

`buildXoTemplateCandidate(request, expectedRequestDigest, context, now)` is a synchronous **Node-only** diagnostic. The caller supplies the same strict offline context as `buildPaymentRequestPlan` and obtains the expected request digest from its own current review state. Pass trusted invocation time, never a clock imported from request/context JSON.

## Actual implementation path

1. The existing request planner validates the request, its review binding, the entire explicit funding context, input parents/unspent claims, expiry/freshness, ownership-script claims, token conservation, change and conservative signed-size fee budget.
2. Refuse requests with anything other than one recipient. Choose the official `sendSatoshis` or `sendFungibleTokens` action.
3. Normalize the installed official `p2pkhTemplate` with `parseTemplate`; require identifier `a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672`.
4. `completeMergedOutput` resolves the recipient locking script and transferred BCH amount, or full fungible category/amount, from request-derived variables. The fungible output's BCH carrier is supplied explicitly from the request, because this template does not declare that carrier through those variables. Recipient locking bytecode/token bytes are **not** copied from the planner output.
5. The existing plan supplies selected inputs with empty unlocking bytecode and their claimed parent amounts/tokens, transaction version/locktime, and exact change outputs. `buildInvitationTransactionFromMergedCommit` serializes the actual XO candidate. Its required source labels are explicitly `offline-diagnostic:<request-plan-digest>`, not actual authenticated commit identifiers. No Invitation or commit is created or accepted.
6. Guard independently decodes those candidate bytes against the intent and supplied snapshot. Require matching intent digest and actual fee, then byte-for-byte equality to the independent plan. The engine's input/output-count fee estimate is shown only as a non-authoritative diagnostic; it never replaces actual fee or signed-size policy checks.

The November 7 compatibility update pins engine `0.1.1-next.17778370827`, the npm `next` tag observed that day. Templates remain `0.0.12`, utils `0.0.10`, and types `0.0.8`. Merged variables now carry the same explicit local source label as inputs/outputs; this is not authenticated commit provenance. The zero-valued-output and real Invitation gates remain open. See [upgrade evidence](../evidence/upstream-next-20261107/README.md).

## Output and trust boundary

The frozen, JSON-serializable result is `EXACT_MATCH_OFFLINE` or `REJECTED`. All five authority flags remain false. The safe report contains output summaries only after exact verification, actual fee, candidate byte count, signed-size assumptions, the independent Guard report, and explicit limitations. It contains no raw request, funding parents, unsigned candidate transaction or reusable Invitation.

The binding includes the prior request-plan digest, the complete validated offline context digest (including snapshot observation time), pinned template identifier, action, candidate-byte digest, and their combined digest. These are domain-separated application content identifiers, not proof of consent, ownership, chain state or accepted XO participation. Context property names are serialized in a fixed order; array order is retained. The observation claim may change this binding even when plan/transaction bytes are unchanged.

`compareXoCandidateBytes` is a low-level raw-byte Guard/comparison helper used by the adapter and actual-engine adversarial tests. It neither compiles templates nor promotes imported reports to authority. There is no callback injection option in the public build API.

## Validation

Run `npx tsc && node --test dist/core/xo-candidate.test.js`. Eleven tests cover BCH/FT positives, pinned normalization, stale/expired claims, bad review digest and context, accessors/imported verdicts, single-recipient scope, observation binding, non-symmetric category bytes, and actual-engine recipient/BCH amount/category/token amount mutations. An actual-engine change-output reorder still passes economic Guard but fails exact byte binding, so both checks are necessary.

This is synthetic offline evidence only. No keys, signatures, Engine instance, wallet, node, discovery, reservation, signing, broadcast, receipt, deployment or submission is involved. Mainnet spendability, authenticated XO Invitations, novel templates, wallet ownership and payment readiness remain unverified.


## Explicit local UI/API path

After building a reviewed plan on `/request`, **Compare with official XO template** sends the request, reviewed digest, explicit offline context and expected plan digest to `POST /api/xo-candidate` on the same loopback server. The server enforces exact Host/Origin, Fetch Metadata, strict UTF-8 and duplicate-free bounded JSON, a 300 KiB body cap and five-second upload deadline. It revalidates current plan freshness before returning. No account, credentials, persistence or external request is involved. Synchronous computation cannot be interrupted mid-CPU execution; bounded inputs and late-result refusal are used rather than claiming preemption.

The browser keeps the comparison pending only for that exact request/funding state. Cancel, new plan, edits, expiry or an older delayed response cannot restore success. Before showing/exporting it, the browser checks an exact response field allowlist, full local Guard/output/fee/size agreement, template/action identity, and recomputed context/candidate/binding digests. Raw transaction payload fields or contradictory success reports are refused. Safe reports can be downloaded only while the original plan remains current.
