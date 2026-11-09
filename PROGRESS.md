# IntentGuard / BCH BLAZE — Progress

## Current: intentguard-mainnet-20261109 — PRESEASON / B1 corrected, final acceptance pending

Owner decision t304u; B1 correction source **a8f1589a55ce91023c10e182a55b19764a44174c**
(2026-11-09T17:11:13+08:00), correction baseline **0b17c070cd34645d72a9928c64dfa015c4ded860**;
original implementation **96e39581b37fdcba2037fd8ca8dfaf134693cebf**, task base **48f5311c1deb4c61b9a8c2732599cca69984f4b3**.
Feature: `feat/intentguard-mainnet-20261109`. Exact metadata/candidate/diff hashes:
task `artifacts/implementation-3/IMPLEMENTATION_RESULT.json` (external, no circular hash).

- WP1: actual memory-only WizardConnect adapter, fresh SDK handshake/paths,
  sign-only sequence/envelope/expiry binding and immediate disconnect/replay refusal.
- WP2: `/pay` confirmed request/build/preflight/sign/postGuard/one-send/observe,
  separate durable payment journal and original-hash recovery. Mainnet immutable
  **0sat**, unsigned-only. **MOCK_TRANSPORT / NO_CHAIN_TRANSACTION** integration.
  B1: authenticated same-economic-ID unsigned revision with atomic input-transfer/CAS;
  no replacement after signature reservation/UNKNOWN/signed/send reservation.
  This repair used no live wallet, protected identity, faucet, signing or broadcast.
  Prior WP2_BROADCAST_BLOCKED receipt is historical; later owner funding screenshot
  in task DECISIONS is parent-owned and not independently rechecked here.
- WP3: actual root banner/private repo label + five obvious TODO_OWNER fields;
  all unknowns in task QUESTIONS. Parent actual browser proof still required.
- WP4: complete production HTML/CSS/JS/Node runtime/notices packaged. Prior candidate's
  external-directory install/native rebuild is historical; repair package/root-pay-
  assets/private-runtime/journal-reopen smoke passed using existing dependencies.
  Payload2090718bytes excluding manifest/external deps; inherited hosting question recommends
  persistent Tencent Node24/SQLite. No deployment or public URL.
- WP5: [actual pre-event SHA/date/features disclosure](docs/PRE_EXISTING_WORK.md),
  original history/baseline/notices preserved. No event novelty/eligibility claim.
- Builder verification: final `npm run validate`277/277, no fail/cancel/skip
  (258 historical+16 prior focused+3 B1 regressions); compiled UI5000→4000sat exact
  outputs/reconfirm/reopen, zero sign/send, SIGNING/UNKNOWN edits blocked; competing
  revisions/signature reservation and input-transfer rollback/release checked.
  Production build/runtime smoke; builder1512finite cases and actual546→547sat
  bad-source control/restoration; TLC124states/346steps/seven rules passed.
  Empirical/statechart execute the concrete revised UI journey before abstraction.
  These are bounded/synthetic Builder checks, not independent acceptance or browser/
  stock-wallet/live-chain/mainnet proof. Raw receipts: task artifacts/implementation-3/.

Next/resume: Node24 locked install/native rebuild; `npm run validate`,
`npm run build:production`; read `core/PAYMENT_FLOW.md` and task artifacts.
Parent freezes this exact metadata candidate and runs second/final fresh runtime
Astra on prior B1 + new diff/task/repo, not Builder reasoning/evidence. Parent owns
actual embedded-browser public proof and locked/CAS publication only after PASS+
green. No independent runtime PASS or main SHA is claimed by this Builder.
Parent reconciles current funding/hosting/banner decisions; no public-release or
judging-readiness claim. Never replay consumed identity create/reconcile; protected
identity remained unopened. Mainnet0sat/unsigned-only; no deploy, push/merge,
visibility/license/IP/submission/social/Notion/Linear or other external writes.

## Historical identity-only milestone (superseded scope; preserved evidence)


Updated: 2026-11-09 12:05 Asia/Shanghai · Agent: Grok Bot executor · task_id: bch-blaze-chipnet-20261109 · owner decision t299s1349

## 已完成 / Done

- Chipnet-only dedicated test identity (public: `bchtest:qppj6e9nxfy4egyx00yv36l6c32whh5epyrjv20ksu`). Identity-only invitation create + shareable export. **0 sat funding needed.**
- Offline IntentGuard verification of the shareable invitation; tamper reject; parent doctor verified (1 signature, no replay).
- Electrum protocol equivalence fix (`1.5` ≡ `1.5.0`) without weakening TLS/checkpoint checks.
- `npm run validate`: typecheck + build + **258 tests PASS** (fail/cancel/skip = 0). Re-run 2026-11-09 12:03 Asia/Shanghai → PASS.
- Astra diff-review r1: **VERDICT PASS**, BLOCKER 0.
- Formal skills (`verify-chipnet-formal` / `verify-chipnet-session`) + statechart/TLC exercised; evidence under task loop.

## 尚未完成（主赛道硬性要求）/ Missing for BCH BLAZE mainnet track

1. Judges can open the site and personally send a useful **BCH mainnet** transaction — not started (no real payment path yet; Chipnet identity-only only).
2. Public live **demo URL**.
3. **XO / WizardConnect** authenticated payment (invite+sign exists; authenticated payment still blocked on external conditions).
4. Homepage **banner**: intro slides, repo link, EMBER2026 vote-token receive address, pre- and post-hackathon version links.
5. BCH BLAZE **Telegram** project confirmation + at least one prep-stream attendance (waiver possible).

Contest submit window opens **2026-11-14**. Deploy / visibility / license / IP waiver / submission still need owner.

## 关键继续 / How to resume

```bash
git clone https://github.com/peterpeter228/intentguard-bch.git
cd intentguard-bch
git checkout main   # after this merge, main carries the Chipnet work
npm ci
npm run validate
```

- Secrets (mnemonic) live **only** at host `/root/.secrets/intentguard-bch-chipnet.env` (0600); never in repo/chat/Notion.
- Shareable invitation zip / evidence: `/workspace/loop/bch-blaze-chipnet-20261109/` (box) and Tencent `/root/work/intentguard-bch/evidence/chipnet-identity-20261109/`.
- Next engineering: authenticated payment path + demo URL + banner; stay on testnet/Chipnet until owner authorizes mainnet.

## 关键 SHA / Key SHAs

| Ref | SHA |
| --- | --- |
| Candidate (Chipnet done) | `fd583a0d92901ffbd0b79eb428aeacdff8389a15` |
| Implementation under test | `8ed624702252daba955c5dbfcc054ad1d5cd5d07` |
| Branch start / prior tip | `dd71e0e5532c8080d3b57c8b69e41f15fbbf7389` |
| Branch | `feat/openbot-bch-20261108` → merged to `main` (owner t299s1349) |
| Remote main before merge | `f0722677d80e3390bf4f4f5c8f991c783691cf6c` (Initial commit) |

## 证据指针 / Evidence pointers

- Loop report: `/workspace/loop/bch-blaze-chipnet-20261109/REPORT.md`
- Loop task: `/workspace/loop/bch-blaze-chipnet-20261109/task.json`
- Shared mirror (OpenBot): `/data/OpenBot/Shared/loop/bch-blaze-chipnet-20261109/`
- Repo evidence: `evidence/chipnet-identity-20261109/`, `evidence/openbot-20261109/`
- Validate receipt: task `validate-final.json` / re-run 2026-11-09 validate exit 0
