# 05｜BCH 工程规格：确定性预检、普通支付与收据

## 1. 交付目标与实现边界

主线产品暂名 **IntentGuard BCH**：先保存用户确认的支付意图，再独立解析待签交易，与意图逐项比较；用户通过 WizardConnect 在自己的钱包签名，应用再次检查已签交易后广播并展示可核验收据。P0 支持普通 P2PKH 的 BCH 与 PUSD 发送。未完成真实测试的功能不得显示“受保护”“已验证”或“支付成功”。

LLM 只解释确定性检查结果，不决定资产身份、收款地址、金额或是否广播。应用不保存用户助记词，不新写资金托管合约，不让 AI 私钥签署放款条件。P1 可创建退款请求，接收人自愿另行转账；原付款不可因“请求退款”自动撤回。

本章是开发与验收规格。**编写时未执行整套依赖编译、真实钱包连接或主网交易**；下面的版本组合是有来源的 spike 候选，并非测试完成声明。

## 2. 技术闭包与版本 spike

保留已有能运行的 Next.js/TypeScript 工程；新项目先用一个应用，划分 `src/domain`、`src/adapters/bch`、`src/features/pay`、`src/features/receipt`，避免起步就引入多链 monorepo。预检逻辑作为无 UI、无 LLM 依赖的纯函数模块，稳定后再提取可复用包。

| 模块 | 2026-10-27 核查值 | 执行要求 |
|---|---|---|
| CashScript SDK | `cashscript@0.14.0` | 其 UTXO 需要 `lockingBytecode`；统一处理 provider 返回类型 |
| Libauth | CashScript 依赖 `^3.1.0-next.8` | 选兼容的精确版本并保存 lockfile；不要保留附件 `^2.0.0` |
| WizardConnect core | `0.2.5` | 锁版本，记录传递依赖解析结果 |
| WizardConnect dapp | `0.2.2` | `0.2.3` 查询返回404，禁止照抄不存在版本 |
| WizardConnect react | `0.2.3` | React/ReactDOM要求≥18；沿用项目已验证版本 |
| `cashc`、mainnet-js、DEX、EVM、XO | P0 不安装 | 不编写自有合约就无需cashc；避免重复钱包与签名实现 |

