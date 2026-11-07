# One new public sample clue, not an expanded fixture search

Parallel surfaced Paytaca CashTokens Studio `sample_built_txs/`. A bounded
read-only inspection found no usable new signed fixture.

- Current pinned commit `ed3868823ae44b1f258ea1ea52d4f535da379a16` has no such
  directory. It was removed by commit
  `2822c65969fa7b081501c0a09e42222bc0245841`.
- Immediately before removal, the only file was
  [build-genesis-input.ts](https://github.com/paytaca/cashtokens-studio/blob/67669ec3bbe36aaa40cf744bb8cb6366dad243a4/sample_built_txs/build-genesis-input.ts),
  blob `addb5d65054ecda4c8abdd229724c3258dfc0fa8`.
- Its version-2 transaction is unsigned (`unlockingBytecode: []` and serialized
  input script length zero). Parent output metadata is claimed, not a complete
  raw parent transaction. `token` is undefined, and no signature/sighash exists.
- A second snippet explicitly says it is unrelated, and also provides no full
  parent or signature. It cannot fill the v2 full-plan or token 0x61 positive gate.

No source fixture was copied into the verifier, no signature was altered into a
claimed positive, and no wallet/key/signing operation ran. Stop this search branch.
