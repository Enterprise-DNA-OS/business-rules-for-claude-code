# Record checks and their sources

Checked 15 October 2026. This system supports operational routing and service priority. It does not certify legal compliance and must not decide regulated lending, insurance underwriting, medical treatment, payroll or payments.

## Privacy controls

New Zealand Privacy Act principle 8 requires reasonable steps before use or disclosure to ensure personal information is accurate, current, complete, relevant and not misleading. Source: https://www.privacy.org.nz/privacy-principles/8/

`evaluate --personal=yes` requires an accuracy-check date. `compliance` raises ACCURACY_REVIEW when that evidence is more than 30 days old. Thirty days is a configurable house review interval in scripts/rules.mjs, not a statutory deadline. A date is evidence to inspect, not proof that the data is accurate.

Principle 9 limits retention to what is necessary for the lawful purpose. Source: https://www.privacy.org.nz/privacy-principles/9/

Personal decisions require a retain-until review date. RETENTION_REVIEW lists expired dates. There is no universal statutory retention duration here. The operator decides it from purpose and any applicable record duties. Review exported archives, drafts, backups and generated documents as well as database rows. No automated deletion occurs. An authorised database administrator removes or anonymises personal inputs after the retention review; audit events carry references, not input payloads. Use synthetic test cases because their history is append-only.

These checks address NZ record handling. Australian organisations must assess their own privacy obligations before recording personal data.

## House controls

REVIEW_DUE: the owner's scheduled rule review has passed. TEST_COVERAGE: fewer than two regression examples. NOT_APPROVED: no approved active rule. EXCEPTION_OVERDUE: an unresolved exception has passed its due date. These are operational controls chosen by this project, not laws.

Approved content is immutable. Activation reruns at least two cases and requires a reviewer distinct from the author. Name labels are attribution, not verified identities: a shared production installation needs individual database identities and an appropriate authentication layer. No claim of tamper-proof logs against the database owner is made.

## Database access

Every application table has RLS enabled with no public policies. Views use security_invoker. Connect through an owner-controlled server-side database account. Never put an owner credential in a browser or enable broad Data API policies. The embedded database is a local single-operator workspace. The application is not an authenticated multi-tenant service.
