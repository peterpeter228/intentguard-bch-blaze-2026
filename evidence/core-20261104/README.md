# Core milestone evidence — November 4, 2026

User instruction: “你现在先做核心开发”. Core implementation began after 13:22 UTC against private remote baseline 4bf2d146c701822526faa0622dd26772dc18c705. This is pre-event development; no Git dates or eligibility assertions are manufactured.

Actual commands: npm run typecheck; npm run validate (strict typecheck, builds including browser module and 47 tests); npm run core:demo. All exit 0. See validation.log and demo.json.log. Sixteen core tests add business validation to the prior 31 tests; counts alone are not qualification evidence.

Core checks cover exact BCH/token recipient outputs, unauthorized change, total fee, missing/altered parents, wrong/stale/future evidence, duplicate/foreign inputs, overlapping recipient-owner roles, token burns/mints/categories, NFTs, expiry, unsupported scripts/sequence/locktime, strict amount parsing and structural post-wallet changes. Every transaction/signature byte is synthetic and unbroadcast. The structural comparison test's dummy unlocking bytes are deliberately NOT valid signatures.

Independent read-only review found overlap/undeclared-token concerns and the ambiguity of naming an incomplete transaction commitment. These were fixed by rejecting overlap/undeclared categories and explicitly naming structuralTransactionDigest. Complete consent/network/source binding, fee-rate policies, live provenance and signature verification remain open. No security audit guarantee is claimed.

Browser verification is separately recorded under browser/ when delivered by the independent tester. Do not infer visual QA from build/test logs or prior XO-lab screenshots. This local UI is port 8788, not the earlier port 8787 XO inspector.

No keys, wallet connection, signing, transactions, deployment, publication, contest submission or outside communications occurred. No dependencies were added and no paid services used. G1 is IN_PROGRESS: the pure comparator is implemented, while the full payment/receipt lifecycle is not.

Actual browser testing caught a runtime failure missed by build/HTTP tests: libauth's WebAssembly initialization was blocked by the local server CSP. The fix permits only wasm-unsafe-eval for the bundled cryptography; JavaScript unsafe-eval remains disallowed, connect-src remains none, and no external resource is introduced. Browser tester must restart the server and verify the corrected final bundle. This is why a build pass is not a UI pass.

A static-server regression test now verifies the actual response permits WASM but not JavaScript unsafe-eval or connection requests, and rejects POST/unknown paths. It preserves the browser-discovered CSP fix; it does not replace visual verification.

Final real desktop browser QA passed after the CSP correction: original comparison, all five altered/incomplete scenarios, edit invalidation, malformed input, reset, actual downloaded-report inspection and reload/re-run. See browser/QA.md. Mobile viewport remains NOT_RUN because Chromium organization policy blocked responsive developer tools; no bypass attempted. The tester's local Git HEAD is a synthetic checkout checkpoint, not the remote project baseline; the final remote commit is bound to the SHA-256 identities recorded for tested source/bundle.
