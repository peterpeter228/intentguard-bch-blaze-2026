# IntentGuard BCH G0 独立审查报告

**审查状态：** G0 PARTIAL（预赛基线）
**审查基准：** `peterpeter228/intentguard-bch` 提交 `955e5c0...` / 树 `f5f757...`
**日期：** 2026-10-27

---

### 1. 独立结论
本项目处于 **G0 预赛兼容性验证阶段**。提供的文件构成了一个精确的规格文档集与 SDK 兼容性探针（probes），而非可用的支付产品。代码审查与离线构建验证确认了开发环境具备可复现性，但未进行任何涉及真实钱包、链上签名、广播、主网交易或第三方身份核验的操作。

### 2. 关键发现

#### 阻塞性/主要问题
*   **非可运行产品：** 项目尚未实现 PaymentIntent 逻辑、Guard 核心逻辑、钱包连接适配器或收据生成器。当前代码仅包含类型定义与离线 SDK 兼容性探测，不具备任何支付功能。
*   **许可元数据缺失：** `@wizardconnect` 相关包在 npm 注册表中缺少明确的许可协议信息。在引入主线开发前，必须确认其商业使用许可，否则无法进入正式交付范围。

#### 技术可行性与工程
*   **依赖完整性：** 已验证 `package-lock.json` 与安装环境一致性。`libauth` (3.1.0-next.8)、`CashScript` (0.14.0) 及 `WizardConnect` 系列包的安装与类型检查均通过。
*   **探针有效性：** `npm run validate` 运行 10 项离线测试均通过，证实了 SDK 对合成数据的处理能力（包括大数据解析、地址校验与预检诊断）。
*   **异常诊断：** `OfflineManager` 探针已重现 SDK 在 `AbortSignal` 触发前的异步执行行为（即未完成校验即调用发送逻辑）。这证实了未来适配器需在调用前进行状态预校验的必要性，属于预期内的工程边界。

### 3. 可复现验证建议

请 root 执行以下命令以独立重现环境与结论：

1.  **环境清理与构建：**
    ```bash
    npm ci --ignore-scripts --no-fund
    npm run validate
    ```
    *预期结果：TypeScript 类型检查通过，`dist/browser-probe.js` 构建成功，10 项 SDK 探针测试全部 PASS（见 `evidence/validation/g0-validation.log`）。*

2.  **验证一致性：**
    核对 `evidence/validation/input-manifest.json` 中的 SHA256 哈希值与当前仓库文件是否一致。

3.  **XO 烟雾测试（仅限只读）：**
    ```bash
    # 仅导入模板对象以验证结构读取能力
    node evidence/xo/inspect-published-template.mjs
    ```
    *预期结果：成功解析 `@xo-cash/templates@0.0.1` 模块，输出模板动作引用列表（见 `evidence/xo/template-smoke-result.json`）。*

### 4. 当前局限与风险提醒
*   **无真实支付/钱包能力：** 当前未实现 `WalletAdapter`，无签名、广播或链上验证代码。
*   **资格证明缺失：** 报名、点名、Telegram 确认及相关 DoraHacks 资格证据尚未取得，相关字段均标记为 `UNVERIFIED` 或 `NOT_RUN`。
*   **业务逻辑缺口：** 尚未完成针对收款脚本、找零路径、NFT 排除及费率计算的独立 Guard 算法。
*   **不得作为放行依据：** 本次审查确认了代码的“可构建性”与“兼容性”，不能作为项目“已完成”的证明，更不得以此作为任何资金投入、参赛提交或外部合作的保证。

**后续行动建议：** 在正式赛期窗口开启后，依据 `docs/09_TASKS.md` 优先推进 G1（核心规格实现），待钱包适配器通过实测后再推进后续任务。不得在未进行真实设备与网络测试的情况下声称支付流程已安全。