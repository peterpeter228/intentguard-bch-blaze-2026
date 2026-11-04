# Independent local code review and corrections

Review on 2026-11-04 found and corrected:

- Report export previously included arbitrary action names. It now uses explicit field allowlist; sentinel regression proves action/errors/payload omitted.
- HTTP aborted uploads could reject outside handler catch. Stream reading is now caught; regression interrupts a request and verifies server still responds.
- Per-chunk UTF-8 conversion could corrupt multi-byte strings. Buffer accumulation plus fatal UTF-8 decode is used; regression splits a Chinese character across writes and matches whole-body template hash. Invalid UTF-8 returns400.
- Commit work limit applied after crypto checks. 101-commit input now rejects before engine checks; regression expects only TOO_MANY_COMMITS.
- Document limit counted JS UTF-16 units rather than bytes. TextEncoder byte counting now applies; multibyte regression included.

Other actual findings: parseTemplate normalizes key order and changes P2PKH content hash relative to unparsed package object. The fixture and trust reference now follow actual State.importTemplate normalization. Engine helper returns an empty issue array for an empty invitation; local code adds EMPTY_INVITATION rejection. Neither indicates upstream exploit or successful payment, only validation scope differences.

Remaining: no vetted signed positive fixture; deliberately malformed signature/entity test proves rejection of bad input, not independent positive crypto compatibility. No UTXO/payment/contract safety verification. Engine browser bundling failed on node:path; local Node backend is used without pretending that fixes browser-wallet support. Public distribution and dependency-license/security review remain pending. No third-party reviewer/API call was made.

Second read-only review confirmed all five principal fixes. Two additional hardenings applied: bounded CLI input read/fatal UTF-8, and actual101 commit count retained on rejection. Final27-test aggregate reran successfully; no positive signature claim added. Host rejection and 600000-byte HTTP cap exist but their specific edges lack separate regression cases.
