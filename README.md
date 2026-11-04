## Latest verification follow-up — 2026-11-04 12:07 UTC

31 tests now pass after adding bounded CLI and upstream legacy-schema regressions plus actual Host/body-limit HTTP checks. Application/UI behavior is unchanged. The official public old Invitation fails the current schema; a compatible positive signed fixture remains missing. See [follow-up evidence](evidence/xo-20261104-followup/README.md). This is still preseason, not a new transaction feature or bounty completion.

# Latest preseason supplement — 2026-11-04

A no-key **XO Offline Lab** is now implemented under `preseason/xo/`. It validates imported template/Invitation structure with pinned official engine and rejects unsafe/incomplete inputs; it is not the core payment product or a novel contract. See [reproduction and limits](preseason/xo/README.md), [actual test evidence](evidence/xo-20261104/COMMANDS.md), and [real browser QA](evidence/browser-qa/REPORT.md).

Final strict typecheck/build and 27 tests passed, including an isolated clean reinstall/retest. Actual local browser paths and report download passed. G0 remains PARTIAL; no wallet, signature, chain execution, public deployment, contest submission or bounty eligibility is claimed. All this code is disclosed as November4 pre-event work.

---

## Historical October27 baseline (preserved below)

# Current execution status: G0 PARTIAL / preseason only

2026-10-27: the supplied 29-file specification is restored. Actual offline SDK compatibility probes are implemented, not the payment application. See docs/STATUS.md and evidence/validation/summary.md.

Reproduce: `npm ci --ignore-scripts --no-fund && npm run validate` (Node 24). No wallet, key or network transaction is needed. `npm run build` produces only a compile probe bundle, not a deployable demo. Do not claim mainnet or contest completion.

---

# BCH BLAZE 2026：dot 开发交接包

**核查日期：2026-10-27（北京时间）。推荐项目：IntentGuard BCH。**

本包将用户提供的《BCH BLAZE 2026 × Avalanche Team1 全栈》改造成可执行的参赛工程方案。它是经过来源核查的开发规格，**不是已开发、已测试或已获奖的产品**。本轮没有取得 IntentGuard-402 源码，没有运行真实钱包、广播交易、报名、申请资助或提交比赛。所有功能、用户验证、钱包兼容性、主网交易证据的初始状态均为未完成。

## 推荐决策

先交付一个聚焦的 BCH 产品：**把用户确认的付款意图，与实际待签交易逐项核对；阻止收款地址、代币、金额、找零或手续费被替换；通过后交给用户钱包签名，并生成可复核的付款收据。**

核心价值是确定性交易检查与可复用开发接口。AI 可帮助理解请求和解释检查结果，但不作最终资金裁决、不保管私钥、不充当跨链结算证明。普通转账和收据是演示这个核心能力的闭环。

优先顺序：

1. 完成真实参赛资格、赛前基线和技术兼容性验证。
2. 主网赛道：WizardConnect、BCH/PUSD 支付意图预检、用户签名、独立链上收据。
3. XO Build：仅在官方工具、模板格式和可用功能验证通过后加入。
4. XO Migrate：仅在确实存在可运行旧项目、真实功能迁移及旧版证据时加入。
5. 跨链桥、Media、Avalanche Team1：分别验证价值与条件后再做；不挤占主线验收。

原稿的双链 HTLC、AI 私钥共签、Solver 热钱包、强制 x402 预付审计费、动态 AI 漫画、多稳定币路由，不进入第一版。此取舍是工程与参赛策略判断，不是主办方要求。不能由公开信息计算可靠获奖概率。

## 现在最重要的三件事

- **人类出席与点名：**剩余准备直播为 10 月 31 日、11 月 7 日北京时间 22:00。至少一位代表须实际参加一次规定准备直播并完成 roll call；看录像不能自动视作满足。
- **尽早注册、确认项目：**按官方要求完成 DoraHacks 注册及 BCH BLAZE Telegram 项目真实性确认。方案没有替你完成这些动作。
- **保留真实时间线：**现在可准备资料、环境和独立技术实验。开赛前完成的代码必须如实归入赛前基线；赛期须有实质新增，不能用新 tag、改文件时间或新仓库冒充赛期工作。

官方日程给出的开发窗口为 11 月 14–22 日，22 日 14:00 UTC（北京时间 22:00）结束；DoraHacks widget 抓取有一小时时间差。**内部提交目标统一设为 11 月 21 日北京时间 22:00 前，最终以再次核实的有效官方窗口为准。**[S01–S02]

## 如何交给 dot

把本 ZIP 和可访问的实际仓库一并交给 dot，复制 `DOT_START_HERE.md` 的启动指令。若没有旧仓库，dot 应按新项目分支继续推进主线，并将 Migrate 标为不适用；不能虚构 IntentGuard-402 已存在。

推荐阅读顺序：

| 文件 | 用途 |
| --- | --- |
| `DOT_START_HERE.md` | 一次粘贴的完整执行委托 |
| `AGENTS.md` | 仓库级约束与完成标准；合并到既有文件，不能覆盖用户规则 |
| `docs/01_FACT_CHECK.md` | 原稿逐项事实与工程纠错 |
| `docs/02_RULES_SUBMISSION.md` | 资格、赛历、奖金、提交矩阵 |
| `docs/03_PRD.md` | 用户、差异化、范围与产品验收 |
| `docs/04_ARCHITECTURE.md` | 信任边界、数据契约、状态机、API |
| `docs/05_BCH_ENGINEERING.md` | BCH 依赖与钱包实施细则 |
| `docs/06_XO_PLAN.md` | XO 可行性验证与 bounty 交付 |
| `docs/07_BRIDGE_AVALANCHE.md` | 条件跨链扩展与独立 Team1 路线 |
| `docs/08_DOT_WORKFLOW.md` | dot/Codex 分工、持久化上下文、恢复与权限 |
| `docs/09_TASKS.md` | 分阶段任务、依赖、验收、停止条件 |
| `docs/10_TEST_ACCEPTANCE.md` | 真实钱包、负例、浏览器、链上验收 |
| `docs/11_PITCH_SUBMISSION.md` | 七页路演规格、两分钟演示、材料索引 |
| `docs/12_COST_AND_DECISIONS.md` | 工时、预算假设、商业验证与删减规则 |
| `docs/13_SOURCES.md` | 官方来源、核查范围与未决问题 |
| `templates/` | 状态、任务交接、版本、交易证据与人工记录模板 |
| `checklists/` | 开发启动与最终提交检查单 |

## 这份文档的可信度边界

来源核实：赛事页面、奖项、官方工具文档、发行方参数、包注册表与 OpenAI dot 文档。工程建议：本包自有的范围选择、状态机、验收与时间估算。待实测：兼容依赖组合、真实设备签名、XO Debug Tool、流动性、到账与申请资格细节。

正文用 `[Sxx]` 指向 `docs/13_SOURCES.md`。日期、版本、服务可用性必须在开赛前和提交前重新查询；不要把本包当永不变更的 API 文档。

**真正的完成条件：**第三方能打开链接，理解价值、执行明确的攻击检查示例，查看真实主网付款证据；开发者能复现构建与关键测试；资格及提交材料逐项有证据。构建成功、测试数很多、子任务显示 Completed，都不足以单独证明完成。

