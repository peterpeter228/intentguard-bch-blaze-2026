# Official public signature-vector review

## Result first

Two **existing published positive compressed-P2PKH BCH signatures** were recovered from immutable BCHN source and successfully verified with installed **@bitauth/libauth3.1.0-next.8**. No keys were copied, derived or generated; no signing/generator API was called; no wallet/node/transaction submission occurred. No application code was changed.

| Original test ID | Algorithm | Sighash suffix | Pubkey | Hash160 matches prevout | Verify-only result |
|---|---|---|---|---|---|
| vx8cqv | BCH Schnorr | 0x41 ALL\|FORKID |33-byte compressed|true|true|
| jyqemh | ECDSA low-S | 0x41 ALL\|FORKID |33-byte compressed|true|true|

**Scope gap:** both vectors contain a complete signed raw transaction and an encoded ordered source-output array, but no full parent transactions. Their previous transaction hash is a synthetic test value. They are valid lower-level serialization/crypto/prevout-script regression fixtures, **not a full-parent txid-binding integration positive**. Do not invent a parent, rewrite an outpoint, re-sign, or claim mainnet/Chipnet provenance. Neither selected vector covers0x61 or token-bearing inputs.

## Immutable source, files and license

[BCHN official source file](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/test/data/vmb_tests/bch_2026_standard/core.benchmarks.signature-checking.p2pkh.vmb_tests.json)

Commit: `07576013c91ff4a3a74acd85f189c69121cdad1b`.
Original raw file SHA256: `802548d238a25a95554bde8aab9e5adc0a2888d8c1eea88fdbcb4b8b09bb64a7`.

- `bchn-p2pkh-public-vectors.json`: exact JSON values of original rows vx8cqv and jyqemh, with formatting changed only. Row fields: test ID, description, source unlocking assembly, source locking assembly, signed transaction hex, serialized source-output array hex. “key1” in assembly is a public symbolic test label, not key material.
- Subset file SHA256: `d0cb055fa0c8be94346bf5e001265c5d8dcea06f32a6214bfc84ad6ff0da0cb2`.
- `verify-only-results.json`: derived public signature, public key, sighash, signing preimage, digest and actual verification outcome. These are verification outputs, not newly produced signatures.
- `BCHN_COPYING.txt`: unchanged [BCHN MIT license](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/COPYING), copyright Bitcoin developers2009–2025 and Bitcoin Core developers2009–2017. Keep copyright/license notice with copied vectors. Attribution here is to their exact BCHN publication; no additional claim about independently deriving their original author is made.

Official source reads and local verify-only execution occurred **2026-11-04 15:43–15:45 UTC**. Raw GitHub file/API retrievals were directly pinned to the commit. Exa search was used to locate the official suite; its results had no acquisition timestamps. Old `src/test/data/CHIPs/…` URLs returned404 because current files reside under `vmb_tests`; the current pinned tree was then enumerated. No permission denial occurred.

## Exact pinned-libauth verification contract

Installed declarations/source inspected:
- `build/lib/vm/instruction-sets/common/signing-serialization.{d.ts,js}`
- `build/lib/crypto/secp256k1-types.d.ts`
- `build/lib/message/transaction-encoding.d.ts`
- `build/lib/vm/instruction-sets/common/common-types.d.ts`

Use `decodeTransaction(hexToBin(rawTx))` and `decodeTransactionOutputs(hexToBin(encodedSourceOutputs))`; each returns decoded data **or an error string**, so fail closed. Check counts, canonical bytes, bounds, ordered alignment, and complete source-output content separately.

`generateSigningSerializationBch({ transaction, sourceOutputs, inputIndex }, { coveredBytecode, signingSerializationType })` returns public signing-preimage bytes; despite its name it **does not create a cryptographic signature**. `generateSigningSerializationBCH` is its deprecated compatibility alias. For strictly validated P2PKH, `coveredBytecode` is the selected source output's25-byte locking script; `signingSerializationType` is `Uint8Array.of(actualSighashSuffix)`, not a four-byte buffer. The default fork ID is zero; the implementation appends the remaining fork-ID bytes itself and includes token-prefix/source-output fields as appropriate.

