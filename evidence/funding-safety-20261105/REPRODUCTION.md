# Reproduction and evidence scope

Base: private work branch `feat/preseason-xo-validation-20261104` at `7f429fe46193f5f1bcc2ec84c32ca4ca29661b09`, verified before work. This local materialization has no `.git`; 118 existing selected source/build/docs/evidence files were independently Git-blob rehashed against its exact remote tree with no mismatch before edits. It is not a full historical repository download.

Environment: Node 24.22.1, npm 11.9.0; pinned dependency directory reused from the Nov 5 reproduction. No dependency/version/lock change and no fresh installation claimed for this slice. Core, UI, old covenant/static template and lab helper bytes are unchanged.

Commands from repository root:

```sh
npm run validate
npm run allowance:test
npm run allowance:funding-demo
node evidence/funding-safety-20261105/independent-review.mjs
```

Definitive local aggregate run: 2026-11-05 03:35:42–03:36:04 UTC; typecheck/build and 246/246 tests passed, exit 0. `VALIDATION.log` is the actual output. npm emitted its existing unknown `http-proxy` environment-option warning; this did not change dependency state or test result. The run used offline/audit/fund/update-notifier flags and a bounded 180-second timeout, not any chain RPC.

Independent reviewer rebuilt the frozen source and passed 23/23 focused tests. Its separate 63 named probes cover input boundaries, exact-index and count binding, token rejection, all successor fee checks, source-only dust failure, immutability and no-authority output. These probes are not added to the 246 formal-test count. `SECURITY_REVIEW.md` records the scope and prior incomplete pre-freeze run honestly.

`CLI_RESULT.json` is the real no-argument demo output. Baseline uses P546, T6, N3: initial reserve4638, beneficiary payments1638, release fees3000, zero remaining reserve; continuations333 bytes and terminal289 bytes, total955. Fees exclude initial funding and later beneficiary spending. Wrong expected count yields PLAN_MISMATCH, invalid remainder CONTRACT_REJECTED, and fee/dust stress LOCAL_POLICY_REJECTED. The CLI accepts no custom input and exports no raw transaction or payment address.

`SOURCE_SHA256.txt` identifies the reviewed source and unchanged contract/dependency-lock bytes. Exact remote readback and clean materialization checks, if completed, are recorded separately in REMOTE_VERIFICATION rather than inferred from this local pass.

No live funding, recovery, chain maturity, beneficiary ownership, signature, normal authenticated Invitation, browser/mobile flow, deployed service or contest acceptance is demonstrated. All authority flags stay false. No image was uploaded, regenerated or retried.
