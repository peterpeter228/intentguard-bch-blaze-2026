# Exact remote verification

Source commit: `3000ceba117232ec48780b429d361b8e3e69f737`
Tree: `c218a937461fab9faacee7a77586fa0af873e3e6`
Branch: `feat/preseason-xo-validation-20261104`, private. Main and PR1 unchanged.

All 16 changed files were hashed as Git blobs and SHA-256 before upload. GitHub create_blob returned the expected Git blob IDs. Branch update used the exact prior SHA4e935f7b and force=false. A nontruncated fixed-commit tree was retrieved.

A new empty `bch-clean-3000ceba` snapshot was reconstructed: 16 changed files were downloaded from the exact source commit using base64 content and checked against pre-upload Git blob/SHA-256; 293 unchanged immutable files were reused only after recomputing their hashes against the new remote tree. Every one of the309 files was checked. No changed development file substituted for a remote download.

From that snapshot, `npm run validate` exited0: typecheck/build and169/169tests passed. Dependencies were reused from the installed locked workspace, not newly downloaded. The source snapshot had no dist directory before this build. The manifest and complete command log accompany this report.

Generated bundles:
- request.js SHA256 `ba4ca496c4517a5420bc09f6ab369ee996c8ef8fba88372d915e32f24647aa7f`
- app.js SHA256 `5f9be1ef94f24b1e9e52a92b2cae4f06a8d0085a46c6b1c15bbc3bf1b13fccea`

The existing inspector bundle is byte-identical to the previously tested version. New real browser evidence is separate in browser/QA.md. These checks do not establish wallet behavior, chain state, actual payment or contest compliance. Subsequent evidence-only persistence must be read back and the final complete tree rehashed before reporting final completion.
