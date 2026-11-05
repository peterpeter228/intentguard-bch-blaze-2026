# Bounded verification handoff, 2026-11-05

## Decision and stopping condition

The current private core is a working offline diagnostic, not an end-to-end
payment application. G1 remains IN_PROGRESS. Normal authenticated XO integration
is BLOCKED_EXTERNAL while no existing signed participant artifact or separately
authorized account session is available.

Do not repeat broad fixture searches, manufacture signed data, create mock
integration success or add generic offline features to occupy this wait. Do not
weaken Guard, expiry, sighash, fee, ownership or uncertain-state rules. The
isolated tranche remains unsuitable for funding because recovery is absent.

The bounded next outcome is an honest result for **one existing artifact**.
Finish its local verification, report which checks passed/rejected/could not run,
and stop. A successful format/signature check does not close payment, chain,
novelty or contest gates.

## Existing artifact: smallest first-stage input

Ask for a non-sensitive, already existing test export that the user can share:

1. Exact output of `serializeInvitation(storedInvitation.invitation)`.
2. The exact template JSON used for that Invitation.
3. Explicit Chipnet or Mainnet designation.
4. Independently selected template identifier and source/review provenance.

Do not ask the user to create/sign a new Invitation as a hidden prerequisite.
Do not request mnemonic, private keys, account backups, secretsByCommitIdentifier
or an entire StoredInvitation. Keep the extended-JSON bytes and signed commit
serialization unchanged. Retyping, JSON field reordering or redacting signed
payload fields may invalidate the signature; a suitable non-sensitive existing
artifact is preferable to altering one.

Keep artifacts local to the authorized verification. Do not upload, commit,
include in screenshots or send them to reviewers/services automatically.
Inspection output can contain upstream error text and action names; review it
before sharing. Template identity is not established by hashing the same imported
template and calling that independent trust.

## Existing implementation to use

After a genuine checkout/build with pinned dependencies:

```sh
npm run xo:inspect -- template.json invitation.json chipnet INDEPENDENT_TEMPLATE_HASH
```

Use `mainnet` only when that is the artifact's actual declared network. This is a
local parser/validator; the argument does not connect to or verify either chain.
Do not substitute `--synthetic` for a missing real artifact and claim integration.

The existing CLI limits each UTF-8 document to 256 KiB. The inspector limits
commits to 100 and validates official schema, template identity, commit/result
signature checks through the pinned engine, committed-field/role/follow-up
consistency, safe timestamps and expiry. It returns REJECTED or REVIEW_REQUIRED,
always canSign=false. Exit code 0 only means a JSON report was printed; it is not
a successful or executable-payment verdict. Read the report's status and issues.

Record artifact byte hashes, exact source commit/dependency lock, trusted check
time, declared network, independent template pin/provenance and individual
findings. Do not change the clock to make an expired artifact appear current.
A rejected expired artifact may still give useful historical format/signature
evidence; distinguish that from present executability and preserve all failures.

## Optional second stage, only with existing exports

For candidate-byte verification, ask separately for already exported complete raw
parents for all inputs and the already built raw candidate or complete
unlocking-bearing Invitation. Additional bytes are not required for the first
signature/schema check.

- Ordinary P2PKH signatures: use the appropriate existing verifier in
  core/signed-verifier.ts. Full-plan verification additionally requires the exact
  original request/planning context and trusted invocation clock. Caller-supplied
  snapshots are not fresh node/ownership evidence.
- Tranche covenant candidates: do not force them through the ordinary-payment
  Guard or P2PKH verifier; they deliberately reject that script. Existing synthetic
  VM results do not establish a normal Invitation integration or CSV maturity.
- Follow-up discovery evidence additionally needs a secret-free existing public
  script-hash record and the successor Invitation/application export identifying
  the selected intent. Treat this as historical supplied data, not current chain proof.

Any artifact-specific adapter or missing verification step must be reviewed as
that bounded task when the actual artifact exists. This handoff does not claim a
generic integrated verifier or a new executable test has been implemented.

## If a new session is necessary

Do not call Engine.create, acceptInvitation, createInvitation, appendInvitation,
signInvitation or executeAction under the current no-account/no-signature scope.
In particular, executeAction(false) signs and records a created result before
testing the broadcast flag; retrying it is not safely read-only.

A separately scoped user-operated test session must first identify the account/
environment and network, permitted public Electrum queries/script-hash disclosure,
identity-signed actions and result recording. New credential/persistent-access or
secret transmission needs its own applicable confirmation. No secret is requested
in chat. Payment signing, funding, broadcasting, public sharing/deployment,
outreach, legal acceptance and submission are separate actions, not implied.

The next actual core milestone would integrate authenticated ownership and fresh
node evidence with the reviewed exact candidate, establish no-broadcast wallet
behavior and full-plan signature positives, then separately establish the real
payment/independent-receipt path. More synthetic tests do not replace these gates.

## Contest evidence is separate

The existing project record requires useful real BCH Mainnet function for the
main track. A pure offline demonstration is insufficient. XO bounty evidence
additionally needs an actual Chipnet/Mainnet execution, inspectable executed
Invitation, reproduction and applicable follow-up behavior. XO may supply the
integration route instead of WizardConnect, but does not remove execution gates.

The user's personal XO feedback must be written by the human; do not generate
the required personal report or claim firsthand human experience. Public demo,
source-sharing scope, attendance/roll call, licensing and the event's rights terms
must be reviewed independently. Do not submit or accept those terms automatically.

Pre-event code must remain disclosed. Preserve the genuine earlier baseline and
the exact work history; do not retag/rewrite dates to manufacture event-period work.
See the organizer's pre-existing-project clarifications at
https://dorahacks.io/discussion/1562143 and https://dorahacks.io/discussion/1562206 .
The organizer's November 5 source recheck requires a fork at the November 14
14:00 UTC start (22:00 Beijing), a submission banner linking the pre-event demo
and old/new repositories, and substantive event-period improvements. Only work
completed November 14–22 is considered by the judges. Those are future obligations,
not completed actions or permission to publish/fork now. A local preview without
the required accessible demo links is not this completed disclosure package.
Recheck the effective official requirements before the event and submission.

## Source and evidence boundary

Recovered source head: ee01a6f7156166976e0852b2eedb4b3d26c1a35b.
The precise normal-XO assessment is
[evidence/funding-safety-20261105/NORMAL_XO_EXECUTION_GATE.md](../evidence/funding-safety-20261105/NORMAL_XO_EXECUTION_GATE.md).
The latest recorded exact-source product validation is
[REMOTE_VERIFICATION.md](../evidence/funding-safety-20261105/REMOTE_VERIFICATION.md):
246/246 tests at 03:41:41–03:42:07 UTC for source 56d2086d, selected 133-file
materialization, dependencies reused. This handoff does not rerun or extend it.

This November 5 continuation is documentation/recovery reconciliation only.
Runtime code, dependencies, Guard, covenant and all authority flags are unchanged.
Exact source checks and organizer quotes:
[readiness reconciliation evidence](../evidence/readiness-reconciliation-20261105/README.md).
