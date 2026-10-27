# Independent G0 evidence audit

Observed 2026-10-27 08:38–08:39 UTC. Scope: local preseason SDK compatibility probes only. No wallet, keys, signature, broadcast, chain query, user transaction, or G1 application implementation.

## Actual independent checks
- Read AGENTS.md, task and acceptance documents, package/lock/config, both probe files and installed SDK implementation.
- `npm run validate` repeated 08:39:11 UTC: strict TypeScript (skipLibCheck=false), TypeScript build/browser esbuild, all 10 Node tests PASS, exit 0. Full output validation.log.
- Additional independently hand-assembled fixed synthetic transaction serialization vector: `node fixed-vector.mjs`, PASS, 85 bytes, expected version/index/value/script and roundtrip. This is NOT a public-chain vector, wallet signature, or consensus-valid spend. Result fixed-vector-result.json.
- SDK signTransaction installed source dapp-connection-manager.js lines 220–253: sendSignRequest at 228 precedes aborted-signal check 243. Offline overridden-transport test observes sent=1,cancelled=1 and AbortError. This is an SDK call-order diagnostic, not proof of actual wallet broadcast.

## Findings and claim boundaries
1. No blocking failure found for the bounded offline G0 compatibility slice. This does NOT release G0 overall or G1.
2. Existing 10 tests use synthetic data. Roundtrip is encoder/decoder consistency, not independent correctness by itself. Node crypto provides an independent hashing implementation; there is no externally sourced known chain transaction vector in those 10 tests. Do not label them known mainnet vectors.
3. Bigint synthetic transaction uses native BCH value 9007199254740993 sats, above BCH supply; appropriate only for encoding precision stress, not a valid spend. Parser success is not consensus/policy acceptance. Add explicit wording if describing validity.
4. Browser bundle succeeds, but component is not mounted. No browser click, QR pairing, wallet cancellation behavior, broadcast:false compliance, late response, or real provider capability was exercised.
5. Pre-aborted call diagnostic is a future adapter requirement: reject before SDK invocation and separately bind late response to session/attempt/revision. This audit does not implement that G1/G2 adapter or claim the issue fixed.
6. T04 wallet feasibility and registration/rollcall/Telegram/IP/real chain gates remain external/NOT_RUN. Initial copied STATUS was still a template at inspection while owner was updating documents; final owner state must say G0 partial, not product complete.

## Audited source hashes (SHA256)
- package.json: 968db6c1cf5976e00af5f88b26b0e1889f4f6c67c70665b988a8d50a85bcb789
- package-lock.json: 670f827c14a8c930a04ae1c131b48a9fd57b63fdc374d5c46bcc8d3a73d93d09
- tsconfig.json: 6797449e31a76d7a5ac6869fce004986e21e99e011c7f5200a24f462033f9112
- probes/browser-types.tsx: c0905d9b68f320a0b81849642102fb8410dea579df3b1ecc87d077efda085c4e
- probes/sdk.test.ts: 45478e9297aba915c207feb0babda1fb82e28434444ebb812eb6cff84861ac1f

No application source edits. Repeat validation if implementation/lock changes; docs-only changes do not create wallet evidence. The fixed-vector runner currently imports the exact absolute inspected install path and must be made relative if archived for portable reproduction.

Integration note: runner import changed to package resolution for portable reproduction; reran successfully, see portable-rerun.json. Original audit hashes remain unchanged.
