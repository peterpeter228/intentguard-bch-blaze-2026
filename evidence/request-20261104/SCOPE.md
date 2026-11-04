# Structured local payment request slice

Implemented 2026-11-04 before the official event development window. This is pre-event work to disclose, not a contest submission.

PRD P0 items 1–2 require a request with explicit network, asset, recipient and amount and a legible review step. The existing transaction laboratory required JSON. `/request` adds a separate structured form and strict import/review/export cycle. It does not fabricate wallet ownership or move imported data into a trusted journal.

The form creates one recipient; imported bounded multi-recipient requests are reviewed in full without silently flattening them into a single recipient form. Token amounts are integer base units and categories are complete; no decimal metadata or ticker is assumed. CashAddr is syntax/routing data, not merchant identity or actual chain authentication. `bchtest` alone cannot distinguish Chipnet from other test networks.

Local review permits only a local JSON download. It does not set a PaymentIntent confirmation timestamp, create a wallet session, select UTXOs, sign, broadcast, or create a receipt. Every edit clears the previous review/export state. The current clock is supplied by the page, never imported from the request. Expiry is rechecked on confirmation/export/focus and via a timer. Reloads do not restore confirmations; there is no localStorage or server persistence for these drafts.

Downloaded request JSON intentionally contains recipient addresses and payment terms and is explicitly labelled accordingly before download. No automatic external transmission occurs. Existing diagnostic downloads remain redacted.

Official source checks:
- https://cashtokens.org/docs/spec/chip/#cashaddress-token-support specifies token-aware types and refusal to send tokens to non-token-aware addresses.
- https://documentation.cash/protocol/blockchain/encoding/cashaddr.html describes prefixes and case handling.
- Installed pinned libauth 3.1.0-next.8 address decoder implementation is inspected, not blindly trusted: mixed-case input requires an explicit check because the conversion helper lowercases internally.

Source research and QA are not evidence of payment, active wallet compatibility or live node connectivity. Signature positives, wallet evidence, real chain execution, public demo, qualification roll call and submission remain separate open gates.
