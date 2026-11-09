---
name: verify-chipnet-formal
description: Check the dedicated Chipnet identity/Invitation lifecycle when custody, journal ordering, network gates, export, or retry behavior changes.
---
# Property
A failed or interrupted identity operation cannot create another identity/signature, or publish unchecked/non-Chipnet bytes. Violations can leak private material or duplicate an identity-signing operation.

# Coverage and bounds
Sync source: `8ed624702252daba955c5dbfcc054ad1d5cd5d07`. This commit contains the exact runtime/gate/generator checked in the final65-state proof and258-test validation; the subsequent skill-sync edit is documentation-only. Gate hashes are in each generated `model-source.json`; task `artifacts/SOURCE_MANIFEST.json` binds all covered files. Move this sync commit only after reconciling code/model and rerunning the negative control.

- `preseason/xo/chipnet-lifecycle.mjs`: actual `initialState` and `transition`; the generator executes these functions, not a copied gate.
- `preseason/xo/chipnet-session.mjs`: new `create` refuses an existing journal before reading/creating any secret; `advance` durably records intent before secret persistence, Engine initialization and its sole `createInvitation` call. The separate `reconcile-session` is pinned to the original public journal SHA/operation ID and public identity, permits ONE unsigned connection-stage continuation, and requires empty stored Invitations before signing. It does not reset the journal, derive a new identity, or repeat signing. `assertShareable` rejects private/arbitrary signed fields before `serializeInvitation(stored.invitation)` publication.
- `preseason/xo/chipnet-journal.mjs`: exclusive journal creation, append+fsync and exclusive atomic link publication. SIGKILL regression cases separately exercise actual filesystem boundaries with PUBLIC markers, not credentials or SDK signatures.
- Atomicity: secret write, identity signing, public file publication and their following journal entries are **separate** model steps. A crash may leave each side effect completed without its receipt. Signing/export uncertainty never replays. Doctor cannot advance side effects. One connection-stage continuation requires the same protected identity and proved absence of any signing intent; original records and counters remain.
- Finite bound: ONE owned operation/identity/signing call; at most TWO Engine initialization attempts (one proven connection-stage continuation), two network inputs (Chipnet/wrong-network), existing/absent file, good/network-refused/expired/unsafe-export evidence, crash at every intermediate phase. No liveness claim. No proof of cryptographic algorithms, arbitrary JS inputs, TLS internals, fsync under faulty hardware, SDK internals, key inference, payment or broadcast safety beyond the reviewed call surface. Guard/ownership/UNKNOWN rules are unchanged.

# Run
From the repository with Node24:
```
node .cursor/skills/verify-chipnet-formal/scripts/model.mjs "$MODEL_OUTPUT"
node --test preseason/xo/chipnet-lifecycle.test.mjs
```
`MODEL_OUTPUT` is a new task-local scratch directory; no secret or participant input is used. Read every TLA+ result using **/statechart**. Follow that skill's current official CLI instructions for this model, config and `artifacts/invitation-view.mjs`; do not transplant machine-specific statechart commands into this skill.

The generated TLA+ checks ChipnetOnly, ExistingFileRefusal, AtMostOneSign, SecretSafeExport and OfflineNotAuthority on all generated reachable edges. A passing finite model is not an unbounded proof of the application. Inspect both TLC output and statechart report.

# Negative control and interpretation
In a controlled scratch delta to the REAL `transition`, remove only the `CHIPNET_REQUIRED` guard. Regenerate the model and run /statechart; ChipnetOnly must fail along wrong network → claim → secret write. Run the boundary tests: the mainnet refusal assertion must fail too. Restore the guard, regenerate into a fresh folder, and rerun proof/tests. Never drive the live command against a broken variant. Retain original, mutation, restored hashes and reports outside private runtime state.

A counterexample is a code finding unless the mapped ordering is wrong. Fix the model only when the actual source proves that mismatch; never weaken the invariant. If source or lifecycle ordering changes, reconcile the coverage before moving the sync reference. Use /maintain-formal-verification-skill for later maintenance.
