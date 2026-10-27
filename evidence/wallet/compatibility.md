# Wallet capability matrix — G0 PARTIAL

| Claim | Evidence | Status |
|---|---|---|
| Published SDK imports and browser bundle compile | strict tsc + esbuild | PASS |
| Unpaired getPubkey may be undefined | actual manager with session:false | PASS |
| broadcast:false exists in nested transaction request | installed official types | STATIC_ONLY |
| signedTransaction string is returned protocol field | installed official types | STATIC_ONLY |
| Actual wallet pairing, paths, signature result, reject/reconnect | no wallet used | NOT_RUN |
| Actual wallet does not auto-broadcast | no wallet used | NOT_RUN |
| Cancellation before sending | SDK diagnostic below | KNOWN_RISK |
| Chipnet/mainnet payment or receipt | no chain operation | NOT_RUN |

## Pre-aborted request diagnostic

In installed dapp 0.2.2, signTransaction calls sendSignRequest before checking options.signal.aborted. A subclass overrides only public transport methods with an in-memory never-resolving Promise and counters. With an already-aborted signal the actual SDK convenience method invokes mock send once then mock cancel once and rejects AbortError. No network connection, relay credentials or wallet was created. Ten tests passing includes reproducing this risk, not fixing it.

Before future product use, the adapter must reject an already-aborted attempt BEFORE invoking SDK and bind late responses to attempt/revision/session/sequence. A true live-wallet cancel response and broadcast behavior remain unverified. G2 remains blocked until one actual supported combination is tested. The application adapter has deliberately not been implemented during preseason G0.
