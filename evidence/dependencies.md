# Dependency compatibility result

Exact direct dependencies and transitive integrity are in package-lock.json and dependencies.json. Successful clean install with scripts disabled, strict TypeScript (skipLibCheck=false), browser-target ESM bundle and ten offline SDK probes. Source: actual installed npm package types and registry snapshots under setup/.

Pinned: Libauth 3.1.0-next.8; CashScript 0.14.0; Wizard core 0.2.5 / dapp 0.2.2 / react 0.2.3; React/DOM 19.2.0; TypeScript 5.9.3; esbuild 0.25.11. Candidate versions are not universal latest recommendations; lockfile is authoritative. No cashc, mainnet-js, XO runtime, bridge or LLM SDK installed.

WizardConnect packages have no license declaration in retrieved metadata/package contents. Do not assume MIT from neighboring libraries: public release license review is OPEN.

Observed official dapp types: getPubkey(childIndex:number,index:bigint) may be undefined; no getIndexToUse/getAddressIndex API. signTransaction supports AbortSignal; broadcast lives in nested WcSignTransactionRequest. signedTransaction is hex. These static capabilities do not prove any actual wallet respects them.
