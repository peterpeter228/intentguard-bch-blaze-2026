# Exact remote-source verification

Source commit `56d2086d480b1216e3f36295a87d9f826d35198e`, tree `ba50ab15b2b6ab2bab17e6bce86ee0bd8d0f2c24`, parent `7f429fe46193f5f1bcc2ec84c32ca4ca29661b09` were read from GitHub. All 20 changed/new blobs were fetched back and compared byte-for-byte to the tested files. The complete source tree has 426 files; the other 406 blob identifiers equal the prior tree. No core, UI, original covenant, static template, lab helper or dependency-lock file changed.

A new empty directory was populated with 133 selected necessary source/build/test/docs/evidence files: 20 changed files from actual GitHub blob readback, 113 unchanged files copied locally only after checking their individual Git blob hashes against the exact remote tree. This is not a full 426-file download. Pinned dependencies were reused by symlink, not freshly installed.

The definitive log begins with `/workspace/shared/bch-remote-56d2086d`. `npm run validate` from that directory passed typecheck, build and 246/246 tests at 2026-11-05 03:41:41–03:42:07 UTC, exit 0. The 63-probe independent script reran at 03:42:10.599 UTC; reviewed source hashes and every non-timing result match the recorded independent review. The funding demo JSON also exactly matches the committed expected result. All 133 selected files were rehashed after those runs and still match the remote tree.

An earlier staging command ran validation from the original local directory because its working directory was not changed. That additional local run is not used as remote evidence. The explicit-cwd run above is the definitive fixed-source validation.

This verification does not add wallet, signing, funding, real chain/CSV age, beneficiary ownership, normal authenticated XO Invitation, browser/mobile, deployment or contest claims. No screenshot was uploaded or retried. These three verification records are appended in a docs-only successor commit; the coordinator verifies the final ref and that all source-commit blobs remain unchanged. GitHub check/status results are reported separately and are not inferred from this local verification.
