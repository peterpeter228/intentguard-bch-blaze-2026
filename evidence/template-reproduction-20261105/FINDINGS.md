# New zero-value output reproduction, 2026-11-05

This is new work from fixed remote commit `53b05b4608c939146e18f9f11ed3b7e44c4592a6`, not restoration of the nine unavailable 2026-11-04 files. Their exact contents and blob mappings could not be recovered from the available workspace, Notion page or Linear comment. Those records preserve historical conclusions, not the original script, JSON result, complete logs or design. No original file hash, recovered-byte claim, old timestamp or old test log is fabricated here.

## Actual result

`zero-value-output-repro.mjs` uses the real pinned XO functions and a deliberately modified in-memory P2PKH reference template. It is a diagnostic fixture, not a novel template or implemented invoice product. Its 32-byte `ab` marker is public synthetic data, not an actual invoice hash. All parent/input/owner/unspent data are synthetic. No Engine, account, Invitation or wallet was created and no key, signature, chain request or broadcast was made.

- Unresolved data declaration supplied directly to the builder: 3 serialized outputs, including one 0-satoshi OP_RETURN. The existing Guard rejects it with `UNSUPPORTED_OUTPUT_SCRIPT`.
- The same data output first passed through `completeMergedOutput`: the output has `valueSatoshis: 0n` and correct bytecode. The builder then omits it, leaving 2 ordinary payment outputs.
- The latter bytes are exactly equal to the ordinary payment control, and Guard returns `MATCH_OFFLINE` for that ordinary payment only. This cannot validate invoice correspondence.
- Assertions check these outcomes, token absence, empty unlocking scripts and the ordinary payment control. The result is explicitly `BLOCKER_REPRODUCED_NOT_FEATURE_SUCCESS`; all spending/broadcast/receipt/network/ownership flags remain false.

See `RESULT.json` for the new actual execution time, outputs, candidate hashes and package versions. The new diagnostic template identifier intentionally differs from the unavailable historical fixture. Neither equality of past source descriptions nor re-observing the same defect proves recovery of its original bytes.

## Pinned SDK and source trace

Installed packages: engine `0.1.0-next.17612568780`, templates `0.0.12`, utils `0.0.10`, types `0.0.8`. Installed engine `dist/index.mjs` SHA-256 is `bcab1da31c349b14ba365144acc09e70148a55adbb6beee2cc0f60603dcf7011`. This is a pinned-version result, not a claim that all current or future releases behave identically.

Relevant lines in that exact installed engine:

1. `executeAction` at 6070 calls `getMergedInvitationOrThrow`, then builds the merged transaction.
2. `getMergedInvitationOrThrow` at 5864 calls `mergeInvitationCommits`.
3. `mergeInvitationCommits` at 5737 calls `resolveMergedOutputs` before ordering outputs.
4. `resolveMergedOutputs` at 5545 calls `completeMergedOutput` (5479), resolving the template's zero amount to `0n`.
5. `buildInvitationTransactionFromMergedCommit` at 5946 calls `encodeMergedInvitationTransaction` (5899), whose loop skips outputs with a defined amount less than or equal to zero before considering their bytecode.

The normal account-flow implication is an inference from this exact source trace plus the actual pure-function reproduction. A real accepted/signed Invitation was NOT executed. The inference is conditional on a valid Invitation supplying such an output; this run does not prove that a valid account/Invitation workflow can be assembled for this fixture. Direct unresolved-only construction is a comparison case, not a supported workaround or proof of normal end-to-end template success. Template presence alone is not evidence that required output semantics survived serialization.

## Design candidate and remaining gates

The recoverable design idea is binding a payment to canonical invoice content, motivated by the existing PRD's application-database order-correlation limitation. It remains a design candidate only. A reference-template rename, generic co-funding or ordinary multi-recipient payment is not claimed as original work. No global novelty or judge acceptance claim is made.

A viable design would need exact, versioned canonical terms bound to the actual recipient, network, integer amount and asset category; an unambiguous domain separator; high-entropy nonce/identifier policy; and independently checked, exactly one zero-valued token-free data output. Predictable invoice hashes do not automatically preserve privacy. Such correspondence does not establish merchant identity, human consent, goods delivery, confirmation, freshness or prevention of repeat payment.

First obtain supported normal merge/build behavior that retains the intended data output. Then separately design and review the narrow data-output, fee/size and request-binding policy. The current Guard intentionally supports P2PKH payments only. Do not relax unknown-script rejection, burn positive value, patch dependency behavior, bypass normal merging, introduce custody, or promote an ordinary-payment match to invoice success. No upstream issue/message was sent and no human-only participant feedback was authored.

## New validation and its limits

87 selected blobs were downloaded from the fixed remote tree and independently Git-blob hashed before use. They contain all executable `core/`, `preseason/`, `probes/` files, build manifests, required public signature vectors and selected project documents. This is NOT a fresh full 380-file checkout; old screenshots and most historical evidence were unnecessary and not downloaded. `SOURCE_MANIFEST.json` records the exact baseline inputs, before three documentation-only appends.

Dependencies were freshly installed from the unchanged lockfile: `npm ci --ignore-scripts --no-audit --no-fund` with a writable workspace cache, then standard `npm rebuild sqlite3`. The initial default-cache failure and wrong explicit header-path attempt are disclosed in `VALIDATION.log`; an early validation started before native setup completed was interrupted, not counted as passing. Final `timeout 180s npm run validate` exited 0 with typecheck, build and 223/223 tests. The reproduction is additional to, not included in, that existing test count. The independent reviewer rechecks the final script and unchanged runtime source separately.

No product code, package manifest, lockfile or original template was edited. Fresh browser bundles have different hashes from the historical browser-test record; their equality is not established, and no old browser result is reused as validation of this new build. There was no new browser/mobile QA, real-chain validation, CI pass, wallet action, signature, deployment, public release or contest submission. Prior denied screenshots were not read, recreated or uploaded. These text/JSON/log records establish a pinned offline defect and a product-policy gap, not a completed bounty feature.

## Provenance

- [Fixed source commit](https://github.com/peterpeter228/intentguard-bch/commit/53b05b4608c939146e18f9f11ed3b7e44c4592a6)
- [Existing PRD](https://github.com/peterpeter228/intentguard-bch/blob/53b05b4608c939146e18f9f11ed3b7e44c4592a6/docs/03_PRD.md)
- [Pinned engine registry metadata](https://registry.npmjs.org/@xo-cash/engine/0.1.0-next.17612568780)
- [Notion historical report](https://app.notion.com/p/40601c911722814b842fe751489d2bad), section DOT-BCH-TEMPLATE-FEASIBILITY-20261104T1833.
- [Linear project](https://linear.app/happydayje/project/intentguard-bch-fa4cc5941cb0), historical comment `ef7ee135-d156-477b-b02d-e1708cd59839`.

These historical narrative sources were reread for recovery; current contest rules were not re-audited in this bounded reproduction task. Publication and branch readback are reported only after their actual completion, not inferred from this pre-publication local report.
