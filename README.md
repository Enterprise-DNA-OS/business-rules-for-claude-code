# Business Rules for Claude Code

Your order routes, service priorities, rule changes and decision evidence in a database you own. Free, MIT licensed.

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your DecisionRules data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=decisionrules">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/decisionrules?utm_source=github&utm_medium=readme&utm_campaign=decisionrules">How it works</a></td>
  </tr>
</table>

## What this does

Run deterministic operational decisions, retain the exact rule version, test proposed changes, track exception owners and prepare review documents. There is no model call inside the evaluator. Claude Code, Codex, OpenCode or Cursor is the operator's door into the records.

This is a focused alternative to DecisionRules for simple operational rules. It is not a drop-in replacement for its full platform. DecisionRules Public Cloud Premium is quoted; Lite is listed at EUR3,500 billed annually on its [pricing page](https://www.decisionrules.io/en/pricing/public-cloud/), checked 15 October 2026. See [research](docs/research.md) for the separate enterprise Marketplace offer that qualified this target.

## Quick start

```bash
git clone https://github.com/Enterprise-DNA-OS/business-rules-for-claude-code.git
cd business-rules-for-claude-code
npm install
npm test
npm run demo
npm run rules -- attention
npm run rules -- simulate --rule="Order routing" --version=2 --input=fixtures/input.json
npm run view
npm run docs
```

Node 20 or later. The demo creates three fictional rules, an unapproved warehouse change, nine regression examples, three exceptions and three decisions, including an unmatched route and an expired retention review. Seed is idempotent. Do not seed a production database. Without DATABASE_URL, PGlite runs locally under .data/db. For PostgreSQL 15 or later, set DATABASE_URL and run npm run migrate against your own empty database. No extensions required.

## The commands

One CLI: `npm run rules -- <command>`. Read `help` for arguments. Reads produce aligned human tables; `--json` returns structured data. Names match without case and IDs accept prefixes. Ambiguous matches list candidates and exit 1.

- `/rules`: List rules, owners, versions and exceptions.
- `/rule`: Read one rule and its full history.
- `/reviews-due`: Check the next fortnight of policy reviews.
- `/test-coverage`: Inspect regression coverage and last test status.
- `/exceptions`: Review unmapped cases and overdue decisions.
- `/decisions`: Compare matched and unmatched decisions by version.
- `/activity`: Read the audit history.
- `/attention`: Start the day with reviews, exceptions and record checks.
- `/compliance`: Check privacy review evidence and house controls.
- `/weekly-review`: Write the Monday rule review.
- `/simulate`: Try an input against an exact version without saving.
- `/evaluate`: Record an operational decision with its matching rows.
- `/test-rule`: Run all regression examples for one version.
- `/add-rule`: Add a rule as an unapproved draft.
- `/revise-rule`: Create an immutable new rule version.
- `/add-case`: Add a synthetic regression example.
- `/approve-rule`: Test and activate a reviewed draft version.
- `/log-exception`: Log an operational case needing a person.
- `/resolve-exception`: Close an exception with the recorded resolution.
- `/review-rule`: Record a completed review and next review date.
- `/import`: Import a supported DecisionRules export as a draft.
- `/export`: Export the complete database including raw vendor exports.
- `/draft-review`: Draft an internal rule review without sending.
- `/customise`: add a field or house control with a migration and tests.
- `/new-view`: create another read-only report in your brand.

Database changes require --actor and accept --dry-run. Exports and drafts write new local files. Approved version content cannot change. A new version must pass at least two saved regression cases and be approved by a different named reviewer. Failed test-rule returns exit 1 with its results. Labels attribute changes but do not authenticate people. Read [access controls](docs/compliance.md) before shared deployment.

## Questions your own rule system answers

These are demonstrated questions about this build's own records. We do not claim the vendor cannot reproduce them with its own customisation.

1. Which rule owners have a review overdue and unresolved exceptions? (`/reviews-due`)
2. Which rule versions have no recorded passing test run? (`/test-coverage`)
3. Which orders were left without a matching route? (`/decisions`)
4. Which proposed change sends our New Zealand orders to a different depot? (`/simulate`)
5. Which version made a recorded decision, and which rows matched? (`/export`)
6. Which urgent service records have passed their retention review date? (`/compliance`)
7. Which case owners have missed an exception due date? (`/exceptions`)
8. What did the previous reviewer approve before a version became active? (`/rule`)
9. Which rule has more than one version waiting for review? (`/rule`)
10. What changed, who recorded it, and what needs attention on Monday? (`/activity`)

## Your first hour: ten things to ask for

1. Put our business name and logo in brand.json.
2. Show the rules whose reviews are overdue.
3. Show who owns the unmapped orders.
4. Compare the proposed dispatch version with the active one.
5. Add a synthetic test for a Pacific islands order.
6. Draft a review of the warehouse change.
7. Import this supported DecisionRules export as a draft.
8. Add our service escalation fields with a migration.
9. Create a read-only view grouped by rule owner.
10. Export all our records before we change anything.

## Documents and views

`npm run docs` produces a rule card, change review pack and exception review sheet for every rule. `npm run view` produces the review desk, decision outcomes and coverage views. Set business_name, logo_path and colours in brand.json. HTML files are read-only snapshots, printable to PDF. Keep generated material private when it contains real records.

## Instead of DecisionRules

[Switching guide](docs/replace-decisionrules.md): export one decision table as JSON, import the supported literal-text subset in one command, compare examples, then approve. Unsupported syntax is rejected as a whole. The full original export stays attached. Scripts, flows, external connections and historical logs need a separate mapping. [Why no front end](docs/why-no-front-end.md) explains the local operating model.

## Verification

`npm test` uses a temporary database and output directory. It checks migrations and seed repeatability, every CLI command, real rule outcomes, failed approval, rollback, ambiguous matching, unsupported imports, escaping, document output and export completeness. GitHub Actions runs Node 20 and 22 on Windows and Ubuntu. Actual execution results are reported separately from configured CI.

## Want it installed and run for you?

**Omni by Enterprise DNA** builds your version, migrates your rules, connects your systems and runs it. One setup fee, then a monthly retainer. Your fields, review process and web front end can be included in the scope.

[Book a 30-minute call with Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=decisionrules).

## Licence

MIT. Copyright 2026 Enterprise DNA.
