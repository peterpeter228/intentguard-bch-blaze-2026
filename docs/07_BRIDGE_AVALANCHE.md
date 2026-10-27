# 07｜稳定币双向路由、Avalanche 与 Team1：条件扩展执行规范

核查基准：2026-10-27（北京时间）。本章服务于后续开发决策；没有证实项目仓库已具备下列功能，没有进行真实换币或申请资助。

## 1. 范围与执行顺序

P0 主线是 **IntentGuard BCH：意图预检 SDK、WizardConnect 支付、独立可验证收据**。本章所有内容位于 P0 验收之后。实现可复用的资产标识、金额、收据与能力查询接口即可；不要提前加入 solver、库存池、自写资金托管合约或跨链共识服务。

BCH BLAZE 稳定币赏金允许 bridge 或 swap，要求 BCH 稳定币与另一生态稳定币之间**两个方向**可运行；一种 BCH 稳定币加一个对端生态已足够。WizardConnect 为强烈推荐，其他链的钱包方案按生态适用性选择。官方没有要求参赛者必须自行发明 HTLC 或经营流动性池。[B1]

执行顺序：先完成本章 G0 只读门槛，再为可行连接器做限时验证；通过后才安排钱包实测。任一关键条件不通过，关闭该扩展并回到主线。功能开关默认关闭，未通过的路线不展示为可交易产品、不计入已完成赛道。

## 2. 可验证的候选路线

| 方向 | 用户执行的步骤 | 可能停留的中间资产 |
|---|---|---|
| PUSD → Avalanche USDC | Cauldron 将 PUSD 换成 BCH，到账用户自己的 BCH 钱包；再经 SideShift 将 BCH 换成 Avalanche 原生 USDC，到账该用户 EVM 钱包 | BCH |
| Avalanche USDC → PUSD | SideShift 将原生 USDC 换成 BCH，到账用户自己的 BCH 钱包；再确认新的 Cauldron 报价，将 BCH 换成 PUSD | BCH |

SideShift 官方两个方向的商品页确实存在，官方币种页列出 BCH 与 USDC AVAX；本次未在该页查到 PUSD。Cauldron 官方提供 CashTokens↔BCH 交易和 Router beta 文档。因此这是有组成部分依据的**两跳候选路线**，并非已证实的 PUSD 直连桥。[B2–B5]

两跳不能提供全程原子性：第一跳成交后，第二跳可能因价格、流动性、钱包拒签或服务故障暂停。应用应显示中间资产和恢复选项。用户可保留 BCH 或重新确认后续兑换；任何反向兑换都是另一笔有费用的新交易。

应用不得接收用户资金到开发者、服务器或 solver 地址。SideShift 条款要求使用者是发送地址、目的地址和所涉资产的受益所有人；本设计因此在用户自己的两端钱包内完成。商家付款是另一个清晰的用户动作。[SHIFT1]

允许的产品表述：“钱包逐步签名的稳定币兑换流程，跨链兑换依赖第三方服务。”不得宣称“原子跨链”“全程无信任”“保证退款”或“10 USDC 必到 10 PUSD”。

## 3. G0：开始实现前的硬门槛

dot 建立 `evidence/bridge/capability-check.md`，逐项记录日期、来源、真实响应的脱敏摘要和 PASS/BLOCKED。以下要求是工程门槛，不是官方新增赛事规则。

