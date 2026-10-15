---
description: "Record an operational decision with its matching rows"
---

# Record an operational decision with its matching rows

Run `npm run rules -- evaluate --rule="<name>" --input=<input.json> --reference=<record> --personal=no --actor="<operator>"`. Add `--json` when combining results. Resolve names case-insensitively or by id prefix. If ambiguous, show candidates and ask the operator to identify the record.

Confirm whether the input is personal information. For personal data use `--personal=yes --accuracy-checked=YYYY-MM-DD --retain-until=YYYY-MM-DD`. Use synthetic examples in tests. This is for operational routing, never lending, medical, payroll or payment decisions.

Report only what the output proves. Drafts stay in `drafts/`. Nothing sends.
