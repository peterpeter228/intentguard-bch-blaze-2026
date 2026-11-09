---
name: verify-chipnet-session
description: Drive the dedicated Q1=B Chipnet identity/Invitation CLI and existing IntentGuard offline inspector; never repeat identity signing during doctor or recovery.
---
# Launch
Use the existing pinned dependencies and Node24; build with `npm run build`. No server or UI is involved. The single approved command is task-bound to `bch-blaze-chipnet-20261109`, the existing feature worktree and `/root/.secrets/intentguard-bch-chipnet.env`. No credentials go in argv/environment/model. Do not read or source that file.

Before the one authorized live operation, follow the formal skill and /statechart, including its broken-code negative control and restoration. Then:
```
node .cursor/skills/verify-chipnet-session/scripts/drive.mjs live
```
Ready means `PUBLIC_EXPORT_READY`, one `createInvitation` attempt, and actual original-CLI report `REVIEW_REQUIRED`, one commit, no issues, `canSign=false`; exit0 alone is insufficient. The helper refuses an existing journal/identity and never silently generates a replacement. Existing state must be reconciled without another live invocation. This is an identity-only initial proposal, not an executed or paid Invitation.

# Doctor
```
node preseason/xo/chipnet-session.mjs doctor
```
Read-only metadata/public-journal check: no SDK imports, secret content reads, signing or network. `NO_OPERATION` permits only the expressly authorized first live operation. `RECONCILIATION_REQUIRED_NO_REPLAY` means stop: preserve the journal/env/runtime; identify whether the already-reserved signature returned or was stored. Do not reset, delete state, create another identity or repeat `createInvitation`. A partial journal/public pending file also requires reconciliation, not regeneration.

This task's first connection initialization returned, but the wrapper incorrectly compared a hostname-only SDK `hostIdentifier` with `host:port`. Its retained public journal proves ZERO signing attempts. After reviewing that source defect and rerunning the formal/negative controls, the only authorized continuation is:
```
node .cursor/skills/verify-chipnet-session/scripts/drive.mjs reconcile
```
This command is pinned to that ORIGINAL operation ID/journal SHA and public identity; the isolated process reads ONLY that operation's own mode-checked env internally, proves the same public key/address, and permits one connection-stage continuation. It preserves every prior record/counter and refuses any signing uncertainty, second continuation, existing export or nonempty Invitation store. It is not a general retry/recovery loader. It must refuse after consumption. Doctor/offline never invoke it.

# Drive
After initial readiness, use the repeatable PUBLIC-only feature:
```
node .cursor/skills/verify-chipnet-session/scripts/drive.mjs offline
```
It invokes the existing `npm run xo:inspect -- TEMPLATE INVITATION chipnet INDEPENDENT_PIN` on the exact original bytes and a one-nibble signature mutation. It checks reports, original SHA256, explicit network, one operation attempt, metadata-only custody, and original unchanged. It never calls create in offline mode. Evidence destinations are exclusive; use a new reviewed public run destination for further repetitions rather than overwrite receipts. Expired exports must reject at actual current time; do not move the clock or re-sign to make a smoke pass.

# Evidence
Fixed task root: `/var/lib/docker/volumes/openbot-eval_openbot-data/_data/OpenBot/Shared/loop/bch-blaze-chipnet-20261109`.
Public `artifacts/`: exact template, unchanged serialized Invitation, identity/address, entity/pin/provenance, trusted timestamps, hashes, session connection summary, original/tamper CLI stdout and command/exits, empirical summary. No full StoredInvitation/secret map/backup/private state is exported. Task `runtime/` is 0700; the approved secret is 0600 within 0700. Evidence of permissions must use stat only. Live process validates own newly-created secret internally and suppresses raw SDK error text. Preserve PRESEASON/no-funding/no-execution limitations.

# Cleanup
The owned create/continuation process stops its Electrum connections and Engine and exits. No process-name kills. A failed command exits and leaves unknown state for reconciliation. Keep the one approved secret, owned runtime journal/state and all public evidence; do not reset or sign again. Offline inspection is short-lived and needs no teardown. Confirm `empirical-reconcile.json` / `empirical-offline.json` still exist after commands exit; the initial failed `live-create.json` remains evidence, not a pass. Real SIGKILL recovery regressions use isolated PUBLIC markers only, removed in each test's finally block. No dummy credentials, funding, faucet, transaction signing or broadcast.

# Feature map and maintenance
See `features/README.md`. Use $pstack-maintain-verification-skill to keep commands, evidence and feature map synchronized after changes. No inferred payment, mainnet readiness, bounty qualification, ownership or Guard authority.
