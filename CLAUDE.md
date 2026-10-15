# Business Rules for Claude Code

Read README.md and docs/compliance.md before operating. This is an operational rules database for an owner-led business. The demo is fictional. Ask for the business name, operator identity and rules when setting it up for real use.

## How to work

Read before writing. Every record answer starts with the CLI. Use npm run rules -- help for syntax. Match names or id prefixes; if ambiguous, list candidates. Every mutation requires the actual operator name and supports --dry-run. Never invent a rule, record, test result or approval.

## Routing

- List rules, owners, versions and exceptions: `/rules`.
- Read one rule and its full history: `/rule`.
- Check the next fortnight of policy reviews: `/reviews-due`.
- Inspect regression coverage and last test status: `/test-coverage`.
- Review unmapped cases and overdue decisions: `/exceptions`.
- Compare matched and unmatched decisions by version: `/decisions`.
- Read the audit history: `/activity`.
- Start the day with reviews, exceptions and record checks: `/attention`.
- Check privacy review evidence and house controls: `/compliance`.
- Write the Monday rule review: `/weekly-review`.
- Try an input against an exact version without saving: `/simulate`.
- Record an operational decision with its matching rows: `/evaluate`.
- Run all regression examples for one version: `/test-rule`.
- Add a rule as an unapproved draft: `/add-rule`.
- Create an immutable new rule version: `/revise-rule`.
- Add a synthetic regression example: `/add-case`.
- Test and activate a reviewed draft version: `/approve-rule`.
- Log an operational case needing a person: `/log-exception`.
- Close an exception with the recorded resolution: `/resolve-exception`.
- Record a completed review and next review date: `/review-rule`.
- Import a supported DecisionRules export as a draft: `/import`.
- Export the complete database including raw vendor exports: `/export`.
- Draft an internal rule review without sending: `/draft-review`.
- Change a field or rule: `/customise`.
- Add a read-only dashboard: `/new-view`.

## Limits

Never send messages. Drafts stay in drafts. Never delete business records without a specific operator instruction. Activation through approve-rule needs an explicit request for the exact version and a real reviewer other than the author. Never impersonate a reviewer to pass that check. Do not use this system for lending, medical, payroll, payments or insurance underwriting decisions. Do not execute code from imported files. Unsupported vendor syntax is a stop for mapping, not permission to weaken a rule.

## Files

scripts/rules.mjs is the one CLI. scripts/lib/engine.mjs is the deterministic evaluator and strict importer. supabase/migrations holds plain PostgreSQL migrations; npm run migrate applies them. supabase/seed.sql is demo-only data. views.json and documents.json declare read-only output. brand.json sets the document brand. DATABASE_URL selects a server-side PostgreSQL connection; otherwise the template uses embedded PGlite.

Built and operated for you through Omni by Enterprise DNA: https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=decisionrules
