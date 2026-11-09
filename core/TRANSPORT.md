# Bounded read-only Electrum transport

November 4 pre-event implementation. No wallet, signing, broadcast, deployment or contest submission is enabled.

## Application boundary

`createElectrumTransport(allowlist, endpointId)` captures an application-authored TLS hostname/port list. It accepts no endpoint URL from a candidate transaction or UI. The five permitted requests are features, one block header, current headers subscription snapshot, raw transaction by txid, and token-inclusive script UTXOs. All parameters are checked before any socket is created. A fixed internal `server.version` handshake negotiates exactly 1.5.0, because token filters require it and later protocol versions can change response shapes.

November 9 compatibility correction: Electrum explicitly permits an omitted zero
revision. Both existing Chipnet peers returned `1.5` to a `1.5.0` request. Accept
only `1.5` and `1.5.0`, not a broader range or malformed spellings. Actual fixed
transport matched the independently pinned block 121957 hash over normal verified
TLS. This does not validate every RPC, a two-source collector or any payment.
The separately authorized identity-only XO Engine uses official WSS/checkpoint
initialization, not this core transport. See task bch-blaze-chipnet-20261109 evidence.

Each call uses one verified TLS connection, normal hostname verification, a 5-second total deadline and a 512-KiB response budget. It checks JSON-RPC identity, framing and protocol errors, cleans up cancellation/close/error and does not retry or select fallback nodes. Node TLS certificate failure is a hard failure; there is no certificate-warning bypass or insecure verification option. Caller-facing errors are fixed codes without raw remote error strings.

The synthetic factory is a unit-test seam, not live node evidence. Injected transports and source kind are trusted application inputs; a malicious application can mislabel them. Hostname allowlisting is not an independent private-IP/DNS rebinding filter. The current code must not be exposed as an arbitrary URL proxy or advertised as such a filter. Future web service integration needs its own network egress boundary.

## Reviewed opt-in candidates

`public-sources.ts` contains only Chipnet candidates, two different operator labels from the fixed GeneralProtocols directory. Construction makes no connection. UI and collector defaults remain unconfigured. Directory attribution does not prove present health or independent backends.

- Kallisti: chipnet.bch.ninja:50002
- Imaginary Username: chipnet.imaginary.cash:50002

BCHN fixed source pins the shared genesis and post-split Chipnet block 121957. This distinguishes the expected reported chain identity from testnet4 but does not prove a chain of work or SPV inclusion. Pins are source-derived, not learned from the node being checked. Full source references and usage limitations are in `evidence/transport-20261104/ENDPOINT_RESEARCH.md`.

`maxTipAgeMs` is explicitly bounded trusted-source policy. These candidate configs use two hours, checked against the header timestamp both at collection start and completion; a tip more than two minutes ahead also fails. This is a conservative application freshness heuristic, not a consensus rule or organizer requirement. A fresh fetch of an old tip is not fresh chain evidence. Two nodes agreeing is still only NODE_REPORTED. Empty UTXO output may reflect server resource limits; it fails the required-input check and must never be presented as proof of payment or nonexistence.

## Actual verification boundary

Local tests exercise fragmented/malformed framing, oversize data, RPC/version/ID mismatch, cancellation (including construction-time abort), closed streams, deadlines, method/parameter restrictions and TLS options through explicitly synthetic streams. The November 9 live result above covers one pinned public header only; it is not inferred from these tests.

The first standalone Node TLS diagnostic on November 4 at 14:05:50 UTC attempted only the public Chipnet server-version handshake. DNS failed with EAI_AGAIN before a TLS connection or RPC response. This diagnostic preceded the final transport implementation; it is not a live test of the final module. No alternate IP, certificate override, proxy or different environment was used to bypass the failure. No user address, key or wallet data was transmitted.

Remaining beyond the single November 9 header: broader public transport health and RPC coverage; raw transaction/UTXO validation against known public examples; full two-source collector with separately authorized authenticated wallet ownership; fee/dust and signature validation; real payment orchestration. The header result and synthetic tests do not close these gates.
