# Exact remote XO source verification

Source commit: `2586149e830bd05d7d78ab1f89964d4f18e4ccbd`.
Source tree: `d392543669ebadc9c2d4b086b5daf8b1b185ae64`.
Parent: `645240141568660db9960c15729d5085617e71b1`.

The branch was freshly read and matched the parent before object creation. All 20 changed UTF-8 source/document/test/evidence blobs returned the independently computed Git blob SHA. After the fixed source commit was created, all 20 blobs were fetched and their complete text compared byte-for-byte with the upload source.

A new empty verification directory combined those exact contents with 352 unchanged baseline blobs. Each unchanged and changed file was independently rehashed; all 372 files matched the complete fixed remote tree, which was not truncated. No previously denied image, new screenshot, binary or substitute encoding was uploaded.

`npm run validate` in that exact remote source snapshot exited 0: strict typecheck, bundles and 223/223 tests with zero failures/skips. REMOTE_VALIDATION.log is the actual output; REMOTE_MANIFEST.json records every path, Git blob, SHA-256 and size. Dependencies were reused, not freshly installed.

Frozen artifact identity:
- request.js: `baa9c564fbecd4e5edccdb531dc677462991d74f522746a74104223d74a3b441`
- request-ui.ts: `60ea7e8ef2187e759576114397a96255db4c22c85e3be22aec4097004cc0d1b1`
- xo-candidate.ts: `82c14bdec032ec2ce9730f79a4074c609247bbe44b931757aa1ef0b626b95178`
- server.ts: `fc5bdfe9db7593c3f57c3428ba487b000323f99d258cfa2fe6dab17f9771448f`
- Existing app.js remains `5f9be1ef94f24b1e9e52a92b2cae4f06a8d0085a46c6b1c15bbc3bf1b13fccea`.
- Lockfile remains `7f43476aef066c9263c69dd12d97c70594471dc9478471205137e429d0683347`.

Final real-browser results are recorded separately under browser/QA.md, including scope and unrun stages. These remote records and final text-only browser evidence are persisted in a subsequent evidence commit; its complete tree/ref and added bytes are checked separately. This document does not guess its future hash or claim nonexistent CI results.

The successful computation is actual official XO template compilation, but all funding/ownership/unspent claims are still offline. No accepted Invitation, new contract, keys, signatures, Engine account, node evidence, transaction, receipt, public demo, deployment, outreach, external-model call or entry submission is established.
