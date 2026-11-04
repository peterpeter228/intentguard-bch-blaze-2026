# Read-only coordination and token-aware dust slice

Base: cd0ee718c02fb11956b71d482c3e2050b78290d1. All changes are pre-event development. The application does not connect wallets, sign, broadcast, deploy, publish, contact organizers or submit entries.

Implemented separate read-only SQLite review coordination with internally derived ownership and internally collected source evidence. It binds intent, exact candidate bytes, stable request key, session, paths and declared source metadata. PENDING is committed before awaits; repeated, reopened or crashed records never become fresh success. Source summaries are bounded and no caller-supplied report/status is accepted. Every record remains canSign=false/receiptValid=false/consensusVerified=false. Source configuration still trusts application adapters; hashes are not proof of an endpoint or independent backend.

Independent code review found a return-time tip-age gap after persistence. It was fixed and regression-tested; successful completion later than a source freshness window returns STALE_RECHECK_REQUIRED. Tests include real private SQLite files, two-connection reservation races, restart and a child-process SIGKILL after reservation. Chain data and session adapters in tests are synthetic, never actual wallet or node success.

The deterministic guard now includes full CashTokens serialized-output dust using libauth at a fixed1000sat/1000bytes baseline. 546 sats remains correct only for plain P2PKH in this supported scope. FT output amount100 requires651; amount253 requires657. Recipient and change are checked. This is application relay policy, not consensus/current mempool assurance. Fee-rate caps, final signed-size verification and an unsigned builder remain incomplete. Official fixed-source research is in FEE_DUST_REVIEW.md.

Local `npm run validate`: exit0,109/109 tests, strict typecheck and build. initial-validation.log is the earlier107-test run, superseded by local-validation.log. These local logs are not themselves remote validation; the exact remote snapshot is checked separately after upload.

Real desktop browser QA: browser/QA.md. Six original scenarios, token dust650 reject/651 match, edit invalidation, bad JSON, Clear/reload,600000/600001-byte limits and actual downloaded report passed. Browser app bundle SHA2567a647361af38b98277be90ca243e07c683fbe8f1ac504645c36abb6e67acef80. App console had no errors; extension errors were separated. Mobile NOT_RUN, no organization-policy workaround. The temporary loopback server was stopped by its owning tester.

No live-source success is asserted: earlier EAI_AGAIN remains a recorded connectivity gap. Mainnet functionality, wallet non-broadcast/sighash guarantees, public demo, eligibility/roll-call, IP and submission requirements remain outstanding.
