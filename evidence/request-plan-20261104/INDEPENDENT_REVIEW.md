# Independent review: offline request-to-plan adapter

Date: 2026-11-04 UTC. Scope: `core/request-plan.ts`, its consumer tests, and reuse of the existing request parser, builder and Guard. Source reviewed locally; remote-byte verification is a separate coordinator step. No production source or tests were modified by this reviewer.

## Finding and verified repair

A bounded synthetic counterexample found that changing the selected change script did not affect `requestPlanDigest` when the transaction had no change output. With a 10000-satoshi input, a 9815-satoshi recipient, a 185-satoshi fee and owner allowlist containing both synthetic owner and stranger scripts, selecting either allowed change script returned `REQUEST_PLAN_BOUND_OFFLINE` with the same digest:

`576346ac48933945666a3e5be7b54a03bf9586d3dafe31bb2c9f91e710d62816`

This is not an observed mispayment: the exact transaction has no change output. It is an incomplete binding relative to the intended policy that selected change context changes the request-plan identity. Recommended repair: explicitly bind the selected change script, either directly or through a domain-separated planning-policy digest, and add the zero-change regression test. Do not alter the existing builder solely for this adapter issue.

## Checks already completed

- Independently ran `node --test dist/core/request-plan.test.js`: 15 tests passed, 0 failed before the new regression repair.
- Confirmed the production adapter imports only pinned libauth and existing request parser, Guard and unsigned builder. No fixture import, wallet, signing, network, storage or broadcasting path was found.
- Confirmed strict request-wire revalidation and expected digest comparison precede planning. Scripts and integer amounts are derived again, not imported from display/result data.
- Context fields are explicit offline claims. Plain-data validation rejects accessors, hidden/extra fields, symbols, custom prototypes and malformed arrays; a fresh copy is passed to the existing builder.
- Application invocation time is supplied separately from request/context JSON; expiry and snapshot freshness are rechecked. Caller control of this function parameter remains an integration trust boundary, not cryptographic time proof.
- Owner allowlist edits affect the intent digest; fee policy affects the existing plan digest. Recipient/change overlap and missing ownership claims fail closed.
- All authority flags remain false. Outputs are deeply frozen; failures return no draft, intent, plan or binding. A supplied matching digest proves content equality only, not human review.

## Remaining boundaries

The binding must not be presented as an evidence snapshot fingerprint, receipt, human consent, current spendability, wallet ownership or duplicate-payment protection. Changing request IDs can bind the same transaction plan to multiple request references; that is explicitly content correlation only. No actual wallet, key, signature, transaction, network observation, deployment, submission or browser action occurred in this review. UI is unchanged; no new browser coverage is claimed.

## Final local review result

No unresolved blocking finding was identified within this SDK slice. The coordinator repaired the no-change omission with a domain-separated `planningPolicyDigest` over sorted owner scripts, explicit change script and complete fee policy, included in `requestPlanDigest`. Existing builder logic was not changed for the repair.

The reviewer independently reran the original 9815/185-satoshi counterexample after repair. Both calls still produce the same unsigned transaction and existing plan digest, but the request-plan digests now differ:

- Original owner change policy: `eeaeeabe1927b3144052517834b5ecd1b916bba4beb10972012fd7460e94d495`.
- Alternate allowed change policy: `2df2d2069e4a4d33955f1d07c1fdfa09e89b3458ba176d11dd839a1d98dc74fd`.

Final independent command: `node --test dist/core/request-plan.test.js`, exit 0, 18 passed / 0 failed. The final tests additionally exercise every fee-policy field and explicitly distinguish content identity from snapshot observation identity. The reviewer read `core/REQUEST_PLAN.md` and confirmed those limitations are documented.

The coordinator separately reports `npm run validate` exit 0 with 187/187 tests, typecheck and build, unchanged lockfile and byte-identical existing browser bundles. Those complete-suite/bundle checks were not rerun by this reviewer; the independent execution above covers the final adapter tests and the additional reproduction.

Final locally reviewed SHA-256:

- `core/request-plan.ts`: `e6aafccf008281f292ef8ed74f8ca84606286fd5bdcac24f81cfa6951d62ef62`.
- `core/request-plan.test.ts`: `7f994d61be9467adea3a5f690f3cb504b6cf44fabac84b316a076d3fede21d4c`.

This review is not a comprehensive security audit or a claim of payment readiness. Exact persisted remote bytes still require coordinator verification. Only this review document was written by the reviewer.
