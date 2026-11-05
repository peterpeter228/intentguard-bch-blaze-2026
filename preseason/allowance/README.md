# Offline finite pre-funded fixed-beneficiary tranches

**Experimental synthetic lab. Never fund this artifact. Not a general allowance,
wallet feature, deployed contract, recurring payment service or production approval.**
The fixed beneficiary is the public test pattern `22` repeated 20 times in a P2PKH
script; no actual recipient, key or signing identity is created. No funding address
or funding transaction is exported. The CLI emits a bounded JSON summary only.

## Reproduce

- `npm run typecheck`
- `npm run build`
- `npm run allowance:test`
- `npm run allowance:demo`
- `npm run validate` includes the allowance tests and unchanged core tests.

All source is isolated here. There is no UI, route, network client, actual Engine
instance, account creation, Invitation acceptance/authentication, signing, broadcast,
RPC, live wallet, faucet or third-party call. Only pure functions from pinned official
XO and libauth packages are invoked. `syntheticCase` is a mutable **internal test
harness**, not a funding/spending API. `runTrancheLab` is the frozen, bounded report
API. It accepts only plain own data properties with strict numeric bounds, and never
returns transaction bytes or addresses. It does not claim to sandbox hostile Proxies.

## What the script enforces

P is a fixed beneficiary payout, with lab factory bounds 546..1,000,000,000 satoshis.
F is fixed at 1,000 satoshis. B = P + F. T is a fixed block delay from 1..65,535.
A valid source has V = N × B, with integer N from 1..100. Every invariant below is
in executable CashASM, not a template helper's metadata or off-chain conditions:

- One input at index zero; transaction version 2; locktime zero.
- Actual `OP_CHECKSEQUENCEVERIFY`, plus exact sequence T, excluding disable,
  time-based and reserved flag variants.
- No input or output tokens, including NFT-only tokens of every capability.
- Source V divisible by B; quotient 1..100.
- When N > 1, exactly two outputs: same covenant at output 0 with V − B, and fixed
  beneficiary at output 1 with P.
- When N = 1, exactly one output: fixed beneficiary at output 0 with P.
- Thus every output is positive and the exact derived fee is F. No extra, reordered
  or missing outputs; no input aggregation or donor fee input.

The factory produces a genuine typed XO template, reparses it with official
`parseTemplate`, and identifies it with `generateTemplateIdentifier`. The official
engine compiles the covenant to P2SH32. The release script `<covenant>` compiles with
XO utilities; its bytecode is compared to libauth's canonical redeem-script push.
The reserve and payout outputs are completed by `completeMergedOutput`, including
reserve amount derived from the template's untrusted `reserveSatoshis` variable.
`buildInvitationTransactionFromMergedCommit` creates the actual bytes passed to
`createVirtualMachineBch2026(true)`. The source value is independently checked by
on-chain introspection, so lying in template variables cannot change the contract.
There are separate continuation and terminal transaction definitions. No zero-value
optional reserve and no patch to XO's existing zero-output filtering are used.

The relay role and continuation/final follow-up references are declarations only.
**Normal Invitation lifecycle, role participation, coin selection, fixed-fee/change
integration and automatic follow-up behavior remain UNVERIFIED.** No
`omitChangeAmounts` workaround, private key, signature or engine-account flow is used.
A caller that explicitly invokes the current engine's automatic change helper can
append change (at these parameters, 600 sat for continuation or 720 sat for terminal),
which violates this covenant's exact output shape. `executeAction` itself does not
universally call that helper, so this is a conditional integration limitation, not
an established blocker on all XO execution. Reducing F does not repair both branches.
No fixed-fee normal Invitation integration has been implemented or verified.
The upstream count-only fee estimate is not trusted. Actual serialized byte length
is checked against a conservative lab baseline of 1 sat/byte. This is not a relay,
miner-fee, current/future network policy or chain-acceptance guarantee.

## Trust and loss risks

- Wrong amount, nonmultiple, below-minimum or over-cap funding, or **any token-bearing
  funding, may permanently strand funds**. There is no recovery, revocation, refund,
  recipient change, fee bump or administrative path. Never send funds here.
- Anyone can trigger a valid payout, but only to the fixed beneficiary. There is no
  automatic execution, keeper or assurance anyone will execute a payout.
