# Public signature fixture research

Read-only official-source check on2026-11-04. No keys generated, account created, signatures produced, upstream signing tests executed or network transaction performed.

- engine fixed commit `5dae1ce68f2867f1753c69afd24ca531e4dec498`: no test/fixture directory in inspected tree. Public literal Invitation at playground/examples/receive-satoshis.js lines133–149 exists but is legacy/incompatible. Source: https://gitlab.com/GeneralProtocols/xo/engine/-/blob/5dae1ce68f2867f1753c69afd24ca531e4dec498/playground/examples/receive-satoshis.js#L133-149
- utils `1514393e46876b30abd8c48d401fe4862cb773e3`, test/invitation.test.ts: static signature combined with randomized identifiers is a schema fixture, not proof of valid signatures.
- crypto `8064a65f5087d921c537ec0251c0b211157986c7`: inspected tests dynamically create signatures. They were read, not executed or copied; no secret material is retained in deliverable.

The retained public Invitation-only fixture preserves original undefined fields. `parseInvitation` rejects missing commit.createdAtTimestamp and undefined data arrays; serialized JSON omits undefined and still rejects missing timestamp. Never fill in missing fields, alter hashes or invent fresh signatures to claim the old example is valid. Only a negative compatibility regression is added. MIT license accompanying published engine is preserved beside the extracted public fragment.

Conclusion: no compatible, independently sourced positive signed fixture found within the bounded official-source check. A complete currently supported public template+Invitation, exact engine/schema versions and known verification result is still required. This does not establish that none exists anywhere.

Unsent optional maintainer question: “Could you point us to a public, static signed Invitation and matching template compatible with engine0.1.0-next.17612568780/utils0.0.10, including expected validation results? We need a verify-only regression without generating keys or executing transactions. The published receive-satoshis example at5dae1ce lacks commit.createdAtTimestamp under the current parser.” No message was sent.
