# Connection
## Sub-features
Explicit Chipnet acknowledgement, transient pairing, fresh key exchange, receive/change path derivation, disconnect/cancel.
## How to get to it (user POV)
Homepage → Open guarded connected-wallet payment → select Chipnet → acknowledge actual wallet network → Connect WizardConnect. Never capture pairing URI/QR.
## Driving it with HTTP/SDK harness
`npm run payment:verify -- NEW_DIRECTORY` uses the actual pinned manager's public transport seam. Parent actual browser checks #network/#chain-ack/#connect/#wallet-state. Mainnet selection disables connect and never starts SDK.
## Gotchas
Stock-wallet session and wallet's adherence to sign-only are NOT_RUN. Cached pubkeys are not authentication; no authenticated chain ID exists in protocol. Drop/reconnect requires a new explicit handshake, not automatic re-sign.
