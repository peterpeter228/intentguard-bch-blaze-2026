# Wallet capability matrix — PRESEASON

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

## November9 connected adapter (task intentguard-mainnet-20261109)

`core/wallet-adapter.ts` now uses the actual pinned manager and low-level protocol,
memory-only session, fresh key-exchange + ready binding, immediate raw disconnect,
pre-abort, immutable attempt envelope and synchronous pending cancellation before
SDK reconnect replay. Actual manager/relay-client transport-seam tests passed7/7.
This is SYNTHETIC_TRANSPORT evidence, not stock-wallet or live-chain evidence.
Official relay is pinned to `wss://relay.riften.net:443`; no fallback or stored URI.
App production bundle strips SDK console calls because malformed-session logs can
contain private paths. App errors stay bounded public codes, not raw SDK messages.
Nested `broadcast:false` expresses sign-only intent; stock-wallet adherence remains
NOT_RUN. Mainnet cap0 prohibits pairing/signing/sending; unsigned tests only.
Original G0 matrix/diagnostic above is historical, not the new adapter's capability.

## November15 WPREV4 visitor route

Visitor adapter is explicitly network-bound mainnet; default legacy adapter still
refuses mainnet. Sign-only uses locked core0.2.5/dapp0.2.2/interfaces0.0.8, no
dependency upgrade, session:false, fresh key exchange, pre-abort and replay cleanup.
Official protocol https://docs.riftenlabs.com/wizardconnect/protocol/ has no
authenticated chain ID or broadcast-only action. Network acknowledgement is not
chain proof. Fixed BCH genesis/Axion661648 sources and session-owned paths required.

Full verifySignedPlan/all-parent/VM/fee/0x61 checks precede durable exact signed
bytes/local txid and explicit visitor-only native handoff. Electron Cash4.4.6.1
official commands.py broadcast is network-only and tx_from_str accepts raw hex:
https://github.com/Electron-Cash/Electron-Cash/blob/4.4.6.1/electroncash/commands.py
https://github.com/Electron-Cash/Electron-Cash/blob/4.4.6.1/electroncash/transaction.py
https://electroncash.readthedocs.io/en/latest/old/coldstorage_cmdline.html
Visitor reviews/deserializes signed.txn then chooses native `electron-cash broadcast -`.
No second signature, broadcast:true or app/server broadcast. Handoff remains UNKNOWN
until independent original-byte/inclusion observations; no retry/repeated handoff.

Compiled UI/stateless HTTP/installed IndexedDB-shim regression passes using existing
isolated Chipnet signatures verify-only; no generated mainnet signatures or chain
transaction. Actual wallet/app/browser interoperability, sign-only adherence and
real visitor payment remain UNVERIFIED. Parent native-browser/Astra evidence separate.

