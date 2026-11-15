---
name: verify-payment
description: Drive IntentGuard's actual SDK session and loopback HTTP confirm/build/sign/postcheck/pay/recovery boundaries, with explicitly synthetic transports while faucet-blocked.
---
# Launch
Node24, locked `npm ci --ignore-scripts`, native SQLite rebuild, `npm run build`.
Run `npm run payment:verify -- /absolute/task/evidence/new-run`.
The driver starts owned loopback servers on ephemeral ports with exclusive private temporary journals. Ready means the actual `/api/payment` config has cap0 and a fresh pinned-SDK session derives paths, not merely a listening process.
# Doctor
The driver POSTs `{action:"config"}` and checks cap0 before preparing anything. `npm run core:preview` without `INTENTGUARD_PAYMENT_DIR` intentionally returns PAYMENT_JOURNAL_REQUIRED; use a new private directory with `--create-payment-journal` once, omit that flag on restart. Never reset UNKNOWN storage.
# Drive
`features/README.md` maps actual controls. Driver retains isolated legacy SDK/HTTP/SQLite evidence and adds compiled visitor UI/stateless HTTP/IndexedDB-shim/native handoff checks, with no imported success or production debug flag. Existing ephemeral Chipnet signatures are verified, NOT regenerated as mainnet signatures. Parent actual embedded browser exercises native IndexedDB/root/pay; no alternate backend after policy denial, no wallet/pairing/QR/key capture.
# Evidence
Exclusive empirical.json records legacy and visitor journeys, source hashes/effect counters, exact-byte handoff and original UNKNOWN recovery. MOCK_TRANSPORT/NO_CHAIN_TRANSACTION; installed IndexedDB shim does not prove browser-native durability. Real wallet, Chipnet receipt, mainnet payment and original-volume restart remain UNVERIFIED/BLOCKED. No replay of consumed helper or protected identity.
# Cleanup
The imported driver closes only its own server/socket/journal and removes only its generated temporary journal directory, in finally. Evidence remains outside scratch and is read back after cleanup. No process-name kills, source changes or global settings.
# Helpers and maintenance
`node .cursor/skills/verify-payment/scripts/drive.mjs NEW_EVIDENCE_DIRECTORY` is the runnable helper. Use `$pstack-maintain-verification-skill` after changed routes/lifecycle. Workflow source: cursor/plugins6b0300214a09fd6029cfb7077043125758cd1fd2; upstream MIT notice remains in task-local workflow checkout.
