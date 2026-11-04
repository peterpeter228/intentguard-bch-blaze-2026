# BCH fee, dust and unsigned-construction review

Research: 2026-11-04 14:49–14:51 UTC. Read-only official HTTP source/documentation retrieval and installed-library inspection only. No node RPC, wallet, key, signing, transaction submission or application-code modification. Search extracts do not establish current network mempool conditions. No permission denial occurred; an initial incorrect `src/policy/feerate.cpp` path returned HTTP404, corrected to official `src/feerate.cpp`.

## Fixed authoritative source

BCHN commit **07576013c91ff4a3a74acd85f189c69121cdad1b**, previously resolved from its official current-master API during this day's research; the files below were fetched directly at that SHA for this review:

- [policy.cpp](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/policy/policy.cpp): `GetDustThreshold`, `IsDust`, `GetVirtualTransactionSize`.
- [policy.h](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/policy/policy.h): `DUST_RELAY_TX_FEE=1000 sat`, `DEFAULT_BYTES_PER_SIGCHECK=50`.
- [feerate.cpp](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/feerate.cpp): exact integer fee rounding.
- [transaction.h](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/primitives/transaction.h), [token.h](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/primitives/token.h), [token.cpp](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/primitives/token.cpp): full output/token serialization.
- [validation.h](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/validation.h): `DEFAULT_MIN_RELAY_TX_FEE_PER_KB=1000 sat`.
- [sigencoding.cpp](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/script/sigencoding.cpp): DER encoding and low-S checks.

## Exact dust calculation

For a spendable output with full serialized length `O`, and nonnegative dust relay fee `r` measured in **satoshis per 1000 bytes**, BCHN computes:

1. `N = O + 148`.
2. `f = floor(N*r/1000)` for nonnegative inputs; if `N>0`, `r>0` and `f=0`, use `f=1`.
3. `dustThreshold = 3*f`.
4. Output is dust iff `valueSatoshis < dustThreshold`; equality passes this check.

`GetFee`, not `GetFeeCeiling`, is used: do not replace this by `ceil(3*N*r/1000)` or `3*ceil(N*r/1000)`. At default `r=1000`, this simplifies to `3*(O+148)`. A provably unspendable script recognized by BCHN's `IsUnspendable()` has threshold0; this does not exempt its transaction from every other consensus/relay check.

The `148` is a **fixed relay-policy spend-size assumption**, not the actual unlocking size. Do not lower it to141 because the intended spender uses Schnorr. Dust and ordinary transaction fee rates are different policy inputs: do not automatically substitute a user's selected transaction fee rate into dust calculation.

### CashTokens serialized output size

Let `CS(x)` be CompactSize's encoded byte count: 1 for0..252, 3 for253..65535, 5 for65536..4294967295, otherwise9 for supported uint64 values. Validate ranges and canonical encodings.

- Without token data, `T=0`.
- With valid token data, `T = 1(prefix) + 32(category) + 1(bitfield) + [CS(c)+c if commitment field present] + [CS(a) if amount field present]`.
- `c` is NFT commitment byte length, not hex-character length; an absent/empty commitment omits its length field when the bitfield says absent. `a` is positive fungible amount when serialized; an NFT-only amount0 omits the amount field. Capability lives in the bitfield, not an extra byte.
- With locking script length `L`, full output bytes are **`O = 8(value) + CS(T+L) + T + L`**. The outer CompactSize covers token prefix plus real locking bytecode together. Token-prefixed bytes are not an additional script push. Do not forget outer-prefix growth at253 bytes.

Examples at default dust rate, derived from that serialization:

| Output | O bytes | Dust sats |
|---|---:|---:|
| Ordinary P2PKH, L25 |34|546|
| Ordinary P2SH20, L23 |32|540|
| Ordinary P2SH32, L35 |44|576|
| P2PKH with FT amount1, no NFT |69|651|
| P2PKH with NFT only, empty commitment |68|648|
| P2PKH with NFT32-byte commitment, no FT |101|747|

