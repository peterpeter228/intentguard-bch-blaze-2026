# Installed API findings — PRESEASON, 2026-11-09

Source: `a82807ae0293baee39a185e229f906718e095e59`, pinned engine `0.1.1-next.17778370827`, utils `0.0.10`, crypto/state `0.0.5`. These are static findings, not calls to these APIs. Exact 1-based embedded-source excerpts and package/map SHA-256 values are in `api-source.log` and `api-source-hashes.json`.

## Engine.create is not keyless initialization

Signature: `static create(mnemonic: string, options: XOEngineOptions): Promise<Engine>` (`engine/dist/index.d.mts:769`). Options (`575–604`): optional `network`, `storageType`, `databasePath`, `databaseFilename`, `electrumServers`, `electrumApplicationIdentifier`, `remoteEncryptedStateServers`. There is no documented offline/no-network/no-identity option.

Embedded `engine.ts:157–204` unconditionally resolves network/servers, computes account hash from the supplied mnemonic, awaits `initializeElectrumApplication`, opens the account storage adapter, initializes monitor listeners, constructs mnemonic-derived Crypto, then subscribes/updates stored script hashes. Constructor `109–119` derives seed-backed keys in memory. `1084–1096` performs script-hash subscriptions, UTXO reads and persistent updates for stored hashes. This is not a harmless import or a public header probe.

Network default is **mainnet**; a separately authorized future test session must explicitly select `network: 'chipnet'`. `network/helper.ts` maps Chipnet/testnet4 to libauth `testnet` key encoding but distinct network server lists and database names. A `bchtest` prefix or tpub alone cannot distinguish these chains.

Storage default is IndexedDB, not automatically SQLite. `databasePath` falls back to `./` in state storage; `databaseFilename` defaults to `XO`. Network base is `<base>-<network>` and the storage factory appends `-<accountHash>`. Electrum cache base is `[<explicitBase>-]Electrum-<network>-<accountHash>`. When SQLite is explicitly selected, the adapter joins its directory/filename and opens a database, creating the directory if absent (`state` embedded SQLite source `108–130`). This run opened no XO account/cache/session. Do not infer that Engine persists the mnemonic verbatim: observed effects are derived in-memory keys plus account/template/invitation/generated-secret state, not a demonstrated mnemonic serialization.

Installed `@electrum-cash/application` initialization (`application.ts:1163–1237`) starts network initialization and configures its database, awaits network initialization, may bootstrap missing checkpoints from network, and starts block-header monitoring. The supported Engine factory has no keyless/offline branch. A future session needs separately reviewed persistence locations and public-query disclosures. No Engine-specific connectivity success/failure was exercised here.

## createInvitation always signs on its successful path

Signature: `createInvitation(params: InvitationCreationParameters): Promise<StoredInvitation>` (`index.d.mts:970`). Required template/action identifiers; optional transaction version/locktime, inputs, outputs, variables, resolutions, role, expiry and intent (`190–247`). Wrapper `engine.ts:512–516` passes private account context.

Embedded `invitation/participation/create.ts` loads the stored template, resolves role/generated-variable identifiers, builds an unsigned commit, then unconditionally calls `crypto.signInvitationCommitWithSchnorr` before adding/storing it. There is no read-only flag, even with no UTXOs and zero requested funding. It may also generate template private-key data, attach local secrets, store/read the invitation, track generated output script hashes and reserve inputs. The return value is local **StoredInvitation**, potentially containing `secretsByCommitIdentifier`; it is not the shareable export.

Crypto source `crypto.ts:182–204` delegates to the genuine Schnorr signing implementation. That implementation derives private invitation/commit keys and calls `secp256k1.signMessageHashSchnorr`. No such method was invoked. Identity signing consumes no BCH; zero funds is not authorization to sign.

## serializeInvitation is export, not signature creation

Signature: `serializeInvitation(invitation: XOInvitation): string`; complementary `deserializeInvitation(serializedInvitation: string): XOInvitation` (`utils/index.d.mts:791,803`). Embedded `invitation/serialization.ts` only uses Extended JSON serialization (bigint/Uint8Array support), with errors; deserialize revives and schema-parses. It does not create a valid participant signature, open an account or connect to a node.

**Minimum real next input:** one already existing, non-sensitive exact `serializeInvitation(storedInvitation.invitation)` export, exact template JSON, explicitly declared network, and independently chosen normalized template identifier plus source/review provenance. Preserve signed byte/field ordering; do not rewrite/redact signed payloads to invent a suitable fixture. Do not supply full StoredInvitation, account backup, mnemonic, private key, owner wallet, workshop token or local secret map. Keep the real artifact out of this evidence/repository and third-party tools.

The existing local inspector (`preseason/xo/inspect.ts:27–68`) can schema/signature/consistency/expiry-check that export without an Engine session. It always keeps `canSign=false`, returns REJECTED or REVIEW_REQUIRED, and cannot prove current ownership, UTXO availability, payment, fees or receipt. A historical/expired genuine artifact may establish only historical compatibility, preserving expiry rejection. None was supplied, so no signed-positive inspection was run or claimed.

## Actual probe and network distinction

Each of the two existing reviewed endpoints received exactly one transport invocation: built-in `server.version` negotiation for exactly `1.5.0`, followed by one requested checkpoint header at height `121957` only if negotiation succeeds. Both returned `ELECTRUM_UNSUPPORTED_PROTOCOL`; no header result. This code means the existing transport rejected the version-stage result shape/version at `core/electrum-transport.ts:112–116`. It is **not** a DNS diagnosis and does not reveal the exact returned remote version (transport intentionally does not expose it). It also is not proof that the different installed Engine network implementation fails. No protocol change, retries, alternative endpoint, IP/TLS/proxy bypass or address subscription was attempted.

Live read-only transport remains unverified for usable headers. Engine initialization has a mandatory network side-effect/prerequisite, but an existing artifact's first offline verification does not need connectivity. No separate network-route decision is requested: these results do not justify a new route or establish Engine-specific failure. Any proposed new session must separately establish an authorized compatible network configuration before execution.

## Preparation-and-questions stop

Wallet **not created; not required for keyless preparation**. Public address unavailable. Current funding request **0 sat**. No offline wallet procedure, recovery check, Engine session, identity signature, signed fixture, transaction construction/signing, funding, broadcast, payment or receipt was produced by this preparation. Existing offline baseline tests remain baseline tests, not new integration evidence. The unsafe finite tranche remains never fundable. Guard/fees/expiry/ownership/UNKNOWN rules are unchanged. Owner options are recorded only in the current task's QUESTIONS.json.
