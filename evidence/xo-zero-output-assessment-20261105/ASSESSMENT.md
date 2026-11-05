# XO zero-value output repair assessment

Assessed 2026-11-05 UTC against IntentGuard commit `89d1135875ae2b63c2fab8eee1bdb883a9a08888`. This is a documentation-only decision after the new reproduction, not another implementation or test milestone.

## Decision

Do not install a local compatibility patch or broaden Guard in this slice. No officially supported preserve-zero option or published fix was found. A strictly bounded, explicitly local offline compiler could be implemented, but it would not repair or establish the normal authenticated XO Invitation/signing path. Introducing that partial fork would add another offline path while leaving the material integration risk open.

This is not a claim that zero-satoshi data outputs are invalid BCH, that the MIT licenses prohibit modification, or that a local adapter is inherently impossible. It is a scope and safety decision: preserve the existing product behavior rather than present an encoder-only change as an end-to-end repair. No production source, dependency, Guard rule, wallet behavior, template, signature flow or UI was changed.

## Actual upstream state

Live [engine npm tags](https://registry.npmjs.org/-/package/@xo-cash%2fengine/dist-tags) still identify `next` as `0.1.0-next.17612568780`; `latest` is older `0.0.1`, and `development` is `0.0.1-development.15965991683`. The pinned next gitHead is `18c44c1b0e9254882dbdbbc1e41bd559244bdda4`.

The [exact encoder source](https://gitlab.com/GeneralProtocols/xo/engine/-/blob/18c44c1b0e9254882dbdbbc1e41bd559244bdda4/source/invitation/generation/transaction.ts#L57) explicitly omits already-resolved outputs whose satoshi amount is at most zero. No preserve-zero flag was found in this function or the inspected output/template types. This is documented upstream behavior, so deleting the filter globally changes semantics. Automatic change may also produce nonpositive values; retaining every zero or negative output is not a safe general correction. The inspected pinned tree did not provide a test directory or a complete formal contract covering all optional-output cases; this is an evidence gap, not proof of intended behavior for every template.

The official GitLab `next` branch was observed at `7926f18deae3950c1f1038280966efd4e6ca252b`. Its [diff from the npm gitHead](https://gitlab.com/GeneralProtocols/xo/engine/-/compare/18c44c1b0e9254882dbdbbc1e41bd559244bdda4...7926f18deae3950c1f1038280966efd4e6ca252b) adds merging without output resolution and variable provenance for displaying in-progress invitations. The documentation still directs transaction building to the resolved merge. The zero-value filter is unchanged. This newer source is not a supported transaction workaround and was not installed. Bounded searches found no matching published fix; this does not prove no discussion exists elsewhere.

## Why an encoder-only change is insufficient

The [unlocking-compilation source](https://gitlab.com/GeneralProtocols/xo/engine/-/blob/18c44c1b0e9254882dbdbbc1e41bd559244bdda4/source/compilation/generate-unlocking-bytecode.ts#L343) places `mergedInvitation.outputs` directly in the signing compilation context. The later serializer applies its separate nonpositive-value filter. The same pattern is present in the installed engine bundle at lines 6893–6900 and 5899–5910, respectively.

This creates a source-level consistency concern when an output is present in the merged signing context but omitted from final serialization. No signing was performed, so this report does not claim a demonstrated invalid signature or a successful authenticated Invitation. It establishes why changing only the pure serializer cannot prove the full path correct. A supported repair must reconcile output resolution, ordering, optional-output handling, signature compilation, final serialization and fee accounting together.

The engine's `160 * input count + 120 * merged output count` fee estimate is not actual serialized size and may count omitted outputs. It cannot replace IntentGuard's independent integer fee caps and signed-size assumptions.

## BCH rules versus application policy

Primary sources were checked at BCHN [v29.2.0](https://github.com/bitcoin-cash-node/bitcoin-cash-node/releases/tag/v29.2.0), commit `07576013c91ff4a3a74acd85f189c69121cdad1b`.

- Consensus rejects negative or excessive output amounts, but permits zero. Dust and default nulldata limits are policy, not consensus. An OP_RETURN script is unspendable. See [transaction amount checks](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/consensus/tx_check.cpp#L12-L48) and [unspendable classification](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/script/script.h#L1229-L1241).
- Default TX_NULL_DATA classification requires OP_RETURN followed by a successfully parsed push-only tail. BCHN totals the locking-script bytes across TX_NULL_DATA outputs, with default maximum 223. OP_RETURN and push opcodes count; outer value/length fields and token prefixes do not. Multiple data outputs are not categorically prohibited. See [classifier](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/script/standard.cpp#L113-L121), [default constant](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/script/standard.h#L54-L62), [aggregate policy](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/policy/policy.cpp#L100-L133), and [boundary tests](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/test/transaction_tests.cpp#L731-L940).
- `-datacarriersize` is configurable; the default does not guarantee propagation or mining. TX_NULL_DATA is dust-exempt. Nonzero BCH placed there is permitted but unspendable, so requiring exactly zero is an application anti-burn safeguard. See [dust policy](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/policy/policy.cpp#L19-L40) and [configuration](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/init.cpp#L1080-L1084).
- BCHN push-only classification is not minimal-push validation. It checks successful parsing and opcodes at most OP_16, including OP_RESERVED, without invoking the minimal-push check. Exact canonical encoding is an application safeguard. See [IsPushOnly](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/script/script.cpp#L431-L446).
- Valid token prefixes do not categorically invalidate OP_RETURN output standardness. Such tokens are unspendable; a token-free policy must reject the entire token object, including NFT-only cases, not merely test fungible amount zero. See [CashTokens standardness](https://cashtokens.org/docs/spec/chip/#token-prefix-standardness) and [token validation](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/consensus/tokens.cpp#L212-L295).
- Under active May-2026 rules, otherwise-unmatched scripts of at most 201 bytes can fall through to standard P2S. Thus the 223-byte TX_NULL_DATA counter is not a universal rule for every OP_RETURN-prefixed script. Neither generic standardness nor a broad OP_RETURN prefix is an appropriate Guard allowlist. See [P2S fallback](https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/07576013c91ff4a3a74acd85f189c69121cdad1b/src/script/standard.cpp#L145-L152) and [upgrade specification](https://upgradespecs.bitcoincashnode.org/2026-05-15-upgrade/).

### Narrow future policy, not implemented

A future commitment feature should allow zero or one explicitly requested data output, at an exact bound index, with value exactly zero and token data entirely absent. Fix one domain/version and one canonical 32-byte digest encoding; reject alternate pushes, malformed lengths, additional bytes, unknown versions, duplicates and unrequested outputs. All other scripts retain the existing explicit allowlist.

For size illustration only, OP_RETURN + direct push of four magic bytes and one version byte + direct push of a 32-byte digest occupies 40 locking-script bytes and 49 serialized output bytes. No magic value or schema is adopted by this report. The preimage design must bind exact canonical invoice/request terms, recipient, asset, network, amount and nonce/identifier policy. Predictable hashes are not automatically private. A matching commitment is not identity, consent, delivery, freshness, confirmation, a receipt or repeat-payment prevention.

One output, zero BCH, no tokens and exact encoding are IntentGuard choices, not BCH consensus mandates. Actual bytes, output index, parent/input binding, payment/token/change conservation and full fee/size accounting must all be independently verified. Stripping the output before Guard, inserting it after verification, or accepting an imported verdict would not satisfy that requirement.

## Pinned libauth caveats

The separate protocol review inspected installed `@bitauth/libauth` `3.1.0-next.8` and exercised only small local classifier inputs, not BCHN or real transactions:

- `build/lib/vm/instruction-sets/bch/2023/bch-2023-instruction-set.js`, lines 493–518, adds one byte to each data locking-script length in aggregate accounting, unlike BCHN's script-only sum.
- `common/instruction-sets-utils.js`, lines 472–489: `isArbitraryDataOutput` can classify malformed push tails such as hex `6a4c` and `6a4d0100` as data. BCHN's nulldata parser rejects those malformed pushes; post-upgrade P2S fallback is separate.
- `isPushOnlyAccurate` is not an exact BCHN replacement because it accepts only decoded instructions carrying data and rejects OP_1 and OP_RESERVED.
- The helper used by libauth dust calculation differs from BCHN's broader unspendable classification; for a zero-satoshi output with locking bytecode `6a6a`, libauth returns a 477-satoshi dust threshold whereas BCHN returns zero.

These differences reinforce using an exact small application format rather than generic helper classification. They are not a reason to replace library primitives or relax transaction verification. No libauth patch was made.

## License verification

The exact installed license files and immutable upstream sources for these five packages are MIT. Preserve the complete copyright and permission notices in copied or substantially adapted source, and identify local modifications and their source version/commit. Licensing permission is distinct from technical compatibility and separate contest/IP requirements.

- [engine 0.1.0-next.17612568780](https://gitlab.com/GeneralProtocols/xo/engine/-/blob/18c44c1b0e9254882dbdbbc1e41bd559244bdda4/LICENSE)
- [templates 0.0.12](https://gitlab.com/GeneralProtocols/xo/templates/-/blob/2e39bd00ed10fda7a2e4e180e4c693a2880c3d3a/LICENSE)
- [utils 0.0.10](https://gitlab.com/GeneralProtocols/xo/utils/-/blob/b0ef5acd3f1552862cf2e77b71ccfdde89360939/LICENSE)
- [types 0.0.8](https://gitlab.com/GeneralProtocols/xo/types/-/blob/e2cea7226b16759cd41e7af1cfb393d4fbd6afc4/LICENSE)
- [libauth 3.1.0-next.8](https://github.com/bitauth/libauth/blob/d28da7f595cbd747c1e1125477db655f740f3dbc/LICENSE)

The four XO packages identify GeneralProtocols / XO; libauth identifies Jason Dreyzehner. No new dependency or agreement was introduced.

## Exact next gate and evidence limits

Obtain supported, coherent output semantics across merge, signing context and serialization, together with a valid verification fixture demonstrating the exact expected outputs and fees. Any actual account/wallet/signing or external maintainer communication remains a separate permitted action; none was initiated. If a separate locally adapted offline compiler is deliberately selected later, it must remain named and bounded as such, reject unexpected nonpositive placeholders, preserve an exact token-free commitment only, and never be presented as official authenticated XO execution.

The newly persisted reproduction remains at the parent commit. Its 223-test validation result belongs to that earlier run. This assessment adds no product tests and claims no new full-suite, browser, signature, chain, CI or relay result. Existing source/package/lockfile bytes are unchanged. There was no wallet, key, signature, real transaction, broadcast, deployment, public release, upstream outreach, screenshot upload or restricted-image retry. G1 remains IN_PROGRESS; this assessment does not complete a contest feature.

Integrity check: all 90 unchanged files in the selected baseline snapshot still match their recorded remote Git blob hashes; only three project-document appends and this new assessment differ. This is not a full historical-artifact download. Separate upstream/licensing and protocol reviews checked this report and found no material factual error. No additional full test suite was run for these documentation-only changes.