1. **使用资格。** 查 SideShift 当前条款、帮助页与真实用户环境下的 `/v2/permissions`。2026-10-27 所读条款和帮助页的禁区名单不完全一致，均限制美国；中国未在已读名单中出现，但这不足以认定每个中国使用者已获准使用。不要用云服务器所在地代替用户所在地，不伪造 IP 或绕过限制。[SHIFT1–SHIFT3]
2. **API 授权。** 确认集成账户、`affiliateId`、`x-sideshift-secret` 的当前需求与可用权限。若经后端请求，应按官方要求提供真实 `x-user-ip`；该值只能由可信部署代理提供，不能盲信客户端提交的头。集成账户凭据只在后端保存。[SHIFT3–SHIFT4]
3. **资产与路由。** 实际读取支持币种、网络、token 合约、入金/出金暂停状态、固定或浮动报价条件、最小额、最大额和费用。以返回数据决定可用性，商品网页存在不能代替这一项。PUSD 用完整 CashTokens category；原生 USDC 与 USDC.e 必须分开。[SHIFT5]
4. **Cauldron 可成交性。** 两个方向都取得针对目标 PUSD category 的报价与可解码无签名交易。核对收款、找零、token/NFT 保全、费用和池 UTXO。Router 当前为 beta，接口与费率可变化；以当前 schema、版本和实测为准。[B5–B6]
5. **网络与金额。** 所有腿必须明确网络。Fuji 测试 USDC 不能与 BCH 主网 PUSD 组成真实价值兑换证明。演示金额由实际最低额、费用、用户授权共同决定，不能套用 0.01 美元微支付金额。
6. **Guard支持范围。** Cauldron会花费池合约输入并重建池输出，不能直接继承P0普通支付的PASS。须用独立、固定版本的路由策略核对已支持池合约、池输出重建与用户净支出；无法在spike证明则保持UNSUPPORTED并关闭扩展。不得放松P0未知脚本限制，也不在本期开发通用合约验证器。
7. **失败处置。** 明确服务审查、过期、错额、退款、第二跳无法成交时用户拥有什么资产、在哪条链、应采取什么动作。SideShift 对严重风险标记的存款可能要求 verification 才退款，不可承诺永久免身份核验。[SHIFT6–SHIFT8]

建议将初次只读与构建验证限定为一个 4–6 小时工作块；这是排期建议，不是成功时限。若实际路由、资格、报价或交易构建无法证明，立即记录 BLOCKED，不以 mock、补库存或另写资金合约消除阻塞。

## 4. 金额、报价与签名前校验

所有基础单位采用十进制整数字符串，计算使用 `bigint`；不要用 JS `Number` 表示余额、兑换金额或累计费用。资产唯一键至少包含 `network + assetId`，显示名和 ticker 仅用于界面。

每次报价保存：`routeId`、`quoteId`、创建/过期时间、来源版本、每跳 source/destination asset、输入/预计输出、该跳 minOut（如服务支持）、所有费用、接收/退款地址，以及仍未锁定的后续报价。接口名称由 G0 实际文档决定，不臆造上游 API。

**精度转换只改变单位，不产生兑换率。** PUSD 与 USDC 的小数位不同，不能乘除 10 的幂就认定等值；GP BCH/USD 预言机也不能证明 PUSD 脱锚风险、USDC/PUSD 成交价格或可用深度。展示实际报价和有效期，第二跳开始前重新报价；变化超出已同意范围时让用户重新确认。

Cauldron Router 构建有单独路由费，必须读取返回费用输出，不硬编码费率或删除该输出。签名前核对完整交易的收款、资产、找零和费用；签名后再次解码并比较关键承诺。钱包成功回调仅表示签名阶段完成，不能触发整个订单完成。[B5]

## 5. 订单状态、幂等与恢复

### 5.1 双层状态

总订单与每条交易腿分别保存状态。UI 的总状态由各腿证据推导，服务商回调只能触发复核。

| 总状态 | 进入条件 | 界面与恢复行为 |
|---|---|---|
| `DRAFT` | 用户尚未确认有效路线 | 可编辑金额与地址 |
| `QUOTED` | 两腿能力已验证，报价尚有效 | 展示费用、信任依赖和中间资产风险 |
| `AWAITING_SIGNATURE` | 当前腿已构建并通过预检 | 等待用户钱包；拒签可安全返回 |
| `IN_PROGRESS` | 当前腿已广播或服务商已接单 | 显示该腿真实进度，防重复提交 |
| `PARTIALLY_COMPLETED` | 第一腿已到账，第二腿未完成 | 显示 BCH 余额、地址，允许重新报价或结束 |
| `REQUIRES_ACTION` | 错额、过期、风险审查、凭据或网络问题 | 展示具体原因、服务订单号和可执行动作 |
| `COMPLETED` | 两腿最终资产均按约定到账，确认策略满足 | 显示两链证据及实际费用 |
| `CANCELLED` | 尚无不可逆链上动作且用户取消 | 已发生交易不得进入该状态 |

