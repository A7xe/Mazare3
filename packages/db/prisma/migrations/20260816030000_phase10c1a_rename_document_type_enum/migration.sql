-- Align live enum name with Prisma schema (additive rename only).
-- QA Neon created OwnerDocumentType; Prisma client expects PartnerDocumentType.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OwnerDocumentType')
     AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PartnerDocumentType') THEN
    ALTER TYPE "OwnerDocumentType" RENAME TO "PartnerDocumentType";
  END IF;
END $$;
