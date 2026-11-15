# Payment feature map

| Journey | Surface | Proof |
|---|---|---|
| [Connection](connection.md) | `/pay` #network/#chain-ack/#connect | Fresh SDK session or bounded refusal |
| [Payment](payment.md) | #review/#confirm/#build/#sign/#broadcast/#handoff-ack/#signed-raw | Exact intent, full signed-byte verification, durable native handoff intent; NO app/server mainnet send |
| [Recovery](recovery.md) | #disconnect/#recover/#new-payment | Original IndexedDB identity/tombstones across reopen, UNKNOWN/no replacement; new payment only after fresh confirmation |

All scripted RPC/relay effects are MOCK_TRANSPORT / NO_CHAIN_TRANSACTION. Actual public visual proof belongs to parent embedded OpenBot browser.
