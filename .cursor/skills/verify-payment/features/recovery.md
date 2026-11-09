# Uncertain operation recovery
## Sub-features
Disconnect/cancel/late response, send response loss, durable restart, original-hash observation.
## How to get to it (user POV)
`/pay` → #disconnect or reload after uncertainty → #recover. Read original operation ID/hash and fresh read-only node report; never create a replacement to clear UNKNOWN.
## Driving it with HTTP/SDK harness
The empirical helper executes response-lost send and server restart, requires one stored original hash and exactly one send, and refuses a second send. Parent browser uses #recover with no operation to observe honest no-operation explanation.
## Gotchas
Public IDs alone do not restore mutation credentials or authenticated wallet state. A signature-late hash can be quarantined but never auto-sent. UTXO disappearance is not payment. Two-source inclusion evidence is node-trust bounded, not SPV consensus; conflicts invalidate receipts.
