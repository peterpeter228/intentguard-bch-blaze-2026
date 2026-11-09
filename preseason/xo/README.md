# XO offline lab — pre-event baseline, 2026-11-04

## November 9 Q1=B identity-only evidence

One explicitly owner-authorized, new dedicated Chipnet identity/session produced a
real Engine identity-signed initial Invitation and unchanged `serializeInvitation`
export. Existing CLI returned REVIEW_REQUIRED / canSign=false with no issues;
public signature tampering returned CommitSignatureInvalidError. Exact public
bytes, template, independent pin/provenance, trusted timestamps and hashes are in
task bch-blaze-chipnet-20261109 artifacts, not a repository signed fixture.

`chipnet-session.mjs` is a consumed, single-task evidence command, NOT a production
wallet adapter or general credential loader. Doctor is read-only. The initial
wrapper host:port mismatch and exact same-identity, proved-zero-signing continuation
are retained, not erased. One identity, two connection initializations, ONE signing
call; no financial transaction/signature/funding/broadcast. Never run create or the
consumed reconciliation again. Use the generated project-local verification skills
for public offline inspection and bounded lifecycle checks. No Guard rule changed.
Parent fresh Astra/static gate and independent public smoke remain separate.

This is preparation code, not the contest-period product, novel template, wallet, or executed invitation. It extends the existing G0 branch a304f8810c402fd29b105563a136379e42f246af without modifying main or PR #1.

## Reproduce

Node 24.22.1 was used. In a fresh checkout:

```
npm ci --ignore-scripts --no-fund --no-audit
npm rebuild sqlite3 better-sqlite3
npm run validate
npm run xo:inspect -- --synthetic
npm run xo:preview
```

Open http://127.0.0.1:8787 in the same machine/network namespace. The preview binds loopback only. Do not expose or deploy it. No account, mnemonic, wallet, signing, broadcasting or Electrum connection is created. Do not paste secret keys, seed phrases, real wallet exports or customer data.

In restricted containers without a writable home directory, the actual successful commands used `--cache /tmp/intentguard-npm-cache` for npm and `--devdir=/tmp/bch-node-headers` for rebuild. Default cache/header paths failed; do not treat them as passing.

The native rebuild is necessary because the upstream engine imports storage dependencies even when only its pure validation exports are used. With scripts disabled, direct import initially failed on sqlite3 bindings. Native rebuild succeeded from the official dependency install. No SDK code, security check, or native import was stubbed. A full engine browser bundle also failed on upstream node:path; this is a Node-backed local laboratory, not proof of browser-wallet integration.

To inspect files: `npm run xo:inspect -- template.json invitation.json chipnet INDEPENDENT_TEMPLATE_HASH`. The invitation must use official `serializeInvitation` extended JSON. Do not JSON-normalize commit objects after signature creation: their field order matters upstream.

## What is actually checked

- Official parseTemplate / deserializeInvitation; independently selected template content pin.
- Actual engine listInvitationValidationIssues and the three additional acceptance-path assertions for immutable commits, role variable ownership and follow-up role consistency.
- Local additional fail-closed rules: empty invitation, bounded input/commits, safe timestamps, future creation, expiry.
- Every result keeps canSign=false. Even no findings means REVIEW_REQUIRED, never PASS or READY_TO_PAY.
- An imported template's own calculated hash is not independent proof of trust. The teaching button pins only the official packaged P2PKH reference, not an arbitrary uploaded template.
- Export strips free-text action, raw errors and payloads. The full local view can show validation errors; do not feed it sensitive documents.

## Findings and limits

Official engine helper accepts an empty, structurally valid invitation without findings. This tool explicitly rejects it. Official docs say commit expiry is not currently acted on by the engine; this tool rejects expired commits. Template import validates structure, not contract safety.

Template identifiers must be generated after official parseTemplate normalization, as importTemplate does. For templates0.0.12 P2PKH the normalized identifier is a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672; hashing the original exported object gives a different identifier due to serialization order. Regression tests bind the normalized reference.

No vetted public signed invitation is included. Negative signature tests use
deliberately invalid, unsigned synthetic data and do not prove successful validation
of a real valid Invitation signature. The separate core now implements offline
transaction, fee and recipient checks, but this inspector does not perform them.
The separate tranche lab is experimental and must never be funded. Normal
authenticated Invitation execution, Debug Tool import, live wallet interoperability
and novel-template bounty qualification remain unverified.

## Contest boundary and next milestone

Official build window is November14–22, closing November22 14:00UTC. This whole
directory is November4 preseason work. Do not relabel it as in-window development.
The user's later November4 core-development instruction superseded the voluntary
G1 deferral; the resulting core work is also disclosed pre-event. Real payment and
receipt integration remains unfinished. XO remains optional until a useful novel
contract and supported execution can be established without manufacturing custody
or duplicating P2PKH. A schema inspector alone does not satisfy Build with XO.

The bounty additionally requires an actual Chipnet/Mainnet execution, executed invitation, reproduction instructions and applicable follow-up actions. Personal development feedback must be written by the human; this lab does not generate it. Main-track mainnet requirement, attendance, public demo, rights/licensing review and submission remain separate gates.

Sources read 2026-11-04: https://bchblaze.cash/bounties/ ; https://bchblaze.cash/schedule/ ; https://stack.xo.cash/getting-started.html ; https://registry.npmjs.org/@xo-cash/engine . Exact package tree and integrity are in package-lock.json.
