# Guarded payment
## Sub-features
Independent terms review/confirmation, fresh sources, deterministic build, final exact outputs/fee approval, sign-only, cryptographic postcheck, one app broadcast.
## How to get to it (user POV)
`/pay` → recipient/amount/fee/rate/expiry → #review → #confirm → #build → review #candidate → #sign → #broadcast.
## Driving it with HTTP/SDK harness
`npm run payment:verify -- NEW_DIRECTORY` first drives the actual compiled UI handlers through 5000sat prepare → edit4000sat → review → explicit confirmation → rebuild, over real HTTP/builder/SQLite with public-wallet/RPC seams; it asserts exact new recipient/change, retained economic ID, durable revision and zero sign/send. Then it checks full-parent signatures and one effect under racing broadcast requests, reopening SQLite before send. This is a Node DOM harness, not real-browser proof. Parent browser checks the same edit journey; mainnet only accepts explicit offline context and cannot sign/send.
## Gotchas
Only ordinary token-free confirmed P2PKH inputs on chosen receive/change indices. Unsupported wallet signature model, missing/stale sources, tokens/NFTs or changed terms fail closed. Faucet blocked: no live txid/receipt; mock sender counters are not chain facts.
Unsigned replacement needs the original in-memory capability and expected revision; reload without that capability remains read-only. Once signing was reserved, edits cannot replace the original operation, including UNKNOWN/signed/send-reserved states. No ID clearing or journal reset.
