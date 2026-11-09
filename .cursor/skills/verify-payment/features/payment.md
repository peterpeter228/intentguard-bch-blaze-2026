# Guarded payment
## Sub-features
Independent terms review/confirmation, fresh sources, deterministic build, final exact outputs/fee approval, sign-only, cryptographic postcheck, one app broadcast.
## How to get to it (user POV)
`/pay` → recipient/amount/fee/rate/expiry → #review → #confirm → #build → review #candidate → #sign → #broadcast.
## Driving it with HTTP/SDK harness
`npm run payment:verify -- NEW_DIRECTORY` traverses actual `/api/payment` endpoints and reopens SQLite before send. It checks full-parent signatures and one effect under racing broadcast requests. Parent browser checks edits invalidate controls; mainnet only accepts explicit offline context and cannot sign/send.
## Gotchas
Only ordinary token-free confirmed P2PKH inputs on chosen receive/change indices. Unsupported wallet signature model, missing/stale sources, tokens/NFTs or changed terms fail closed. Faucet blocked: no live txid/receipt; mock sender counters are not chain facts.
