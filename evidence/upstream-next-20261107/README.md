# XO next compatibility maintenance, November 7, 2026

This is a bounded dependency/API maintenance slice on the existing private working
branch, not a novel contract, authenticated Invitation, wallet or payment feature.
The baseline was `61e0895d21ab173a74cf5363a9392d73a3b2314f`.

## Why the change was needed

The official bounty asks developers to use the latest next release. The registry
now reports engine `0.1.1-next.17778370827`, gitHead
`f3b90b41c2ca2302e995895c9a0d029666952abc`, rather than the November 5 observed pin
`0.1.0-next.17612568780`. The bounty wording still names `0.1.0-next.xxx`; adopting
the currently published next is compatibility maintenance, not a guarantee that a
sponsor accepts this version or any submission. Both package versions are MIT.

The new merged-variable type requires `sourceCommitIdentifier`. An unmodified
source substitution failed typechecking in five places, captured in
`new-next-typecheck.log` (exit 2). The five repaired sites map each variable to the
same already explicit local/synthetic source label used by its inputs and outputs.
No new commit or authenticated provenance is fabricated. The two package files
pin this exact engine; the lock changes only its entry and the root dependency.
Utils remains `0.0.10`; its separately published `0.0.11` was not blindly adopted.

## Exact scope and actual checks

- `candidate-source-diff.patch` and `candidate-source-manifest.json`: five narrow
  source/test changes and two dependency files. No Guard, covenant, fee, identity,
  signing, network or receipt code is changed.
- Node `24.22.1`, npm `11.9.0`. Recovered 88 selected baseline source/build/test/
  fixture/document/reproduction files and checked their Git blob hashes. This is
  not a complete repository checkout.
- Fresh baseline `npm ci --ignore-scripts` installed 287 packages. The documented
  native SQLite rebuild succeeded. Baseline typecheck/build and the existing 16
  public-signature tests passed. These use immutable public signed bytes and
  negative mutations, not newly generated keys or signatures.
- Exact engine upgrade used `npm install --save-exact --ignore-scripts`; npm
  reported one changed package. Candidate `npm run validate` passed typecheck,
  build and 253/253 existing tests, 0 failed/cancelled, test time 8.432 seconds.
  Candidate reused the fresh baseline dependencies except that engine replacement;
  this is not a second clean candidate install or GitHub CI pass.
- Independent verification is recorded separately in `INDEPENDENT_REVIEW.md`.
  Do not infer it from the local log.

The normal test suite includes local loopback HTTP and synthetic fixtures; no
real browser, wallet, account, node, chain transaction or receipt is validated by
these results. All authority flags remain false. No actual signing path ran.

## New release does not fix zero outputs

The two official tarball source maps contain 62 sources each. Only
`source/invitation/merge/merge-commits.ts` differs. Encoding and unlocking/signing
context sources are byte-identical; hashes are in `source-comparison.json`.
The new API `mergeInvitationCommitsWithoutResolving` is for incomplete previews,
not supported transaction construction.

The pure reproduction on the new package still emits three outputs through the
unresolved diagnostic path, but two after full output resolution: the zero-valued
data output is dropped. The unresolved path is rejected by our unchanged Guard.
The resolved path equals the original ordinary payment bytes, with canSign=false.
This is `BLOCKER_REPRODUCED_NOT_FEATURE_SUCCESS`, not a successful invoice feature.
Neither the package bump nor this reproduction validates normal signed execution.

`zero-output-result.json` records the initial detached-new-package reproduction
against the exact old core before compatibility edits. Its script is preserved as
`new-next-zero-output-repro.mjs`, which expects the new tarball extracted at
`node_modules/.xo-next-review`. The source-routing adaptation did not change its
diagnostic assertions. It deliberately does not call Engine.create or signing.

## Next material gate

Use one already existing, shareable participant Invitation with exact template,
network and independent pin as described in `docs/VERIFICATION_HANDOFF.md`. No
artifact was supplied this round. New public sample and live transport outcomes
are negative, recorded separately. Preserve real normal-XO, full v2 signed-plan,
strict P2PKH token 0x61, mainnet, demo and human-feedback gates.

No funds were placed in the experimental tranche; its absent recovery and wrong
funding/permanent-lock risks remain. All work is pre-event and must be disclosed.
No external-model review is claimed by this slice.
