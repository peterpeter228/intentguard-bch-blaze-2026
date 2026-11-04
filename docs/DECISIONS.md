# Decisions

2026-10-27: follow supplied new-project G0/preseason path. Existing NEAR IntentGuard is unrelated and not reused as BCH migration evidence. Core G1 implementation deferred to official contest window, unless user later explicitly chooses a transparently disclosed prior-project strategy compatible with confirmed rules.

Use one npm lockfile, strict official types, no custom SDK declarations or type suppression. Pin candidate package versions only after actual install/build. Use no wallets/secrets/chain side effects for G0. Avoid Next.js scaffolding/visual payment UI before G1; browser-target SDK bundling is a compatibility experiment, not a runnable product.

Keep SDK pre-abort ordering risk visible; do not add a production signing adapter prematurely. Actual wallet no-broadcast behavior is mandatory before claiming post-sign prevention. Public distribution review remains open. Exact upstream gitHeads have verified LGPLv3 LICENSE.txt despite npm metadata lacking license; see post-Argon evidence, not a blanket no-license claim.


2026-11-04: retain new-project/preseason strategy and G1 event-window boundary. Implement only isolated XO schema/acceptance/expiry tooling and teaching UI, using official current engine rather than upgrading old probe claims. All lab work is explicitly preseason; it does not implement or award a novel template. Local Node preview is necessary because current engine transitive browser packaging fails on node:path; do not stub dependencies or disable validation to manufacture browser compatibility.

2026-11-04 13:22 UTC user update: “你现在先做核心开发”. This explicitly supersedes our earlier voluntary G1 deferral. Begin the core transaction comparator now and disclose every current change as pre-event. The official published build window remains November 14–22; no claim is made that pre-event work automatically qualifies or is absolutely forbidden. Preserve the fixed earlier baseline 4bf2d146c701822526faa0622dd26772dc18c705 and distinguish later event-period improvements. No signing, wallet transactions, deployment, public release, outreach or submission is authorized by this change.

2026-11-04 unsigned-planner scope: explicit selected inputs only, no coin discovery or wallet integration. Fee models are declared assumptions (compressed-key/minimal-push Schnorr or conservative strict-low-S ECDSA envelope), not authenticated wallet capabilities. Preserve exact recipients and all fungible-token change; reject non-dust uneconomic remainder rather than silently donate it. The optional dust donation is narrowly below546 sat at the fixed1000sat/kB baseline and still subject to absolute and worst-case rate caps. No plan/import can promote payment or review state. This work is pre-event and private.

## 2026-11-04 — Request review is not spending authority

The new structured request page operates on a separate strict draft schema. CashAddr decoding is local address formatting and script derivation, not wallet ownership, recipient identity, network connectivity or a signature. Review state is tab-local and never exported/imported as authority. Amounts use decimal strings and integer base units; token addresses require explicit token-aware P2PKH. A 24-hour maximum request validity is our conservative application policy, not a contest or BCH consensus rule. No owner-change scripts or actual UTXOs are inferred from the merchant address.

## 2026-11-04 — Explicit request-to-plan boundary

Connect validated request content to the offline builder through a separate SDK adapter, not through the teaching UI's fixture wallet. Expected request digest comes from application review state, but equality remains provenance rather than human-consent proof. Bound policy includes owner/change/fee choices even where a choice does not change transaction bytes. Snapshot observations are revalidated at invocation and are not included in the content identifier as authority. No live wallet, chain, payment or receipt capability is added.

## 2026-11-04 — UI planning stays explicitly offline

Use separate request and funding acknowledgements. The complete synthetic example loader replaces both datasets and is never a fallback for a missing context. Clear funding on any detected request change, including a re-review with missing input events. Capture exact funding fields because content hashes intentionally exclude observation time. Form support is one selected parent output and same-script change; do not imply authenticated ownership, available balances or a wallet's signing ability. The diagnostic export is not a receipt or reusable authorization.
