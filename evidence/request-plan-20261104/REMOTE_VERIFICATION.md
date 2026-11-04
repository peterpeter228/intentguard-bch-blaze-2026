# Fixed remote source verification

Source commit: `de6c42759e3b79e185045b7374bd42fcd3ac847d`.
Source tree: `8b2b2b076cdda26c3fed6e6ae89c26b771d9f0d3`.
Parent: `e5d91aa2609dea92b454320e226156477a6130b2`.
Private working branch: `feat/preseason-xo-validation-20261104`. Main and Draft PR #1 are not changed by this slice.

The original branch ref and complete remote tree were fetched before work. All 328 baseline files were Git-blob hashed locally and the saved baseline manifest was compared with the freshly fetched fixed remote tree. A separate working directory preserved prior tasks and excluded the two previously restricted screenshots.

Twelve changed UTF-8 source/document/evidence files were uploaded as Git blobs. Every returned blob SHA matched the independently calculated local Git-blob SHA. The new tree and commit were created without a branch mutation. Each of those 12 remote blobs was then individually fetched at its immutable SHA and compared byte-for-byte with the pre-upload content. No screenshot or binary file was uploaded.

A new empty source-verification directory was reconstructed using the 12 freshly read remote blobs plus 323 unchanged blobs from the verified baseline. All 335 resulting files were recomputed against the complete fixed remote tree, with no mismatch. During materialization the patch helper introduced an extra trailing newline; the hash check caught it before tests. Only the extra newline was removed after independently proving that the resulting bytes exactly matched the remote SHA. No altered byte content was accepted as verified.

`npm run validate` in this exact remote source snapshot exited 0: 187/187 tests, 0 failures/skips, strict typecheck and build. Dependencies were reused from the existing installation; no clean-install claim. Actual full log is REMOTE_VALIDATION.log; every path, Git-blob SHA, SHA-256 and byte count is in REMOTE_MANIFEST.json.

Both browser bundles exactly match the previously browser-tested baseline:
- app.js: `5f9be1ef94f24b1e9e52a92b2cae4f06a8d0085a46c6b1c15bbc3bf1b13fccea`.
- request.js: `ba4ca496c4517a5420bc09f6ab369ee996c8ef8fba88372d915e32f24647aa7f`.

These three remote-verification records are added in a subsequent evidence-only commit. They do not change the source tested here; the final branch/evidence persistence is separately checked and reported by the coordinator. This document deliberately does not invent its own future commit hash.

Scope remains an offline SDK integration, not a real wallet/chain/payment flow, receipt, public deployment or contest completion. All spending and verification authority flags remain false. Existing network restrictions and both screenshot refusals were respected. No Argon/API-key call occurred in this slice.
