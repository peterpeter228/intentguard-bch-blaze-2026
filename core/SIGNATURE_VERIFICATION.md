# Offline signed-candidate verification

No private keys are generated, requested, loaded or used. No signature is created. No wallet is connected, and no transaction is broadcast. Only immutable public BCHN test vectors supply positive signed examples.

## Three deliberately separate layers

`verifyResolvedP2pkhSignatures` accepts canonical signed bytes and serialized source outputs. It requires exactly two minimal direct pushes per input, compressed public keys matching the P2PKH source hash, declared Schnorr or strict-DER low-S ECDSA model, and restricted sighash flags. It runs every input through the pinned libauth3.1.0-next.8 explicit BCH_2026_05 standard VM. It does not use the backwards-compatible default alias, which still selects2023 rules.

Its success is `SIGNATURES_VALID_STATELESS`, never a payment-plan verdict. Source outputs are caller assertions. The two published BCHN vectors have no complete parent transactions and cannot prove input provenance or spendability. No network is verified.

`verifyParentBoundP2pkhSignatures` resolves each signed input from complete, canonical parent transactions whose content hashes match the outpoints, then calls the stateless layer. Its separate success is `SIGNATURES_VALID_PARENT_BOUND`. The unchanged official Trezor historical version1 child now supplies a two-input positive for this shared resolver. Parent content binding does not prove confirmation, current spendability, wallet ownership or an approved business intent. This crypto-only layer accepts that historical version1 transaction; the actual payment builder remains version2-only.

`verifySignedPlan` instead reconstructs the deterministic unsigned plan from the strict build input, replacing JSON's `now` with the trusted invocation clock (default Date.now). It compares all non-unlocking transaction bytes, resolves parents by full transaction hash and exact input order, rechecks actual signed size and fee/rate policy, then calls the stateless verifier. Its separate success would be `SIGNED_PLAN_VALID_OFFLINE`; it still does not authorize a payment. The supplied snapshots/owner scripts are not authenticated live chain or wallet facts. No positive full-parent integrated signed fixture was found in this slice; that acceptance gate remains unverified.

All layers always return canSign=false, broadcastable=false, receiptValid=false, networkVerified=false and chainVerified=false. They are not plugged into signing, broadcasting, payment state transitions or a UI green payment indicator. Imported result JSON is never evidence authority.

## Sighash and model policy

Plain BCH supports only ALL|FORKID (0x41) or ALL|FORKID|UTXOS (0x61). Token-bearing inputs or outputs require0x61 as a stricter application policy, not a claim that consensus universally mandates it. NONE, SINGLE, ANYONECANPAY and unknown bits are rejected. No official strict-P2PKH token/0x61 positive is established yet; flipping an existing0x41 byte is only a negative mutation, not a new valid signature.

Schnorr requires exactly65 signature bytes including sighash. ECDSA requires strict DER, low-S through VM rules, and the declared compressed-key envelope. A65-byte transaction signature is not accepted under the ECDSA model because the BCH VM dispatches its64-byte payload as Schnorr. Actual signed size and both actual fee bounds are checked again at the plan layer. The structural comparator by itself remains insufficient.

BCH signatures do not encode a chain ID. Matching network labels cannot cryptographically prevent cross-network replay; genuine source provenance/freshness and actual network checks remain separate. Pinned stateless standard validation is not a guarantee of today's node configuration, miner acceptance, absence of double-spends or confirmed execution.

## Evidence and limitations

See evidence/signature-20261104/OFFICIAL_VECTORS.md for immutable source URLs, hashes, license and verify-only results. The signature tests include two unmodified BCHN public positives and an unchanged Trezor full-parent positive, mutation/unsafe sighash/source substitutions/malformed encoding failures, and explicit high-level rejection of an existing public signature transplanted into a synthetic plan. No synthetic signature is generated or claimed valid.

Version2 full-plan integrated signed success, actual token0x61 success, authenticated wallet ownership, no-broadcast wallet behavior, real node/chain acceptance, receipts and event requirements remain open. This November4 work is disclosed pre-event.

Additional immutable-source search and upstream notices: evidence/signature-positive-20261104/. The complex BCHN cvs72j token vector has actual auxiliaryP2PKH sighash0xc3, not the0x61 in its primary-script description. It remains rejected, never relabelled as an allowed payment positive.
