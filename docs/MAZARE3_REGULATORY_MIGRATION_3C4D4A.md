# Mazare3 — Regulatory Foundation Migration (3C.4D.4A)

**Migration:** `packages/db/prisma/migrations/20260917120000_phase3c4d4a_regulatory_foundation/migration.sql`

## Contents (additive)

- Enums: `PropertyActivityCode`, `RegulatoryRequirementType`, `RegulatoryApplicability`, `RegulatoryComplianceStatus`
- Tables: `PropertyActivity`, `PropertyRegulatoryRequirement`, `RegulatoryEvidence`, `RegulatoryDecisionEvent`
- Indexes + FKs to `Property` / requirement rows
- **No** destructive drops of existing Property / Owner / Booking data

## Legacy behavior

- Existing Properties receive **no** fabricated activity rows, requirement rows, evidence, or applicability decisions.
- Readiness for Properties with no activity profile → `not_started`.
- After activities exist but assessment incomplete → `incomplete`.
- **Never** auto-`ready` / auto-`verified` / auto-`not_applicable_confirmed`.
- Current local/dev publication and paid Booking gates are **unchanged** in this phase.

## Local / test apply

Apply only to safe local/dev Neon:

```bash
pnpm --filter @mazare3/db generate
pnpm --filter @mazare3/db exec dotenv -e ../../.env -- prisma migrate deploy
```

**Applied** to configured local/dev Neon (`neondb`) via `prisma migrate deploy` on 2026-09-17 during Phase 3C.4D.4A.

## Production status

**DO NOT APPLY TO PRODUCTION.**

- No Production `migrate deploy`
- No Production `db push`
- No Production cron for `reconcile-regulatory-document-expiry` in this phase

Confirmation: Production untouched.
