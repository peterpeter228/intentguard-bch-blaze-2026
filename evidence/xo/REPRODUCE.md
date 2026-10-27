# Reproduce limited published-example smoke check

This does not install or run the XO engine. It downloads an official npm package and imports its data-export module. Read the module before execution; do not execute generated keys, sign or broadcast operations.

1. GET https://registry.npmjs.org/@xo-cash/templates/0.0.1.
2. Download the response's exact `dist.tarball` URL. Check its SHA1 equals `dist.shasum` and compare observed SHA256 to `package-inspection.json`.
3. Safely extract under `templates-0.0.1/` (reject absolute paths, traversal and unsafe links).
4. Inspect `package/dist/index.mjs`: the observed release declares a template data object and exports it, without imports or network calls.
5. From this directory run `node inspect-published-template.mjs`.
6. Expect module import and references for the nine transaction-bearing actions to pass; `sign`/`verify` have no transaction and return null for that check.

Result only proves the published object is readable and these references resolve. It does not validate all fields, scripts, wallet inputs or blockchain behavior. No complete dependency lockfile or official Debug Tool baseline was established.
