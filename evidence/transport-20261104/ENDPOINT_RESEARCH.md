# Electrum Cash endpoint research — 2026-11-04

## Scope and observed status

Read-only documentation and official-source research for IntentGuard BCH. No accounts, API keys, wallets, signatures, transactions, broadcasts, or operator communications were created. No application code was changed by this research.

Research tool calls occurred approximately **2026-11-04 14:04–14:06 UTC**, using runtime-provided UTC time. Exa returned web extracts without acquisition timestamps; those are not proof of same-minute freshness. Parallel reported Fulcrum configuration acquired **2026-11-04**, but the protocol-method page acquired **2026-11-02**. Official GitHub/GitLab API and raw-file HTTP retrievals occurred during this research window. Their successful retrieval establishes documentation availability, not live Electrum service health. Local filesystem timestamps are not used as the UTC time source.

**Parent-reported live attempt, not performed by this researcher:** at **14:05:50 UTC**, the parent's first TLS read-only probe of `chipnet.bch.ninja:50002` failed at DNS with `EAI_AGAIN`; no valid RPC response was received. No alternate IP or disabled TLS verification was used. This is a transient/indeterminate DNS outcome, not evidence that the remote service is offline. Endpoint connectivity, certificates, advertised current capabilities, and RPC correctness remain unverified.

## Public endpoint candidates and provenance

GeneralProtocols' official server registry, pinned commit **36ffc06fa6ccbf98d171bf56a32e93ba3145b132**, lists:

| Network | Registry operator label | TLS endpoint | WSS endpoint | Registry protocol label |
|---|---|---|---|---|
| BCH mainnet | Imaginary Username | bch.imaginary.cash:50002 | wss://bch.imaginary.cash:50004 | 1.6.0 |
| BCH mainnet | Kallisti | cashnode.bch.ninja:50002 | wss://cashnode.bch.ninja:50004 | 1.6.0 |
| Chipnet | Kallisti | chipnet.bch.ninja:50002 | wss://chipnet.bch.ninja:50004 | 1.6.0 |
| Chipnet | Imaginary Username | chipnet.imaginary.cash:50002 | wss://chipnet.imaginary.cash:50004 | 1.5.3 |

