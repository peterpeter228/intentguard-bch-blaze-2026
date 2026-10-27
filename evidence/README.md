# 证据目录说明

此包中的文件是模板与规格；目录存在不代表对应事件发生。只有实际产生的结果才进入证据文件。

建议按setup、eligibility、provenance、wallet、mainnet、validation、ui、product、submission、bridge划分子目录。每条证据注明日期/时区、来源或执行命令、代码commit、环境/网络、实际观察、限制与相关文件。

阶段状态使用PASS/FAIL/NOT_RUN/NOT_APPLICABLE；资金状态使用应用状态机，不用一个布尔paid覆盖全部阶段。

保护秘密：不放助记词、私钥、API密钥、钱包握手secret、xpub、完整钱包session或无关客户资料。公开主网txid与演示地址仍须符合用户对公开展示的授权范围。

`dependencies.json`为机器可读版本/integrity/工具记录，`dependencies.md`为其摘要；两者生成于同一实验结果，不独立手填互相矛盾的数据。
