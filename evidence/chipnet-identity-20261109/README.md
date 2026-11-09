# Dedicated Chipnet identity / Invitation — PRESEASON, 2026-11-09

## Decision and scope

Base: `dd71e0e5532c8080d3b57c8b69e41f15fbbf7389`, existing feature branch
`feat/openbot-bch-20261108`, one existing worktree. Parent retained its manual lock;
implementation neither acquired nor released it. Local origin feature/main refs
were absent; cached preseason ref was a82807ae. No fetch/push/merge/publication.
Parent-observed remote refs are context, not a new live remote verification.

Owner card t292s1301 / task DECISIONS Q1=B authorizes ONLY the new dedicated Chipnet
identity/session, identity-only createInvitation, serializeInvitation and existing
offline inspection. Prior PLAN.md / plan-gate.md PASS under bch-blaze-dev-20261108
were reused, not renewed. Their signing prohibition is superseded only by this
specific decision; old PASS did not prove the new path. No second Opus/model/advisor.

All detailed PUBLIC evidence is under:
`/var/lib/docker/volumes/openbot-eval_openbot-data/_data/OpenBot/Shared/loop/bch-blaze-chipnet-20261109/artifacts/`.
No signed export, account backup, full StoredInvitation or private runtime state is
included in this repository. Candidate source/commit hashes are bound separately
in the task's implementation receipts, rather than self-embedded in a commit.

## Exact outcome

- One new owned identity; approved env is 0600 inside 0700. Only the isolated Node
  process generated/read its owned secret, recovery-checked it using locked
  libauth/XO derivation, and emitted whitelisted public identity/address metadata.
  Tools inspected only file metadata, never secret contents or another account.
- One actual `Engine.createInvitation` call, one genuine Schnorr identity commit.
  Official P2PKH `receive`, no role/intent generate list, inputs, outputs or
  resolutions. Pinned source proves no generated template keys on this path;
  actual listSecretData/listScriptHashes remained empty. Three owned runtime files
  were internally scanned for known mnemonic/entropy/seed bytes without returning
  contents. This is scoped absence evidence, not a universal information-flow proof.
- Exact `serializeInvitation(stored.invitation)` bytes only, not StoredInvitation.
  Export SHA256: `3f03f5f5cb29b2b398e735402ca2f54d66f2b2bf42cc5d5310d19ce3998cfdfb`.
  Exact packaged template SHA256: `6b14f773f5a623ddf3264716a35e06eb70660d2e3a2f8f9567921300431fcd4a`.
  Independent normalized pin predates this run in preseason/xo/README.md at base:
  `a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672`.
- `metadata.json` binds explicit Chipnet, public identity/address, package/template
  provenance and trusted host creation/expiry. TTL is 24 hours; no clock override.
- Original CLI report: REVIEW_REQUIRED, one commit, zero issues, canSign=false.
  One-nibble public signature mutation: REJECTED / CommitSignatureInvalidError.
  Both CLI exits are 0; actual report assertions—not exit alone—establish results.
  Separate offline-only original/tamper run passed without a session/signature.

## Failures retained and root causes

1. Prior raw ELECTRUM_UNSUPPORTED_PROTOCOL on both peers was accepted as fact,
   not repeated for confirmation. Exactly two discriminating TLS observations
   showed Fulcrum 2.1.3 / 2.1.4 responding `1.5` to requested `1.5.0`. The minimal
   core fix accepts only these equivalent spellings. No range relaxation, TLS/IP/
   proxy workaround, retry scan or parser/checkpoint/deadline change.
2. Fixed production transport fetched block 121957 once over verified TLS and
   independently matched `0000000056087dee73fb66178ca70da89dfd0be098b1a63cf6fe93934cd04c78`.
   This is one public header result, not payment/ownership/two-source collection.
3. Initial live Engine initialization returned, then the wrapper incorrectly
   compared SDK hostname-only hostIdentifier with host:port. `live-create.json`
   retains NETWORK_REFUSED; original journal retained attempts=0 and no signing
   intent. Installed network source shows hostIdentifier returns socket.host.
4. One explicit connection-stage continuation was pinned to original operation
   `6eb5e21e-c104-4ead-bb31-cb6d72819b6e`, original journal SHA
   `6d4831e4edaf75067df74ec10573db4622d4a73cf1b3f9a445fb46149d07a5f1`, the same public
   key/address and protected owned file; it verified an empty Invitation store.
   It appended—not reset—history and kept counters: two Engine initializations,
   ONE identity, ONE signing call. It cannot run again. Signing uncertainty never
   replays. Actual WSS connected to chipnet.bch.ninja / Fulcrum 2.1.3, reported
   height331521, through official TLS and independent Chipnet checkpoint checks.

