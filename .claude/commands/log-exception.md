---
description: "Log an operational case needing a person"
---

# Log an operational case needing a person

Run `npm run rules -- log-exception --rule="<name>" --summary="<summary>" --owner="<owner>" --due=<YYYY-MM-DD> --actor="<operator>"`. Add `--json` when combining results. Resolve names case-insensitively or by id prefix. If ambiguous, show candidates and ask the operator to identify the record.

Read the existing record first. Preview with `--dry-run`, then apply the requested change with the real operator name. Never invent source facts.

Report only what the output proves. Drafts stay in `drafts/`. Nothing sends.