每腿至少区分 `prepared`、`signed`、`broadcast`、`observed`、`confirmed`、`failed`；服务商腿另外保留原始 provider status、退款交易和审查状态。`REFUND_PENDING` 与 `REFUNDED` 必须分开；退款也要链上核实。

### 5.2 持久化与幂等

保存 `intentId`、schema 版本、当前 step、assetId、固定地址、providerOrderId、报价引用、链上 txid、vout/logIndex、观测 blockHash、确认数与最后更新时间。用户 IP、凭据和 xpub 不进入公开证据包。

- 每个 intent/step 只能有一个活跃执行记录；数据库唯一约束阻止重复创建和执行。
- 事件去重键使用真实链标识加 txid 与 vout/logIndex；同一交易可能含多个付款输出，不能只凭 txid 一概合并。
- 查询可以退避重试；创建换币订单、签名和广播属于有副作用动作。上游若无已核实幂等键支持，不得因超时直接再创建。
- “创建请求已发送但响应丢失”进入 `REQUIRES_ACTION/UNKNOWN_PROVIDER_RESULT`，先查已保存标识或按服务方支持流程核实；不要假定请求失败。
- 用户刷新、换设备或服务重启后，从持久化状态与链上记录恢复。自动恢复观察，不自动扩大金额、改变地址或再次签名。
- 发现 blockHash 改变或交易退出链，应撤销相应确认状态并重新核验，保留事件历史；这不等于资金可自动回滚。

### 5.3 完成证据

BCH 腿核对原始交易、正确 category、输出脚本与数量；EVM 腿核对 chainId、USDC 合约、成功 receipt 与准确 Transfer 事件。确认策略依据所选网络与服务商要求确定并记录，不自行捏造统一“六确认”。总完成状态要求最终目标资产已到账，不能只检查源链支出或服务商字符串。

## 6. 桥扩展验收矩阵

| 用例 | 必须看到的结果 |
|---|---|
| 双向正常成交 | 各一次真实小额闭环；两链、每跳、最终金额均有证据 |
| 报价过期/资产暂停/低于下限 | 签名前阻止；显示原因和重新报价入口 |
| 钱包拒签/网络切错 | 无意外发送；保留已完成交易腿 |
| 第一跳完成，第二跳池不足或拒签 | `PARTIALLY_COMPLETED`，明确用户持有 BCH |
| 创建响应丢失、重复点击、重复事件 | 不生成重复金融动作；可追查未知订单 |
| 服务商退款/风控审查 | 区分等待、需用户行动与已链上退款 |
| 刷新、断网、服务重启、重组 | 状态可恢复；不伪造完成、不重复付款 |
| 评委复核 | 可从收据定位两链交易与限制，操作不是单纯外链跳转 |

上述任何真实付款均须在用户已授权的预算、地址和网络内进行。dot 可先完成全部本地测试和可审阅交易计划，只有实测证据齐全才将此扩展标为“完成”。

## 7. Avalanche / x402：独立后续模块

官方 x402 文档列 Avalanche C-Chain `eip155:43114` 原生 USDC `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E`，精度 6，支持 EIP-3009。但协议可表达支付，不代表某个 facilitator 已支持结算。当前所查 Coinbase CDP 支持表没有 Avalanche；Avalanche 官方课程及 PayAI 页面提供其他候选。[X1–X4]

实施前记录所选 facilitator 的 `/supported` 实际结果：x402 version、scheme、network、asset。锁定 SDK 版本和相应 header/CAIP-2 语义，不能混合 v1 示例与 v2 SDK。至少完成一次所选环境的真实钱包授权、支付验证、结算和独立收据核验；只收到 HTTP 402 不算集成完成。

本期 BCH 付款挑战/收据不得直接声称标准 x402 PUSD 兼容：本次官方支持表没有 BCH/PUSD。若将来做专门 scheme，需另设互操作测试与 facilitator 实现项目。

面向人的桥报价应免费。机器付费 API 可后续作为独立功能，明确用户支付取得的服务、失败补偿和幂等规则；AI 不持资金密钥，不因模型判断解锁资产，也不承诺模型能证明跨链安全。

