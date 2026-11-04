/** Human-readable explanations of internally computed offline reports, not validation. */
import type {GuardReport} from './guard.js';import type {UnsignedBuildResult} from './unsigned-builder.js';
const reasons:Readonly<Record<string,string>>={
 RECIPIENT_MISMATCH:'The candidate changes a requested recipient, amount, or token category.',
 UNCONFIRMED_CHANGE:'An extra output does not return to a supplied owner script.',
 UNCONFIRMED_INPUT_OWNER:'An input is not associated with a supplied owner script.',
 UNDECLARED_TOKEN:'The candidate includes a token category that the request did not declare.',
 TOKEN_IMBALANCE:'Token inputs and outputs do not conserve the declared quantities.',
 FEE_LIMIT:'The total fee exceeds the request’s absolute fee cap.',
 FEE_RATE_LIMIT:'The fee could exceed the allowed rate under the declared signature-size model.',
 DUST_OUTPUT:'An output is below the fixed token-aware application dust baseline.',
 DUST_RECIPIENT:'A requested output is below the fixed token-aware application dust baseline.',
 STALE_OR_INVALID_SNAPSHOT:'The supplied observation is stale or has an invalid time.',
 MISSING_OR_SPENT_PREVOUT:'A required parent output or supplied unspent claim is missing.',
 NETWORK_MISMATCH:'The request and supplied observation use different network labels.',
 INTENT_EXPIRED:'The payment request has expired at the supplied comparison time.',
 NFT_UNSUPPORTED:'NFT inputs or outputs are unsupported; their assets must not be silently removed.',
 INSUFFICIENT_BCH:'The selected inputs cannot cover recipients, token carrier amounts and the fee budget.',
 INSUFFICIENT_TOKEN:'The selected inputs do not contain enough of the requested token.',
 BCH_CHANGE_REQUIRES_DONATION:'A small remainder would become extra fee; explicit dust-only permission is absent.',
 BCH_REMAINDER_NOT_DUST:'The remainder is not dust. It cannot be silently converted into an extra fee.',
 INVALID_BUILD_SCHEMA:'The planning input is missing required fields or contains unsupported fields.',
 DUPLICATE_INPUT:'The same input was selected more than once.',
};
export function explainIssue(code:string):string{return reasons[code]??'This input is unsupported or could not be safely checked. Inspect the technical report for the exact code.';}
export function comparisonExplanation(report:GuardReport):string{
 const heading=report.status==='MATCH_OFFLINE'?'Supplied data agrees. This is not payment approval.':report.status==='UNKNOWN'?'Evidence is incomplete. No successful comparison is established.':'This candidate is not accepted by the offline comparator.';
 return [heading,...[...new Set(report.issues)].map(c=>`${explainIssue(c)} (${c})`),report.feeSatoshis===null?'Fee: not established.':`Computed fee: ${report.feeSatoshis} satoshis.`,'No wallet, signature, live-chain check or payment has occurred.'].join('\n');
}
export function planExplanation(plan:UnsignedBuildResult):string{
 if(plan.status!=='BUILT_OFFLINE')return ['No unsigned plan was built.',explainIssue(plan.issue??''),`Reason: ${plan.issue??'unknown'}.`,'Nothing was sent. You can edit the request or explicitly select different inputs.'].join('\n');
 const lines=['Unsigned plan only. Nothing is signed or sent.'];
 for(const o of plan.outputSummary){const label=o.role==='recipient'?'Requested recipient':o.role==='token-change'?'Token change to supplied owner':'BCH change to supplied owner';lines.push(`${label}: ${o.satoshis} satoshis${o.token?` + ${o.token.amount} token base units`:''}.`,`Script: ${o.script}`);if(o.token)lines.push(`Token category: ${o.token.category}`);}
 lines.push(`Total fee: ${plan.feeSatoshis} satoshis; budget: ${plan.budgetFeeSatoshis}; explicit dust remainder: ${plan.donatedRemainderSatoshis}.`);
 if(plan.estimatedSignedBytes)lines.push(`Assumed final size: ${plan.estimatedSignedBytes.minimum}–${plan.estimatedSignedBytes.maximum} bytes (${plan.estimatedSignedBytes.signatureModel}). This is not a verified wallet capability.`);
 lines.push('Owner scripts and unspent data are supplied assertions. Real ownership, live funds, signatures and chain acceptance are not established.');return lines.join('\n');
}
