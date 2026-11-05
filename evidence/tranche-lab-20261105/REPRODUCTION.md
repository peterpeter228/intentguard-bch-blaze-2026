# Final reproduction record

Fixed remote baseline: 6f762050eee1c520b6b9f1ffb541c2aaf014a10a.
This selected-source directory is not a Git checkout. The implementation-stage run below preceded publication; remote preservation and verification are recorded separately.

The definitive run is `npm run validate`, recorded in VALIDATION.log with its exact
UTC start/end and exit code. It includes strict typecheck, build, and all existing
and newly added tests. CLI_RESULT.json is the bounded synthetic report from
`node dist/preseason/allowance/cli.js` after that build.

Development runs are superseded. Early exploratory compilation found and corrected:
1. Missing required sourceCommitIdentifier in completed merged outputs (typecheck).
2. XO lockingBytecode requiring a named script reference rather than inline source.
3. Payout value requiring a decimal string rather than a bare CashASM push string.
4. Strict noUncheckedIndexedAccess assertions in mutation tests.
No dependency or lockfile patch was needed. Focused tests then passed, and aggregate
runs passed before additional disclosure flags and one helper-vs-covenant regression
were added. Only the timestamped final run is the definitive final-source validation.

No live chain, account, key, signature, funding, transaction broadcast, normal signed
Invitation execution or chain maturity was tested. All authority flags are false.