- This is a **per-UTXO relative block delay**, not a calendar schedule, global cap,
  account balance, global allowance or elapsed-time catch-up. Multiple valid coins
  can pay concurrently. Missed intervals do not accrue payouts; the next delay
  starts at confirmation of the newly created reserve coin.
- The beneficiary and fee are immutable. An incorrect or inaccessible beneficiary
  cannot be fixed. Future fee or relay policy changes may make progress impractical.
- Stateless VM checks sequence/CSV fields, **not the actual age of a coin**, chain
  inclusion, ownership, unspent status, mempool acceptance or consensus activation.
  Synthetic parent binding checks hash and output index against synthetic bytes only.
  The lower-level stateless helper intentionally accepts supplied source outputs;
  a dedicated test demonstrates why that alone cannot authenticate a parent.
- Every authority flag remains false, even when synthetic VM verification passes.
  Existing ordinary-payment Guard still rejects this contract. No Guard bypass or
  product integration is introduced.

## Tests and attribution

Tests exercise N=1,2,100, P=546 and upper bound, T=1 and 65,535, a full synthetic N=3
hash-bound progression, output/script/value/fee mutations, changed next-state delay,
version/locktime/sequence flags, malformed source amounts, FT and NFT injection,
multiple XO-merged inputs, donor inputs, redeem substitution, unlocking stack
injection, strict API rejection, immutable authority and existing Guard rejection.
These are offline synthetic tests, not broadcast evidence or a security audit.

Uses pinned `@xo-cash/engine`, `@xo-cash/types`, `@xo-cash/utils` and
`@bitauth/libauth` through their public APIs. This original isolated lab does not
copy third-party implementation code. Dependency licenses and notices remain in
those packages; no dependency or lockfile is changed.

Conceptual inspiration: the official XO faucet example and the original 2qx faucet
covenant. This implementation is independently written and deliberately differs:
exactly one input, immutable beneficiary, finite bounded reserves, distinct terminal
branch, exact fee and sequence, no token funding and no live faucet or fund handling.
It does not claim compatibility with the original faucet's aggregation behavior.
# Funding-risk inspector (2026-11-05)

`npm run build && npm run allowance:funding-demo` runs five fixed synthetic cases without editing JSON: baseline full depletion, wrong intended count, malformed reserve amount, higher byte fee, and higher dust threshold. It accepts no arguments and exports no transaction bytes or funding address. **Never fund this artifact.** This tool diagnoses risk; it does not add recovery or make the experiment safe to fund.

The pure `inspectSyntheticFunding` API in `funding.ts` accepts exactly `parentTransactionHex`, `outputIndex`, `parameters`, `plannedTranches`, and `policy`. `parameters` uses the existing payout/delay schema; `policy` requires canonical positive integer strings `feeSatPerKb` and `dustRelayFeeSatPerKb`, each at most 1,000,000. These are explicit local assumptions, not network observations. Parent encoding is bounded to 65,536 bytes and must round-trip canonically. Plain own data properties only; no hostile-Proxy sandbox is promised.

It checks the actual selected output's compiled locking script, token absence and amount, independently derives N, and matches N to the intended count. It then builds and parent-binds every actual XO successor through final exhaustion, checking the VM, exact accounting, actual sizes, and local fee/dust assumptions. Initial source dust is checked separately from successor output dust. All report fields remain frozen and all authority flags remain false.

Distinct verdicts prevent misleading claims: `OUTPUT_MISMATCH` means the expected script is absent; `CONTRACT_REJECTED` means matching-script amount/token funding has no release path; `PLAN_MISMATCH` is a mathematically valid but unintended number of payments; `LOCAL_POLICY_REJECTED` is local-policy incompatibility, not consensus impossibility. `SYNTHETIC_CONTINUATION_VERIFIED` proves only the bounded supplied-byte computation.

The API does not establish parent validity, chain inclusion, current unspentness, actual CSV maturity, beneficiary ownership/key access, normal authenticated Invitation execution or future relay acceptance. It does not verify the initial funding transaction's inputs, fee or other outputs. Total fees cover only the modeled tranche releases, not initial funding or later beneficiary spending. Per-UTXO checks cannot prevent unsolicited deposits, combine invalid coins into a valid reserve or impose a global schedule across multiple coins.

Recovery/refund, key rotation, mutable beneficiary or flexible fees would require a separate contract and changed guarantees. None was added. See `evidence/funding-safety-20261105/ASSESSMENT.md` and `DESIGN.md` for the source-backed risk analysis and decision gates.

