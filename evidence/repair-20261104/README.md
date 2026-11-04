# Remote integrity and signed-expiry repair

Independent review found that remote 613397f9 contained a corrupt core/evidence.test.ts blob, despite the developer working copy passing validation. The earlier statement that all remote files were verified only compared the returned upload SHA with the tree; it did not compare intended local bytes or run the remote snapshot. That statement was insufficient and is superseded by this report. No claim is made about the exact corruption mechanism beyond this verified transfer/integrity gap.

Corrupt blob: 86ab28c6e56685efdb3755a756d8f6fa599df771, 10696 bytes, SHA256 ab1e60af31d8b1319afddcb404171d3cd12fd2e16cf47d39fbc31218e72ebae5. Invalid UTF-8 at offset4393. Restored intended UTF-8 test: blob a4865e3a1f1f85fe846e49d7ede33fe136a44869, 11316 bytes, SHA256 e4e740a2da743ea7260dcf386401a02a3fece8f8629c8864324b9d3ad4907bc3.

Code repair commit: 3619c70ead31dc89d8437b445a125a9f353b9c55, tree f32dc23a912e6b7bc1f2a6c04bf046535412dd2b. All three repaired source files were uploaded as UTF-8 and each server-returned Git blob SHA was compared with an independently computed pre-upload local Git blob hash.

The signed-expiry policy now fails closed: secondary-check-match at or after expiresAt enters NEEDS_REVIEW, retaining originalTxid and the locked session. It cannot transition to BROADCASTING or restart the same attempt. The new test covers999/1000/1001 timing, original txid, competing session rejection and restart persistence. This remains a simulation policy fix, not evidence of actual signing/broadcast.

## Clean remote validation

Downloaded every one of186 files from the exact 3619c70 remote commit into a new empty directory. No development source was copied. Every downloaded file's Git blob hash was recalculated and matched the remote tree; SHA256 and per-file comparisons are in remote-files-3619c70.json.

Compared every remote file to the prior developer workspace:108 files match exactly,49 differ only by terminal CR/LF and29 historical files were absent from that workspace. No other content mismatch was found. The original remote historical files were retained, not overwritten by reconstruction.

Executed npm run validate in that complete remote snapshot: exit0, strict typecheck, build,94/94 tests passed, none skipped. Exact log: remote-validation-3619c70.log. Node24.22.1 dependencies were reused through a read-only dependency-directory symlink; this is NOT a fresh dependency installation. Source and package-lock.json came from the exact remote snapshot. No external node/wallet/transaction was exercised.

This evidence-only follow-up commit does not alter tested code. Its added evidence and appended status documents are independently byte-hash checked on upload/readback. The source snapshot remains3619c70; G1 remainsIN_PROGRESS and earlier DNS/live chain gates remain open.

## Prevent recurrence

1. Calculate intended file SHA256 and Git blob hash before upload.
2. Compare upload response with that independent expected hash, not only the new tree.
3. Read exact remote bytes into a clean directory and verify every file against remote hashes.
4. Run the final complete validation from those remote bytes. Report dependency reuse and all unavailable stages.
5. Keep corrupted commit and audit history visible; append corrections rather than rewrite history or conceal failure.
