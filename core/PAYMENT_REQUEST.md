# Offline payment request drafts

This module addresses the PRD's first step: create or import explicit payment terms for human review. It does not confirm the request, authenticate the recipient, construct a `PaymentIntent`, populate wallet owner/change scripts, access a chain, or grant spending permission.

## API

- `createPaymentRequestDraft(input: unknown, now: number): PaymentRequestResult`
- `parsePaymentRequestDraft(text: string, now: number): PaymentRequestResult`
- `exportPaymentRequest(inputWire: unknown, now: number): string`

The create/parse result is either `DRAFT_READY` with `draft` and `issue: null`, or `REJECTED` with `draft: null` and a fixed error code. Both variants always have `canSign=false`, `receiptValid=false`, and `networkVerified=false`.

A successful `draft` is frozen and labeled `UNCONFIRMED_DRAFT`. It contains:

- `request`: normalized wire fields only.
- `display.recipients`: full canonical addresses, derived P2PKH scripts, exact satoshi strings, token-aware address flags, and any explicit category/base-unit amounts.
- `display.recipientSatoshis` and `display.maxFeeSatoshis`: exact integer strings. Recipient BCH includes token carrier funds. A fee cap is a request term, not a measured transaction fee.
- `requestDigest`: a domain-separated hash of canonical wire JSON. This is a content identifier, not authentication, human confirmation, a chain commitment, or a transaction ID.
- `limitations`: boundaries the UI must preserve.

Pass `draft.request` to export. Export revalidates against the caller's current clock and emits only normalized wire JSON. It does not export local review state, derived scripts, digests or trust flags. Export failures throw a fixed error code. An edited request must be reviewed again; this pure module provides no persistent human-confirmation state.

## Wire schema

Exactly these fields are accepted:

```json
{
  "schemaVersion": 1,
  "kind": "intentguard-payment-request",
  "requestId": "example-order-001",
  "network": "mainnet",
  "expiresAt": 1800000060000,
  "maxFeeBch": "0.000006",
  "recipients": [
    {
      "address": "bitcoincash:qr7fzmep8g7h7ymfxy74lgc0v950j3r2959lhtxxsl",
      "bch": "0.00001"
    }
  ]
}
```

The example uses a public specification address and a synthetic caller clock of `1800000000000`; it is not a live payment instruction. `requestId` is caller-supplied, not automatically generated on edits.

A fungible-token recipient additionally has `token: {category, amountAtomic}`. `category` is exactly 64 lowercase hexadecimal characters; `amountAtomic` is a positive canonical decimal integer string up to `9223372036854775807`. No symbol, decimals, NFT, minting, metadata lookup or issuer claim is accepted.

## Limits and normalization

- Import and pretty export are limited to **8,192 UTF-8 bytes**. Byte limits are applied before JSON parsing. Duplicate decoded JSON keys and nesting deeper than six containers are rejected.
- Exactly 1–20 ordered recipients. Order is preserved; recipients are not merged. The object API requires ordinary `Array.prototype` arrays with dense data elements and rejects extra own properties/symbols/accessors.
- IDs contain 1–80 ASCII letters, digits, `_` or `-`. No memo, URL, callback or arbitrary metadata fields are supported.
- `expiresAt` is a safe integer Unix timestamp in milliseconds, strictly after caller-supplied `now` and at most 24 hours ahead. This is an application draft policy, not a consensus rule or a change to the Guard. JSON cannot supply `now`.
- BCH fields are decimal strings with at most eight fractional digits. No signs, whitespace, exponent notation, numeric JSON amounts, separators, ambiguous leading zeros or rounding. Integer math produces satoshis; export removes trailing fractional zeros.
- Positive recipient amounts and recipient total plus fee cap cannot exceed the 21-million-BCH monetary bound. A zero fee cap is explicit and allowed; it does not promise a relayable transaction. The module does not call a large requested fee safe.
- Per-category aggregate token amounts cannot exceed the supported maximum. BCH carrier amounts must meet the existing fixed 1000 sat/1000-byte token-aware dust baseline. This is not live relay-policy verification.
- Unknown fields at every object level are rejected, including `trusted`, `confirmed`, `canSign`, `ownerScripts`, supplied scripts and supplied digests. Deserialized reports are not valid wire requests.

## Address boundaries and source evidence

The installed `@bitauth/libauth` **3.1.0-next.8** types and implementation were inspected alongside its [official decoder documentation](https://libauth.org/functions/decodeCashAddress.html). The decoder checks CashAddr checksum/version and requires the prefix. This module additionally checks original-string casing because this pinned implementation lowercases internally and would otherwise accept mixed case. Entirely uppercase valid addresses are accepted and normalized only after validation.

The [CashTokens specification](https://cashtokens.org/docs/spec/chip/#cashaddress-token-support) defines token-aware P2PKH and P2SH address types and prohibits token sends to non-token-aware addresses. This slice supports only 20-byte P2PKH: ordinary or token-aware for BCH, token-aware only for fungible tokens. Token-aware and ordinary forms can encode the same locking script, so support is read from the address version, not inferred from the script. Tests use public addresses from the specification's test-vector table.

`mainnet` requires `bitcoincash:`; declared `chipnet` requires `bchtest:`. A test-network prefix cannot distinguish Chipnet from other BCH test networks. Checksum validity likewise does not authenticate the recipient or confirm an asset exists. Accordingly, `networkVerified` remains false.

No prefix guessing, URI parsing, address repair, P2SH support, wallet/chain calls or implicit authorization is provided.

## Validation

Run `npx tsc && node --test dist/core/payment-request.test.js`. Tests cover official address vectors, the pinned decoder's mixed-case gap, exact BCH/token units and boundaries, aggregate/dust checks, strict and bounded imports, immutable drafts, unknown trust fields, sparse arrays, and canonical export/import round trips. No real payment, wallet, signature, key generation or network call occurs in these tests.
