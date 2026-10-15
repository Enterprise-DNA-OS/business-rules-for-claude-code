---
description: "Run all regression examples for one version"
---

# Run all regression examples for one version

Run `npm run rules -- test-rule --rule="<name>" --version=<number> --actor="<operator>"`. Add `--json` when combining results. Resolve names case-insensitively or by id prefix. If ambiguous, show candidates and ask the operator to identify the record.

Report only what the output proves. Drafts stay in `drafts/`. Nothing sends.
