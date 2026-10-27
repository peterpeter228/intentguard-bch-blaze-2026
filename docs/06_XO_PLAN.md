# 06｜XO 可选集成计划与赏金证据

## 1. 决策：先证明有适合的功能，再投入迁移

XO是可选里程碑，不是P0付款闭环的前置条件。IntentGuard BCH的核心价值是用户确认意图与实际交易的确定性对照；不能为了“Build/Migrate to XO”凭空增加资金托管、AI放款私钥或跨链合约。

本章尚未验证当前 XO Debug Tool 的完整安装、Invitation导入或真实钱包执行。它规定如何完成核实与验收；完成前不得声称“XO迁移成功”“获得赏金资格”。规则以官方最新赛事说明及主办方书面答复为准，赛事硬要求见规则矩阵。

## 2. 先做功能映射，避免普通示例换名字

候选方向是**受金额与收款意图约束的支付请求及透明后续动作**，需实际满足XO评审所要求的独特性与工具执行：

| 已有/候选行为 | 与XO可能的关系 | 何时可宣称实现 |
|---|---|---|
| 用户确认PaymentIntent | 表达角色、变量与动作要求 | 官方schema能表达且引擎真实验证该结构 |
| 付款前显示真实收款/金额/费用 | XO对用户可读语义的补充 | UI显示的数据来自实际Invitation/交易，能与独立预检一致 |
| 防替换/超预算预检 | 独立SDK核对XO产出的交易 | 修改输入向量会产生可重现拒绝；不是只有绿色提示 |
| 实际支付 | XO引擎生成有效交易并由用户签名 | Debug Tool或官方支持流程完成真实链上执行 |
| 退款请求 | 可能的自愿回付动作 | 确定属于官方follow-up模型且有真实状态来源、另一方签名 |
| 独立收据核验 | 与template/action/txid关联 | 第三方能重建数据并确认对应关系 |

普通P2PKH付款后，应用里的“退款按钮”不自然成为XO的follow-up action。需要核实引擎如何在输出中保存状态、引用可用动作、识别角色与所有权；若不能对现有非托管产品自然建模，则停止该扩展，保留主线，不引入合约来制造动作。

“付款请求+金额显示”可能与官方P2PKH示例重叠。提交前至少完成一项有实际价值、可复现的差异，例如跨模板统一意图验证、收款/找零篡改检测、可重用SDK或可核验请求到交易的证据链。是否满足Build赏金独特性要按官方要求判断，不由项目自行宣布。

## 3. 包与schema核查：先解决版本闭包

附件使用旧`@xocash/stack`与新`@xo-cash/*`混合架构。2026-10-27读取官方npm registry发现：

| 包 | 观察 | 决策 |
|---|---|---|
| `@xocash/stack` | registry明确deprecated | 不进入新项目依赖 |
| `@xo-cash/state` | latest0.0.5，依赖types0.0.8、utils0.0.10 | 不能据此假定与任意engine兼容 |
| `@xo-cash/engine` | latest0.0.1，精确依赖state0.0.2、types0.0.1、utils0.0.1 | 以官方已跑通示例/工具的锁文件形成兼容版本集 |

