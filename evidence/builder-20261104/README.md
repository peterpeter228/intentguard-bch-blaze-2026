# Offline builder slice evidence

November4 pre-event work continuing c8b03df3. All examples and parent transactions are synthetic/unbroadcast. No node reads, wallet connection, signing, transaction, deployment, public release, submission, external contact or paid service was performed in this slice.

## Delivered

- core/unsigned-builder.ts: deterministic explicit-input P2PKH and fungible CashTokens construction, exact recipient order, sorted outpoints/category change, token conservation, exact-output dust and full Guard recomparison.
- Assumption-labelled compressed-key Schnorr and strict-low-S ECDSA signed-size bounds; ceil budget at upper size and fee-rate ceiling at lower size. Final wallet size/algorithm remain unverified.
- Narrow optional BCH dust donation; independent high-rate/non-dust consent bug corrected before saving source.
- Local browser builder and redacted plan-summary download. UI defaults synthetic fixed-clock input; no network API.

## Actual validation

npm run validate: exit0,129/129 tests, strict typecheck, build. See local-validation.log. Dependencies reused from the existing installed environment; no fresh install or upgrade.

Independent source review and reproduction: OFFICIAL_REVIEW.md and REVIEW.md. Real desktop browser results: browser/QA.md when captured. Exact remote snapshot and per-file integrity are reported separately after persistence, not inferred from local success.

The intended final local app.js SHA256 before browser review is89d41bf63bcbeae9fcd228cc3e6ff81d06e910d1d3c5b0901b17c00bbf0d4419. If it changes, re-test and preserve the final tested hash rather than reusing this claim.

## Remaining gates

G1 remains IN_PROGRESS. No independently authenticated wallet, live UTXO/consensus proof, signed transaction validation, actual Chipnet/mainnet transfer, receipt, public demo or contest readiness. Eligibility/roll-call, pre-event disclosure, license/IP and XO real executed Invitation/human feedback remain separately tracked. This local slice does not guarantee prizes or income.
