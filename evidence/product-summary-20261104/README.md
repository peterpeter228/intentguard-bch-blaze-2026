# Parent-bound public fixture and readable payment summaries

Continue1a9f24a2 with two meaningful deliverables rather than expanding synthetic success claims.

1. Shared parent-bound cryptographic verifier: unchanged official Trezor historical child consumes two outputs of the complete published parent. Parent txid/outpoints and both signatures verify. This is version1 and is not rewritten into the version2 deterministic builder; the high-level plan-positive gate remains open. New resolver is reused by the high-level verifier, with duplicate/missing/tampered parent rejection tests. Public data/provenance/original notices are in evidence/signature-positive-20261104.
2. Human-facing summaries: comparison results and unsigned plans now explain requested recipients, exact raw token units/category, owner change, fees, incomplete evidence and refusal reasons before optional technical JSON. Text is rendered using textContent. Edits, clear and invalid input invalidate summaries and downloads. No signing or payment control added.

Local npm run validate: exit0,157/157 tests, typecheck/build. See local-validation.log. Independent review and actual browser evidence are recorded separately. No wallet, key generation, signing, transaction, deployment, publication, outreach or contest submission occurred.

A bounded scan of official BCHN1300 signing-serialization vectors and946 CashTokens vectors did not establish a strictP2PKH token/0x61 positive. Labels describing a main test script are not evidence of auxiliary-input flags. The saved cryptographically valid complex token vector is deliberately not accepted by this application's narrow payment policy. No further broad scan is justified without a new specific source.

Independent review found source-output serialization could precede input/script bounds in the new parent-bound API, allowing memory amplification. Fixed before persistence: input/output caps and duplicate outpoint checks now run before parent resolution; each source must already be supported P2PKH and non-NFT before encoding. Small safe regression cases verify early rejection. No large allocation exploit was executed.