## Verification and reproducibility

Pinned APIs were read first from installed types/source maps: Engine
0.1.1-next.17778370827, utils0.0.10, templates0.0.12, crypto/state0.0.5,
libauth3.1.0-next.8. Node v24.22.2 and existing accepted dependencies were reused;
no dependency/lock change or installation. Exact source hashes are task receipts.

- `npm run validate`: final restored candidate exit0; 258/258, no failures,
  cancellations or skips; typecheck/build passed. `validate-final.json` is raw
  command/stdout/stderr/time evidence. Historical253 and intermediate257 are not
  this final count. New cases: one canonical-version regression and four lifecycle
  cases (including actual SIGKILL with PUBLIC markers). npm devdir/nodedir warnings
  remain disclosed; they were not suppressed or treated as failures.
- Formal skill: `.cursor/skills/verify-chipnet-formal/SKILL.md` and model generator.
  Model executes the actual lifecycle transition function, with separate effect/
  journal steps. Official /statechart helper source pinned to cursor/plugins
  `6b0300214a09fd6029cfb7077043125758cd1fd2`, MIT notice/license retained task-local.
  TLC jar releasev1.7.4 SHA256
  `936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88`;
  actual output identifies TLC2 Version2.19, rev5a47802. Existing Java21.0.10 used
  through supported JAVA/TLA2TOOLS overrides. Final/mutation reconciliation runs
  explicitly isolate Java temp and user home with JAVA_TOOL_OPTIONS; model/helper
  temp and downloaded tools remain task-local. Earlier initial-model receipts are
  retained separately. No global installation/config/service modification.
- Final model: 65 states/158 edges, depth17; all five invariants and NoDeadlock
  hold. ONE operation, two networks, existing/absent file, bounded evidence inputs,
  crashes across effect/journal boundaries and one proved unsigned connection
  continuation. No liveness or unbounded proof, cryptographic/TLS/OS/hardware proof,
  or proof of arbitrary SDK paths. `statechart-final/{tlc.out,chart.mmd,report.md}`.
- Real broken-code control: remove actual CHIPNET_REQUIRED guard; generated model
  reaches122 states/304 edges and exits1. Shortest counterexample: wrong network →
  claim operation → record persistence intent → secret persisted. Runtime boundary
  assertion also fails. Restore exact guard: final65-state TLC and full258-test run
  pass. Earlier27-state preparation-model receipts are retained, not substituted.
- Empirical skill: `.cursor/skills/verify-chipnet-session/SKILL.md`, three-feature
  map and actual CLI driver. `empirical-reconcile.json` and `empirical-offline.json`
  are PASS; initial live failure retained. Teardown stopped the owned network/Engine;
  public evidence survived. Doctor/offline never load the secret or sign.

Public rerun before expiry (no signing):
```
npm run xo:inspect -- TASK_ARTIFACTS/template.json TASK_ARTIFACTS/invitation.json chipnet a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672
```
`TASK_ARTIFACTS` means the exact task artifact directory above, not a new input or
trust pin. Parent must run independent original/tamper inspection with current time.
Do not create another identity, reset runtime, re-sign, rerun consumed continuation
or adjust the clock. Doctor is `node preseason/xo/chipnet-session.mjs doctor`.

## Remaining independent gates / nonclaims

Implementation evidence is complete; fresh explicit Astra STATIC readonly review
and parent independent public smoke are still outstanding. No self-awarded Astra
PASS or parent/host DONE/result/lock-release receipt. Parent must bind the actual
source-to-candidate diff, decision, failures and current evidence, then write final
result/report/HANDOFF and both atomic terminal receipts. No new owner/funding input
is needed for this identity-only result; funding requested is exactly0 sat.

PRESEASON only. Identity-signed initial proposal is NOT a paid/executed Invitation,
transaction signing, chain/payment authority, ownership verification, mainnet
readiness, receipt, novel-template or bounty qualification. Guard/fees/expiry/
ownership/UNKNOWN policies and never-fundable tranche are unchanged. No owner
Selene mnemonic/xPrv/token, funding/faucet, executeAction, transaction, broadcast,
deployment, public preview, external message/record write, submission/IP acceptance,
personal feedback, main merge or child push occurred. Local SYNC_PROPOSAL only;
DOT/Hunter business ownership remains unchanged.
