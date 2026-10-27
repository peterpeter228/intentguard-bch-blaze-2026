# 来源登记、核查方法与未决事项

**核查日：2026-10-27（北京时间）。** 优先采用主办方、赞助方、协议开发者、资产发行方与官方包注册表。读取内容而不只依赖搜索摘要。以下是本包根引用 `[S01]` 等的索引；第02/05/06/07章另有本章自足的实际URL引用。

动态事实包括版本、奖金、服务支持、日期、登录与申请条款。以下链接不是永久保证；dot必须在启动、开赛前和提交前复核关键项，保留变更与访问时点。

## 1. 赛事与演示要求

| ID | 一手来源 | 本轮用于核实 | 边界 |
| --- | --- | --- | --- |
| S01 | [DoraHacks：BCH BLAZE 2026详情](https://dorahacks.io/hackathon/bchblaze2026/detail) | 主网/Media资格、奖金、首页要素、准备直播点名、Telegram确认、四项评分 | 页面widget与正文/官网有时间差；不能据全球开放保证领奖资格 |
| S02 | [BCH BLAZE官方日程](https://bchblaze.cash/schedule/) | 10/31、11/7、11/14、11/21、11/22、11/28的UTC时间与注册日期 | 注册仅列日期；精确小时待核对 |
| S03 | [BCH BLAZE bounties与总则](https://bchblaze.cash/bounties/) | 桥、XO Build/Migrate、身份赏金、叠加、AI反馈、权利条款 | 赞助方评选不保证获奖；follow-up有适用性条件 |
| S04 | [BCH BLAZE Getting Started](https://bchblaze.cash/forge/) | 官方入门入口与准备资源 | 不代替完整参赛条款 |
| S05 | [当前Widget Factory模板](https://docs.google.com/presentation/d/1Yfuk9CJkf4U9M_WukcELhumWgj3Ak6345Ewy8hSp-Hk/edit?usp=sharing) | 已读取其公开HTML导出，确认七页结构 | 要提交自己的成品，不是链接空模板 |
| S06 | [2025官方档案](https://bchblaze.cash/archive/) | 历史获奖项目名称与方向 | 不能推出2026私人偏好、竞争强度或胜率 |

DoraHacks普通抓取出现405后，通过另一公开页面读取方式取得正文；没有使用用户账户报名或操作提交。当前发现的时间差按冲突处理，未擅自判定哪个界面错误。

## 2. BCH、钱包、资产与XO

| ID | 一手来源 | 已核实事实/用途 | 仍需开发验证 |
| --- | --- | --- | --- |
| S07 | [WizardConnect协议](https://docs.riftenlabs.com/wizardconnect/protocol/)、[dApp集成](https://docs.riftenlabs.com/wizardconnect/dapp/)、[React集成](https://docs.riftenlabs.com/wizardconnect/react/) | session/path、inputPaths、签名返回值与sighash规则 | 每个钱包实际实现、广播与取消行为 |
| S08 | [dapp完整registry](https://registry.npmjs.org/@wizardconnect/dapp)、[core latest](https://registry.npmjs.org/@wizardconnect/core/latest)、[react latest](https://registry.npmjs.org/@wizardconnect/react/latest)、[dapp0.2.3查询](https://registry.npmjs.org/@wizardconnect/dapp/0.2.3) | 当日core0.2.5/dapp0.2.2/react0.2.3；dapp版本列表不含0.2.3，该具体版本返回404 | 最终依赖组合尚未安装/编译 |
| S09 | [CashScript版本](https://cashscript.org/docs/releases/release-notes)、[迁移说明](https://cashscript.org/docs/releases/migration-notes)、[SDK registry](https://registry.npmjs.org/cashscript/latest)、[cashc registry](https://registry.npmjs.org/cashc/latest) | 0.14.0及UTXO lockingBytecode、签名属性和mock校验变化 | 旧项目迁移是否成功 |
| S10 | [ParyonUSD发行方](https://paryonusd.com/)、[发行方部署配置](https://github.com/ParyonUSD/verify_contract_deployment/blob/main/config.ts) | 主网category与发行方来源 | 未执行完整部署验证脚本；不据此担保资产价格 |
| S11 | [发行方BCMR](https://mainnet-v1.paryonusd.com/.well-known/bitcoin-cash-metadata-registry.json)、[Paytaca BCMR交叉核对](https://bcmr.paytaca.com/api/tokens/2469acc5afa4b10cb5b5c04afb89c3a3ffd61c5da9c01e26d00951cae2a02544/) | decimals=2；同类别NFT元数据存在 | 真实钱包UTXO类别与NFT形态仍需逐个检查 |
| S12 | [Libauth v2.0.0地址源码](https://raw.githubusercontent.com/bitauth/libauth/v2.0.0/src/lib/address/cash-address.ts)、[v2.1.0源码](https://raw.githubusercontent.com/bitauth/libauth/v2.1.0/src/lib/address/cash-address.ts)、[当前encodeCashAddress](https://libauth.org/functions/encodeCashAddress.html)、[地址类型](https://libauth.org/enums/CashAddressType.html) | 旧3参数API与当前对象接口区别，token-aware地址类型 | 实际安装版本和错误返回处理 |
| S13 | [发布dapp0.2.2类型](https://unpkg.com/@wizardconnect/dapp@0.2.2/dist/dapp-connection-manager.d.ts)、[同版本实现](https://unpkg.com/@wizardconnect/dapp@0.2.2/dist/dapp-connection-manager.js) | getPubkey可能undefined，未提供原稿使用的索引方法 | npm包完整性和真实运行 |
| S14 | [XO Writing Templates](https://stack.xo.cash/blog/2026-08-24-Vision-to-Reality-6-Writing-Templates) | 模板结构、动作transaction字段、编写顺序 | 当前Debug Tool/schema兼容，不把博客当唯一类型约束 |
| S15 | [XO P2PKH FT Request](https://stack.xo.cash/blog/2025-10-16-Vision-to-Reality-P2PKH-Fungible-Token-Request)、[官方XO站](https://stack.xo.cash/) | 可作为原样复现样例与独特性比较对象 | 本轮未执行Invitation或链上交易 |
| S16 | [旧xocash stack](https://registry.npmjs.org/@xocash/stack/latest)、[新state](https://registry.npmjs.org/@xo-cash/state/latest)、[engine](https://registry.npmjs.org/@xo-cash/engine/latest) | deprecated、state/engine精确依赖差异 | 必须锁同一可复现工具版本闭包 |
| S17 | [CashScript交易构建](https://cashscript.org/docs/sdk/transaction-builder)、[钱包集成](https://cashscript.org/docs/guides/walletconnect) | 交易构造、费用、CashTokens/NFT与标准钱包对象 | 具体wallet placeholder与版本组合 |

PUSD小端字符串由本地逐字节反转核对；该算术验证不等于对发行方合约做审计。所有原稿合约漏洞结论来自静态读取，是对所给代码约束的分析，未进行攻击或主网利用。

## 3. x402、Avalanche与资助

| ID | 一手来源 | 本轮用途 | 边界 |
| --- | --- | --- | --- |
| S18 | [x402网络与token支持](https://docs.x402.org/core-concepts/network-and-token-support)、[维护仓库](https://github.com/x402-foundation/x402) | Avalanche原生USDC、CAIP-2、协议与facilitator区别；支持表未列BCH/PUSD | 不是所有facilitator都支持该链/资产/版本 |
| S19 | [CDP facilitator](https://docs.cdp.coinbase.com/x402/seller/facilitator) | 当日支持网络表没有Avalanche；应查询能力端点 | 后续可变更，必须重新读取 |
| S20 | [Team1官方Grants](https://www.team1.network/grants) | Mini最高10k且不保证，Accelerator30k与委员会机制区分 | 最终款项/个人条件以协议为准 |
| S21 | [Avalanche Mini Grants入口](https://build.avax.network/grants/team1-mini-grants) | 项目入口、开放申请与方向 | 本轮未登录或提交申请 |
| S22 | [Team1官方拨款介绍与案例](https://www.team1.blog/p/team1-builder-grants-backing-the) | 长期生态投入、实际里程碑个案 | 个案不等于全部申请的统一拨付比例 |

不采用原稿未取得对应Mini条款证据的“四周审批”“主网或AI固定加分”“默认凑满10k”说法。

## 4. OpenAI dot与工程组织

| ID | 官方来源 | 采用的能力事实 | 本包的原创工作流设计 |
| --- | --- | --- | --- |
| S23 | [Tasks and memory](https://learn.chatgpt.com/docs/dots/tasks-and-memory) | 可协调多个任务；新任务上下文独立；Codex云环境需先设置 | 每任务传入完整handoff与验收证据 |
| S24 | [Computers and apps](https://learn.chatgpt.com/docs/dots/computers-and-apps) | 云电脑与用户电脑/登录/应用权限分开 | G0实际环境清点，不假定插件安装即所有权限可用 |
| S25 | [Meet dots](https://learn.chatgpt.com/docs/dots)、[Control your dot](https://learn.chatgpt.com/docs/dots/controls) | 持续协作、现有权限与自动审查适用 | 按具体动作与已有授权执行，不泛化重复确认 |
| S26 | [Run long horizon tasks with Codex](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex) | 持久规格/计划/状态与可验证里程碑的实践 | STATUS/DECISIONS/NEXT_ACTION与分阶段gate |

本包不保证所有产品版本都有相同界面、斜杠命令、额度或并发数；不从模型名字推导可用工具。未调用任何外部付费审查模型。

## 5. 可选两跳兑换的服务边界

| ID | 官方来源 | 已核查到的范围 |
| --- | --- | --- |
| S27 | [SideShift权限/IP](https://docs.sideshift.ai/api-intro/permissions/)、[API FAQ](https://docs.sideshift.ai/faq/)、[币种schema](https://docs.sideshift.ai/endpoints/v2/coins/)、[报价](https://docs.sideshift.ai/api-intro/shift/)、[退款](https://docs.sideshift.ai/api-intro/refunds/) | 真实用户IP、权限、API与退款流程要求；本轮未执行实际个人permissions或创建订单 |
| S28 | [Cauldron Router](https://docs.riftenlabs.com/router/)、[route.quote](https://docs.riftenlabs.com/router/api/route.quote/) | Router beta及报价/费用机制；没有取得本项目双向PUSD可成交报价 |
| S29 | [SideShift USDC AVAX→BCH](https://sideshift.ai/usdcavax/bch)、[BCH→USDC AVAX](https://sideshift.ai/bch/usdcavax)、[token页](https://sideshift.ai/tokens) | 两端商品路由存在；不证明PUSD直连或当前金额可成交 |
| S30 | [SideShift条款](https://sideshift.ai/legal)、[地区限制](https://help.sideshift.ai/en/articles/2874595-why-am-i-blocked-from-using-sideshift-ai)、[风险政策](https://help.sideshift.ai/en/articles/6230858-sideshift-ai-s-risk-management-policy) | 禁区名单有来源差异、本人资产条件、可能的verification与退款限制 |

附加facilitator候选入口：[Avalanche课程](https://docs.avax.network/academy/blockchain/x402-payment-infrastructure/04-x402-on-avalanche/03-facilitators)、[PayAI](https://facilitator.payai.network/)。这些是候选来源，未对其真实结算作本项目测试。

## 6. 原附件与本轮实际验证

U01：用户提供《BCH BLAZE 2026 × Avalanche Team1 全栈.txt》。其中代码、历史项目、示例地址与个人身份不自动成为已验证事实。

已做：完整附件阅读；官方规则和模板核对；技术文档/发布包/注册表对照；PUSD参数和字节序核对；独立研究分工与交付文件的一致性复核。

未做：访问用户私人IntentGuard仓库、编译真实应用、安装完整链依赖、连接真实钱包、主网或测试网付款、XO工具执行、实时兑换报价、报名/点名、对外发消息、部署、比赛提交或资助申请。

最终交付前的文件检查只证明文档和压缩包完整、引用和内部字段一致，不证明应用能运行。所有未来验收项应以实际执行结果更新。
