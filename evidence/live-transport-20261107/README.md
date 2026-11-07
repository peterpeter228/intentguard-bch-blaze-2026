# Public transport diagnostic, November 7, 2026

Only the existing approved public endpoint `chipnet.bch.ninja:50002` was attempted.
The first request was `server.features` with an empty parameter list. No user
address, wallet data, key, signature or transaction was supplied. The recorded
transport also performs its protocol handshake. No RPC response was returned.

`RESULT.json` at 14:50:48 UTC uses exact core source from
`61e0895d21ab173a74cf5363a9392d73a3b2314f`, with Git blob hashes checked locally.
It exits 1 with `ELECTRUM_CONNECTION_FAILED`, operations empty, status UNVERIFIED
and every authority flag false. The transport hides the underlying connection
error, so this does not establish a specific DNS/TLS/server diagnosis.

An initial 14:49 attempt had one extra trailing newline in materialized source
files and returned the same generic failure. It is retained separately and is not
claimed as exact-source evidence. After correcting materialization and verifying
all seven initial file hashes, one exact-source attempt was made. No further
retry, alternate IP/endpoint, proxy, TLS bypass or executor change was used.

The script's later checkpoint/tip checks were not reached. Even their success
would only be single-source header diagnostics, not full collector/ownership,
SPV/consensus, spendability or payment evidence.
