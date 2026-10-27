# G0 environment — 2026-10-27

- Actual execution: dot cloud shell, Node v24.22.1, npm 11.9.0, Linux; no desktop or saved coding environment assumed.
- New private repository: https://github.com/peterpeter228/intentguard-bch ; initial remote main supplied by coordinator: `f0722677d80e3390bf4f4f5c8f991c783691cf6c`. This workspace is prepared files, not a cloned checkout; final persistence SHA must be recorded by sole remote writer.
- No accessible IntentGuard-402 baseline was found by coordinator. This is a new BCH project, not the existing NEAR IntentGuard. Migrate is NOT_APPLICABLE unless real prior-project evidence is later supplied.
- Original 29-file specification copied by exact relative path; only AGENTS extended to preserve user restriction. Root SHA256SUMS is original handoff manifest, not current-project checksum. See source-import.json.
- npm first attempted default cache `/home/agent/.npm`, which did not exist; recovered using writable `/tmp/intentguard-bch-npm-cache`. No security settings changed. Failed metadata response files retained, not described as successes.
- Successful registry/install steps used public npm registry; install scripts disabled. No credentials, session, wallet, signatures, broadcasts, paid services or contract deployment.
- Browser SDK bundle compiled; not mounted or browser-click tested. Wallet connection is NOT_RUN, including broadcast:false behavior.
