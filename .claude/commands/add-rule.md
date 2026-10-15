---
description: "Add a rule as an unapproved draft"
---

# Add a rule as an unapproved draft

Run `npm run rules -- add-rule --name="<name>" --owner="<owner>" --purpose="<purpose>" --review-due=<YYYY-MM-DD> --file=<definition.json> --actor="<operator>"`. Add `--json` when combining results. Resolve names case-insensitively or by id prefix. If ambiguous, show candidates and ask the operator to identify the record.

Read the existing record first. Preview with `--dry-run`, then apply the requested change with the real operator name. Never invent source facts.

Report only what the output proves. Drafts stay in `drafts/`. Nothing sends.
