# Deterministic offline unsigned planning

This is pre-event engineering, not a wallet adapter or an executable payment workflow. The planner never fetches UTXOs, requests keys, signs, broadcasts, or changes the persistent payment state. Callers explicitly select the inputs to consider; the planner never selects additional funds automatically.

## Trust boundary

Parent transactions are content-hash checked and the existing Guard rechecks the constructed outputs. Supplied network, unspent state, owner scripts and clock remain assertions, not live-chain evidence. The read-only review coordinator is a separate interface; importing a plan cannot promote its journal to trusted state. Every returned plan retains canSign=false and must be treated as hypothetical until independently refreshed and authenticated.

## Fee assumptions

The requested signature model is an assumption, not a fact established by a P2PKH script hash. Only minimal-push compressed-public-key models are considered. Schnorr uses a 100-byte unlocking script (141-byte full input). Strict low-S ECDSA uses the conservative 44–107-byte unlocking-script envelope (85–148-byte full input). This broad lower bound is used for the rate ceiling, not as a claim about likely signature length.

Budget fees using the maximum estimated final size and a ceiling division. Bound the worst-case fee rate using the minimum estimated final size, with integer cross multiplication. Also enforce the intent's absolute fee cap. No fake signatures are generated to estimate size. Empty unlocking scripts in the output are not valid signed inputs; their transaction hash is not the final signed transaction ID.

Token dust uses the complete serialized output at the declared 1000 sat/1000-byte application baseline. Actual node configuration, mempool policy, miner inclusion, real signed size, signature algorithm, sighash and signature validity remain unverified. Narrow signed-size assumptions must be enforced again on any future returned wallet transaction. The existing structural comparator alone does not establish them.

## Determinism and failure

Selected outpoints have a stable ordering; recipient output order and exact values are preserved. Fungible token change is ordered by category and cannot be burned. BCH-only remainder below the fixed plain-output dust threshold may become a fee only with explicit opt-in and renewed absolute/rate-cap checks. Non-dust remainder is rejected even if an extra change output would be uneconomic at the requested fee rate. Unsupported inputs, invalid amounts, missing evidence, expiration, insufficient funds and excessive fees fail closed. No hidden retries or input discovery occur.

## Scope remaining

This slice does not establish authenticated ownership, fresh production UTXO evidence, a safe no-broadcast wallet signing adapter, actual signed size/validity, consensus acceptance, real Chipnet/mainnet operation, receipts, public deployment, contest eligibility or award likelihood. All synthetic examples are unbroadcast teaching data.

Official review and actual execution evidence: evidence/builder-20261104/. Preserve the pre-core baseline 4bf2d146c701822526faa0622dd26772dc18c705 and disclose this November4 work as pre-event.
