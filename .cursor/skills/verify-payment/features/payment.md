# Guarded payment
## Sub-features
Independent terms review/confirmation, fresh sources, deterministic reconstruction, all outputs/fee approval, sign-only, full cryptographic postcheck, explicit SAME-byte visitor native handoff. No app/server mainnet broadcast.
## How to get to it (user POV)
`/pay` → recipient/amount/fee/rate/network/expiry → #review → #confirm → #build → inspect all #candidate terms → #sign → #handoff-ack → #broadcast → identical #signed-raw for Electron Cash4.4.6.1 native broadcast. App never runs that command.
## Driving it with HTTP/SDK harness
`payment:verify` retains legacy compiled UI→HTTP/SQLite/SDK checks and adds `driveVisitor`: actual compiled visitor UI→stateless HTTP→deterministic build→installed IndexedDB shim→verify-only existing Chipnet signature→native handoff text. Tests atomic competing-tab reserve/handoff, late original bytes quarantine, reopened original hash, failed persistence, conflict invalidation and no replacement. MOCK_TRANSPORT/NO_CHAIN_TRANSACTION; NOT native-browser durability or wallet interoperability.
## Gotchas
Only ordinary token-free confirmed P2PKH inputs from fresh session-owned paths. Tokens/NFTs, missing/stale/conflicting sources, changed terms or failed storage refuse. Every effect intent commits first; uncertain effects keep original economic/input reservations. No fallback to memory/new request IDs. Agent mainnet0sat; real visitor payment UNVERIFIED.
