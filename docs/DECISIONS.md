# Decisions

2026-10-27: follow supplied new-project G0/preseason path. Existing NEAR IntentGuard is unrelated and not reused as BCH migration evidence. Core G1 implementation deferred to official contest window, unless user later explicitly chooses a transparently disclosed prior-project strategy compatible with confirmed rules.

Use one npm lockfile, strict official types, no custom SDK declarations or type suppression. Pin candidate package versions only after actual install/build. Use no wallets/secrets/chain side effects for G0. Avoid Next.js scaffolding/visual payment UI before G1; browser-target SDK bundling is a compatibility experiment, not a runnable product.

Keep SDK pre-abort ordering risk visible; do not add a production signing adapter prematurely. Actual wallet no-broadcast behavior is mandatory before claiming post-sign prevention. Public licensing review remains open because Wizard package metadata does not specify license.