Digest is `hash256(preimage)` (double SHA256). Strip only the final sighash byte from the transaction signature before calling:
- `secp256k1.verifySignatureSchnorr(raw64ByteSignature, publicKey, digest)`
- `secp256k1.verifySignatureDERLowS(rawDerSignature, publicKey, digest)`

Both return boolean. `verifySignatureDER` is **not** an equivalent strict check because it normalizes high-S before verification. The Schnorr function implements the BCH EC-Schnorr-SHA256 construction, not BTC BIP340 verification. Check compressed pubkey length33 and prefix02/03, match `hash160(pubkey)` to the P2PKH20-byte payload, and require exact supported unlocking-script structure. Do not infer policy acceptance just because a low-level verifier accepts a pubkey format.

The actual verify-only run decoded each selected row, extracted its two minimally pushed signature/pubkey items, generated its signing preimage, hashed it, checked hash160, and called the relevant verify function. It did not execute upstream test generators, produce signatures, invoke a wallet, or call private-key APIs.

## Sighash and strict policy

Recommended restricted application allowlist: **0x41** (ALL|FORKID) and, when explicitly supported, **0x61** (ALL|FORKID|UTXOS). Reject unexpected suffixes/reserved bits, legacy/no-FORKID, NONE, SINGLE, ANYONECANPAY and unsupported combinations rather than passing every byte into the serializer. Source: [immutable BCHN signature encoding rules](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/script/sigencoding.cpp). These encoding rules also prohibit UTXOS with ANYONECANPAY and require active tokens/FORKID for UTXOS.

Demanding0x61 for token inputs is a **stricter application policy**, not proof that0x41 token transactions are universally invalid. UTXOS binds the serialized ordered source-output set; require every source output and token record correctly aligned and bound to actual outpoints.0x41 still commits selected input amount/script and relevant transaction data, but does not commit all source outputs via hashUtxos.

[BCHN public signing-serialization suite](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/test/data/vmb_tests/bch_2026_standard/core.signing-serialization.vmb_tests.json) contains0x61 tests (e.g. k97cez), but the inspected example is a specialized script harness, **not strict P2PKH**. It was not relabelled as a supported positive or copied into the selected subset. A strict P2PKH0x61/token-input positive remains unverified in this bounded search.

## Network and consensus limits

BCH fork-ID signatures do not independently encode “mainnet” versus “Chipnet”. Correct network binding requires separately established chain/source provenance and application network context. A signature over a synthetic transaction does not establish any on-chain UTXO or ownership relationship with the user.

The published vectors are lower-level test programs: their transaction shape need not satisfy this project's version/locktime/final-sequence/payment-intent constraints. Keep their crypto tests separate from builder/guard integration tests; do not alter vector bytes to make them fit.

The installed default `createVirtualMachineBCH` alias is2023, while explicit2026 exists (as independently noted by the parent). No VM was invoked here. Restricted P2PKH cryptographic verification is **not a full consensus/standardness verdict**. Structural equality, sighash coverage, key-to-script match, signature validity, source transaction binding, UTXO availability, fee/dust checks, authorization and broadcast/inclusion remain separate gates.

## Remaining coverage gaps

- Full-parent binding positive: absent, cannot fabricate a preimage for synthetic parent hashes.
- Strict compressed-P2PKH0x61 positive: not established.
- Token-input P2PKH positive with complete token source outputs: not established.
- Real network/wallet/source provenance: deliberately not attempted.

Useful next authorized local checks are verify-only negative mutations of these immutable positives (signature/pubkey/sighash/output/source amount) with clear derived-negative labels; the parent may integrate them without creating new signatures. A malformed fixture is not a newly signed positive.
