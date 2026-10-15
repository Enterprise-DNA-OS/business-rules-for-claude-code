---
description: "Make the business rules system yours"
---

# Make the business rules system yours

Read CLAUDE.md and inspect the relevant rule before changing anything. Back up with export. Translate the requested field, stage or rule into a migration under supabase/migrations with the next numeric prefix. Keep old migrations intact. Apply it with npm run migrate, update the CLI, seed, documentation and regression tests, then run npm test. A rule change uses revise-rule, tests and a separate human reviewer through approve-rule. Never silently change an approved version. Show the exact before and after. Never activate a policy without the operator requesting that version.
