# Independent XO candidate boundary review

Reviewed 2026-11-04 UTC. Outcome: no unresolved blocker found within the bounded offline scope described below. This is not a payment, wallet, live-chain, browser, contest, or production-security acceptance.

Coordinator-supplied baseline: `645240141568660db9960c15729d5085617e71b1`. The local review directory is a source snapshot without Git metadata, so this review binds the actual files by SHA-256 rather than claiming a locally verified Git HEAD. Implementation sources were frozen by the coordinator after final validation.

## Executed checks

- Read repository instructions, current status/decisions/next actions, actual implementation and installed pinned XO implementation/types.
- Initial strict typecheck, build, and focused adapter plus DOM harness: 26/26 tests passed.
- Standalone integrated HTTP suite: 1/1 passed, containing positive BCH/token and numerous negative assertions; actual local server process and loopback requests only.
- Initial full suite before final UI hardening rebuild: 222/222 passed.
- Final `npm run validate`: exit 0; strict TypeScript (no SDK declaration suppression), all browser bundles, and 223/223 tests passed. Final run log SHA-256: `a74ba881b8f732abfd8c33925628f015c75d429df581d6fd35985a46c799808d` (local scratch log `/tmp/xo-independent-final-validate.log`).
- Additional independent actual-engine probe, `node /tmp/xo-independent-probe.mjs`, exit 0: altered unlocking bytecode, sequence, version, locktime, zero-valued change skipped by upstream encoding, added dust change, and one-satoshi fee drift all failed exact candidate/plan byte comparison. The fee drift retained Guard `MATCH_OFFLINE`, demonstrating that exact comparison provides a separate necessary boundary. Probe SHA-256: `667a61663ddada14507bd73df7867ba4c7db1a3c2ae7491a05945a8b6b9c4f3a`.

## Findings and resolution

The initial UI response validator accepted a superficially valid success whose Guard verdict, official template/action, output/fee/size summary, or additional fields disagreed with the local plan. Export spread could retain unexpected payload fields. This was defense-in-depth exposure to malformed or mismatched endpoint responses, not an observed bypass of the correctly implemented trusted backend.

Resolved before freeze: success acceptance now requires the exact report and binding key sets, independently recomputed context/candidate/binding digests, pinned template and intended action, exact local Guard report, output summary, fee, unsigned byte count, and signed-size estimate. Top-level authority flags must remain false. Final DOM regression rejects 13 altered response variants, including extra raw-payload fields, and confirms a later valid result still works. Source review and final rebuild independently verified this correction.

## Reviewed boundary behavior

- The recipient is genuinely derived by pinned official `completeMergedOutput`: script and BCH amount, or script/category/fungible amount, come from request variables. FT carrying BCH is explicitly supplied because this template leaves it unset. Recipient script/token fields are not prefilled to bypass compilation.
- Normalized template identifier is pinned to `a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672`. Formatting-insensitive identity and non-symmetric full category bytes are tested.
- Existing independent planner supplies selected inputs, change and conservative fee policy. All upstream transaction bytes are independently decoded by Guard and compared exactly to that plan. Upstream count-only fee estimation is informational only.
- Installed engine may retain caller-provided output fields and skip nonpositive outputs. The wrapper uses controlled validated fields and requires full exact comparison, rather than assuming upstream action/commit validation.
- No Invitation is created, accepted, signed or authenticated. The local provenance label is explicitly diagnostic. No Engine instance, wallet, key, signature, node, network source, receipt or payment authority is introduced.
- Server enforces loopback bind and exact allowed Host, same Origin/browser metadata restrictions, JSON content type, strict UTF-8, duplicate decoded key refusal, nesting/body limits, upload timeout, safe failures and bounded response size. Clock is server-selected; request and funding freshness are checked again after compilation. Request interruption does not crash subsequent requests.
- UI epoch/cancellation handling prevents older replies from restoring state after edits, cancel or newer comparisons. Revalidation catches silent request/funding edits and real-clock expiry at response/export, independently of timers. Repeat clicks are disabled during an active comparison.
- Current successful reports omit candidate transaction bytes, complete parent bytes and source contexts. Technical/export content retains only the bounded report fields; all spending/network/ownership/receipt flags remain false.

## Scope and remaining limits

All funding and chain observations used here are explicitly synthetic or caller-supplied offline claims. Tests are Node unit tests, a synthetic DOM harness and local HTTP, not real-browser acceptance. No screenshot, mobile test, wallet signing, live node, credentials, external model, deployment, public submission or transaction was performed by this reviewer.

The synchronous compilation path cannot be interrupted in the middle of CPU work. Bounded input sizes and elapsed-time result rejection reduce exposure but are not a preemptive worker timeout. The server is a local diagnostic, not a public hardened service.

Successful equality is content binding, not proof of human consent, authentic source observations, current spendability, valid Invitation conditions, template novelty, signatures or payment completion. This review does not close those gates or verify remote persisted source bytes.

## Frozen file SHA-256

- `core/xo-candidate.ts`: `82c14bdec032ec2ce9730f79a4074c609247bbe44b931757aa1ef0b626b95178`
- `core/xo-candidate.test.ts`: `f578192f784a19f25c5f24f3a37c0084dceeeb051c1e055f3b3d9a1f079139f9`
- `core/server.ts`: `fc5bdfe9db7593c3f57c3428ba487b000323f99d258cfa2fe6dab17f9771448f`
- `core/http.test.mjs`: `ff34ee442c3bd86b1ac034b7e268d2fc62349eecc40a56d4de458fb8a1d88c5f`
- `core/request-ui.ts`: `60ea7e8ef2187e759576114397a96255db4c22c85e3be22aec4097004cc0d1b1`
- `core/request-ui.test.mjs`: `5c1d66cf35b4bea4d52de92ca55422bf04d02a4822963352654436f9e74e4426`
- `core/request.html`: `22960ab0e2d6f62670eaf80072ffcef5b5f5f44b92021460604f79c320c390b4`
- `dist/core/request.js`: `baa9c564fbecd4e5edccdb531dc677462991d74f522746a74104223d74a3b441`
- `package.json`: `b5df59e88dfbae8edb920a6641733fe743a821e037c8628ab812f3e40efd3b34`
- `package-lock.json`: `7f43476aef066c9263c69dd12d97c70594471dc9478471205137e429d0683347`