版本证据：[CashScript registry](https://registry.npmjs.org/cashscript/latest)、[官方发布说明](https://cashscript.org/docs/releases/release-notes)、[Wizard core](https://registry.npmjs.org/@wizardconnect/core/latest)、[dapp](https://registry.npmjs.org/@wizardconnect/dapp/latest)、[不存在的dapp版本](https://registry.npmjs.org/@wizardconnect/dapp/0.2.3)、[react](https://registry.npmjs.org/@wizardconnect/react/latest)。这些是核查当日快照，dot 开工时重新核实并将最终解析版本、integrity、来源和 Node/package-manager 版本保存到 `evidence/dependencies.json`。

**先完成兼容 spike 再写业务页面：**

1. 用项目实际包管理器安装精确候选版本，提交唯一lockfile；先跑严格TypeScript与浏览器构建。
2. 对照安装包types验证 `useWizardConnect`、`getPubkey`、`signTransaction`、地址编码、交易decode/encode/hash、provider构造与广播接口。禁止自造 `.d.ts` 让错误API通过编译。
3. 已发布 `dapp@0.2.2` 中 `getPubkey()` 可能返回undefined，必须处理；本轮读取其types未见 `getIndexToUse`/`getAddressIndex`，因此不能直接复制开发文档中的这些方法。索引管理放在应用自己的适配层，或采用经过验证的官方commit。[发布包类型](https://unpkg.com/@wizardconnect/dapp@0.2.2/dist/dapp-connection-manager.d.ts)
4. 完成固定向量：金额解析、主网/Chipnet地址、PUSD category、原始交易解析；记录所用API与结果。
5. 实测钱包配对、拒签、恢复与 `broadcast:false`。若钱包忽略该标志，不能宣称应用可以签名后拦截广播；该钱包在保护模式下保持不可发送，直到具备可验证行为。

附件2.x Libauth代码使用3.x对象参数，是明确版本混用。[v2.1.0源码](https://raw.githubusercontent.com/bitauth/libauth/v2.1.0/src/lib/address/cash-address.ts)接收三个参数并返回字符串；不要复制后再用类型断言掩盖错误。

## 3. 用户意图与原始交易的双重核验

### 3.1 PaymentIntent 必须独立于待签交易

由用户填写/选择并确认：网络、资产、收款地址、金额、最高矿工费、允许的找零规则。确认后生成不可变快照和 `intentId`。不能先从待签交易提取字段，再以这些字段生成“用户意图”进行自我比对。

| 数据 | 最小字段 | 约束 |
|---|---|---|
| PaymentIntent | id、network、asset、recipient、amountAtomic、limits、expiresAt、revision | 所有金额为bigint语义，JSON传输使用十进制字符串 |
| 资产身份 | BCH或指定CashToken category、decimals | 名称/图标只用于显示；不能用symbol授权 |
| OwnedUtxo | txid、vout、valueSats、lockingBytecode、token、pathName、addressIndex | 来源输出需独立查询并与prevtx匹配 |
| GuardReport | intentHash、candidateCommitment、findings、verdict | checks来自解析后的字节；保存所用规则版本 |
| PaymentAttempt | intentId、operationId、attemptId、unsignedHex、signedHex、txid、status、observations | signedHex不当作txid；交易与订单有持久关联 |
| Receipt | network、txid、付款输出vout、asset、amount、recipient、确认状态 | 展示事实与核查时间，不宣称合规或审计证书 |

字段以第04章的内部契约为规范；本表补充PaymentAttempt和证据概念，不另建冲突类型。`evidence/dependencies.json`存机器可读依赖记录，`evidence/dependencies.md`为其人工摘要。

`recipient`存储验证后的地址及对应lockingBytecode，实际比较script字节。UI显示网络、金额、代币身份、接收人、费率与最高费用。任何金额、地址、UTXO或输出变更都产生新revision并重新确认。

### 3.2 签名前的检查

- 验证网络配置、provider、钱包会话与地址类型；`bchtest`不能单独区分Chipnet和其它BCH测试网，须配套网络配置与可信节点识别。
- 从链查询每个outpoint的实际源输出；检查未花费、金额、script、token。构造服务传来的 `sourceOutputs` 不是自证真相。P0依赖指定节点报告未花费和确认状态；本地原交易解析/txid复算不独立证明上链。保存provider与观察时间，不标成SPV证明。
- BCH支付只选无token输入；PUSD支付只选纯PUSD FT与无token BCH输入。其他类别、NFT、mutable/minting能力全部排除。
- 接收输出必须等于意图的script、资产类别、精确数量；额外收款输出拒绝。找零仅可回到当前钱包已验证拥有的派生地址；默认不添加OP_RETURN。
- BCH价值满足输入减输出等于矿工费，费为非负且不超用户确认上限/费率上限。PUSD必须逐category精确守恒，无铸造、销毁、隐式NFT丢失。
- 校验版本、locktime、sequence等是否符合普通支付策略。禁止隐藏的条件支出和未展示字段。

### 3.3 签名后的检查

`broadcast:false` → 请求签名 → 解析返回hex → 比较输入outpoints、顺序、sequence、输出、version、locktime与原计划一致；只允许预期解锁材料变化。复查金额/找零/费用/资产不变量，确认签名公钥对应源输出，并使用所选SDK/VM验证签名有效性与要求的sighash。WizardConnect规范要求 `SIGHASH_ALL | SIGHASH_FORKID | SIGHASH_UTXOS`。[官方协议](https://docs.riftenlabs.com/wizardconnect/protocol/)

任何差异都阻止应用广播，保留脱敏差异报告。计算交易ID使用经过向量验证的SDK；`signedTransaction`是完整hex，不能用于explorer链接当txid。节点接收后，使用网络查询验证实际观察结果。签名与广播都不是“已确认”。

## 4. PUSD、HD地址与UTXO

主网PUSD：`2469acc5afa4b10cb5b5c04afb89c3a3ffd61c5da9c01e26d00951cae2a02544`，decimals=2；`0.01` PUSD=1基础单位。来源：[发行方官网](https://paryonusd.com/)、[发行方BCMR](https://mainnet-v1.paryonusd.com/.well-known/bitcoin-cash-metadata-registry.json)。元数据同类别含Loan/Oracle NFT定义，因此“这个category没有NFT”的假设错误。验证时读完整token结构。

SDK转账使用常见显示顺序的category字符串；只有以后写VM内省时才涉及字节序转换。P0不写合约，不需要把反转常量散落到前端。Chipnet使用明确标记的测试资产，不可把主网category/余额复制为测试成功。

地址必须完整解码校验checksum、network、type及payload。Token-aware还存在P2SH类型；MVP若只支持P2PKH，应提示“当前版本仅支持此地址类型”，不能把合法P2SH说成假地址。[Libauth地址类型](https://libauth.org/enums/CashAddressType.html)

每个输入保存真实路径映射，`inputPaths`从最终输入数组生成，不能固定全写 `[i,"receive",0]`。只共享钱包给出的路径xpub；本地按有限gap策略发现接收/找零地址。明确已扫描范围与余额刷新状态，避免把单一`receive/0`余额显示为整个钱包余额。xpub不写服务端日志、不发给LLM。[CashScript钱包集成](https://cashscript.org/docs/guides/walletconnect)

选择UTXO支持多个小额合并、准确FT找零与BCH找零；签名前刷新outpoints状态。普通收据不铸NFT。余额不足应区分“PUSD不足”“BCH手续费/输出承载额不足”“查询不完整”，不要统一报资金不足。

金额输入严格十进制字符串解析，禁止浮点乘法和四舍五入。拒绝负数、零、指数记法、小数超精度与上限溢出。费用根据实际序列化大小估算，dust根据实际输出结构计算；固定650sat/1000sat不是网络通用规则。FT找零须先于最终BCH找零计算；SDK自动找零不能自动保留NFT。[交易构造文档](https://cashscript.org/docs/sdk/transaction-builder)

## 5. 状态、重试与收据

状态最少包含 `DRAFT → PREFLIGHT_OK → AWAITING_SIGNATURE → SIGNED_VALIDATED → BROADCAST_SUBMITTED → SEEN_MEMPOOL → CONFIRMED`，另有 `USER_REJECTED`、`EXPIRED`、`CONFLICTED`、`BROADCAST_UNKNOWN`。错误与状态分开记录；断网是证据不足，不等于支付失败。

- 每个intent只允许一个进行中的attempt；按钮锁定加持久幂等键，处理刷新、双标签页、服务重启。
- 设置签名deadline及取消按钮真实调用abort；响应必须绑定operationId、attemptId、intent revision/hash、wallet session和sequence。取消、替换或过期attempt的迟到响应永不自动广播。区分明确拒签与结果未知；有signed hex后可计算txid查询，没有hex时按输入花费/钱包记录调查，不以UTXO消失当付款成功。
- 广播超时先查计算出的txid；只可重发同一已签hex，不能自动构造第二笔付款。已花费冲突时提示检查钱包和原交易。
- 追踪mempool与确认变化；索引器不可用显示未知并重试。收据保留查询时间、节点来源、区块高度/hash和确认状态；不得把单次RPC布尔值当不可逆事实。
- 商户付款核验绑定网络、category、收款script、金额和订单。唯一消费键为 `(network,txid,vout)`；同订单重复核验幂等返回，跨订单复用拒绝。
- 若收据用于解锁私有资源，公开txid不足以认证，必须绑定客户会话或一次性claim token，防止观察链上交易者抢领。

P1退款只产生新请求与接收人新签名交易。记录 `originalPaymentId` 和退款txid，原付款收据保留。明确部分退款、重复请求、对方拒绝/未响应；不显示“自动退款保障”。

## 6. 验收矩阵与必须留存的证据

| 测试组 | 必过场景 | 可审核证据 |
|---|---|---|
| 意图绑定 | 改地址/金额/category/找零、增加隐藏收款输出均阻止签名或广播 | 输入向量、实际解析输出、规则失败码 |
| 金额与地址 | 0.01→1；1.10→110；超精度/负数/错网/错checksum拒绝 | 单元结果及边界向量 |
| UTXO | 多输入、BCH不足、FT找零、NFT/未知类别排除、签名前被花费 | 测试fixture与金额守恒记录 |
| 钱包 | 实测版本的连接、刷新、移动端切屏、拒签、超时、断线恢复 | 浏览器/手机操作录像与版本 |
| 签名后预检 | 返回hex被改输出/顺序/locktime/费用时拒绝；flags不符拒绝 | 负向样本及阻止广播记录 |
| 交易生命周期 | 广播成功、超时但已见链、冲突、未确认、确认变化 | txid、网络观察日志、恢复录像 |
| 幂等 | 双击、双标签页、并发核验、服务重启、跨订单重放 | 状态存储与一次性消费结果 |
| 收据 | 正确vout、完整资产身份、点击explorer、刷新可恢复 | 录屏、JSON导出、可访问链接 |

普通UI构建通过不足以验收付款。必须保留一个正常付款和多个被拦截的篡改案例，使评委直观看见预检价值。先在离线/Chipnet完成；已获授权时再做小额主网实测，资金由用户钱包签名。受控自付只能表述为功能演示，不能计作真实客户或销售收入。

每阶段更新 `evidence/README.md`：代码SHA、部署版本、网络、钱包/SDK版本、实际执行命令、真实结果与未通过项。未完成的主网/钱包步骤写 `NOT_RUN`，不生成占位txid或成功截图。
