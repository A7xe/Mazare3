-- Phase 3C.4D.4A — Property activity + regulatory requirements foundation (additive)
-- Local/dev only. Legacy Properties are NOT auto-READY / NOT auto-verified.
-- Production: DO NOT APPLY.

DO $$ BEGIN
  CREATE TYPE "PropertyActivityCode" AS ENUM ('day_use', 'overnight_accommodation', 'events', 'swimming_pool', 'food_service', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RegulatoryRequirementType" AS ENUM ('tourism_regulatory_status', 'municipal_or_professional_licence', 'pool_regulatory_assessment', 'civil_liability_insurance', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RegulatoryApplicability" AS ENUM ('unassessed', 'applicable', 'not_applicable_confirmed', 'regulatory_confirmation_required');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RegulatoryComplianceStatus" AS ENUM ('not_assessed', 'under_review', 'action_required', 'verified', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PropertyActivity" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "activityCode" "PropertyActivityCode" NOT NULL,
    "otherDescription" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PropertyRegulatoryRequirement" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "requirementType" "RegulatoryRequirementType" NOT NULL,
    "applicability" "RegulatoryApplicability" NOT NULL DEFAULT 'unassessed',
    "complianceStatus" "RegulatoryComplianceStatus" NOT NULL DEFAULT 'not_assessed',
    "issuingAuthority" TEXT,
    "referenceNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "validFrom" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "reviewReason" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "reassessmentRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyRegulatoryRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RegulatoryEvidence" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "label" TEXT,
    "documentNumber" TEXT,
    "issuerName" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "superseded" BOOLEAN NOT NULL DEFAULT false,
    "supersededById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegulatoryEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RegulatoryDecisionEvent" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "previousApplicability" "RegulatoryApplicability" NOT NULL,
    "newApplicability" "RegulatoryApplicability" NOT NULL,
    "previousComplianceStatus" "RegulatoryComplianceStatus" NOT NULL,
    "newComplianceStatus" "RegulatoryComplianceStatus" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "reasonCategory" TEXT,
    "reasonText" TEXT,
    "evidenceIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegulatoryDecisionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PropertyActivity_propertyId_activityCode_key" ON "PropertyActivity"("propertyId", "activityCode");
CREATE INDEX IF NOT EXISTS "PropertyActivity_propertyId_active_idx" ON "PropertyActivity"("propertyId", "active");
CREATE INDEX IF NOT EXISTS "PropertyActivity_activityCode_idx" ON "PropertyActivity"("activityCode");

CREATE UNIQUE INDEX IF NOT EXISTS "PropertyRegulatoryRequirement_propertyId_requirementType_key" ON "PropertyRegulatoryRequirement"("propertyId", "requirementType");
CREATE INDEX IF NOT EXISTS "PropertyRegulatoryRequirement_propertyId_applicability_complianceStatus_idx" ON "PropertyRegulatoryRequirement"("propertyId", "applicability", "complianceStatus");
CREATE INDEX IF NOT EXISTS "PropertyRegulatoryRequirement_requirementType_idx" ON "PropertyRegulatoryRequirement"("requirementType");
CREATE INDEX IF NOT EXISTS "PropertyRegulatoryRequirement_expiresAt_idx" ON "PropertyRegulatoryRequirement"("expiresAt");

CREATE INDEX IF NOT EXISTS "RegulatoryEvidence_requirementId_superseded_idx" ON "RegulatoryEvidence"("requirementId", "superseded");
CREATE INDEX IF NOT EXISTS "RegulatoryEvidence_expiresAt_idx" ON "RegulatoryEvidence"("expiresAt");

CREATE INDEX IF NOT EXISTS "RegulatoryDecisionEvent_requirementId_createdAt_idx" ON "RegulatoryDecisionEvent"("requirementId", "createdAt");
CREATE INDEX IF NOT EXISTS "RegulatoryDecisionEvent_propertyId_createdAt_idx" ON "RegulatoryDecisionEvent"("propertyId", "createdAt");
CREATE INDEX IF NOT EXISTS "RegulatoryDecisionEvent_actorUserId_idx" ON "RegulatoryDecisionEvent"("actorUserId");

DO $$ BEGIN
  ALTER TABLE "PropertyActivity" ADD CONSTRAINT "PropertyActivity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PropertyRegulatoryRequirement" ADD CONSTRAINT "PropertyRegulatoryRequirement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RegulatoryEvidence" ADD CONSTRAINT "RegulatoryEvidence_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "PropertyRegulatoryRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RegulatoryDecisionEvent" ADD CONSTRAINT "RegulatoryDecisionEvent_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "PropertyRegulatoryRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Legacy Properties: no requirement rows → readiness NOT_STARTED / INCOMPLETE (not READY).
-- No fabricated verified evidence or not_applicable_confirmed.
