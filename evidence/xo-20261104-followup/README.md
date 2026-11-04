# Follow-up: close concrete verification gaps (2026-11-04 12:07 UTC onward)

Starting remote was verified as0015efdb784df67145cbb6266ccbd5d9115e64d2. No duplicate branch/repository, signing, account creation, transaction, deployment or submission.

Added three CLI regression tests: synthetic invocation cannot authorize signing; invalid arguments exit2; oversized/invalidUTF8/missing local files exit1 with no contents/path disclosed. Exactly256KiB is readable but invalid JSON remains rejected. Expanded actual HTTP regression to cover forged Host rejection403,600001-byte request rejection413 and continued server response.

`npm run validate`: exit0,31 tests pass, strict typecheck/build pass. Tests launch real local Node HTTP server and CLI processes, not mocks. Browser/application source is unchanged from0015efdb; no new visual QA or wallet compatibility is claimed. The initial Host assertion using fetch failed because fetch did not send the chosen Host header; replaced with Node HTTP request explicitly carrying Host. Do not claim that initial test proved a server flaw.

Official schedule re-read: build period November14–22; preparation remains pre-event. No premature G1 payment implementation. Public signed Invitation research is separately recorded; absence of a compatible fixture is not cured by synthesizing a signature.

Added one provenance-bound official legacy Invitation rejection regression, not a valid signed positive fixture. See PUBLIC_FIXTURE_SEARCH.md. Tests increased from27 to31, without changing application/business logic.
