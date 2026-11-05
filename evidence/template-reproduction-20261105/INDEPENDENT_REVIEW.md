# Independent review: newly recreated zero-value-output reproduction

Reviewed at: 2026-11-05T02:30:41+00:00 UTC.

## Verdict

**PASS as a new, bounded offline reproduction of an output-serialization blocker. NOT feature success, a fix, a valid Invitation, account-flow execution, payment, receipt, or contest qualification.**

The pinned XO encoder treats an unresolved zero-valued template output differently from the same output after completion. The new script establishes this directly with synthetic unsigned candidates and an unchanged plain-payment control. The complete project validation passed independently twice, including a second run with npm offline mode and the update notifier disabled. No production source, package/lockfile, installed dependency, or generated-bundle bytes changed during this review.

The hypothetical ordinary-account implication is supported by source inspection only, and remains conditional on a valid invitation actually supplying this template output. No Engine, account, wallet, authenticated Invitation, key, or signature was created or executed.

## Provenance and scope

- Script reviewed: `evidence/template-reproduction-20261105/zero-value-output-repro.mjs`.
- Script SHA-256: `857d78ee72f04e7f27c2dc3e5a646ef7bce0dfad644bd32c2d374ccc6f32a638`.
- This is **new 2026-11-05 evidence**, not recovered 2026-11-04 historical evidence. The unavailable original nine-file payload/manifest is not reconstructed or claimed recovered.
- The source snapshot is recorded as repository `peterpeter228/intentguard-bch`, commit `53b05b4608c939146e18f9f11ed3b7e44c4592a6`, tree `303f829652a7c4bced08a426547d6a5369780479`. This review independently checked local transferred blob bytes against the recorded tree and transfer manifests, not a fresh GitHub fetch or the commit-to-tree association.
- At 2026-11-05T02:26:44.032227+00:00, all **87 selected files** matched both the recorded Git tree and transferred Git blob hashes. The tree contains **380 blob entries**. This directory has no `.git` and is not a full checkout; historical screenshots and most old evidence are absent. A missing historical artifact is not validated by this run.
- Runtime: Node `v24.22.1`, npm `11.9.0`. Dependency installation and sqlite3 rebuild preceded this review and were not repeated by this reviewer.
- Installed versions: engine `0.1.0-next.17612568780`, templates `0.0.12`, utils `0.0.10`, types `0.0.8`. These match the package lock.
- Installed `node_modules/@xo-cash/engine/dist/index.mjs` SHA-256: `bcab1da31c349b14ba365144acc09e70148a55adbb6beee2cc0f60603dcf7011`.

## Reproduction result and validity

Independent execution: 2026-11-05T02:26:44Z to 02:26:45Z, exit 0. JSON execution timestamp: `2026-11-05T02:26:45.088Z`.

1. The script clones the published P2PKH template and adds a diagnostic `OP_RETURN` containing the public constant `ab` repeated 32 times. This is not an invoice digest or novel product. The fixture transaction graph and owner/merchant scripts are explicitly synthetic, with no current ownership or unspent proof.
2. `completeMergedOutput` resolves that output to value `0n`, the expected `6a20` plus public constant locking bytecode, and no token. All three conditions are asserted.
3. Passing the **unresolved** template output to the pure builder produces three outputs, including the zero-satoshi diagnostic output, in **162 bytes**. Guard returns `REJECTED`, issue `UNSUPPORTED_OUTPUT_SCRIPT`. Candidate SHA-256: `6702bb5b79e1fcd4e320e5b6348b12a3fb32245cfac09dcc54c4aa1ed73e74c3`.
4. Passing the **resolved** output drops it, producing two outputs in **119 bytes**. The entire serialized candidate is asserted equal to the original payment fixture and to the separate plain-payment control. Guard returns `MATCH_OFFLINE`, fee 500 satoshis, `canSign=false`. Candidate SHA-256: `3a53ea3568a1cdd44615abb16c1a2090b9d8c55197c60955bcd2fb637bdb1e56`.
5. Every generated candidate input is asserted to have empty unlocking bytecode. Top-level `canSign`, `broadcastable`, `receiptValid`, `networkVerified`, and `ownershipVerified` remain false.

**Important boundary:** the Guard intent in this test requests only the BCH payment. It does not encode an obligation to preserve the added data output. Its payment-only `MATCH_OFFLINE` result therefore does not verify a missing invoice/data commitment and is not a demonstrated Guard-policy bypass. The unresolved path is a deliberately synthetic lower-level API input, not proof that ordinary account execution preserves this output.

The added output is a diagnostic modification of a reference template. Parse/compile/serialize success does not establish authenticated participation, semantic acceptance of an Invitation, script spendability, consensus/relay acceptance, a usable product, or event eligibility. The encoder's wider `<= 0n` behavior is visible in source; this reproduction exercises exactly zero, not negative values or every zero-output type.

## Installed-source trace

Reviewed actual installed engine source, not a reconstructed implementation:

- Lines 5479–5507, `completeMergedOutput`: fills omitted template value and locking bytecode; zero remains explicit `0n`.
- Lines 5545–5554, `resolveMergedOutputs`: calls completion for every merged output.
- Lines 5737–5753, `mergeInvitationCommits`: resolves outputs at 5744 and returns them after index ordering.
- Lines 5864–5871, `getMergedInvitationOrThrow`: loads the stored invitation/template and invokes `mergeInvitationCommits` at 5870.
- Lines 6070–6074, `executeAction`: gets that resolved merged object, then calls `buildInvitationTransactionFromMergedCommit`.
- Lines 5946–5947, `buildInvitationTransactionFromMergedCommit`: invokes the encoder.
- Lines 5899–5919, `encodeMergedInvitationTransaction`: line **5905** skips an output when `valueSatoshis` is defined and `<= 0n`; line **5910** completes unresolved outputs only after that check. It does not rerun the skip check on a newly completed output.