Fixed original sources:
- [mainnet.ts](https://gitlab.com/GeneralProtocols/electrum-cash/servers/-/blob/36ffc06fa6ccbf98d171bf56a32e93ba3145b132/source/mainnet.ts)
- [chipnet.ts](https://gitlab.com/GeneralProtocols/electrum-cash/servers/-/blob/36ffc06fa6ccbf98d171bf56a32e93ba3145b132/source/chipnet.ts)
- [README.md](https://gitlab.com/GeneralProtocols/electrum-cash/servers/-/blob/36ffc06fa6ccbf98d171bf56a32e93ba3145b132/README.md)

These are **two differently labelled operator candidates**, not two independently verified healthy providers. Backend independence, ownership and current second-provider availability are unverified. `bch.imaginary.cash` and `electrum.imaginary.cash` are labelled as the same operator and must not count as independent providers. A historical third-party report indicated Chipnet Imaginary downtime; this is not a current availability finding.

The [BCH Ninja operator homepage](https://bch.ninja/) directly publishes mainnet and Chipnet TLS endpoints and attributes the service to Kallisti.cash. [Jeremy Kister's operator page](https://jeremy.kister.net/node.html) explicitly offers a public Fulcrum service at `bch0.kister.net:50002` for mainnet. His separate testnet endpoint must not be assumed to mean Chipnet.

[Electron Cash's fixed Chipnet registry](https://github.com/Electron-Cash/Electron-Cash/blob/85e9d82b502c982416170457c06d6d2f2aaa636c/electroncash/servers_chipnet.json) also lists `chipnet.c3-soft.com:64002` and `cbch.loping.net:62102` TLS. These are fallback research candidates only; their present health and operator-specific terms were not verified. `blackie.c3-soft.com` and `chipnet.c3-soft.com` must not be counted as independent operators.

## Public-use and limit findings

The GP registry README says its list can be used by anyone and that submitted servers must be publicly accessible. Published client connection examples require no API key or account. The operator pages examined do not advertise mandatory payment; BCH Ninja accepts donations. This supports treating them as public community endpoints, **not** asserting unlimited free usage, a commercial-use license, an SLA, or guaranteed availability.

No operator-specific numeric request quota, acceptable-use policy, SLA, or explicit commercial license was found in the examined pages. **No published quota found does not mean unlimited use.** Source-code licensing and server-list reuse permission do not confer unlimited hosted-service entitlement. Use a small request budget, bounded concurrency, caching and backoff; respect errors and do not evade rate limits.

[Fulcrum's official configuration](https://github.com/cculianu/Fulcrum/blob/master/doc/fulcrum-example-config.conf) documents configurable software defaults, not actual operator commitments: `max_clients_per_ip=12`, `max_batch=345`, and backend request throttle tuple `50 20 5`. Critically, a history exceeding `max_history` may cause `get_history` and `listunspent` to return an empty list. An empty response is not an independently established proof that no UTXO/history exists. This configuration URL is mutable; no commit pin was collected for it in this bounded research.

## Required read-only RPC behavior

Authoritative protocol reference: [Electrum Cash protocol methods](https://electrum-cash-protocol.readthedocs.io/en/latest/protocol-methods.html). This is a mutable documentation reference; Parallel's extract was acquired 2026-11-02.

- `server.version(client_name, "1.5.0")`: explicitly negotiate a supported protocol. Do not silently fall back below 1.5.0 for token-aware queries. If negotiating a range through 1.6.0, implement that version's response changes, notably `blockchain.block.headers` changing from concatenated `hex` to a `headers` array.
- `server.features()`: validate `genesis_hash`, `hash_function === "sha256"`, supported protocol range, and `cashtokens === true` for CashTokens support. Advertisements remain assertions from that server, not independent proofs.
- `blockchain.block.header(height, 0)`: returns raw header hex. Decode, enforce the expected BCH header format, compute SHA256d, reverse the digest for displayed block hash, and compare with a trusted fixed checkpoint.
- `blockchain.headers.subscribe()`: initially returns `{height, hex}`. Notifications can skip intermediate headers and can represent reorganizations. Do not assume monotonically increasing consecutive heights.
- `blockchain.transaction.get(tx_hash, false)`: returns raw transaction hex. Recompute txid locally. Raw transaction retrieval is not an inclusion proof; inclusion requires a Merkle proof checked against a verified header.
- `blockchain.scripthash.listunspent(scripthash, "include_tokens")`: token_filter was added in 1.5.0. Pass this exact string explicitly, preserve and validate `token_data`, and reject unsupported token-aware behavior instead of silently dropping tokens.

[CashScript documentation](https://cashscript.org/docs/sdk/electrum-network-provider) explicitly warns its default provider uses one trusted server without SPV inclusion validation. Its source defaults to `bch.imaginary.cash` for mainnet and `chipnet.bch.ninja` for Chipnet: [fixed source](https://github.com/CashScript/cashscript/blob/5f0eaffb66086e1f3de41d631fa53cb0c8c41346/packages/cashscript/src/network/ElectrumNetworkProvider.ts). Provider compatibility is not proof of chain-state correctness.

## Trusted chain identity and checkpoints

Primary chain-parameter reference: BCHN commit **07576013c91ff4a3a74acd85f189c69121cdad1b**, [src/chainparams.cpp](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/chainparams.cpp).

- BCH mainnet genesis: `000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f`.
- Chipnet genesis: `000000001dd410c49a788668ce26751718cc797474d3152a5fc073dd44fd9f7b`.
- **Chipnet checkpoint height 121957**: `0000000056087dee73fb66178ca70da89dfd0be098b1a63cf6fe93934cd04c78`. BCHN's `CChipNetParams` checkpoint list identifies this as the first block under upgrade9 rules on November 15, 2022, around lines1079–1080 in the fetched source. Use this fixed source hash, not an endpoint-supplied checkpoint.
- BCH mainnet fork height **478559**: `000000000000000000651ef99cb9fcbe0dadde1d424bd9f15ff20136191a5eec`, corroborated by [Electron Cash fixed networks.py](https://github.com/Electron-Cash/Electron-Cash/blob/85e9d82b502c982416170457c06d6d2f2aaa636c/electroncash/networks.py).

**Genesis alone is insufficient:** Chipnet and testnet4 share genesis; BCH and BTC also share genesis. A chain-specific post-fork checkpoint is required for identity checks. Passing a historic checkpoint check does not prove the reported current tip descends from it. Proper SPV work additionally needs connecting headers and the appropriate consensus checks.

Do not confuse these ordinary block hashes with the distinct cumulative headers Merkle root returned by `blockchain.block.header(height, cp_height)` when `cp_height` is nonzero. A block-hash checkpoint cannot be substituted for that Merkle root.

## Retrieval artifacts and limitations

Temporary original research downloads (not application fixtures; may not survive environment replacement):
- `/tmp/transport-gp-source-mainnet.ts`, `/tmp/transport-gp-source-chipnet.ts`, `/tmp/transport-gp-README.md`: fetched by fixed GP commit above.
- `/tmp/transport-chainparams`, `/tmp/transport-ecnetworks`, `/tmp/transport-ecchip`, `/tmp/transport-cashscript`: raw official master contents fetched during the window; corresponding GitHub current-master commit IDs were retrieved separately and are pinned in links above. These raw-file requests used the master URL, not the commit URL, so byte identity with the subsequently resolved SHA was not separately re-fetched/verified.
- `/tmp/transport-bchn-metadata`, `/tmp/transport-ec-metadata`, `/tmp/transport-cashscript-metadata`: original GitHub commit metadata responses.

Exa's GitLab HTML fetch timed out; the official GitLab read-only API then succeeded. Fetching the Imaginary website failed, which does not establish Electrum service status. No access/permission denial occurred. No live RPC success or independent second-provider verification is claimed.