These are size examples, not permission to create tokens or bypass token validity rules. **546 is not universal.** CashScript recommends1000 sats as a convenient convention for common P2PKH/P2SH outputs, but explicitly warns custom scripts may need more; always calculate the actual serialized output rather than hardcode1000 as a universal ceiling. [CashScript script limits](https://cashscript.org/docs/compiler/script-limits)

## Signed-size estimation versus dust policy

A transaction's exact serialization is `4(version)+CS(inputCount)+sum(inputBytes)+CS(outputCount)+sum(outputBytes)+4(locktime)`. Each input includes32-byte previous txid,4-byte output index, CompactSize unlock length, unlocking bytes, and4-byte sequence. Empty unsigned unlocking scripts materially understate the final fee size.

For a standard P2PKH input with **compressed33-byte pubkey**, minimal direct pushes and ordinary one-byte sighash suffix:

- Schnorr: raw signature64 + sighash1 =65 bytes. Unlock script is `1+65 + 1+33 =100` bytes; complete input is `32+4+1+100+4 =141` bytes.
- ECDSA: DER raw signature is variable length. Strict DER allows up to72 bytes raw; adding sighash can make73, producing up to149-byte input. **With enforced low-S standardness**, raw DER max71, plus sighash gives72, producing conservative148-byte input. Actual inputs may be shorter. A “72-byte signature” must say whether it includes the sighash byte.
- Uncompressed65-byte pubkeys add32 bytes relative to those estimates. Contracts, multisig, unusual pushes and count/length CompactSize boundaries need their own size model; a generic141/148 assumption is invalid for them.

[CashScript types](https://cashscript.org/docs/language/types) specifies65-byte transaction Schnorr signatures; [signature-template docs](https://cashscript.org/docs/sdk/signature-templates) says Schnorr is the default. These are mutable docs read via search during the review, not a promise about the project's installed CashScript version. **Do not call `SignatureTemplate` or builder methods that generate signatures to obtain size estimates in this unsigned-only slice.**

## Fees: relay, consensus and application checks

BCHN's fixed source default minimum relay fee is1000 sat/1000bytes =1sat/byte. This is configurable relay policy, not a consensus mandate, live mempool quote, guaranteed inclusion price or universal miner minimum. There is no single consensus minimum fee rate. Consensus still enforces valid inputs/outputs, value conservation, scripts, tokens and applicable resource limits.

BCHN also defines policy virtual size as `max(serializedBytes, sigChecks * bytesPerSigCheck)`, default bytesPerSigCheck50. For simple P2PKH the byte size dominates. Do not apply Bitcoin SegWit weight/vbyte arithmetic to BCH; complex scripts may require a sigcheck-aware policy review.

Suggested application checks, explicitly **application policy**, not consensus:
- Integer/BigInt satoshi values, nonnegative amounts, duplicate-input rejection, complete source-output identity, and `fee=sum(sourceValues)-sum(outputValues)` with no negative result or unsafe-number coercion.
- Accept a documented rational/integer fee-rate representation; reject NaN, Infinity, negative rates and unbounded rates. If rates must be positive, reject0 explicitly. Keep `sat/byte` versus `sat/1000bytes` unambiguous.
- For a chosen budget rate use conservative estimated signed bytes and **ceil** the fee budget to avoid underfunding. This application budgeting choice differs from BCHN dust's floor rule.
- Enforce both an absolute fee cap and a fee-rate cap. Do not invent a universal safe maximum rate; make caps explicit project/user policy. Rate-cap checks based only on a maximum-size estimate can understate actual fee rate, so final signed-size revalidation remains necessary or use a defensible minimum-size bound as well.
- Recalculate after adding change, accounting for its output size and output-count CompactSize changes. Omit BCH change below its actual dust threshold only with an explicit policy/report that the remainder becomes fee and still passes caps. Never silently burn/drop tokens or NFTs as “dust change”.
- Treat mempool acceptance/inclusion, current unspent status, token conservation, and signed-transaction validity as distinct checks. A structurally valid unsigned plan is not proof of spendability or relay acceptance.

[CashScript TransactionBuilder](https://cashscript.org/docs/sdk/transaction-builder) exposes both `maximumFeeSatoshis` and `maximumFeeSatsPerByte`, freezes additions after BCH change calculation, and states its fungible-token change helper does not preserve NFTs automatically. These API design choices support explicit caps and separate token/NFT handling; do not invoke signing/sending methods for this task.

## Libauth cross-check and zero-rate caveat

Official API references: [getDustThreshold](https://libauth.org/functions/getDustThreshold.html), [getDustThresholdForLength](https://libauth.org/functions/getDustThresholdForLength.html), [getMinimumFee](https://libauth.org/functions/getMinimumFee.html), [encodeTransactionOutput](https://libauth.org/functions/encodeTransactionOutput.html).

Installed local `@bitauth/libauth` version **3.1.0-next.8** was inspected (not executed for signing): `build/lib/vm/instruction-sets/common/instruction-sets-utils.js` uses encoded full output length, fixed148, and 3×minimumFee. Its `getMinimumFee` returns1 when the truncated result is0 for a positive length **even if rate=0**. BCHN `GetFee` returns0 at rate0. Therefore do not claim exact equivalence for all custom rates. For an application requiring positive dust relay rates, reject nonpositive inputs; if supporting0 deliberately, specify and test BCHN-compatible behavior separately. Libauth's arbitrary-data exemption and BCHN's broader `IsUnspendable()` predicate should not be asserted identical for malformed/custom scripts.

## Unsigned-only boundary

This slice may serialize/inspect public transaction plans, calculate exact output sizes, use declared unlock-size bounds and report fee/dust warnings. Keep source outputs and token data attached for subsequent authorized validation. It must not generate/derive private keys, create dummy or real cryptographic signatures, connect/sign with wallets, broadcast, mutate UTXOs, claim unsigned txid equals final txid, or label a plan fully VM-validated without the necessary final unlocking scripts. Wallet/source identity and final signature/fee/size checks belong to a later explicitly authorized stage.
