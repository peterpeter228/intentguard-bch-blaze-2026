# IntentGuard BCH — G0 T05/T06 independent feasibility review

Observed 2026-10-27 08:35–08:38 UTC. Scope: read-only official sources and isolated published example inspection. No wallet, keys, signing, broadcast, registration, fees, project dependency edits or contact. This is preseason work, not a completed XO integration or a demand-validation result.

## Decision

T05 PARTIAL / XO optional deferred. T06 research preparation completed, external demand UNVERIFIED. Preserve WizardConnect mainline. Do not report a valid Invitation, successful Debug Tool import, wallet compatibility or bounty eligibility.

## Actual evidence

1. Registry responses (URLs, timestamps, hashes in `sources.json`) confirm deprecated `@xocash/stack` and engine0.0.1's exact state0.0.2/types0.0.1/utils0.0.1 dependencies. Latest state0.0.5 instead requires types0.0.8/utils0.0.10. Mixing latest package names is not a tested closure.
2. Published types0.0.1/templates0.0.1 archives downloaded from registry-declared tarball URLs; SHA1 matched registry. SHA256 receipts in `package-inspection.json`. MIT licenses present. No lifecycle script ran; only data-export module imported.
3. Official P2PKH example import passed; nine transaction-bearing action references resolve. Its sign/verify actions have no transaction, so they are reported not-applicable for this narrow check. Initial smoke incorrectly required every action to have a transaction; corrected test to scope reference checks to declared transaction fields. This is NOT official schema validation. Raw versioned type declarations and template are readable locally.
4. `inspect-published-template.mjs` reproduces this limited inspection. `template-smoke-result.json` and log give actual output. No fabricated invitation/schema file created.
5. Official site tools and playground are reachable through web reading. Playground still shows deprecated @xocash/stack, so it is not evidence for current engine. The Writing Templates article explicitly defers validation/tool instructions to a later article. No verified current Debug Tool deployment + source commit + lockfile was established within this bounded pass. Not finding it here is not proof no such tool exists.
6. Official FT Request article already describes role assignment, variable requirements, resource reservation, human authorization and execution. Repackaging that sequence is not a new contribution.

## Existing alternatives and counterevidence

- XO P2PKH FT request already models payment requests and participant consent. IntentGuard must demonstrate independently frozen user intent compared against actual candidate transaction and post-sign result, not duplicate an amount form.
- WizardConnect provides wallet request/response, cancellation and reconnect semantics. It is the wallet transport, not evidence that arbitrary application intent is independently enforced. Specific wallet support must be tested rather than inferred from protocol documentation.
- CashScript TransactionBuilder already provides absolute/rate fee caps, token burn protection and explicit token-change helpers; NFT change needs explicit handling. Avoid claiming all SDKs lack these defenses. Potential differentiator is a builder-independent boundary checker plus evidence provenance, still a hypothesis.
- Base libauth/schema tooling and wallet human confirmation are credible lower-cost alternatives. No multiple-user pain, willingness-to-pay or adoption evidence was collected. Commercial confidence remains unknown.

## Proposed falsifiable gates

Resume XO after P0 works and a canonical official tool/source commit/lockfile can be pinned. In one bounded isolated session: reproduce unmodified official example; identify exact schema/runtime validator; validate example and deliberately malformed action reference; create/import a non-sensitive Invitation without invented fields. Stop/defer if closure or validator cannot be reproduced. Do not introduce escrow solely to create follow-up behavior. Chain execution remains separately authorized and separately recorded, never inferred from import success.

For distinctiveness, later feed equivalent correct/mutated candidates from two independent builders into the same guard; rejection must come from decoded transaction versus frozen intent, not UI metadata. If existing SDK features already fully cover the proposed gap for target users, narrow or drop the separate product claim.

## Human interview questions (draft only, not sent)

1. Show the last BCH/CashTokens payment integration you implemented: where did validation and reconciliation take time?
2. Which existing SDK/wallet checks caught errors, and which concrete error escaped? Can you provide a redacted reproducible input?
3. How do you verify recipient, token category, change ownership and fee ceiling before and after wallet signing today?
4. Would an independent verifier reduce work relative to your current tests? Which integration/API requirement would make it unusable?
5. What proof would you need before relying on it? Would you use a local open-source library only, or pay for support/hosted receipts? Ask for rationale, not a leading positive answer.

No answers or users are invented. These are not XO personal feedback; user must write that feedback independently from actual experience.

## Primary sources

- https://stack.xo.cash/
- https://stack.xo.cash/tools/primitives.html
- https://stack.xo.cash/playground.html
- https://stack.xo.cash/blog/2026-08-24-Vision-to-Reality-6-Writing-Templates
- https://stack.xo.cash/blog/2025-10-16-Vision-to-Reality-P2PKH-Fungible-Token-Request
- https://registry.npmjs.org/@xo-cash/engine/latest
- https://registry.npmjs.org/@xo-cash/types/0.0.1
- https://registry.npmjs.org/@xo-cash/templates/0.0.1
- https://docs.riftenlabs.com/wizardconnect/protocol/
- https://cashscript.org/docs/sdk/transaction-builder

Full downloaded HTML and package archives are local research inputs, not proposed wholesale repository upload. Integrator should persist this review, compact receipts and the smoke script/results with provenance; do not silently vendor all downloaded content.
