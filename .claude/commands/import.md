---
description: "Import a supported DecisionRules export as a draft"
---

# Import a supported DecisionRules export as a draft

Run `npm run rules -- import decisionrules --file=<export.json> --strategy=first --owner="<owner>" --review-due=<YYYY-MM-DD> --actor="<operator>"`. Add `--json` when combining results. Resolve names case-insensitively or by id prefix. If ambiguous, show candidates and ask the operator to identify the record.

Read `docs/replace-decisionrules.md` first. Confirm the original Solver strategy. Run with `--dry-run` first. Unsupported syntax is a stop, never a reason to discard a condition. Reconcile known examples before approval.

Report only what the output proves. Drafts stay in `drafts/`. Nothing sends.
