# Startup-failure repair and submission readiness

Checked November 5, 2026 (UTC). Base: `e4b9e24cdb6965e3b4c2abc0723d45757b1eea7e`,
tree `e6c0ebc0ddbab1f65011e290e1bfb5bc6908d483`. G1 remains IN_PROGRESS /
PRESEASON. This fixes a real test failure-path hang and the top-level setup
instructions. It adds no payment capability and does not complete the contest.

## Reproduced defect and correction

A fresh `npm ci --ignore-scripts` can typecheck/build while the pinned XO engine
cannot load native sqlite3 bindings. The existing `preseason/xo/README.md`
already correctly required `npm rebuild sqlite3 better-sqlite3`; the historical
top-level shortcut omitted it. Correct native installation restores the unchanged
baseline: an independent fixed-source run passed 246/246, typecheck and build.
This was not a newly discovered vulnerable dependency or a reason to stub SQLite.

The actual bug was in `core/http.test.mjs`: the startup promise observed the
server exit, then finally registered a second one-shot exit listener and waited
forever for an event that had already occurred. A deliberately missing-native run
reproduced a timeout/cancel rather than a completed failure.

The test-only lifecycle helper now records close immediately at spawn, requires a
specific readiness marker, bounds startup time, retains at most 4096 characters
of stderr, reports exit code/signal/error, and performs idempotent bounded
SIGTERM/SIGKILL shutdown. Both HTTP test suites use it; the XO suite previously
lacked a startup timeout. Seven actual-child-process regressions cover readiness,
startup crash, already-exited cleanup, silent exit, missing executable, startup
timeout, and ignored SIGTERM. No product server, Guard, covenant, wallet, SDK
validation, dependency version or lockfile changed.

## Actual validation

- Local candidate: `npm run validate` exit 0, typecheck/build and 253/253 tests
  (0 failed/cancelled; test phase 9.137 seconds).
- Independent candidate: the same command exit 0, typecheck/build and 253/253
  (0 failed/cancelled; test phase 9.804 seconds).
- Independent helper-only run: 7/7, including already-exited and forced shutdown.
- Missing-native regression: both HTTP suites now end with the expected explicit
  failure, exit 1, zero cancelled tests, in 0.719 seconds locally / 0.670 seconds
  independently. This expected-negative run is not a passing application run.
- Existing 63-probe synthetic funding review rerun: exit 0; frozen reports,
  all-false authority flags, no raw transactions/scripts/addresses all retained.

The baseline verifier freshly installed the lockfile dependencies and performed
the documented native rebuild. Candidate runs reused those rebuilt dependencies;
they were not second clean installs. Each candidate copy contains 88 selected
source/build/test/fixture/document files, not the complete repository. The
post-test manifest binds 82 unchanged base files and all six candidate blobs.
No application browser/mobile, authenticated Invitation, wallet, signing,
live chain, funding, payment or receipt test is claimed.

Raw evidence:
- [Local aggregate log](VALIDATION.log), SHA-256
  `f08d4766db5b0cff5a021f271634b85745bbbf00e0edd965b0d07610d4f41350`.
- [Independent aggregate log](INDEPENDENT_VALIDATION.log), SHA-256
  `a9e423e24c94af99add13f7fe766f4059cca2a137db83cc4e391ab156cef469f`.
- [Local expected failure](NATIVE_FAILURE.log), SHA-256
  `93ed3462961249e4cbd3486305482770e17c8cf0bf53f10fcb3bf2ecc98c72f1`.
- [Independent expected failure](INDEPENDENT_NATIVE_FAILURE.log), SHA-256
  `2bcfa759e087ca83e82b8cf6468feb0e2698d9c24b6a117d4fbc8f6ca8986aed`.
- [Exact file manifest](SOURCE_MANIFEST.json).
- [Synthetic independent probes](INDEPENDENT_PROBES.json), SHA-256
  `ede3b8690f0b43a84cc387b86ca4489342f47bb7da53a2da61957da9720ce100`.

## Bounded source review

The exact base files were re-read: core/server.ts, core/request-ui.ts,
core/xo-candidate.ts, core/signed-verifier.ts, preseason/xo/inspect.ts, package.json,
docs/STATUS.md and the prior remote-test record. The local request API stays
loopback-only; XO generation is a pure-function offline diagnostic; its reports
keep canSign/broadcastable/receiptValid/networkVerified/ownershipVerified false.
The signed verifier's stateless/parent-bound checks are not current chain or
spending authority. The Invitation inspector's best result is REVIEW_REQUIRED,
not payment approval. This is a bounded source review, not a complete security
audit or an Argon/Opus review.

At the base SHA, GitHub returned zero check runs, zero workflow runs and zero
status entries. The combined status was pending because nothing had run; it is
not a GitHub CI pass. Publication must re-read the exact final head and checks.

## Contest and portal gate: NOT SUBMITTED

At approximately 12:04–12:05 UTC, the DoraHacks detail portal remained behind
Human Verification. One permitted read-only CAPTCHA attempt encountered unusable
checkbox controls and then the visible expired-challenge message. Access was
stopped and the failure reported. No login, authenticated contestant identity,
account-level registration proof or actual submission control was reached.
Historical reports of registration/group joining are preserved as historical;
this attempt neither confirms nor disproves them.

Independent live official-source review on November 5 confirmed:
- [Organizer Q&A](https://dorahacks.io/discussion/1562143): development starts
  November 14 at 14:00 UTC, fork the pre-existing repository at that start and
  disclose a pre-event demo; deadline November 22 at 14:00 UTC.
- [Organizer follow-up](https://dorahacks.io/discussion/1562206): DoraHacks opens
  at the proper time; only November 14–22 work is judged. A judge being able to
  send a useful mainnet transaction through the app satisfies the relevant
  functionality requirement; a specific prior TXID is not compulsory.
- [Official site](https://bchblaze.com/): registration closes November 13 and the
  build period is November 14–22. On this November 5 check the published build/
  submission window is still in the future. This is published schedule evidence,
  not an observed account-level submission button.
- [XO bounty terms](https://bchblaze.com/bounties/): actual Chipnet/Mainnet
  execution, inspectable Invitation, template/reproduction and applicable
  follow-up evidence are required. Feedback must be personally written;
  AI-written submissions are rejected and about 500 words is suggested.
- The same bounty page states: “Submissions for a bounty automatically waive
  their rights over intellectual property or similar in submitting their project
  for consideration for the bounty.” Any final action that effects that rights
  waiver must be handled personally by the participant after reviewing it.

The existing real-integration gates remain open: authentic shareable Invitation
with exact template/network/independent pin; supported account and current chain
evidence; no-broadcast wallet behavior; full valid signed-plan positives; actual
execution; independent receipts; usable public demo; event-start fork and
substantial event-period improvement; attendance/roll call and project identity
confirmation; and the participant's own feedback/legal decisions. The current
finite-tranche experiment has no recovery and must not be funded.

Argon retried once after its first empty response and again returned no review
body (stopReason=length). The one authorized Opus fallback returned HTTP 502 /
upstream_error with no review body. Fees remain unknown. No external-model review
has completed for this version, and no further blind retry was made.

Next smallest useful action remains the bounded read-only verification of an
already existing shareable artifact, or a separately scoped participant-operated
session if none exists. See [the handoff](../../docs/VERIFICATION_HANDOFF.md).
No repository visibility change, main update, merge, new repository, public
deployment, outreach, signature, funding, transaction or contest submission was
performed by this repair.

