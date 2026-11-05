# Exact remote-source verification

Verified source commit: `fce079a24d5dcc2bf3ebbd6f52f2654be00043f5`, parent `6f762050eee1c520b6b9f1ffb541c2aaf014a10a`, tree `72c3ac6907e5f8a35307b77995404e5cd1025fcc`.

All 24 new/changed blobs were fetched back from GitHub and compared byte-for-byte with the pre-upload bytes. Full tree has 408 files; the other 384 blob identifiers match the base. Core/Guard/UI and all dependency versions/lockfile are unchanged. Only package scripts changed outside the isolated lab and documentation/evidence.

A new empty selected-source directory was materialized with 24 remotely fetched blobs and 91 unchanged local files, all individually Git-blob hashed against that fixed remote tree. This verifies 115 required source/build/fixture/report files, not a full 408-file download. Historical images and unrelated evidence were not downloaded. Dependencies were reused from the prior pinned Nov5 install, not newly installed.

With npm offline/update-notifier disabled, `npm run validate` completed 03:20:32–03:20:51 UTC, exit 0, typecheck/build and 237/237 tests passed. The separate independent runner repeated 190 valid cases and 17 negative mutations, with identical result/source hashes. The static template again parsed and matched the factory exactly; the CLI output equaled committed CLI_RESULT.json. All 115 selected files were rehashed after testing and still match the source tree.

REMOTE_VALIDATION.log contains the exact command and real output. REMOTE_VERIFICATION.json contains the full selected-file manifest, timing and additional results. This verification evidence is appended in a later documentation-only commit without changing the tested runtime/template/test/package blobs. The final branch head must be separately read back before announcing publication; main and PR1 must remain unchanged. No CI pass is inferred from local tests or a GitHub status with zero checks.

No new browser/mobile validation, normal signed Invitation, chain maturity, live funding, wallet, signature, transaction, deployment, outreach or contest qualification is claimed. All data are synthetic; never fund the experiment.
