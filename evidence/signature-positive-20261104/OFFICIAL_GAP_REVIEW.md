# Bounded official positive-vector gap review

## Outcome

No new compatible strict-final-sequence P2PKH payment with full parent transaction bytes, and no strict P2PKH0x61 positive, was established. Do not mark either gate closed. The existing0x41 compressed-P2PKH Schnorr/ECDSA positives remain useful only for their previously documented source-output-level checks.

A useful **different** result: immutable BCHN publishes valid compressed-P2PKH signatures spending token outputs under **0xc3 (SINGLE|FORKID|ANYONECANPAY)**. These verify cryptographically but must be rejected by the project's0x41/0x61-only application policy. Original row `cvs72j` is preserved unchanged in `bchn-cvs72j-unsupported-sighash.json`, with BCHN MIT license in `BCHN_COPYING.txt`. This is not a compatible payment positive and no signature/transaction byte was modified.

## Scope and time

Read-only public official-source inspection and local verification took place2026-11-04 **16:02–16:04 UTC**. The signing-serialization source file was reused unchanged from the earlier15:44 pinned-source download; token source was fetched directly at the same immutable commit around16:03. Libauth current master was resolved through official GitHub API and inspected around16:03–16:04. No keys were copied/generated, no signing test generator was run, no wallet or node RPC was contacted, no transaction was submitted, and no implementation was edited. No permission/access denial occurred. The local directory was supplied as the latest snapshot; its name is not independently verified Git provenance.

## Exact official sources and observed coverage

BCHN immutable commit `07576013c91ff4a3a74acd85f189c69121cdad1b`:

1. [core.signing-serialization.vmb_tests.json](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/test/data/vmb_tests/bch_2026_standard/core.signing-serialization.vmb_tests.json): all1300 rows decoded locally with pinned libauth3.1.0-next.8. Among their source-output scripts,1512 input occurrences are exact P2PKH;432 are token-bearing P2PKH. Every one of those P2PKH signatures uses actual suffix0xc3. None uses0x61. Counts are occurrences, not unique transactions or independent test cases.
2. [core.cashtokens.vmb_tests.json](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/test/data/vmb_tests/bch_2026_standard/core.cashtokens.vmb_tests.json): all946 rows decoded, zero source outputs have exact ordinary P2PKH locking scripts.
3. [prior P2PKH benchmark source](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/test/data/vmb_tests/bch_2026_standard/core.benchmarks.signature-checking.p2pkh.vmb_tests.json): existing positive IDs vx8cqv/jyqemh retain synthetic outpoints, only encoded source-output arrays, and do not provide full parents.
4. [BCHN license](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/COPYING): MIT. Preserve the supplied copyright/permission notice with copied vector material.

**Description trap:** many serialization rows say “all_outputs_all_utxos” and “with P2PKH input”. The0x61 signature being tested belongs to a specialized harness script. The auxiliary P2PKH inputs still use0xc3. A test title is not evidence that the P2PKH signature has that sighash. Do not extract a harness signature and relabel its covered script as P2PKH.

Libauth official current master resolved to **60aec239cc2d57ae21d0069c5bbafb346abc9b66**:
[transaction-e2e.p2pkh.spec.ts](https://github.com/bitauth/libauth/blob/60aec239cc2d57ae21d0069c5bbafb346abc9b66/src/lib/transaction/transaction-e2e.p2pkh.spec.ts). This file contains a literal expected signed transaction, but its test constructs signatures using owner key material, uses sequence0, pays an OP_RETURN output, and does not provide a complete raw parent. The generator was not executed, owner-key helper material was not retrieved/copied, and this unsuitable vector was not added to project fixtures. Master is not assumed identical to the installed prerelease package.

## Actual verification of the useful nonconforming fixture

`scan-results.json` records the bounded scan and two verify-only observations for original row `cvs72j`, input indices0 and2:
-33-byte compressed pubkey;
-pubkey hash matches the exact P2PKH source script;
-signature verifies against libauth-generated signing serialization and SHA256d;
-actual sighash195 decimal =0xc3;
-version2, locktime0, sequence0.

This proves low-level cryptographic validity for those supplied source outputs, not strict-policy acceptance, complete transaction consensus validity, source UTXO reality, network binding, ownership or authorization. It is suitable for an application rejection test that explicitly labels “cryptographically valid but unsupported sighash/sequence”. Do not change it to0x61 or final sequence: that would invalidate the signature and fabricate a different fixture.

## Explicit stopping condition and remaining gaps

This bounded pass examined the two most relevant fixed BCHN standard suites completely and the official libauth P2PKH end-to-end source. It is not an exhaustive search of every historical repository or every public blockchain transaction. No claim of universal nonexistence is made.

Still unverified:
-Complete raw parents whose txids bind every input of a compatible signed P2PKH payment (version2/locktime0/final sequences).
-Strict compressed-P2PKH0x61 positive, particularly with token inputs and full ordered source outputs.
-Real-chain provenance and full-parent integration acceptance.

There was no identified verified public-chain transaction locator in the inspected evidence. No arbitrary live address/transaction searching or prolonged scan was initiated. Future work should begin with a published transaction ID/fixture containing its full parents, or a separately authorized test-fixture creation process. This report does not grant permission for signing or synthetic parent construction.

## Reproducibility hashes

SHA256 of unchanged retrieved full source JSON:
- signing-serialization: `ac09d7366cae3fd8cc1c6e9e68e320ecbc4e064bddfa02604a4991978fa41e93`
- cashtokens: `3cd208b28cc0af68cba15b56087be3dcbd783bd71f39ef6ac53e759a09a4f9bc`
- saved cvs72j row JSON (formatting changed, field values unchanged): `6161ccf6cef640595381110faa60683789cca6bd94a48a8f7a8d74ef6c003937`
