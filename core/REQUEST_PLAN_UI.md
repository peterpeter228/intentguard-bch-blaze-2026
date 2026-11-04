# Clickable offline request planning

The local `/request` page now connects the request-plan SDK through ordinary form controls. This is still an **offline diagnostic flow**, not a payment application. No wallet, secret, signature, transaction broadcast, network request or payment-state journal is involved. The static server remains loopback-only with `connect-src 'none'`.

## Primary path without hand-editing JSON

1. Select **Load full BCH example** or **Load full token example**. This deliberately replaces both the request and funding fields with an entire synthetic scenario. Funding bytes are invented and unbroadcast. A fresh hypothetical timestamp is clearly part of the example, not a current node observation.
2. Select **Review draft** and read the full request terms.
3. Select **I have checked these request details locally**. This is local content review, not spending consent.
4. Inspect the separate funding form and check its acknowledgement that owner, funds and unspent status are not verified.
5. Select **Build offline plan**. The result displays selected input, every recipient/token-change/BCH-change output, exact base units and full category, fees, size assumptions and content bindings.
6. Optionally open technical details or download an **offline plan report**. Download rechecks request fields, acknowledged funding fields, expiry and observation age. Its five authority flags are false. The report omits raw parent and unsigned transaction bytes, and is not an importable approval or receipt.

Missing context never receives teaching defaults. Importing a request or editing any request field clears the old funding context, confirmation and plan. Re-loading an example is an explicit replacement, not a fallback for a failed build.

## Supplied offline data

Users may enter their own funding fields without JSON: full owner/change CashAddr, full parent raw transaction hexadecimal, selected output index, claimed UTC observation time, integer target/maximum rates, a signature-size model and an optional narrowly bounded dust donation choice. Pasting raw transaction bytes is an advanced data-input step, not a node lookup.

The form deliberately supports one selected output from one parent and one declared owner script. Change must decode to that same script. Parent bytes are canonical decoded/re-encoded and hash-bound; the selected output must exist and match the declared owner script. NFTs are rejected. The reusable SDK remains broader and supports its already documented multiple-input/recipient limits. Imported multi-recipient requests preserve their full ordered summary; this narrow funding form does not merge them.

Address checks do not authenticate the owner or merchant. Test-network prefixes do not establish Chipnet. The form explicitly supplies an unspent claim for its selected outpoint; no source has verified it. Such claims remain all-false authority results even if the deterministic comparison succeeds.

## Invalidation and state integrity

- Request input/change events clear request review, funding and plan. The visible request fields are also captured and compared before confirm, build, export and focus/visibility rechecks, so omitted DOM events cannot retain old review.
- Re-review compares earlier request fields regardless of the funding-origin label. A silent request edit followed by a funding edit cannot preserve teaching funds.
- Funding edits clear its acknowledgement and old plan, while preserving unchanged request review. Exact fields, including observation time, are compared against the acknowledged values. A content digest alone cannot detect a changed observation timestamp.
- Editing synthetic funding, including a silent edit before first acknowledgement, changes the label to supplied offline claims. A modified dataset is not called an untouched example.
- Any rejected or mismatched export/build removes the old summary, technical output and enabled download. No earlier success is restored.
- Request expiry and the two-minute observation limit have timers and are rechecked at action time and after focus/visibility changes. Timers are a usability aid, not the authority boundary.
- Clear funding, clear request, replacement examples and reload never restore a prior confirmation or plan. Nothing is persisted in browser storage.

These checks improve honest UI state integrity. They are not a sandbox against arbitrary injected scripts controlling the whole application, nor cryptographic proof that a human reviewed content.

## Verification

`npm run validate` includes existing SDK tests, nine new form-helper tests and eleven DOM-event regression tests. The DOM harness explicitly is **not** browser acceptance. It reproduced and guards against the independently discovered silent request edits, silent funding/observation edits, stale export display and combined re-review cases.

Independent real-browser execution and exact persisted-source checks are recorded under `evidence/request-plan-ui-20261104/`. Check those reports for actual passed, failed and unrun stages. No mobile/browser/chain/wallet success should be inferred from compilation or the DOM harness. No previously restricted screenshot was retried or uploaded.