来源：[旧stack](https://registry.npmjs.org/@xocash/stack/latest)、[state](https://registry.npmjs.org/@xo-cash/state/latest)、[engine](https://registry.npmjs.org/@xo-cash/engine/latest)。开始前重新核实当前版本；不同包“都能安装”不代表类型、schema或运行时兼容。

只采用一种可复现基线：官方Debug Tool/样例的仓库commit、锁文件与配置。记录工具URL、源码commit、package版本、schema版本、支持网络和必要依赖。没有schema或可读类型定义时，先标 `BLOCKED_SCHEMA`，不可凭博客段落生成“正式Invitation JSON”。

原附件的模板片段不满足可运行标准：动作使用`transactions:[...]`而官方2026-08-24文中是`transaction:'...'`；缺少完整transactions/inputs/outputs/scripts；只有字符串命名的校验脚本不产生实际安全效果。所有字段从当前schema验证，不能用 `as any`、忽略typecheck或自写声明补齐。[Writing Templates](https://stack.xo.cash/blog/2026-08-24-Vision-to-Reality-6-Writing-Templates)

若已有固定且确有必要的CashScript脚本，官方建议top-to-bottom封装；当前P0没有自写资金脚本，不能为采用这个方法而创建托管合约。支持的VM年份只列实际设计支持且验证过的版本，不能复制所有年份。

## 4. XO spike：分阶段，有限投入

### X0｜获取真实基线与选择用例

输入：P0已通过的支付模块、当前官方样例、赏金规则。输出：`xo-bounty/COMPATIBILITY.md`与`USE_CASE_MAPPING.md`，写明一个候选功能、与现成示例的差异、为何对用户有用、依赖与阻塞。

先用独立分支或隔离目录，不能破坏WizardConnect付款入口。若两个专注工作时段仍拿不到可用版本或schema，记录证据并暂停XO；继续主线完善和参赛材料。该时间盒是工程建议，不是主办方规定。

### X1｜原样复现官方示例

先跑官方可用P2PKH/FT请求样例，不修改业务语义，验证安装、schema校验、Invitation产生与Debug Tool导入。保存真实命令、退出码、工具版本和失败日志。示例执行仅是基础验证，不能当作本项目独创成果。

参考入口：[XO官方站](https://stack.xo.cash/)、[P2PKH FT Request](https://stack.xo.cash/blog/2025-10-16-Vision-to-Reality-P2PKH-Fungible-Token-Request)、[XO类型源码](https://gitlab.com/GeneralProtocols/xo/types/-/blob/development/source/template.ts)。网页入口可能变化，优先从当前官方链接追踪，记录访问日。

### X2｜映射一个真实主线能力

将用户确认的PaymentIntent映射为官方schema允许的参与角色/动作/变量；由引擎构造交易，再用独立预检模块检查。不得把自行构造的交易重新包一个JSON文件就声称使用XO引擎。

正常样本应可签可执行；攻击样本至少包含：收款script替换、FT数量变化、额外收款输出、找零重定向、费用超预算、错误网络/类别。在官方流程可控制的位置验证阻止，界面显示具体差异和更正路径。

### X3｜链上执行与适用的后续动作

在Chipnet完成一笔真实交易；如果规则和产品要求follow-up，执行一个业务真实需要且官方模型支持的后续动作，保留前后状态证据。退款必须是接收人自愿新付款，不能演示为“付款人强制撤回”。

当前官方规则要求在底层结构适用时展示follow-up；没有自然follow-up时记录不适用理由并核对用例接受性，不能自行强化为绝对强制，也不伪造状态。

### X4｜第三方复现与最终决定

由未参与该模块实现的reviewer在干净环境按文档复现：生成Invitation→导入→检查实际网络/角色/金额→执行正常交易→触发一个真实负向拒绝→查看结果。无法重复执行已花费outpoint时，应按说明生成新的Invitation，不能承诺重放已花费交易。

只有全部通过才把XO入口纳入提交版本。未通过的部分保留为明确实验状态，不放在首页主按钮中诱导评委进入故障流程。

## 5. Build与Migrate申报边界

**Build候选**：需有真实XO Template、可用Invitation、真实交易、符合要求的后续动作和开发反馈；“安装XO包”“展示静态schema”“录一段模拟动画”均不替代验收。

**Migrate候选**：必须先确认存在可运行旧项目、其真实核心功能与可访问旧链接/源码基线，再证明迁移前后相同核心能力怎样落到XO。附件提及IntentGuard-402不等于本轮已读取该仓库。不得以当天新建的“旧版”制造迁移资格。旧版仅EVM功能是否构成真实相关迁移仍需按功能与主办方口径确认。官方总则允许同项目兼报多个bounty且同获不互斥，Build/Migrate制度上可兼报；本项目仍须分别达标，不据此预估收入。

迁移证据建议使用两个不可变SHA的compare链接；当前参赛demo必须在线可使用；旧版优先保留可运行部署，并保存固定版本和归档演示。若旧版只有归档视频，核对主办方接受性，不能自行断言一定合格或一定无效。列出旧版已有、比赛期间新增和仍未实现功能。

## 6. 交付目录与反馈边界

| 文件 | 内容 | 防误报要求 |
|---|---|---|
| `xo-bounty/COMPATIBILITY.md` | 版本闭包、源码commit、工具入口、schema、网络 | 未核实字段明确为空/未知 |
| `xo-bounty/USE_CASE_MAPPING.md` | 原产品能力、XO映射、独特贡献 | 不虚构旧项目或用户 |
| `xo-bounty/template.json` | 通过实际schema校验的模板 | 不用附件伪片段占位 |
| `xo-bounty/invitation-executed.json` | 真实执行过的Invitation，必要脱敏 | 删除密钥/secret；脱敏不得破坏说明真实性 |
| `xo-bounty/REPRODUCE.md` | 干净环境步骤、测试资产、重新生成方法 | 区分可导入与可再次执行 |
| `xo-bounty/EVIDENCE.json` | txid、网络、工具版本、状态、录屏路径 | 不写模拟txid |
| `xo-bounty/RAW_DEV_LOGS.md` | 时间、命令、原始错误、复现步骤、实际修复 | 仅记录真实观察 |
| `xo-bounty/FEEDBACK_STATUS.md` | 本人反馈是否已完成、位置和字数检查 | 不包含AI生成反馈正文 |

官方要求本人写作的反馈正文由用户亲自完成。dot不得生成范文、替写、润色、翻译或伪装成个人体验；只提供实际开发过程的技术记录、检查是否附上文件及统计字数。也不预设用户“遇到了某bug”供其照写。

## 7. 合并门槛

合并前确认：兼容基线可重建；template/Invitation由官方schema验证；至少一个真实交易及适用follow-up可核验；意图预检仍独立于XO输出；不持有用户seed；主线钱包/支付回归通过；个人反馈完成状态诚实；旧项目与奖金叠加判断有依据。

任何核心项未通过，保留WizardConnect主线并在提交矩阵中把XO记为未申报或实验，不能拖垮已可用产品。是否增加功能的判断标准始终是可见的用户价值和真实验收证据。
