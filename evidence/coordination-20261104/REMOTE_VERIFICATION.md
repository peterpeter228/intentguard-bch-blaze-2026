# Exact remote snapshot validation

Source commit:1c215e20a7b41d22e062b29178a0eb05396f9cc2; tree7dbd1900d14680fae955409bc96fbd65bcf375b8. Constructed a new empty snapshot directory. All38 changed files were fetched as base64 from that exact remote commit, decoded and Git-blob-hashed. The other183 files reused previously downloaded/verified immutable remote blobs from cd0ee718; each was rehashed against the new remote tree before copying. No differing development file was substituted.

All221 repository files match the fetched full, nontruncated remote tree. Per-file Git blob and SHA256 are recorded in remote-manifest-1c215e20.json. The pre-upload hashes for all38 changes also matched the GitHub upload response.

Executed npm run validate in that clean exact snapshot: exit0,109/109 tests, strict typecheck and build. Exact log:remote-validation-1c215e20.log. Dependencies were reused via symlink to the previously installed Node24.22.1 environment, not freshly installed. The manifest/lockfile/source came from the remote snapshot.

Resulting browser bundle SHA256:7a647361af38b98277be90ca243e07c683fbe8f1ac504645c36abb6e67acef80, identical to the independent real-browser QA artifact. This establishes exact tested bundle consistency, not real chain/payment success.

The follow-up commit containing this verification report adds evidence only. No tested source is changed. All new evidence-file bytes are independently hash-checked and fetched back before final status reporting. This follows the corrected integrity procedure documented in the previous repair slice.
