# Doctor and crash isolation
## Sub-features
Read-only public journal/secret metadata; exclusive operation ownership; interrupted secret/sign/export quarantine.
## How to get to it (user POV)
Run doctor before any drive and after an unexpected result. No secret contents or network are required.
## Driving it with the CLI harness
`node preseason/xo/chipnet-session.mjs doctor`; `node --test preseason/xo/chipnet-lifecycle.test.mjs` exercises real SIGKILL and exclusive publication with non-secret markers. A second claim must fail without changing original journal/export bytes.
## Gotchas
Doctor never creates identity, clears state, signs, resets or funds. Unknown signing/export state stays quarantined, including a completed signature before its receipt. Preserve any .pending file. Human-reviewed reconciliation may recover already-stored public bytes, but absence of a receipt never authorizes re-signing. Synthetic crash regressions do not prove hardware crash durability or SDK cryptography.


The task's one exceptional connection-stage continuation was separately proven
unsigned: exact original journal SHA/operation ID, same protected identity/public
key, no signing intent and empty stored Invitations. `drive.mjs reconcile` binds
those facts and may continue that connection stage ONCE without resetting history
or creating a key. It refuses after consumption; uncertain signing never replays.