# Independent unsigned-builder review

## Scope, time and source state

Reviewed 2026-11-04 **15:16–15:17 UTC**: repository AGENTS.md, STATUS/DECISIONS/NEXT_ACTION, current `core/guard.ts`, package.json and prior `FEE_DUST_REVIEW.md`. Official immutable BCHN source and live libauth/CashScript documentation were re-fetched via Exa during this window. Connector output supplies no acquisition timestamp; request time is not proof that mutable documentation was freshly crawled. No wallet, private key, signing, node RPC or transaction was used. Only this evidence document was written.

The supplied directory has **no Git repository metadata**: `git rev-parse HEAD` and `git status` fail with “not a git repository”. Therefore this review does not independently certify a local source commit; the directory suffix is not proof. Local package pins are libauth3.1.0-next.8 and CashScript0.14.0. Mutable API documentation may describe a newer version; installed types/source remain the implementation contract.

## Important conclusions before implementation

1. Current guard supports empty unlocking scripts, P2PKH, fungible tokens only, version2, locktime0 and sequence **0xffffffff**. CashScript's official builder documentation defaults input sequence to **0xfffffffe**. Set supported fields explicitly; do not inherit wallet/builder defaults.
2. A P2PKH locking script's20-byte pubkeyHash does **not** establish public-key length or signing algorithm. Thus `ownerScripts` alone cannot justify an exact141-byte input estimate. Treat a Schnorr/compressed-key mode as an explicit constrained assumption, later checked against the returned signed transaction.
3. Maximum fee rate needs a **minimum final-size bound**, not a maximum-size estimate. Minimum funding needs a maximum-size bound. Using148 in both directions can approve excessive actual fee rates.
4. Token change cannot be silently discarded as dust. Fund its BCH dust, select an additional eligible BCH-only input, or return insufficient-funds/unsupported status. Never implicitly burn tokens to fit a fee budget.

## Signature and final-size bounds

Rechecked [BCHN sigencoding.cpp at07576013c91ff4a3a74acd85f189c69121cdad1b](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/script/sigencoding.cpp): raw Schnorr has64 bytes; transaction signatures add one sighash byte. DER raw signatures have8..72 encoded bytes; low-S removes the possible33-byte S encoding, making71 the raw upper bound. Standard pubkeys may be compressed33 or uncompressed65 bytes. Encoding bounds do not establish cryptographic validity.

For minimal-push P2PKH, compressed pubkey:
- Schnorr: unlock100 bytes, full input141 bytes, exactly under those assumptions.
- Low-S ECDSA: raw DER8..71 plus sighash, hence full input **85..148 bytes** as a conservative encoding envelope. The lower bound is deliberately broad; it is not a claim that an8-byte DER signature can sign this particular transaction. Typical ECDSA signatures being longer is not a safe universal lower-bound assumption.
- Without low-S assurance, upper bound149. Uncompressed public keys add32 bytes. Nonminimal pushes, additional stack data or unsupported scripts invalidate these narrow envelopes; reject or re-estimate under an explicitly broader model.

Full transaction size is `4 + CS(inputCount) + sum(inputBytes) + CS(outputCount) + sum(serializedOutputBytes) + 4`. If all current unsigned inputs are empty and all eventual unlocking scripts are shorter than253 bytes, `S_signed = S_unsigned + sum(unlockingScriptBytes)`: the one-byte CompactSize fields remain one byte. Do not use this shortcut if any count or length boundary changes.

For fee `F`, rational rate `r=p/q` sat/byte:
- Funding for the whole permitted envelope: `F >= ceil(p*Smax/q)`.
- Proving a maximum rate `m=a/b`: `F*b <= a*Smin`.
- Actual rate lies in `[F/Smax, F/Smin]`. An upper-size estimate only establishes the lower end.
- Also enforce the absolute intent fee cap and ensure estimated signed size, not only unsigned size, satisfies the chosen transaction-size policy. Use BigInt cross multiplication and bounded numeric inputs, not floating-point rounding.
- Any cap proved using an envelope is conditional on enforcing that envelope on the real signed transaction. Final signature validity, hash type, public-key ownership and exact signed fee/size still need separate checks. The current structural comparator deliberately does not provide them.

