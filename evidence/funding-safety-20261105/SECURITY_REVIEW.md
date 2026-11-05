# Independent offline funding inspection review — 2026-11-05

## Result and scope

Final frozen-source build, focused tests and independent probes passed. No source-selection, planned-value, token/NFT, output-redirection or authority-promotion bypass was found in this bounded review. This is engineering evidence for an **offline synthetic diagnostic only**, not production security certification. **Never fund this artifact.**

The coordinator supplied base commit `7f429fe46193f5f1bcc2ec84c32ca4ca29661b09` and separately reported a 118-file baseline byte verification. This directory has no `.git`; this reviewer did not independently establish that remote commit binding. Local reviewed bytes are identified below. No runtime source was edited by this reviewer.

## Actual checks

`npm run build` passed, including TypeScript compilation and existing browser bundles. `npm run allowance:test` passed **23/23** existing and new focused tests. Logs: `REVIEW_BUILD.log` and `REVIEW_ALLOWANCE_TESTS.log`.

`node evidence/funding-safety-20261105/independent-review.mjs` completed successfully at **2026-11-05T03:36:54.372Z**. This reusable script executed 63 named probes, not 63 additional formal test cases. The result JSON records each actual status, metrics, elapsed time and reviewed hashes. Meaningful assertions include:

- Successful exact three-step depletion, terminal minimum payout, maximum N/payout/delay, and selected output index 2 among unrelated parent outputs. A wrong but existing output is rejected.
- Planned N 1/2/4/100 against actual N3 rejects; zero, remainder, over-cap and maximum uint64 source values reject. Expected payout/delay script changes reject.
- Fungible tokens and NFT-only sources with each capability, including empty commitment, reject.
- Negative/fractional/nonfinite/missing indices, oversized/malformed/trailing-byte parent data, unknown symbol fields, accessors at root/parameters/policy, nonplain objects and malformed rates reject. Getter bodies are not executed.
- Three-step baseline is exactly 955 bytes total (333-byte continuations, 289-byte terminal), pays 3000 sat, charges 3000 sat total and leaves no reserve. At minimum fee rate 3003 sat/kB, headroom reaches exactly zero. At 3004, exactly the two continuations fail; at 3461, all three steps fail. Every payout dust failure is counted; zero policy is rejected.
- Reports, nested metrics/policy and limits are frozen, all nine authority flags remain false, and raw input/output transactions, scripts and addresses are not exported.
- The maximum-count/payout/delay probe took 1274 ms in this run. This is an observed bounded local cost, not a service-level or adversarial-Proxy guarantee.

## Findings and disposition

1. **Initial selected-source dust was omitted in an early draft. Fixed and independently reproduced.** The coordinator identified N1/P550000 at dust policy1000000: source551000 is below P2SH32 dust576000, while payout550000 exceeds P2PKH dust546000. Final result is `LOCAL_POLICY_REJECTED`, `sourceBelowDust=true`, no successor dust failures, with the exact576000 threshold. This is correctly a local funding-admission failure, not a claim that an existing dust coin has no consensus release path.
2. **Policy minimum and permanent-loss language strengthened before freeze.** Final rates require canonical positive integer strings1..1000000. Report limits explicitly retain inaccessible-beneficiary risk, unauthenticated provenance, unverified normal Invitation execution and unvalidated parent inputs/other outputs/funding fee. Fixed fee1000 is checked for every successor; total fee is bounded by N≤100 rather than a caller-controlled fee amount.
3. **Source and lineage binding are explicit.** Source review confirms canonical decode/reencode; actual selected script/token/value checks; actual N derived from amount; exact planned N comparison; pinned official XO output/transaction construction at every step; comparison of actual child hash/index against the preceding serialized parent; standard libauth VM verification with that actual source; and complete successor fee/dust accounting. The first selected index need not be0; only subsequent reserve index is0. Lower-level stateless VM checks alone are not treated as parent authentication.
4. **No recovery is added.** Wrong nonmultiple/out-of-range/token funding can remain permanently locked. An inaccessible beneficiary cannot be repaired; immutable fees and future policy changes can make progress impractical. Unsolicited deposits cannot be prevented by this inspector. Valid but unintended tranche multiples are distinguished from amounts with no covenant release path.

## Limits and untested claims

No browser/UI was added or exercised here. No wallet, key, signature, account, RPC, live funding, maturity, unspentness, mempool acceptance, chain inclusion, payment receipt, authenticated Invitation, automatic follow-up, deployment, contest qualification or external model review was performed. Caller-supplied bytes are not authenticated as synthetic and are never chain evidence. Initial parent transaction validity, its fees and unrelated inputs/outputs are intentionally not checked. Plain-object validation is not a hostile-JavaScript-Proxy sandbox. Dependency compromise and all consensus/network environments are outside this review.

An early pre-freeze probe run completed its assertions but failed while hashing the not-yet-created test file. It was not counted as a successful run. The final rerun above rebuilt frozen source and completed without that error. No existing Guard or covenant behavior is loosened by this work.

## Reviewed SHA256

- `preseason/allowance/funding.ts`: `20d1c85fdc25045951fbd958645ef493166a663f29eff023ab1b8d25157935d0`
- `preseason/allowance/funding.test.ts`: `7ca2f278b3c5868335f9219c63a6c56509231e02b11ad9085a4f913b8954e3b3`
- `preseason/allowance/funding-cli.ts`: `874455de7bc77f3703cfcad61618d719af419d68c691ca1620080f7488df2b78`
- `preseason/allowance/funding-cli.test.mjs`: `b543ae779616ab5194574e5d4de488c9aba485044bfc7c385fa5a2d3a5c71a3e`
- `preseason/allowance/template.ts`: `c8f034bed191baab8f13fd4e13411b1c477fcc23f2792010c32e9ac738a5901d`
- `preseason/allowance/lab.ts`: `f3228f76153ad18b82d101a17e0cc939e8b9a6e6c360f01a79d0d52aa56b4d32`
- `package-lock.json`: `7f43476aef066c9263c69dd12d97c70594471dc9478471205137e429d0683347`
- Independent probe: `01e84d656ef790166cd4e5a7d8c5bffce74ad676aa07a848864ca32822b9a63f`
- Independent result JSON: `a15f7e82d1f1ad9aa93606eb0bf815311a61ee9e3d05c681ef3c9a075e97d932`
