# Independent real-browser QA

2026-11-04, frozen build tested 17:46–17:49 UTC. Cloud Chrome/CDP via supported cua_repl; http://127.0.0.1:8788/request. Desktop screenshot observed at 1165×747, not persisted or uploaded. No mobile test attempted because of the previously reported restriction and no advertised viewport API. No source edits, wallets, signatures, network chain calls, deployment or submissions.

## Summary

PASS for exercised desktop request → separately acknowledged offline funding → readable plan → actual downloaded report. Both BCH and fungible-token paths require no JSON hand-editing. No app failure found in exercised paths. Primary examples are visibly synthetic. Editing/reviewing/expiry does not retain an exportable old plan.

## Frozen artifact identity

- core/request-ui.ts: 6b58bfe55d95076cd705fbaec99183f9035b7d952d54753f5039e19a893ab2c5
- dist/core/request.js: 2161674dfe740e25f82e700048cf282ba4bfea9e1e4f9a1ca07a9c348cde05dc
- Full source/bundle checksums in source-hashes.txt.

## Checks and outcomes

- Identity/nonblank/framework overlay: PASS. Correct title and route; meaningful full form; no framework overlay.
- Primary BCH: PASS. Explicit local request confirmation alone leaves Build disabled. Separate funding acknowledgement enables it. Input 10,000 sat; recipient 1,000; BCH change 8,781; fee 219; request, intent, plan, policy and binding digests shown.
- Primary token: PASS. Input 500 token base units and 10,000 sat; recipient 100 units/1,000 sat; token change 400 units/657 sat; BCH change 8,018; fee 325. Full 64-character category shown for input and both token outputs.
- Actual downloads: PASS. bch-report.json and token-report.json retrieved using download event and copied from completed paths. Five authority flags false (canSign, broadcastable, receiptValid, networkVerified, ownershipVerified); no raw parent or unsigned transaction in report. Output summaries/fees agree with DOM. Request export also downloaded as request.json.
- Missing context: PASS, fails closed on Build with FORM_FUNDING_ADDRESS and disabled export. Note Build itself can become enabled after manually checking the acknowledgement with empty fields; validation happens on click.
- Field failures: PASS. Invalid owner, different change owner, malformed parent hex, nonexistent index, negative target rate, max rate below target, stale observation each REJECTED; no downloadable prior result and acknowledgement cleared. Specific messages in failures.json.
- Funding edit: PASS, clears acknowledgement and plan but preserves request review.
- Request edit: PASS, clears request review, all funding fields, acknowledgement and plan.
- Re-review: PASS, keeps untouched funding values but requires both local review and funding acknowledgement again and clears old plan.
- Clear funding/request: PASS. Funding clear keeps reviewed request but no context/plan; request clear removes both.
- Import exported request: PASS. Unconfirmed draft only; any loaded funding is cleared. This used exact downloaded content in the import textbox, not hand-crafted primary flow JSON.
- Real observation timer: PASS. Set observation ~110 seconds old, built a valid plan, observed it become NO PLAN after two-minute boundary; acknowledgement/export disabled and expiry message displayed.
- Real request timer: PASS. Set short future expiry, reentered funding through form fields, built successfully, then observed NO DRAFT/NO PLAN, cleared funding, disabled exports and explicit request-expired message.
- Reload after valid plan: PASS, no draft, owner, acknowledgement or plan restored.
- Original inspector regression: PASS. Original payment MATCH_OFFLINE fee500; recipient substitution REJECTED/RECIPIENT_MISMATCH; excessive fee REJECTED/FEE_LIMIT fee1500; original builder BUILT_OFFLINE fee325. Link back to request has no old confirmation/context/plan.
- Console: checked repeatedly, including latest 50 error/warn entries. Observed only browser-extension metadata errors, not app-origin exceptions. This is not a claim that the extension console is clean.
- Visual: desktop entry screen readable, no visible overlap/blank or overlay. Full-flow evidence uses DOM and state, not a complete multi-viewport visual audit.

## Environment and safe recovery

Initial executor-hosted server was not reachable (ERR_CONNECTION_REFUSED). Parent authorized same-cloud-desktop startup. Opened a separate terminal tab, confirmed target dist file exists, used preinstalled /opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node dist/core/server.js (plain node absent from PATH). Loopback-only server then reached through exact authorized URL. Attempt to acquire prior chrome-error tab was URL-policy denied; it was not inspected or bypassed. A fresh tab opened authorized http URL successfully. Clipboard timeout was checked for actual input before supported character typing. One getByLabel select locator missed; fresh DOM confirmed combobox and getByRole succeeded.

Server created for this QA was stopped with Ctrl-C after testing; shell prompt confirmed. Other processes untouched. No screenshots were saved in repo or uploaded; old denied screenshot files and mobile restrictions were not retried. No proxy, security or network settings changed.

## Evidence and limits

Final-only files: exactflows.json, states.json, failures.json, timerbefore.json, timers.json, requesttimerbefore.json, expiry-clear.json, import-reload-inspector.json, oldsmoke.json, bch-report.json, token-report.json, request.json, source-hashes.txt, QA.md. JSON evidence wraps exact tool text; timers.json includes the recovered locator failure alongside successful observation-expiry result. Intermediate pre-freeze evidence was moved outside this repo and is not part of final acceptance.

Unverified: mobile/other browsers, real wallets/chains/signing/receipts, adversarial no-event DOM mutations (browser evaluation is read-only; separate unit/DOM tests cover those). Technical expandable details were exercised on the immediately preceding build; final reports and normal visible summary were checked again on frozen build. No authorization is inferred from offline success.
