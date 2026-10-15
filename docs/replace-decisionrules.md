# Replace DecisionRules for operational routing

This is a bounded replacement for operational rules, not a drop-in implementation of every DecisionRules feature. Export, preview, reconcile and approve before cutover. Keep the original system active until outcomes match.

## Export from DecisionRules

Open Rules, select the rule menu and choose Export. Choose JSON for a decision table. The vendor also supports XLSX, but this importer reads JSON only.

Sources checked 15 October 2026:
- https://academy.decisionrules.io/rules/export-and-import-of-the-rules/export-rule
- https://docs.decisionrules.io/doc/api/management-api
- https://academy.decisionrules.io/rule-types/decision-tables

Save one exported rule in a local file. Confirm whether the caller used First Match or Standard. The export does not settle the caller's solving strategy. Standard maps to `all`, First Match maps to `first`.

```bash
npm run rules -- import decisionrules --file=export.json --strategy=first --owner="Your name" --review-due=2026-12-01 --actor="Your name" --dry-run
npm run rules -- import decisionrules --file=export.json --strategy=first --owner="Your name" --review-due=2026-12-01 --actor="Your name"
```

## What maps

One decision-table object with ruleId, version, name, decisionTable.columns and decisionTable.rows. Flat simple input columns, `=` and `<>` comparisons on literal text, flat literal text output columns, and active rows. Imported text starts with an English letter and contains only letters, numbers, spaces, underscores, periods, commas, slashes and hyphens. This deliberately narrow subset rejects dates, arrays and ambiguous automatic casting. Original row order is preserved. All cells must be present. Names, descriptions and the full original export are retained. The new owner and review date are supplied by you. The imported version is a draft, even when the source was published.

Reimporting the same ruleId/version, content and strategy skips it. A changed file under the same source version is rejected. A new source version creates a new local draft. Imports are atomic; unsupported content leaves no partial rule.

## What needs mapping

Numeric or boolean coercion, nested fields, blank/wildcard cells, functions, variables, inactive rows, scripts, decision trees, flows, lookups and connector credentials are refused. They are never silently ignored. Native rules support explicit number, text and boolean types and comparisons, but translating vendor semantics requires examples and review. Historical solver logs, account permissions, schedules and integrations are not in a single rule export. Bring those across separately with an agreed mapping. Enterprise DNA can build those pieces into your version.

`fixtures/decisionrules.json` is a fictional structural example based on the vendor's documented Management API, not a customer export or a vendor-certified interoperability test. Accepted literal output text is preserved exactly. Quoted or otherwise ambiguous text is refused for manual mapping. Compare case, spaces, types and order with actual vendor results before approval.

Casting source: https://docs.decisionrules.io/doc/rules/data-types-and-functions/data-types

## Reconcile and switch

Read the imported rule. Add at least two synthetic regression examples using add-case, including boundaries and no-match cases. Compare output, result order and types with DecisionRules. Run test-rule for the exact version. A different reviewer activates it with approve-rule. Run both systems side by side on representative records. A simple supported routing rule can be imported in one command; a whole-platform migration has a wider scope.

Export writes a complete new JSON archive with all records and original vendor exports. Existing files are never overwritten. Treat the archive as private business data. Restoring an archive is a database administration task; this CLI does not pretend the DecisionRules importer restores its own archive.
