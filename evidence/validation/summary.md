# G0 validation — 2026-10-27

PASS: exact npm clean install with lifecycle scripts disabled; strict TypeScript including dependency declarations; actual browser-target SDK bundle; 10/10 Node tests, zero skipped. Commands and full output: setup/clean-install.log and validation/g0-validation.log. Tested files are hashed in validation/input-manifest.json. Remote commit binding is pending coordinator persistence; a future commit is not fabricated.

The test data are SYNTHETIC teaching transactions/address payloads, never funded, signed, broadcast or claimed as chain history. Tests exercise actual Libauth encode/decode/hash, independent Node crypto txid oracle, truncation, token/NFT/bigint preservation, address types/checksum, unpaired SDK state and in-memory transport cancellation diagnostic. No application Guard exists yet. The oversized synthetic value demonstrates codec precision, not a valid spendable chain amount.

KNOWN_RISK: pre-aborted SDK convenience signing calls mock send before cancel. This is a reproduced SDK behavior, NOT a passed production cancellation requirement.

NOT_RUN: actual browser rendering/clicks; wallet/phone; pairing; real signatures; Chipnet; mainnet; provider readback; broadcasts; receipt; application business tests; user adoption; external demo; contest submission.

NOT_APPLICABLE: XO Migrate absent an accessible genuine old application. G0 remains PARTIAL, G1 is NOT_STARTED/PRESEASON, overall project is not complete.

Independent review repeated the 10 tests and a hand-assembled 85-byte synthetic fixed serialization vector. Portable runner: `node evidence/independent-audit/fixed-vector.mjs`. No known public-chain transaction vector is claimed.
