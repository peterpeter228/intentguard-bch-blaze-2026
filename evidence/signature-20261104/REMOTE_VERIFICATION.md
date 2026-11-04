# Exact remote signature/refresh snapshot validation

Source commit7d2246cd13d1efa4a07a630684b160d752242d78, tree3481f84d5301f3bba9af1e0b831a78706614b99d. Every one of18 changed files was fetched as base64 from that exact commit and compared to independently computed intended Git blob SHA and SHA256. The246 unchanged files reused previously downloaded immutable remote blobs, each rehashed against the new full nontruncated tree before copying into a new empty snapshot. No differing local development source was substituted.

All264 repository files matched the exact remote tree. Per-file manifest:remote-manifest-7d2246cd.json. In the complete remote snapshot, npm run validate exited0:150/150 tests, strict typecheck and build. Log:remote-validation-7d2246cd.log. Dependencies were reused through the existing installation symlink, not freshly installed.

The rebuilt app.js SHA256 remains89d41bf63bcbeae9fcd228cc3e6ff81d06e910d1d3c5b0901b17c00bbf0d4419. No UI behavior changed or new browser run is claimed. The earlier browser evidence applies to these unchanged UI bytes only, not to a signature interface or real wallet.

This evidence-only follow-up adds3 files, changing no tested source. Its files are fetched back and hashchecked and the full final tree revalidated before final status. The result does not close the absent full-parent signed positive or strictP2PKH token/0x61 positive, real wallet/network/chain, or contest gates.
