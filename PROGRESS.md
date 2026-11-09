# IntentGuard / BCH BLAZE — Progress

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
