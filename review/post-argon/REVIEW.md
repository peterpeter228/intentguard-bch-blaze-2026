# Post-Argon independent review — 2026-10-27

Scope: one already-completed external review, followed by bounded official read-only evidence checks. No new model call, project source changes, wallet, signing, publishing, outreach or agreement acceptance.

## Disposition
- Accept G0 PARTIAL and NOT_RUN wallet/mainnet/qualification distinctions.
- Argon did not execute commands; its compile/test statements summarize supplied logs. Lockfile metadata/hash is not full independent content validation. Root's local 10-test rerun is separate evidence.
- Missing G1 product functionality is intentional preseason scope, not an unexpected defect in the G0 slice.
- Abort diagnostic means pre-aborted request sends through the overridden hook before cancellation. Do not characterize as actual unauthorized signing/broadcast or wallet exploit.

## WizardConnect license evidence resolved beyond npm metadata
Fresh official registry responses identify exact gitHead for core0.2.5/dapp0.2.2/react0.2.3. Their tarballs were fetched and SHA1 matched registry shasum; no LICENSE/COPYING paths occur in those tarballs. Registry license fields remain null.

Official GitLab project 80015883 tree identifies LICENSE.txt. At all three exact gitHead revisions, GET of LICENSE.txt returns HTTP200 and the same GNU Lesser General Public License, Version 3 text. Exact URLs, source hashes and package provenance in license-evidence.json; license text preserved alongside this report. These are substantially stronger facts than “npm license null”. Do not describe the packages as having no license.

Registry-provided npm provenance payloads point to the same gitHead. They were decoded as source evidence, not independently cryptographically verified; this is not a SLSA verification claim. No statement is made that all dependencies or the resulting application satisfy redistribution obligations. Exact license application, notices, source/relinking obligations, third-party dependencies and any 'or later' grant require concrete distribution review before public delivery. This is evidence, not legal clearance.

Initial direct /LICENSE requests returned404 because actual filename is LICENSE.txt; those failures were not proof of absence. No access control was bypassed.

## XO namespace correction
Argon's @xo-cash/templates@0.0.1 is correct for the actual published template smoke probe: official registry endpoint returns200 and repository GeneralProtocols/xo/templates. @xocash/templates@0.0.1 returns404. Do NOT replace that name with @xocash merely because engine/types/state use the latter namespace.

The real defect is a missing reproduction prerequisite: `node evidence/xo/inspect-published-template.mjs` requires exact @xo-cash/templates extraction into the relative directory specified by REPRODUCE.md. Root npm ci alone does not install that package. Its output only checks module import/action references, not full schema, engine, wallet or chain execution.

## Conclusion
License discovery improves G0 evidence and removes the claim of total license uncertainty. It does not release distribution, G0 wallet/qualification gates, or G1. Preserve the original Argon answer and append this disposition rather than silently rewriting it.
