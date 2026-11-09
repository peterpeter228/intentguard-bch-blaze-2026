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
`features/README.md` maps actual `/pay` controls. The helper drives the same HTTP endpoint and real installed DappConnectionManager, then restarts/reopens the journal; no simulation event imports. External RPC and relay are explicitly injected synthetic transport, isolated ephemeral Chipnet-labelled test keys only. It does not claim a live wallet or chain transaction. Parent embedded OpenBot browser separately exercises actual root/pay, confirms disabled mainnet controls and captures public-only visual evidence; never capture pairing URI/QR/xpub/keys. No alternate browser backend.
# Evidence
Exclusive destination contains `empirical.json`: action sequence, exact effect counters and original-hash recovery status, labelled MOCK_TRANSPORT/NO_CHAIN_TRANSACTION. Payment signed-positive crypto and post-Guard run against actual code. Unknown response loss must retain the original hash and one send through reopen; invalid/cancelled paths must send zero. Real-chain evidence remains blocked by Q_FAUCET; do not replay private signing/faucet/send during verification.
# Cleanup
The imported driver closes only its own server/socket/journal and removes only its generated temporary journal directory, in finally. Evidence remains outside scratch and is read back after cleanup. No process-name kills, source changes or global settings.
# Helpers and maintenance
`node .cursor/skills/verify-payment/scripts/drive.mjs NEW_EVIDENCE_DIRECTORY` is the runnable helper. Use `$pstack-maintain-verification-skill` after changed routes/lifecycle. Workflow source: cursor/plugins6b0300214a09fd6029cfb7077043125758cd1fd2; upstream MIT notice remains in task-local workflow checkout.
