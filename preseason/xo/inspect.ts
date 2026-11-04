/** Pre-event, offline triage. Never authorizes a wallet operation. */
import { parseTemplate, deserializeInvitation, generateTemplateIdentifier } from '@xo-cash/utils';
import { listInvitationValidationIssues, XO_SUPPORTED_NETWORKS,
  assertCommitsDoNotChangeCommittedFields, assertEntityFollowUpRoles,
  assertRoleVariablesProvidedByRoleEntities } from '@xo-cash/engine';

export interface InspectionInput {
  templateJson: string;
  invitationJson: string;
  network: 'chipnet' | 'mainnet';
  /** Independently reviewed/pinned hash, not inferred from the supplied template. */
  expectedTemplateIdentifier: string;
  now: number;
}
export interface InspectionReport {
  schemaVersion: 'intentguard.xo.offline-report.v1';
  status: 'REJECTED' | 'REVIEW_REQUIRED';
  canSign: false;
  checkedAt: string | null;
  network: string;
  templateIdentifier: string | null;
  action: string | null;
  commits: number;
  issues: { code: string; message: string }[];
  limitations: string[];
}
export function inspectInvitation(input: InspectionInput): InspectionReport {
  const report: InspectionReport = {
    schemaVersion: 'intentguard.xo.offline-report.v1', status: 'REJECTED', canSign: false,
    checkedAt: Number.isSafeInteger(input.now) && input.now >= 0 && input.now <= 8640000000000000 ? new Date(input.now).toISOString() : null,
    network: input.network, templateIdentifier: null, action: null, commits: 0, issues: [],
    limitations: ['No wallet connection, signing, broadcast or chain queries.',
      'Schema and signature checks do not establish contract safety or user intent.',
      'UTXO availability, transaction outputs/fees and execution are NOT verified.',
      'No contest eligibility or bounty completion is established.']
  };
  const issue = (code: string, message: string) => report.issues.push({code,message});
  if (!report.checkedAt) { issue('INVALID_CLOCK','Use a safe non-negative Unix millisecond timestamp.'); return report; }
  if (input.network !== 'chipnet' && input.network !== 'mainnet') { issue('UNSUPPORTED_NETWORK','Select chipnet or mainnet explicitly.'); return report; }
  if (new TextEncoder().encode(input.templateJson).byteLength > 262144 || new TextEncoder().encode(input.invitationJson).byteLength > 262144) { issue('INPUT_TOO_LARGE','Each document must be at most 256 KiB of text.'); return report; }
  try {
    const template = parseTemplate(input.templateJson);
    const invitation = deserializeInvitation(input.invitationJson);
    report.templateIdentifier = generateTemplateIdentifier(template);
    report.commits = invitation.commits.length;
    if (invitation.commits.length > 100) { issue('TOO_MANY_COMMITS','This bounded inspector supports at most 100 commits.'); return report; }
    report.action = invitation.actionIdentifier;
    if (!/^[a-f0-9]{64}$/.test(input.expectedTemplateIdentifier)) issue('MISSING_TRUST_PIN','Supply a separately reviewed template SHA-256 identifier. The imported template is not its own trust proof.');
    else if (input.expectedTemplateIdentifier !== report.templateIdentifier) issue('UNTRUSTED_TEMPLATE','The template differs from the independently selected reference.');
    for (const error of listInvitationValidationIssues(invitation,template,XO_SUPPORTED_NETWORKS[input.network])) issue(error.name,error.message);
    // Engine acceptance performs these separately; its public validation helper alone is insufficient.
    for (const check of [assertCommitsDoNotChangeCommittedFields,assertRoleVariablesProvidedByRoleEntities,assertEntityFollowUpRoles]) {
      try { check(invitation,template); } catch(error) { issue(error instanceof Error ? error.name : 'ENGINE_CHECK_FAILED', error instanceof Error ? error.message : 'Engine check failed.'); }
    }
    if (!Number.isSafeInteger(invitation.createdAtTimestamp)) issue('UNSAFE_TIMESTAMP','Invitation timestamp must be safe integer milliseconds.');
    if (invitation.createdAtTimestamp > input.now) issue('FUTURE_INVITATION','Invitation creation timestamp is in the future.');
    if (!invitation.commits.length) issue('EMPTY_INVITATION','An unsigned empty invitation is not an executable payment.');
    for (const commit of invitation.commits) {
      if (!Number.isSafeInteger(commit.createdAtTimestamp) || !Number.isSafeInteger(commit.expiresAtTimestamp)) issue('UNSAFE_TIMESTAMP','Commit timestamps must be safe integer milliseconds.');
      if (commit.createdAtTimestamp > input.now) issue('FUTURE_COMMIT','A commit claims a future creation time.');
      if (commit.expiresAtTimestamp <= input.now || commit.expiresAtTimestamp <= commit.createdAtTimestamp) issue('EXPIRED_COMMIT','A commit is expired or has an invalid lifetime. The upstream engine currently does not enforce expiry.');
    }
    // Even zero findings are not payment approval: this slice cannot verify a constructed transaction or UTXOs.
    report.status = report.issues.length ? 'REJECTED' : 'REVIEW_REQUIRED';
  } catch(error) {
    issue('INVALID_DOCUMENT', error instanceof Error ? error.message.slice(0,1000) : 'Unable to validate input.');
  }
  return report;
}
