# Payment feature map

| Journey | Surface | Proof |
|---|---|---|
| [Connection](connection.md) | `/pay` #network/#chain-ack/#connect | Fresh SDK session or bounded refusal |
| [Payment](payment.md) | #review/#confirm/#build/#sign/#broadcast | Exact intent, valid checked bytes, one send reservation |
| [Recovery](recovery.md) | #disconnect/#recover | Original hash survives restart, no replacement/resend |

All scripted RPC/relay effects are MOCK_TRANSPORT / NO_CHAIN_TRANSACTION. Actual public visual proof belongs to parent embedded OpenBot browser.
