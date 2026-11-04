# Request-plan SDK scope

Baseline: private branch feat/preseason-xo-validation-20261104 at e5d91aa2609dea92b454320e226156477a6130b2, remote ref reread on 2026-11-04. Actual Git tree a104b1b5e1398b946d2f8405b34270dc438e88da. All 328 retained files were locally Git-blob-hashed against the complete fixed tree before work. Working snapshot is separate from earlier task directories; dependencies are reused, not freshly installed.

Chosen core gap: the validated request page/SDK and deterministic builder were previously separate. The new SDK maps exact reviewed request terms to a plan and binds their digests without granting payment authority. Request/context are separate; no teaching fixture is a production default. Browser source is unchanged.

Independent review found that a no-change transaction did not originally bind a changed changeScript. This is not a current wrong-output exploit because no change output exists, but failed the intended policy-provenance invariant. Added an explicit planningPolicyDigest and regression test rather than modifying or weakening the old builder. Final verification is recorded separately.

No wallet connection, key/signature generation, real-chain request, transaction, deployment, public release, outreach or contest submission occurred. The two previously restricted screenshots are absent from this working snapshot and will not be uploaded or retried. No new screenshots are needed for this SDK-only slice. Existing true-chain, authenticated ownership, v2 signed-positive and token0x61 gates remain open.
