# Pre-existing work disclosure — PRESEASON

All work below predates the announced November14–22,2026 hacking window. This is
an honest existing-code baseline, not a claim of event-period novelty, eligibility,
mainnet readiness, adoption or a public demo. Do not rewrite Git dates/history.
Original pre-core baseline remains `4bf2d146c701822526faa0622dd26772dc18c705`.
Current task began from `48f5311c1deb4c61b9a8c2732599cca69984f4b3`.

## Actual history

Source: `git log --reverse --format='%H %aI %cI %s'`, read November9.
Author and committer timestamps are identical for every row; the timestamp column
records both, including their actual offset. Documentation/evidence commits remain
listed, not relabelled as new capabilities. Functions are implementation scope,
not assertions that every wallet/network/browser combination was exercised.

| Full commit SHA | Author = committer ISO timestamp | Work already present |
|---|---|---|
| f0722677d80e3390bf4f4f5c8f991c783691cf6c | 2026-10-27T17:34:55+09:00 | Initial repository |
| 955e5c0afebedb5931d24feaa4261917131f88a3 | 2026-10-27T16:48:08+08:00 | G0 SDK probes, specs, partial baseline/evidence |
| a304f8810c402fd29b105563a136379e42f246af | 2026-10-27T17:01:13+08:00 | Fixed-commit Argon review/corrections; not runtime proof |
| 0015efdb784df67145cbb6266ccbd5d9115e64d2 | 2026-11-04T19:11:39+08:00 | XO offline inspection lab/regressions |
| ca322c1ac1c5b37da4ee157806351edd618a3f14 | 2026-11-04T20:13:54+08:00 | Input boundaries and incompatible upstream fixture |
| 4bf2d146c701822526faa0622dd26772dc18c705 | 2026-11-04T21:05:56+08:00 | Preserved pre-core readiness/rules baseline |
| 277c23a896896ada22a57454a767378dd7c7e462 | 2026-11-04T21:42:07+08:00 | Deterministic offline intent/transaction Guard and demo |
| 4a93590de9c2f41a2db6b2c80b844d4dedc67aa5 | 2026-11-04T21:59:32+08:00 | Evidence ownership/source boundary and simulation CAS ledger |
| 613397f9f407a997612a4625d30568176e0dd2fa | 2026-11-04T22:14:11+08:00 | Read-only bounded Electrum TLS/Chipnet source pins; later corruption repair below |
| 3619c70ead31dc89d8437b445a125a9f353b9c55 | 2026-11-04T22:33:51+08:00 | Restore UTF8 evidence tests, quarantine expired signatures |
| cd0ee718c02fb11956b71d482c3e2050b78290d1 | 2026-11-04T22:42:21+08:00 | Correct remote-validation evidence |
| 1c215e20a7b41d22e062b29178a0eb05396f9cc2 | 2026-11-04T23:06:51+08:00 | Durable read-only review coordination/token-aware dust |
| c8b03df3e2aa2b43cf126508cd055a9343c70a83 | 2026-11-04T23:10:45+08:00 | Coordination snapshot evidence |
| c54f5481bd047785107a429ed77a03402dbdcf86 | 2026-11-04T23:28:02+08:00 | Deterministic unsigned builder, exact change/fee policy |
| f44561cd6ace3f7537e38083547c39c0a749aa04 | 2026-11-04T23:39:21+08:00 | Builder browser/remote evidence |
| 7d2246cd13d1efa4a07a630684b160d752242d78 | 2026-11-04T23:56:51+08:00 | Stateless/full-plan signature verification, safe evidence refresh |
| 1a9f24a273de97f301a9f35e59b43f0028ef26ea | 2026-11-04T23:59:56+08:00 | Signature snapshot evidence |
| 6d445a89050b70d8365a17c7d9a6a1fcbffe82d2 | 2026-11-05T00:15:47+08:00 | Complete-parent historical positive and readable summaries |
| 4e935f7b56a050404f6fa15b5dbeb7d56fd1fe4f | 2026-11-05T00:23:24+08:00 | Parent-positive/browser evidence |
| 3000ceba117232ec48780b429d361b8e3e69f737 | 2026-11-05T00:44:44+08:00 | Strict request drafts, CashAddr/amount parsing and local review |
| e5d91aa2609dea92b454320e226156477a6130b2 | 2026-11-05T01:00:44+08:00 | Request browser/remote evidence and image limits |
| de6c42759e3b79e185045b7374bd42fcd3ac847d | 2026-11-05T01:27:00+08:00 | Canonical request-to-plan/policy binding |
| 6de75464d992205602ae2855bf767428d9be3e72 | 2026-11-05T01:30:45+08:00 | Request-plan review/evidence |
| 8765b83017016c72551dbb6a4836cd677effaee4 | 2026-11-05T01:50:17+08:00 | Clickable offline planning forms and stale-state invalidation |
| 645240141568660db9960c15729d5085617e71b1 | 2026-11-05T01:56:28+08:00 | Frozen UI/remote verification evidence |
| 2586149e830bd05d7d78ab1f89964d4f18e4ccbd | 2026-11-05T02:15:33+08:00 | Actual XO P2PKH pure-function candidate comparison |
| 53b05b4608c939146e18f9f11ed3b7e44c4592a6 | 2026-11-05T02:19:02+08:00 | XO browser/source evidence |
| 89d1135875ae2b63c2fab8eee1bdb883a9a08888 | 2026-11-05T10:33:34+08:00 | New dated zero-valued-output blocker reproduction |
| 11f3584ab31460ee5a881b90d6855ce22bd8fa80 | 2026-11-05T10:49:05+08:00 | Zero-output repair risk/next-gate assessment |
| 6f762050eee1c520b6b9f1ffb541c2aaf014a10a | 2026-11-05T11:00:15+08:00 | Positive-output template alternatives assessed, no cutover |
| fce079a24d5dcc2bf3ebbd6f52f2654be00043f5 | 2026-11-05T11:19:45+08:00 | Isolated fixed-beneficiary tranche lab; NEVER FUND |
| 7f429fe46193f5f1bcc2ec84c32ca4ca29661b09 | 2026-11-05T11:22:55+08:00 | Tranche remote evidence |
| 56d2086d480b1216e3f36295a87d9f826d35198e | 2026-11-05T11:40:55+08:00 | Finite-tranche funding-risk inspector; no recovery/funds |
| 7db4f9d67a98df0b976caf9c8a87ab303d99b9e9 | 2026-11-05T11:44:18+08:00 | Funding-safety evidence |
| ee01a6f7156166976e0852b2eedb4b3d26c1a35b | 2026-11-05T11:50:35+08:00 | Authenticated Invitation integration boundary/handoff |
| e4b9e24cdb6965e3b4c2abc0723d45757b1eea7e | 2026-11-05T18:38:57+08:00 | Core readiness/handoff reconciliation |
| 61e0895d21ab173a74cf5363a9392d73a3b2314f | 2026-11-05T20:19:05+08:00 | Bounded child-server lifecycle/startup failure repair |
| a82807ae0293baee39a185e229f906718e095e59 | 2026-11-07T23:15:04+08:00 | Locked current-next XO API compatibility adaptation |
| dd71e0e5532c8080d3b57c8b69e41f15fbbf7389 | 2026-11-09T09:13:33+08:00 | Keyless preparation/owner-gate evidence |
| 8ed624702252daba955c5dbfcc054ad1d5cd5d07 | 2026-11-09T10:44:30+08:00 | Dedicated Chipnet identity-only Invitation; canonical Electrum version fix |
| fd583a0d92901ffbd0b79eb428aeacdff8389a15 | 2026-11-09T10:45:07+08:00 | Formal coverage binding; identity not a payment |
| 48f5311c1deb4c61b9a8c2732599cca69984f4b3 | 2026-11-09T12:04:34+08:00 | Prior merged identity milestone PROGRESS |
| 8abb754d16bf4498952f99c8dc63237ac85bda8d | 2026-11-09T15:52:30+08:00 | Current WP1–4 and verification code: WizardConnect, guarded payment/journal, banner, production packaging, empirical/builder/state verification |
| 96e39581b37fdcba2037fd8ca8dfaf134693cebf | 2026-11-09T16:01:11+08:00 | Current receipt conflict downgrade, historical state separation and signature-reservation restart regression |
| 0b17c070cd34645d72a9928c64dfa015c4ded860 | 2026-11-09T16:05:31+08:00 | Original five-WP disclosure/progress metadata; independent round1 later found unsigned edit/rebuild B1 |
| a8f1589a55ce91023c10e182a55b19764a44174c | 2026-11-09T17:11:13+08:00 | B1 authenticated atomic never-sign-reserved draft revision, consistent input reservations; compiled UI/HTTP/SQLite regression and empirical/model synchronization |

