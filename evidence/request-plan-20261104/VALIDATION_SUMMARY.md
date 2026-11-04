# Local SDK validation

2026-11-04. Base source: e5d91aa2609dea92b454320e226156477a6130b2. New request-plan adapter only; no existing runtime source or browser UI changed. Node v24.22.1, npm 11.9.0. Existing node_modules reused, no new dependency installation or lockfile modification.

`npm run validate` exited 0: strict typecheck, TypeScript/esbuild builds, and 187/187 tests with 0 failures/skips. This includes 18 new SDK consumer tests. Actual log: LOCAL_VALIDATION.log. Independent review and repaired no-change-policy case: INDEPENDENT_REVIEW.md.

Compiled browser SHA-256 values match the earlier actually browser-tested baseline exactly:
- dist/core/app.js: 5f9be1ef94f24b1e9e52a92b2cae4f06a8d0085a46c6b1c15bbc3bf1b13fccea
- dist/core/request.js: ba4ca496c4517a5420bc09f6ab369ee996c8ef8fba88372d915e32f24647aa7f
- package-lock.json: 7f43476aef066c9263c69dd12d97c70594471dc9478471205137e429d0683347

No new browser flow or fresh browser pass is claimed. This SDK is not wired into the browser request page. Mobile, real authenticated wallets, real node evidence, signatures/signing, transactions/receipts, public deployment and contest submission were NOT_RUN. Synthetic fixtures remain explicitly synthetic; no network or screenshot restrictions were retried or bypassed. Exact final remote reconstruction/validation is recorded separately, not inferred from this local run.
