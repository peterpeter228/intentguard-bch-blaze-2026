# Current requirement audit and scope decision

Read-only official-source check on 2026-11-04, against private baseline `645240141568660db9960c15729d5085617e71b1`. All current work remains disclosed pre-event development.

## Why this slice

The existing XO laboratory checked imported documents, while the request planner generated its own transaction. Neither demonstrated actual XO template construction. The chosen narrow integration now compiles the official P2PKH recipient through the installed engine, constructs the candidate through the engine, and independently compares every resulting byte and payment term. This tests a real third-party producer without inventing a contract, account or valid signature.

## Requirements still open

The [official bounty board](https://bchblaze.cash/bounties/) requires an original, functional template, a real Chipnet/Mainnet execution with an inspectable executed Invitation, reproduction material, suitable follow-up actions where applicable, and human-authored feedback. Migrate additionally needs a genuine original working project and links to both implementations. Sponsor judgement, latest-next-engine guidance and submission/IP terms remain relevant.

Using the unchanged official P2PKH reference plus independent tooling is useful integration progress, but does not establish template originality or prize qualification. The board does not explicitly require inventing a new locking script; that is not permission to claim a wrapper meets its novelty requirement. No sponsor outreach or personal feedback was written or sent.

The [current schedule](https://bchblaze.cash/schedule/) lists the remaining preparation workshop on November 7 at 14:00 UTC, registration closing November 13, hacking November 14–22, and hacking finishing/submissions and judging beginning November 22 at 14:00 UTC. This wording is not a freshly verified DoraHacks submission closing timestamp. The other read-only check received HTTP 405 from DoraHacks, so the prior platform timing discrepancy remains unresolved. Existing attendance and identity-confirmation evidence gaps remain; ordinary schedule entries do not prove attendance.

## Official API and package evidence

- [Getting started](https://stack.xo.cash/getting-started.html) describes account-backed Invitations as signed additions and shows `Engine.create` opening state and Electrum. No such account path was called.
- [Writing templates](https://stack.xo.cash/blog/2026-08-24-Vision-to-Reality-6-Writing-Templates) separates template instructions, transaction construction and participant coordination. Runtime template normalization, not its metadata schema URL alone, is the parser used here.
- [Official npm next tag](https://registry.npmjs.org/@xo-cash/engine/next), read through a permitted public-page tool, currently points to `0.1.0-next.17612568780`, matching the lockfile. Registry gitHead is `18c44c1b0e9254882dbdbbc1e41bd559244bdda4`; published SHA-512 integrity matches the locked dependency. No package update or fresh install was performed.
- Installed official pure exports `completeMergedOutput` and `buildInvitationTransactionFromMergedCommit` were executed for both BCH and FT without an Engine instance. Template-derived recipient compilation is real; parent/unspent/ownership claims remain synthetic or supplied offline data.
- A valid nonempty Invitation still needs participant identity and commit signature. `InvitationBuilder.createUnsignedCommit` does not authenticate a participant or insert a signed commit. No fake signed Invitation is produced to cross that boundary.

## Exact remaining action gates

The user still needs actual required attendance/roll-call and project identity confirmation evidence, separately authorized wallet/account and chain activity for real integration, the participant-controlled reception address, personally written feedback, and publication/submission/IP decisions. Migrate also needs a genuinely pre-existing working project. Existing node DNS restrictions remain unworked-around. The next material end-to-end milestone is authenticated participation and real execution evidence, not another generic offline state layer.

This record is technical project planning, not personal development feedback or an entry submission.
