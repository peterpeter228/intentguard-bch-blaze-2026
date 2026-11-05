# Offline funding inspection, not recoverable funding

## Scope and decision

This slice continues the isolated finite-tranche experiment from private commit `7f429fe46193f5f1bcc2ec84c32ca4ca29661b09`. It does not change the covenant, beneficiary, fees, dependency lock, core payment Guard or UI. The permissionless fixed-beneficiary contract remains irrevocable and has no recovery branch. No wallet, key, signature, account, live chain query, funding, broadcasting, deployment, external outreach or submission is part of this work.

The useful achievable outcome is to detect prospective mistakes before an independently authorized future funding action, and to demonstrate full finite depletion under supplied local policy assumptions. **The output is always diagnostic, never authorization. Do not fund this experimental template.** Its fixed beneficiary is a synthetic test hash with no ownership or key availability established.

## What the gate checks

The public API accepts a strict plain-data request containing raw parent transaction hex, a selected output index, expected payout/block delay, explicitly intended tranche count, and declared local byte-fee and dust-relay rates. Parent bytes are bounded before parsing and must round-trip canonically. Parameters are compiled by the pinned official XO toolchain. The actual selected output must match the expected locking script, have no token/NFT, and satisfy the contract amount invariant. The output's derived count must separately match the planned count.

For admissible inputs, every successor is built by the real pinned XO functions using the preceding parent bytes and actual output value. The first selected output may be nonzero; all continuation reserves are at index zero. Each constructed successor is decoded and checked for exact parent hash/index, VM execution, output count, actual serialized size and fixed fee. The loop ends after at most 100 steps, with exact total payout plus total fees equal to the initial reserve and no covenant reserve remaining.

Local policy checks are separate from script execution. They measure actual-byte fee requirements with integer ceiling and dust thresholds for the selected source and each generated output. These are caller-declared assumptions, not queried network conditions. The initial parent transaction's fee and other outputs are outside this narrow inspector.

## Verdicts and important distinctions

- Malformed input is not a chain or covenant verdict.
- A different locking script is unsupported/mismatched, not evidence that the other script is unspendable.
- A matching covenant with invalid amount or token funding has no release path under this fixed script. Waiting, top-ups or updating the app cannot create one.
- A valid multiple that differs from intended count is a payment-intent mismatch. It is not trapped funds: it would pay that different number of tranches.
- A local policy rejection can be temporary or node-specific. It is not a proof of consensus impossibility or global unspendability.
- Successful synthetic continuation proves only this bounded local computation. No parent consensus validity, chain inclusion, unspentness, beneficiary ownership, maturity, relay/miner acceptance, authenticated XO Invitation or future liveness is established.

Amounts are per selected UTXO, never an aggregate address balance. Two invalid UTXOs do not repair each other, and two valid UTXOs create independent schedules. A receiving output does not execute its future spending covenant, so the app cannot prevent an outsider from sending bad funds.

## Recovery is a separate product decision

The current contract deliberately prevents payout redirection and donor revocation. A refund/timeout branch would weaken that promise and introduce a race over unspent reserve. Key rotation or an alternate recovery signer would add another authority. External fee sponsorship or variable fees would change transaction shape, payer accounting and extraction bounds. Remainder sweeping changes fixed payout economics. These are candidate new contracts, not patches for old locked outputs.

If recovery becomes a requirement, first choose whose guarantee has priority: irrevocable beneficiary entitlement or donor/alternate-signer recovery. Then specify exact destinations, authorization, timing, fee bounds, token handling and adversarial races before implementing a separate version. Existing coins cannot be upgraded retroactively merely by changing XO metadata or application code. No such recovery design is enabled in this slice.

## Next external evidence gates

1. Agree on the intended irrevocability/recovery and fee-liveness tradeoff; do not silently add spend rights.
2. Establish supported normal XO Invitation roles, unlocking/follow-up discovery and exact-fee/no-extra-change workflow. Pure function execution does not close this gate.
3. Separately obtain applicable authorization for actual wallet/session/ownership and permitted chain evidence, and prove no-broadcast behavior before any signing workflow.
4. Require independent security review and explicit funding approval before any live-money proposal. This offline inspector is insufficient, even when all checks pass.

The source-backed risk matrix is in `ASSESSMENT.md`; actual commands and results are in the accompanying validation/review records. No new browser or mobile evidence is claimed for this CLI/API-only slice, and no restricted images are used or retried.
