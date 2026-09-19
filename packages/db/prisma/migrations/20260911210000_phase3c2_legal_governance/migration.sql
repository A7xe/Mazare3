-- Phase 3C.2 — Legal governance fields on LegalRelease (additive only)
-- Counsel review + founder approval status. Does NOT activate Production legal.
-- Reviewer identity is intentionally omitted (do not invent).

CREATE TYPE "LegalReviewStatus" AS ENUM (
  'not_reviewed',
  'under_review',
  'approved',
  'approved_with_changes',
  'rejected'
);

CREATE TYPE "FounderApprovalStatus" AS ENUM (
  'pending',
  'approved',
  'rejected'
);

ALTER TABLE "LegalRelease"
  ADD COLUMN "legalReviewStatus" "LegalReviewStatus" NOT NULL DEFAULT 'not_reviewed',
  ADD COLUMN "legalReviewedAt" TIMESTAMP(3),
  ADD COLUMN "legalReviewReference" TEXT,
  ADD COLUMN "legalReviewNote" TEXT,
  ADD COLUMN "founderApprovalStatus" "FounderApprovalStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "founderApprovedAt" TIMESTAMP(3),
  ADD COLUMN "founderApprovalNote" TEXT;