This proves the ordering discrepancy in the pinned implementation. It supports the conditional inference that an eligible normal merged invitation carrying this diagnostic output would encounter the drop after resolution. This review did not call `mergeInvitationCommits` with an authenticated invitation, `getMergedInvitationOrThrow`, or `executeAction`, and does not establish that a complete valid account flow reaches the encoder with this exact fixture.

## Commands and validation

Working directory for the following exact command lines:
`/workspace/shared/bch-reproduce-20261105`

Reproduction:

```sh
timeout --kill-after=5s 30s node evidence/template-reproduction-20261105/zero-value-output-repro.mjs > /workspace/shared/bch-recovery-20261105/INDEPENDENT_REPRO_RESULT.json 2> /workspace/shared/bch-recovery-20261105/INDEPENDENT_REPRO_STDERR.log
```

First independent full validation, 2026-11-05T02:27:02Z to 02:27:23Z, exit 0:

```sh
timeout --kill-after=10s 180s npm run validate > /workspace/shared/bch-recovery-20261105/INDEPENDENT_VALIDATION.log 2>&1
```

Second independent full validation, 2026-11-05T02:28:09Z to 02:28:29Z, exit 0:

```sh
npm_config_offline=true npm_config_update_notifier=false npm_config_audit=false npm_config_fund=false timeout --kill-after=10s 180s npm run validate > /workspace/shared/bch-recovery-20261105/INDEPENDENT_OFFLINE_VALIDATION.log 2>&1
```

Both completed strict TypeScript checking, TypeScript/esbuild builds, and **223 tests passed, 0 failed, 0 cancelled, 0 skipped, 0 todo**. No tests or production implementation were edited. Existing tests use loopback HTTP services, synthetic transports/state, and read-only checks of public historical signature fixtures. The mocked signing diagnostic overrides its send/cancel transports; it does not sign or connect to a wallet. The script itself calls only pure local compilation/construction/verification helpers and reads installed package metadata. No public application API, wallet, broadcast, deployment, screenshot, GitHub write, or external-model operation was intentionally invoked.

The first npm invocation printed an update notice. The second disabled npm notifier/audit/fund behavior and enabled npm offline mode. This review did not capture network syscalls, so it does not make a packet-level assertion that the first npm invocation made no background registry request. No live chain/network result is claimed from either run.

Source inspection command used:

```sh
nl -ba node_modules/@xo-cash/engine/dist/index.mjs | sed -n '5455,5590p;5705,5775p;5840,5985p;6050,6135p'
```

Integrity checks independently recomputed Git blob IDs as SHA-1 of `blob <byte length>\0<bytes>` for every transferred entry and compared them with `BASE_TREE.json` and `transfer/*.json`. Before/after SHA-256 snapshots covered every file under `core`, `preseason`, `probes`, `node_modules`, and `dist`, plus AGENTS/README, package/lock/tsconfig, and the reproduction script. The raw snapshot/check results are `INDEPENDENT_BEFORE.json` and `INDEPENDENT_AFTER.json` in the recovery directory.

## Unchanged bytes and browser limits

At 2026-11-05T02:28:54.885575+00:00, **7,459 protected files** were byte-identical to the pre-review snapshot, including dependencies and all generated files. Aggregate SHA-256 of the sorted path/hash records before and after: `de8c4b43e9fc17b2ad8f46f8340b32af12759eee99f2ed24b78aa9afbc7b3a0d`.

Of the 87 selected baseline files, only the coordinator's three explicitly planned append-only documentation updates differed: `docs/STATUS.md`, `docs/DECISIONS.md`, and `docs/NEXT_ACTION.md`. The remaining 84 matched their recorded original Git blob hashes. This reviewer wrote only this report in the project and temporary review logs/snapshots outside it.

Current browser-bundle SHA-256:

- `dist/core/app.js`: `a92c8246d13df66e0dd415adc0fbd198a7bb2c248d3ba190f1ac1480ab24931a`.
- `dist/core/request.js`: `5f0d9ea63ec513af4f00dc664ad25474ae14392bc522dd3ed61b01aeb519667c`.

These hashes agree before/after this review, **not with historical browser-tested build hashes**. The coordinator reports that the historical hashes differ. Current esbuild output visibly embeds module-path comments such as `// node_modules/@bitauth/libauth/build/lib/format/error.js`, so build layout can affect bytes, but no historical bundle bytes were available to prove that is the actual cause. No new browser QA, historical-bundle equivalence, or screenshot verification is claimed.

## Review log hashes

- `INDEPENDENT_REPRO_RESULT.json`: `a1a69b602b19bbd483977492911816c711bd785d4f796c51fc03e14f7f4b2730`.
- `INDEPENDENT_VALIDATION.log`: `ef98748d1035104fd55fab7131a1fa0f3c4f792763ee8f3d9e4aa783ec399324`.
- `INDEPENDENT_OFFLINE_VALIDATION.log`: `5769927757026552267e89e11d50fdbcd95927dd749daf8b0c0bcc58b0799da0`.
- `package.json`: `b5df59e88dfbae8edb920a6641733fe743a821e037c8628ab812f3e40efd3b34`.
- `package-lock.json`: `7f43476aef066c9263c69dd12d97c70594471dc9478471205137e429d0683347`.
- `tsconfig.json`: `8bdfe97725216da83aaf07fcdb51743877a9e56dc7f4206a7fb0c5ba746e2e58`.

No corrective production patch was made or recommended as already validated. The zero-output commitment path remains blocked, and all real-wallet, authenticated-Invitation, chain, receipt, UI-verification, and submission gates remain open.
