# Keyless preparation — PRESEASON, 2026-11-09

Outcome: reachable preparation completed; authenticated XO integration remains **BLOCKED_EXTERNAL / needs_owner**. No application, Guard, fee, expiry, ownership or UNKNOWN-state behavior changed. No signed-positive or chain/payment/receipt success is claimed.

Source: `a82807ae0293baee39a185e229f906718e095e59`, branch `feat/openbot-bch-20261108`. The exact docs/evidence candidate commit SHA is bound after its one local commit in current task `result.json` and `artifacts/final-result.json`; it cannot be embedded in its own committed bytes. Parent final review must use the actual base-to-candidate diff, not this author's summary. No child push/deploy/preview.

## Reused approval and ownership

Current task `bch-blaze-dev-20261109` resumes `bch-blaze-dev-20261108` with output namespace remapped to this directory. Prior task `artifacts/PLAN.md` (Sol revision 1) and `artifacts/plan-gate.md` are reused unchanged. Plan gate: Astra PASS / 未满足 0, receipt `ob-c1eaaf24bfd1f75398cf33048a61a73c9a56616df3a3fd583c1500f6c5f9a394`. Initial Opus receipt `ob-d1f3902f16b072e9075309b1e6ee84e31f57c4e8d3a75a8cf677223647ff2103`, session `01a1bbe5-681a-70f4-9189-d76ef3097bf5`. No repeated planning or recursive model call.

Sol implementation: `sub2api/gpt-6.1-sol:high`, receipt `ob-232b461f7a4ad0860f055d4f26cd69cbc8a7e2f4ba0e6ba96f1bf1e75f556381`. Parent retains manual task lock; child neither acquired nor released it. See `preflight.md`. Fresh explicit `sub2api/gpt-6-astra:high` final static diff review and independent parent inspection remain separate parent-owned gates, maximum two review/fix rounds. No final review PASS is self-awarded here.

## Actual fresh baseline

Node **v24.22.2**, npm **11.19.1**. Current-task npm-cache, TMPDIR and node-gyp environment; native headers `/opt/aicc/node-v24.22.2-linux-x64`. Finite command timeout: 600 s per npm command; no task-wide timeout. Actual commands:

| Command | Exit | Duration |
| --- | --- | --- |
| `npm ci --ignore-scripts --no-fund --no-audit` | 0 | 3519 ms |
| `npm rebuild sqlite3 better-sqlite3` | 0 | 696 ms |
| `npm run validate` | 0 | 16677 ms |

Typecheck/build passed; **253 tests, 253 pass, 0 fail/cancelled/skipped** in this execution, not reused historical counts. Raw combined stdout/stderr: `baseline.log`; command timing/exit/hash records: `baseline-result.json`. Original baseline recorder's summary filter recognized TAP `#`, while Node emitted `ℹ`; the untouched raw log and `manifest.json` carry the actual totals. The filter was corrected for final recording, without rerunning install/baseline.

Package/lock SHA-256 unchanged before/after install:

- package.json: `3880cd44c1c773ce0ab8025177341cd368dd449d6b1e811448cfe9b0fcc18799`
- package-lock.json: `c97ac66dcc70b702393adcfe7851cbe58fb1f5d77a37ebf5facc26eccff41e87`

npm emitted deprecation and future env-config warnings; no dependency/lockfile changes or warning-suppression workaround. Native rebuild returned success; no forced source-build claim. Final exact-candidate `npm run validate` raw output and result are in current-task `artifacts/final.log` / `artifacts/final-result.json`, outside the candidate commit to avoid mutating the reviewed candidate with post-commit logs. These are a required separate run, not this baseline or signed-integration evidence.

## Exercised bounded transport

Actual `node <current-task>/artifacts/probe.mjs`, exit 0 means recording completed, not connectivity passed. Reused unchanged `createReviewedChipnetCandidates` / `createElectrumTransport`, exactly one invocation per existing endpoint, 5000 ms total deadline including TLS + fixed 1.5.0 handshake, no retries or bypass. Only checkpoint header `121957` requested; no address/identity/wallet/script-hash subscription, transaction query or broadcast.

| Endpoint | Raw transport outcome | Duration | Header |
| --- | --- | --- | --- |
| chipnet.bch.ninja:50002 | ELECTRUM_UNSUPPORTED_PROTOCOL | 905 ms | unavailable |
| chipnet.imaginary.cash:50002 | ELECTRUM_UNSUPPORTED_PROTOCOL | 725 ms | unavailable |

`transport-probe.log` is the raw JSONL result. This is rejection of the version-stage response shape/version, not a DNS failure; transport does not expose the exact remote version. No header/payment/ownership was verified. The different Engine network path was not executed, so its connectivity is still unverified, not proved broken by these probes. No extra network-route decision is needed for offline import of an existing artifact.

## Installed API evidence and smallest real input

Read [api-notes.md](api-notes.md), verbatim numbered excerpts in `api-source.log`, and `api-source-hashes.json`. Source-map extraction read public installed package bytes only; no Engine/Crypto/serializer API import or invocation. Sources attributed to official pinned `@xo-cash/engine`, utils, state, crypto (MIT packages), and `@electrum-cash/application`; hashes bind the exact installed files, not a latest-doc guess. `preparation-sources.log` retains the task-only recorder/probe/extractor source as evidence, not new product helpers or permanent tests.

`Engine.create(mnemonic, options)` unconditionally initializes network/storage and derives identity keys. Network defaults to **mainnet**, storage to IndexedDB; explicit Chipnet and protected state paths are essential for any separately authorized session. `createInvitation(params)` calls actual Schnorr identity signing, persists invitation/possible generated secrets, and may track outputs/reserve inputs even without funding. Neither was invoked.

Minimum next input: an **already existing** non-sensitive exact `serializeInvitation(storedInvitation.invitation)` export, exact template JSON, declared network, independent normalized template pin and source/review provenance. Not full StoredInvitation/account backup/seed/key/token. Preserve signed fields/order; do not create a fixture or ask the owner to sign under an existing-artifact option. No private artifact belongs in repo logs or third-party review tools. The existing offline inspector can check it with `canSign=false`; expiry, transaction/fee, chain/ownership and current-execution limits remain intact.

## Stop and excluded actions

Wallet **not created; not required for keyless preparation**. Public address unavailable; current funding request **0 sat**. No wallet-generation procedure or recovery check ran. No Engine/account session, new identity signature, signed fixture, transaction signing, funding, broadcast, payment, receipt, deploy, preview, public sharing, main/PR/fork/visibility change, contest submission/IP acceptance or personal-feedback ghostwriting. The existing unsafe tranche remains never fundable. Existing baseline tests using offline transactions do not change those live-integration facts.

Only current task `QUESTIONS.json` requests A: existing shareable artifact (recommended), B: separately scoped new Chipnet session/identity-signature authorization, or C: defer. End needs_owner; do not infer B from this resume or fund anything. `SYNC_PROPOSAL.md` stays task-local for Rio; DOT remains canonical build_owner and Hunter lifecycle owner. Parent alone inspects permitted preparation, runs the fresh static Astra gate, decides acceptance/publication and releases its own lock at terminal. No external tracker write by this worker.
