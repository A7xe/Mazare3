-- Phase 3C.4D.7A — Payout beneficiary identity matching + review lifecycle
-- Additive only. Does NOT auto-approve legacy profiles. Does NOT rewrite IBAN ciphers.
-- LOCAL / DEV only. Production untouched.

-- Expand review status enum
DO $$ BEGIN
  ALTER TYPE "OwnerPayoutReviewStatus" ADD VALUE IF NOT EXISTS 'action_required';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "OwnerPayoutReviewStatus" ADD VALUE IF NOT EXISTS 'reassessment_required';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PayoutBeneficiaryRelationship" AS ENUM (
    'operator_self',
    'operator_legal_entity',
    'authorised_third_party',
    'other_review_required'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PayoutBeneficiaryNameMatchHint" AS ENUM (
    'match_likely',
    'review_required',
    'clear_mismatch'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "OwnerPayoutProfile"
  ADD COLUMN IF NOT EXISTS "contractingOperatorPartyId" TEXT,
  ADD COLUMN IF NOT EXISTS "beneficiaryRelationship" "PayoutBeneficiaryRelationship",
  ADD COLUMN IF NOT EXISTS "payoutCountry" VARCHAR(2),
  ADD COLUMN IF NOT EXISTS "nameMatchHint" "PayoutBeneficiaryNameMatchHint",
  ADD COLUMN IF NOT EXISTS "reviewReasonCategory" TEXT;

CREATE INDEX IF NOT EXISTS "OwnerPayoutProfile_reviewStatus_idx"
  ON "OwnerPayoutProfile"("reviewStatus");
CREATE INDEX IF NOT EXISTS "OwnerPayoutProfile_contractingOperatorPartyId_idx"
  ON "OwnerPayoutProfile"("contractingOperatorPartyId");

DO $$ BEGIN
  ALTER TABLE "OwnerPayoutProfile"
    ADD CONSTRAINT "OwnerPayoutProfile_contractingOperatorPartyId_fkey"
    FOREIGN KEY ("contractingOperatorPartyId") REFERENCES "OperatorParty"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Legacy rows keep prior reviewStatus (pending/reviewed/rejected).
-- No fabricated relationship / approval. Preflight reports unassessed relationship.

CREATE TABLE IF NOT EXISTS "OwnerPayoutBeneficiaryReviewEvent" (
  "id" TEXT NOT NULL,
  "payoutProfileId" TEXT NOT NULL,
  "ownerProfileId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "previousStatus" TEXT,
  "newStatus" TEXT NOT NULL,
  "reasonCategory" TEXT,
  "reason" TEXT,
  "ibanLast4" TEXT,
  "beneficiaryRelationship" TEXT,
  "nameMatchHint" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OwnerPayoutBeneficiaryReviewEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OwnerPayoutBeneficiaryReviewEvent_payoutProfileId_createdAt_idx"
  ON "OwnerPayoutBeneficiaryReviewEvent"("payoutProfileId", "createdAt");
CREATE INDEX IF NOT EXISTS "OwnerPayoutBeneficiaryReviewEvent_ownerProfileId_createdAt_idx"
  ON "OwnerPayoutBeneficiaryReviewEvent"("ownerProfileId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "OwnerPayoutBeneficiaryReviewEvent"
    ADD CONSTRAINT "OwnerPayoutBeneficiaryReviewEvent_payoutProfileId_fkey"
    FOREIGN KEY ("payoutProfileId") REFERENCES "OwnerPayoutProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
