# Screenshot persistence limitation

2026-11-04 16:58 UTC. The source commit3000ceba and complete source verification succeeded. During evidence upload, the screenshot `browser/non-token-aware-rejected.png` was rejected by the action reviewer because opaque binary image content was considered potentially sensitive. The implementation agent directly viewed the screenshot: it contains the local draft UI, public CashTokens test-vector address and synthetic QA values, with no observed credentials/customer/account interface. The user subsequently authorized continuing the blocked evidence-save work. A single attempt after that new authorization was still rejected. That action was stopped, not bypassed, re-encoded, renamed or moved through another route.

Two local screenshots are deliberately NOT included in the remote evidence tree:
- `browser/non-token-aware-rejected.png`: upload denied; expected SHA256 c1d7b4dc7f38139c0acc40322d800ebb27daaa431de2738d7db5da4c2eecfab4.
- `browser/multi-recipient.png`: not uploaded after the same image-class blocker; retained only locally.

The browser QA report and local evidence-sha256 manifest describe the full local test set. That manifest is not a claim that every listed local file was uploaded. Other evidence files and previously accepted screenshots remain individually verified. Text/DOM/state/download artifacts retain the corresponding behavior evidence. No test result has been changed to imply that the missing screenshots were persisted. There is no new screenshot retry scheduled without a resolved authorization path.
