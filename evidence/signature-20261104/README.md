# Offline signature and explicit refresh slice

November4 pre-event work continuing finalf44561cd. Only existing immutable public BCHN signatures are used as positive inputs. Tests never generate keys or signatures. Synthetic read transports and sessions exercise review persistence but are not real chain evidence.

Delivered:
- core/signed-verifier.ts: separate stateless resolved-source verification and exact full-plan binding. Explicit2026standard VM; strict P2PKH pushes/pubkeyhash/models, restricted sighash, actual fees/size and trusted invocation clock.
- core/review-coordinator.ts: explicit expected-revision refresh, durable history/CAS, immutable bindings and fail-closed uncertain state. Oldv1 journal refusal preserves bytes; migration is unimplemented.

npm run validate: local exit0,150/150 tests, typecheck/build. See local-validation.log. Independent review and additional exploit/mutation/concurrency checks: INDEPENDENT_REVIEW.md. Official immutable vectors/license/provenance: OFFICIAL_VECTORS.md and BCHN_COPYING.txt.

Important scope gaps: two official vectors prove stateless ECDSA/Schnorr verification only. They do not include fullparentraw and do not prove a bound payment; strictP2PKH token/0x61 positive remains absent. No actual wallet, signed payment, live node evidence, transaction, receipt, public demo, contest eligibility or prize likelihood is established.

No UI code changed. Rebuilt app.js SHA256 remains89d41bf63bcbeae9fcd228cc3e6ff81d06e910d1d3c5b0901b17c00bbf0d4419, identical to the previous independently tested browser bundle. No new browser run or signature UI is claimed. Final remote byte verification is reported separately after saving.
