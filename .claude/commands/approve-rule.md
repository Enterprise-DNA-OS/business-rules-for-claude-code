---
description: "Test and activate a reviewed draft version"
---

# Test and activate a reviewed draft version

Run `npm run rules -- approve-rule --rule="<name>" --version=<number> --actor="<reviewer>"`. Add `--json` when combining results. Resolve names case-insensitively or by id prefix. If ambiguous, show candidates and ask the operator to identify the record.

The operator must explicitly request activation of this exact version. Inspect its definition, cases and author first. The reviewer must be a different real person. Actor labels are attribution, not authentication.

Report only what the output proves. Drafts stay in `drafts/`. Nothing sends.