This disclosure/progress metadata candidate follows the immutable implementation
commits above; its final full SHA/date are
bound in the external task receipt, avoiding a circular self-hash. It too is
November9 PRESEASON, not event-period functionality or a new business capability.

## Evidence limits, owners and third parties

Current Builder correction:277 tests pass, including UI5000→4000sat reconfirm/rebuild
with zero signature/send calls and refusal after signing reservation/UNKNOWN;
synthetic relay/RPC crypto/recovery, production private runtime and bounded checks
also ran. Independent final acceptance remains parent-owned, NOT_RUN by Builder.
No funded live payment/public txid was created in this repair; historical task
WP2_BROADCAST_BLOCKED and later parent-owned funding decisions are separate evidence.
Mainnet cap0, no mainnet keys/signatures/broadcast. Stock-wallet combinations,
public demo and mainnet receipt remain NOT_RUN here; no eligibility claim.

Current repository `https://github.com/peterpeter228/intentguard-bch` is private.
Old/new event repository roles, slides, EMBER2026 address and pre-hack demo are
owner-controlled unknowns, visible TODO_OWNER fields in the actual homepage and
individual task QUESTIONS. No fake prior demo/fork, visibility or IP/license change.
Future event-period work must retain this base and separately disclose actual
improvements after the real event boundary. Attendance/token observations stay
in their existing records; no repeated owner action is claimed.

WizardConnect LGPL notice/source references remain in
`review/post-argon/LICENSE-WizardConnect-upstream.txt` and `license-evidence.json`;
XO MIT fixture notice remains in `preseason/xo/fixtures/LICENSE-XO.txt`. Existing
BCHN/Trezor public-vector provenance/notices and historical evidence are retained.
Production packaging copies applicable notices; public distribution/IP compliance
still needs concrete owner review before release, not an invented license waiver.
