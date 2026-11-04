# XO offline browser QA

Actual UI run began 2026-11-04 11:00 UTC. Loopback-only preview started from ordinary cloud desktop terminal using Node24; Chromium reached http://127.0.0.1:8787. npm run build exited 0. No wallet, signature, external RPC, broadcast or public deployment.

Initial run: loaded unsigned teaching example, inspected, observed REJECTED / EMPTY_INVITATION with canSign false. Changed template identifier: Inputs changed · check again, previous result removed and export disabled. Malformed invitation JSON '{': REJECTED / INVALID_DOCUMENT. Clear emptied all JSON/pin fields and returned No check run, disabled export. Actual browser download copied to exported-report.json. rejected.png shows rejected state.

Concurrent developer changes detected in app.js during initial test: initial downloaded report includes action/limitations; latest source removes arbitrary action field. Initial evidence does not certify the final amended version. Waiting for developer freeze and final reload/restart regression.

## Final frozen-code regression 11:03–11:04 UTC
After developer freeze, restarted same-desktop preview. Initial navigation raced server startup (ERR_CONNECTION_REFUSED); terminal confirmed listening, single reload succeeded. Final app.js module/redact.mjs loaded. Repeated teaching example -> REJECTED / EMPTY_INVITATION. Actual browser downloaded final-export.json at 2026-11-04T11:04:11.517Z; independently parsed file: canSign false, no action, raw issue messages, templateJson or invitationJson. Latest export replaces initial export as final privacy evidence.

Edited invitation to malformed '{': immediately Inputs changed · check again and export disabled. Inspect -> INVALID_DOCUMENT. Clear -> empty JSON and template identifier, No check run, disabled export. final-invalid-json.png captures final error state; final-source-sha256.txt binds reviewed source. No signing/approval control appears. No external RPC, chain execution, wallet, funds, public deployment or competition submission was performed. This certifies only these offline UI paths, not XO novelty, bounty eligibility, complete Guard, valid signed Invitation or actual transactions.

Developer owns source SHA/persistence. This worker made no business-code changes. Loopback service stopped after QA.

Post-QA documentation-only note: preseason/xo/README.md subsequently gained the restricted-container cache/header reproduction instructions. Its recorded QA hash therefore differs; all11 executable/UI/test source hashes in final-source-sha256.txt were rechecked and match. No final UI code changed after the regression.

11:08 UTC post-QA hardening: CLI file input now uses bounded reads/fatal UTF-8 instead of whole-file read; inspect.ts sets the actual commit count before >100 rejection, and its unit test asserts101. These three source/test hashes differ from the recorded browser-run snapshot. No HTML/CSS/app.js/redact.mjs/server.js changed. Full27 tests/typecheck/build were rerun, including HTTP regression; these two adjustments are not claimed to have a separate later visual QA run.
