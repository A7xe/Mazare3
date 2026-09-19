-- Phase 3C.4D.3 — Owner / entity / authority foundation (additive)
-- Local/dev only. Does NOT auto-approve authority for legacy rows.
-- Production: DO NOT APPLY.

DO $$ BEGIN
  ALTER TYPE "PartnerDocumentType" ADD VALUE IF NOT EXISTS 'representation_authority';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "PartnerDocumentType" ADD VALUE IF NOT EXISTS 'lease_or_sublease_authority';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OperatorEntityKind" AS ENUM ('individual', 'sole_establishment', 'legal_entity');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AccountHolderOperatorRelation" AS ENUM ('is_contracting_party', 'acts_for_entity', 'authorised_representative', 'authorised_manager');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DeclaredPropertyOwnerRelation" AS ENUM ('same_as_contracting_operator', 'other_individual', 'legal_entity', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PropertyAuthorityBasis" AS ENUM ('owner', 'authorised_manager', 'authorised_representative', 'lessee', 'sublessee', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PropertyAuthorityReviewStatus" AS ENUM ('not_submitted', 'under_review', 'action_required', 'approved', 'rejected', 'reassessment_required');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "OwnerVerificationProfile" ADD COLUMN IF NOT EXISTS "accountHolderRelation" "AccountHolderOperatorRelation";

CREATE TABLE IF NOT EXISTS "OperatorParty" (
    "id" TEXT NOT NULL,
    "ownerProfileId" TEXT NOT NULL,
    "entityKind" "OperatorEntityKind" NOT NULL,
    "legalName" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "registrationAuthority" TEXT,
    "country" TEXT NOT NULL DEFAULT 'JO',
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "isDefaultContractingOperator" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperatorParty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OwnerAttestation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ownerProfileId" TEXT NOT NULL,
    "propertyId" TEXT,
    "attestationKey" TEXT NOT NULL,
    "attestationCorpusVersion" TEXT NOT NULL,
    "sourceSurface" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OwnerAttestation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PropertyAuthorityReviewEvent" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "previousStatus" "PropertyAuthorityReviewStatus" NOT NULL,
    "newStatus" "PropertyAuthorityReviewStatus" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "reasonCategory" TEXT,
    "reasonText" TEXT,
    "evidenceDocumentIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyAuthorityReviewEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "contractingOperatorPartyId" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "declaredPropertyOwnerPartyId" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "declaredPropertyOwnerRelation" "DeclaredPropertyOwnerRelation";
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "authorityBasis" "PropertyAuthorityBasis";
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "authorityReviewStatus" "PropertyAuthorityReviewStatus" NOT NULL DEFAULT 'not_submitted';
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "authorityReviewReason" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "authorityReviewedAt" TIMESTAMP(3);
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "authorityReviewedByUserId" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "authorityAttestedAt" TIMESTAMP(3);
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "authorityAttestationVersion" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "authorityAttestedByUserId" TEXT;

ALTER TABLE "OwnerDocument" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;

CREATE INDEX IF NOT EXISTS "OperatorParty_ownerProfileId_idx" ON "OperatorParty"("ownerProfileId");
CREATE INDEX IF NOT EXISTS "OperatorParty_ownerProfileId_isDefaultContractingOperator_idx" ON "OperatorParty"("ownerProfileId", "isDefaultContractingOperator");
CREATE INDEX IF NOT EXISTS "OwnerAttestation_ownerProfileId_attestationKey_idx" ON "OwnerAttestation"("ownerProfileId", "attestationKey");
CREATE INDEX IF NOT EXISTS "OwnerAttestation_propertyId_attestationKey_idx" ON "OwnerAttestation"("propertyId", "attestationKey");
CREATE INDEX IF NOT EXISTS "OwnerAttestation_userId_idx" ON "OwnerAttestation"("userId");
CREATE INDEX IF NOT EXISTS "PropertyAuthorityReviewEvent_propertyId_createdAt_idx" ON "PropertyAuthorityReviewEvent"("propertyId", "createdAt");
CREATE INDEX IF NOT EXISTS "PropertyAuthorityReviewEvent_actorUserId_idx" ON "PropertyAuthorityReviewEvent"("actorUserId");
CREATE INDEX IF NOT EXISTS "Property_authorityReviewStatus_idx" ON "Property"("authorityReviewStatus");
CREATE INDEX IF NOT EXISTS "Property_contractingOperatorPartyId_idx" ON "Property"("contractingOperatorPartyId");
CREATE INDEX IF NOT EXISTS "OwnerDocument_propertyId_documentType_idx" ON "OwnerDocument"("propertyId", "documentType");

DO $$ BEGIN
  ALTER TABLE "OperatorParty" ADD CONSTRAINT "OperatorParty_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OwnerAttestation" ADD CONSTRAINT "OwnerAttestation_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OwnerAttestation" ADD CONSTRAINT "OwnerAttestation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PropertyAuthorityReviewEvent" ADD CONSTRAINT "PropertyAuthorityReviewEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Property" ADD CONSTRAINT "Property_contractingOperatorPartyId_fkey" FOREIGN KEY ("contractingOperatorPartyId") REFERENCES "OperatorParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Property" ADD CONSTRAINT "Property_declaredPropertyOwnerPartyId_fkey" FOREIGN KEY ("declaredPropertyOwnerPartyId") REFERENCES "OperatorParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Legacy Properties: authorityReviewStatus defaults to not_submitted. No fabricated approvals.
