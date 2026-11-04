/** Explicit export allowlist. Never include free-text action, error message or input documents. */
export function redactReport(report) {
 return {schemaVersion:report.schemaVersion,status:report.status,canSign:false,checkedAt:report.checkedAt,network:report.network,templateIdentifier:report.templateIdentifier,commits:report.commits,issues:report.issues.map(({code})=>({code})),privacy:'No input documents, participant identifiers, action labels or raw error messages included.'};
}
