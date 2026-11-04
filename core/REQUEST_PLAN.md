# Explicit offline request-to-plan binding

This SDK adapter joins the strict payment-request schema to the existing deterministic unsigned builder. It implements the missing mapping between reviewed request terms and a plan without introducing a wallet, network request, teaching-fixture default, receipt or spending permission. All work is disclosed pre-event on November 4, 2026.

## Consumer contract

`buildPaymentRequestPlan(request, expectedRequestDigest, context, now = Date.now())` accepts:

- `request`: untrusted request wire object or bounded JSON text. Text uses the existing duplicate-key/8 KB parser. Objects use the existing strict request validator. Reports, derived displays, supplied scripts, owner fields and authorization claims are not request documents.
- `expectedRequestDigest`: a digest retained by the application's independent local review flow. Every call revalidates request terms and recomputes the digest. Changed terms require review again. Supplying the request's own claimed digest or an old result is not meaningful consent. A caller can fabricate a digest, so equality is never proof of a human action.
- `context`: an explicit separate object containing only `ownerScripts`, `changeScript`, `snapshot`, `selectedInputs`, and `feePolicy`. These are **offline supplied claims**, not authenticated wallet ownership, sources, funds, UTXOs or fee quotes. Missing context rejects; there is no fallback to `fixtures.ts`.
- `now`: current invocation time supplied by trusted application code. Neither request nor context JSON can override it. The explicit argument supports deterministic synthetic tests, not replaying stale observations as current.

The adapter re-derives recipient scripts and integer amounts from validated CashAddr/request fields, preserves recipient order and token carrier BCH, and copies network, expiry and absolute fee cap. Owner/change scripts are never derived from a recipient address. A fresh plain context is constructed before calling `buildUnsignedPlan`; its fee/size/token/change logic and final independent Guard re-comparison are not duplicated or weakened.

Context objects must have ordinary or null prototypes, exactly the supported own data fields and no symbols/accessors. Arrays must be ordinary, dense and have no extra properties. Bounds are 20 owner scripts, 20 selected inputs, 20 parents totaling at most 250 KB raw bytes, 100 asserted unspent outpoints, and 100 KB per parent. Existing builder semantic limits still apply. This is a data API, not an isolation boundary for hostile executable JavaScript such as Proxy traps.

## Result and binding

`REQUEST_PLAN_BOUND_OFFLINE` returns deeply frozen `draft`, `intent`, `plan` and `binding`. `draft` remains `UNCONFIRMED_DRAFT`; a successful mapping is not payment approval. All top-level `canSign`, `broadcastable`, `receiptValid`, `networkVerified` and `ownershipVerified` flags are always false.

The binding includes:

- `requestId` and recomputed `requestDigest`.
- `intentDigest` independently recomputed and required to equal both builder and Guard values.
- `planDigest` from the existing builder.
- `planningPolicyDigest`: SHA-256 over the `intentguard/request-planning-policy/v1` domain, a NUL separator and canonical JSON of sorted owner scripts, the explicitly selected change script, and all fee-policy fields. Even a no-change transaction binds its chosen change policy.
- `requestPlanDigest`: SHA-256 over the `intentguard/request-plan/v1` domain, a NUL separator and the preceding binding fields in declared order, including schema/kind.

These are application content identifiers. They do **not** fingerprint every source observation, establish freshness later, authenticate consent, prove a chain commitment, or prevent duplicate economic payment. Fresh snapshot timestamps can yield the same content binding. Every later operation needs its own current clock and trusted evidence checks. Existing journal/session/signature/real-node gates remain unchanged. Different request IDs can describe the same transaction; there is no automatic receipt allocation or payment deduplication here.

`REJECTED` returns no partial draft, intent, plan or binding. Request validation codes are preserved. Mapping/context codes use `REQUEST_PLAN_*`; a builder refusal returns `REQUEST_PLAN_BUILD_REJECTED` plus its static `builderIssue`. No arbitrary adapter exception text is returned. Prior result objects are historical data and cannot become current authority after a later refusal.

## Integration and verification status

This is an SDK-level slice. The browser request page remains a draft/review/export flow and does not automatically build or fund requests. Both previously tested browser bundles must remain byte-identical; no new browser UI or browser acceptance claim is made. A future UI integration must explicitly obtain and describe its separate planning context and invalidate results on edits, expiry and context changes.

Run `npm run validate`, or after compilation `node --test dist/core/request-plan.test.js`. Consumer tests cover BCH and fungible tokens, complete ordered recipient mapping, reviewed-term mutations, request IDs, duplicate JSON keys, supplied trust fields, no context fallback, clock/expiry, malformed arrays/accessors/prototypes, owner/network/prevout/funding/fee failures, every policy field, no-change policy binding, snapshot-vs-content identity and deep immutability.

Tests use public CashTokens address vectors and synthetic unbroadcast parent bytes. They do not show a real wallet, signature, current spendability, payment, receipt or complete G1/G2 product. No keys/signatures are generated, no node is queried, and no previous network restriction or screenshot restriction is bypassed.