## Output serialization, dust and token conservation

Rechecked immutable [BCHN policy.cpp](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/policy/policy.cpp) and [token.h](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/primitives/token.h), plus [libauth getDustThreshold](https://libauth.org/functions/getDustThreshold.html). The prior review's default formula is confirmed: dust=`3*(fullSerializedOutputBytes+148)` at1000sat/1000bytes; equality passes. The148 is fixed policy and does not shrink for Schnorr.

For this FT-only slice, with positive token amount `a`, token prefix length is `T=1+32+1+CS(a)`. With P2PKH script length25, output size is `8+CS(T+25)+T+25`. Without tokens `T=0`. Default dust: ordinary P2PKH546; FT amount1..252 has651; amount253 has657. `CS` is CompactSize byte length, not decimal/hex string length. Every token-bearing recipient/change output is checked separately using the exact final amount. Amounts must be1..2^63−1 when serialized as FT-only token outputs; zero FT change means omit the token output, not encode an invalid zero-amount FT token prefix.

Per-category conservation is a strict **application no-burn/no-genesis restriction**, not a statement that all consensus-valid CashTokens transactions require equality. Keep NFT/minting/genesis unsupported. Filter inputs to declared categories; retaining a token UTXO solely for BCH funding must not unintentionally import undeclared categories. Source-output validation must happen before deterministic selection, not only after serialization.

Compute positive token change outputs first and reserve their BCH dust. Then evaluate BCH-only change with its incremental serialized size/fee. If BCH-only change is omitted below dust, explicitly report remainder-as-fee and recheck both fee caps. Recalculate from scratch for the final output set; never maintain a stale size/fee after adding/removing change. Specify deterministic input ordering/tie-breaks, preserve recipient order from intent, and use a fixed deterministic category order for change. Determinism is project behavior, not a BCH consensus requirement.

## Node policy and unsigned boundaries

BCHN policy.cpp explicitly labels its rules local configurable node policy. Default dust rate1000sat/kB and ordinary minimum relay fee1000sat/kB are documented in the prior review's pinned policy.h/validation.h sources; they are not current live-node quotes or guaranteed miner inclusion. `kB` here means1000 bytes. Dust's integer `GetFee` floor-before-times3 semantics differ from conservative fee-budget ceiling. BCH policy virtual-size treatment may include sigchecks; simple supported P2PKH byte size dominates the default50bytes/sigcheck, but do not generalize to contracts.

The existing guard's fixed1000 dust baseline is valid as a declared application baseline. Its unsigned100KB limit alone does not establish final signed standard-size acceptance. Node policy, UTXO freshness/ownership, relay acceptance and consensus remain distinct from serialization/comparison.

[libauth encodeTransaction](https://libauth.org/functions/encodeTransaction.html) documents standard P2P serialization and its use for txid. An unsigned serialization's hash is not the final signed txid. Call it unsigned candidate/structural digest; do not present it as a mined or broadcast transaction identifier. Build plain public transaction data with empty unlocking scripts; do not invoke sign-generating builder unlockers, produce dummy signatures, connect wallets or broadcast to estimate sizes.

[CashScript TransactionBuilder documentation](https://cashscript.org/docs/sdk/transaction-builder) confirms separate absolute/rate caps, default implicit FT burn=false, default nonfinal sequence, and an NFT exclusion in its fungible-token-change helper. These are references for design, not a mandate to use signing-oriented methods. No official API/documentation result here establishes that this project's future builder is implemented or correct.

## Suggested boundary-test evidence

Unsigned-only tests should cover: source ordering permutations; duplicate outpoints; insufficient BCH for token change; FT CompactSize252/253 and65535/65536; exact dust and dust−1; BCH change appearance/disappearance; multi-category conservation; fee-rate upper cap using `Smin`; funding using `Smax`; unsupported wallet mode; uncompressed/unknown pubkey assumptions; estimated signed-size cap; and unchanged recipient order. Synthetic size arithmetic/serialization is permitted, but no real or fabricated cryptographic signature is needed. Future signed validation must reject an actual script outside the declared size/algorithm envelope rather than silently preserving an obsolete estimate.

No permission blocker. Only local Git metadata is unavailable; no source state was changed to repair it.
