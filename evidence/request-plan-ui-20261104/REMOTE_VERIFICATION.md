# Exact remote UI-source verification

Source commit: `8765b83017016c72551dbb6a4836cd677effaee4`.
Source tree: `669363de6eaf81b5480bc6c38a5451e784a541c0`.
Parent: `6de75464d992205602ae2855bf767428d9be3e72`.
Private branch: `feat/preseason-xo-validation-20261104`; main and PR1 are unchanged.

The complete baseline 338-file snapshot was hash-verified before work; the remote branch was reread and still matched 6de75464 before creating new objects. Seventeen changed UTF-8 source/document/test/evidence blobs were created and each returned SHA matched its independently calculated Git-blob SHA. No image or binary evidence was uploaded.

After creating the fixed source tree/commit, all 17 changed blobs were individually fetched and their complete UTF-8 bytes compared with the pre-upload source. A new empty verification directory used those fetched contents plus 329 unchanged blobs, each rehashed from the verified baseline. All 346 files matched the full fixed remote tree, with no truncation or mismatch.

`npm run validate` in that exact remote snapshot exited 0: 207/207 tests, no failures/skips, strict typecheck and build. Dependencies were reused; no clean-install assertion. REMOTE_VALIDATION.log is the actual output, and REMOTE_MANIFEST.json lists every path, Git blob, SHA-256 and size.

The resulting new request bundle exactly matches the frozen artifact exercised in the independent real desktop browser:
- request.js SHA-256: 2161674dfe740e25f82e700048cf282ba4bfea9e1e4f9a1ca07a9c348cde05dc.
- request-ui.ts SHA-256: 6b58bfe55d95076cd705fbaec99183f9035b7d952d54753f5039e19a893ab2c5.
- Existing app.js is unchanged: 5f9be1ef94f24b1e9e52a92b2cae4f06a8d0085a46c6b1c15bbc3bf1b13fccea.
- Lockfile is unchanged: 7f43476aef066c9263c69dd12d97c70594471dc9478471205137e429d0683347.

browser/QA.md records actual final desktop flows, invalidation, real timers, real downloads and original-inspector regression. It explicitly distinguishes non-browser DOM-harness findings, pre-final technical-details checks and unrun mobile/real-payment paths. Only final text/DOM/download/hash records are persisted. No screenshot from this slice, no previously denied image and no substitute encoding was uploaded. The QA server was stopped.

These remote-validation records, final browser evidence and a documentation-only next-action update are persisted in a subsequent evidence commit. Final tree/ref and all additional bytes are checked separately; this record does not invent its own future hash.

This remains pre-event offline functionality with all payment, receipt, ownership and network authority flags false. No wallet connection, keys/signatures, real node evidence, transaction, deployment, public release, external outreach, Argon call or submission occurred.
