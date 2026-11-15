# Uncertain operation recovery
## Sub-features
Disconnect/cancel/late response, send response loss, durable restart, original-hash observation.
## How to get to it (user POV)
`/pay` → #disconnect or reload after uncertainty → #recover. Read original operation ID/hash and fresh read-only node report; never create a replacement to clear UNKNOWN.
## Driving it with HTTP/SDK harness
The helper additionally drives visitor IndexedDB competing-tab CAS and reopen after signature/handoff intent, checks UNKNOWN/no repeated handoff and original-hash observation; installed shim is NOT browser-native proof. Parent browser must exercise actual IndexedDB tabs/reload/failure around effect boundaries. Legacy response-loss/SQLite checks remain separately labelled.
## Gotchas
Public IDs alone do not restore mutation credentials or authenticated wallet state. A signature-late hash can be quarantined but never auto-sent. UTXO disappearance is not payment. Two-source inclusion evidence is node-trust bounded, not SPV consensus; conflicts invalidate receipts.
