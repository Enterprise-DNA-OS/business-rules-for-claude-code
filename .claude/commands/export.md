---
description: "Export the complete database including raw vendor exports"
---

# Export the complete database including raw vendor exports

Run `npm run rules -- export --out=<new-archive.json>`. Add `--json` when combining results. Resolve names case-insensitively or by id prefix. If ambiguous, show candidates and ask the operator to identify the record.

Report only what the output proves. Drafts stay in `drafts/`. Nothing sends.
