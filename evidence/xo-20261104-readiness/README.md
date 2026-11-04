# Preseason readiness review, 2026-11-04 13:01–13:04 UTC

Starting remote head: ca322c1ac1c5b37da4ee157806351edd618a3f14 on feat/preseason-xo-validation-20261104. This review does not change application code or claim a new product milestone.

## Fresh official checks

- https://bchblaze.cash/schedule/ still lists hacking November 14–22, final submission November 22 14:00 UTC, and next workshop November 7 14:00 UTC. These are Beijing November 22 22:00 and November 7 22:00 respectively.
- https://bchblaze.cash/bounties/ still requires a novel functional XO template, a real Chipnet or Mainnet transaction and its inspectable Invitation, reproduction instructions, and personally written development feedback. Feedback must not be AI-written. Offline schema tests do not meet these deliverables.
- https://registry.npmjs.org/@xo-cash%2fengine: next remains 0.1.0-next.17612568780, matching our pinned dependency. latest is 0.0.1 and is not the required next line. This is a point-in-time observation, not a permanent version guarantee.
- https://blaze.xo.cash/ is accessible. Its public HTML identifies it as an XO developer wallet/debug tool. Only the HTML and three linked static application bundles were inspected: assets/index-DJhdeiJ8.js, assets/invitation-CLGmRD3p.js, assets/home-Bkz1LyJj.js. No compatible static signed Invitation was identified in these bounded reads. This is not proof that none exists elsewhere. No app wallet was created/opened, no private state read, and no browser execution or chain verification is claimed.

## Blocking evidence, not more test counts

The missing positive reference is a complete public template plus unmodified signed Invitation compatible with the pinned schema/engine and independently known expected validation results. The prior fixed-commit official example remains an incompatible negative fixture, not positive proof. Do not add timestamps, recompute hashes, invent signatures, or suppress validation to make it pass.

The unsent precise source request remains in ../xo-20261104-followup/PUBLIC_FIXTURE_SEARCH.md. Sending it requires separately authorized outreach. Alternatively an existing public compatible fixture or user-provided approved fixture can close this gap without signing.

## Official rules versus project strategy

November 14–22 is the official published build window. Our choice to defer G1/core payment implementation until that window is a recorded project strategy in docs/DECISIONS.md. It must not be represented as proof that the organizer prohibits every form of pre-event work. Current laboratory code is explicitly pre-event; any prior-project approach must transparently disclose its baseline and comply with confirmed event rules. No strategy change was made in this review.

## Exact remaining preparation

1. Participation evidence: registration was previously confirmed and user reports Telegram joined; introduction/roll-call evidence still unverified here. Attend the published November 7 workshop and preserve genuine roll-call evidence. Do not claim attendance from a reminder or group membership.
2. XO technical evidence: obtain the compatible public signed reference, then verify the valid case and tampered-signature rejection unchanged. Do not repeat empty fixtures as progress toward contract novelty.
3. Product gate: G1 remains not started; core intent/transaction comparison, wallet behavior, real-chain evidence and public demo are separate unfinished gates. XO bounty additionally needs a novel contract, not only this inspector.
4. Submission decisions: IP/license review and permission for any public release, signing/transaction or submission remain separate. No such action was taken.

## Validation

Re-ran npm run validate with unchanged application code. See validation.log for actual typecheck, build and all 31 tests. No fresh visual/browser run is claimed; prior browser evidence remains separately dated. No new tests were added merely to increase the count.

Stop condition for this slice is a clear, reproducible evidence gap and current requirements, not fabricated completion. GitHub, Notion and Linear persistence must be confirmed separately by their actual write responses.
