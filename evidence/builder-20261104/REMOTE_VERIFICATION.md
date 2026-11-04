# Exact remote snapshot validation

Source commit c54f5481bd047785107a429ed77a03402dbdcf86, tree0d1791da800574777bba7854c6541d19f84075ff. Fourteen changed files were fetched in base64 from that fixed commit, decoded, and compared to independently calculated intended Git blob SHA and SHA256. The217 unchanged files reused previously downloaded immutable remote blobs; each was rehashed against the new full nontruncated remote tree before copying into a new empty snapshot directory. No differing development source was substituted.

All231 source-repository files matched the exact remote tree. Per-file Git blob/SHA256: remote-manifest-c54f5481.json. Executed npm run validate in the complete clean snapshot: exit0,129/129 tests, typecheck and build. Log: remote-validation-c54f5481.log. Dependencies were reused through a symlink to the already installed Node24.22.1 environment; no fresh installation claimed.

The resulting app.js SHA256 is89d41bf63bcbeae9fcd228cc3e6ff81d06e910d1d3c5b0901b17c00bbf0d4419. This is the same frozen source/bundle assigned for actual browser verification, whose outcomes are separately documented in browser/QA.md. This establishes offline code consistency, not chain/transaction success.

The following evidence-only commit adds this report, manifest/log and browser artifacts. It changes no tested application source. New evidence bytes are fetched and checked, then the full final tree is rehashed and validation rerun before final reporting. Do not infer final completion from an upload response alone.
