# Actual commands / outcomes, 2026-11-04 UTC

- Private Git clone: exit128, no credentials in git transport; used authorized GitHub connector for fixed a304f881 source. No credential created/read.
- Registry and docs read-only HTTP: succeeded. @xo-cash/engine next=0.1.0-next.17612568780; public docs match.
- npm ci --ignore-scripts --no-fund --no-audit: initial default cache failed254; writable --cache /tmp/intentguard-npm-cache succeeded.
- npm install --save-exact @xo-cash/engine@0.1.0-next.17612568780 and direct utils/templates/types pins with --ignore-scripts: exit0.
- Initial direct engine import: exit1, sqlite3 native binding absent (scripts were intentionally disabled).
- Browser esbuild probe: exit1, upstream node:path unresolved. No false browser compatibility pass.
- Native rebuild with guessed /usr node headers: exit1 (headers absent); no bypass or security changes.
- npm rebuild sqlite3 better-sqlite3 --cache /tmp/intentguard-npm-cache --devdir=/tmp/bch-node-headers: exit0.
- npm run validate on final source: exit0; strict tsc, old browser SDK compile probe, and27 tests (10 legacy +17 new). The compile probe is not the browser UI result.
- CLI --synthetic: exit0, report is REJECTED/EMPTY_INVITATION/canSign=false. Command success is not payment approval.
- Separate six HTTP smoke assertions: exit0, all pass. Final aggregate includes stronger split-UTF8 and interrupted-upload regression.
- Clean isolated install/rebuild/retest results are recorded in clean-repro.log; initial default native-cache error retained in clean-repro-initial.log.

Real browser interaction is reported separately under evidence/browser-qa. Not run: wallet/create/sign/broadcast, chain transaction, Debug Tool real execution, public deployment, contest submission, human XO feedback.