## 8. Team1 Mini Grant：独立后续申请

Team1 官方确认 Mini Grant 开放申请、最高 10,000 美元，并明确不保证资助；Accelerator 最高 30,000 美元，由委员会提名/投票、无公开申请。不要把 Accelerator 的每月会议当作 Mini 四周审批承诺。官方重视持续投入 Avalanche，也允许既有项目；公开说明为全球持续开放，但个人最终收款、KYC和申请表字段仍需实际确认。[A1–A3]

申请前应有 Avalanche 支付模块及链上证据，再说明它服务谁、为何需要、已有何种真实反馈。把已经完成、计划交付和未验证假设分开；如复用 BCH 代码或已拿赛事奖励，透明说明边界与资金用途，避免把同一项已支付成本重复包装。

建议首轮按实际工作量申请约 **4,000 美元**，可调整，不为凑满上限增加功能：

| 建议里程碑 | 可验收成果 | 建议预算 |
|---|---|---:|
| M1：支付与收据 SDK | 固定版本、Avalanche 原生 USDC 实测、失败/重放测试、复现说明 | $1,200 |
| M2：外部集成验证 | 目标为两个独立集成者的真实接入与问题记录；尚未获得用户则如实记录 | $1,800 |
| M3：文档与维护 | 开源示例、公开问题修复记录、30 天维护与一次教程 | $1,000 |

这是申请预算建议，**不是官方要求、获批金额或拨款比例**。实际条件以获批协议为准。官方确有分阶段拨款案例，但不能将个案套为所有申请。不要编造客户、付费数据、合作承诺、营收或已有部署。[A3]

dot 可准备申请稿、证据索引和预算；正式提交前交用户审阅。Team1 申请不占用 BCH BLAZE 的核心交付时间，也不计入 BCH 奖池。

## 来源索引

- [B1] [BCH BLAZE bounties](https://bchblaze.cash/bounties/)
- [B2] [SideShift USDC Avax → BCH](https://sideshift.ai/usdcavax/bch)
- [B3] [SideShift BCH → USDC Avax](https://sideshift.ai/bch/usdcavax)
- [B4] [SideShift 支持币种](https://sideshift.ai/tokens)
- [B5] [Cauldron Router](https://docs.riftenlabs.com/router/)
- [B6] [Cauldron route.quote](https://docs.riftenlabs.com/router/api/route.quote/)
- [SHIFT1] [SideShift 服务条款](https://sideshift.ai/legal)
- [SHIFT2] [SideShift 受限地区帮助页](https://help.sideshift.ai/en/articles/2874595-why-am-i-blocked-from-using-sideshift-ai)
- [SHIFT3] [SideShift permissions / 用户 IP](https://docs.sideshift.ai/api-intro/permissions/)
- [SHIFT4] [SideShift API FAQ](https://docs.sideshift.ai/faq/)
- [SHIFT5] [SideShift coins schema](https://docs.sideshift.ai/endpoints/v2/coins/)
- [SHIFT6] [SideShift 风险管理](https://help.sideshift.ai/en/articles/6230858-sideshift-ai-s-risk-management-policy)
- [SHIFT7] [SideShift 报价流程](https://docs.sideshift.ai/api-intro/shift/)
- [SHIFT8] [SideShift 退款](https://docs.sideshift.ai/api-intro/refunds/)
- [X1] [x402 网络与资产支持](https://docs.x402.org/core-concepts/network-and-token-support)
- [X2] [Coinbase CDP facilitator](https://docs.cdp.coinbase.com/x402/seller/facilitator)
- [X3] [Avalanche facilitator 指南](https://docs.avax.network/academy/blockchain/x402-payment-infrastructure/04-x402-on-avalanche/03-facilitators)
- [X4] [PayAI facilitator](https://facilitator.payai.network/)
- [A1] [Team1 Grants](https://www.team1.network/grants)
- [A2] [Avalanche Mini Grants](https://build.avax.network/grants/team1-mini-grants)
- [A3] [Team1 官方项目与拨款案例](https://www.team1.blog/p/team1-builder-grants-backing-the)
