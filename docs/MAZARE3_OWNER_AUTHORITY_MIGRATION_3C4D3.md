# Mazare3 — Owner Authority Migration (3C.4D.3)

**Migration:** `packages/db/prisma/migrations/20260916180000_phase3c4d3_owner_authority/migration.sql`

## Contents (additive)

- New enums: OperatorEntityKind, AccountHolderOperatorRelation, DeclaredPropertyOwnerRelation, PropertyAuthorityBasis, PropertyAuthorityReviewStatus  
- Additive PartnerDocumentType values: representation_authority, lease_or_sublease_authority  
- Tables: OperatorParty, OwnerAttestation, PropertyAuthorityReviewEvent  
- Columns on Property (authority package + review), OwnerDocument.propertyId, OwnerVerificationProfile.accountHolderRelation  
- FKs / indexes  

## Legacy row behavior

- All existing Properties receive `authorityReviewStatus = not_submitted` via column DEFAULT.  
- **No** fabricated `approved` authority.  
- Existing OwnerProfile / OwnerDocument / Property rows preserved.  

## Local apply status

**Applied** to configured local/dev Neon (`neondb`) via `prisma migrate deploy` on 2026-09-16 during Phase 3C.4D.3.

```bash
pnpm --filter @mazare3/db generate
pnpm --filter @mazare3/db exec dotenv -e ../../.env -- prisma migrate deploy
```

## Production status

**DO NOT APPLY TO PRODUCTION** beyond the project's approved non-Production Neon.  
No Production deployment. No fabricated regulatory/authority approvals.
