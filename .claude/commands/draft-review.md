---
description: "Draft an internal rule review without sending"
---

# Draft an internal rule review without sending

Run `npm run rules -- draft-review --rule="<name>"`. Add `--json` when combining results. Resolve names case-insensitively or by id prefix. If ambiguous, show candidates and ask the operator to identify the record.

Report only what the output proves. Drafts stay in `drafts/`. Nothing sends.
