# Shareable offline inspection
## Sub-features
Exact public serialized original, independent normalized P2PKH pin, current expiry/schema/signature checks and public signature-tamper negative.
## How to get to it (user POV)
Use the completed single operation's artifacts/template.json, invitation.json and metadata.json. The prior source already pins normalized P2PKH a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672.
## Driving it with the CLI harness
`node .cursor/skills/verify-chipnet-session/scripts/drive.mjs offline` invokes existing npm xo:inspect twice and checks actual reports, not just exits. Original must remain byte-identical; only a public signature nibble changes in the negative copy.
## Gotchas
Both CLI reports may exit0: tamper must report REJECTED with a signature issue. Expiry uses the real clock. Rejected/expired exports are not renewed automatically. All reports remain canSign=false and establish no payment, chain authority or current ownership.
