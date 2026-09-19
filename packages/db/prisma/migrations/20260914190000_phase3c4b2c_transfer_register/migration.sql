-- Phase 3C.4B.2C — Article 14 Personal Data transfer/exchange register.
-- Does not store copied raw Personal Data. Legal sufficiency remains COUNSEL_REVIEW_REQUIRED.

CREATE TYPE "PersonalDataTransferBorderScope" AS ENUM (
  'domestic',
  'cross_border',
  'unknown_pending_review'
);

CREATE TYPE "PersonalDataTransferRegisterReviewStatus" AS ENUM (
  'draft',
  'recorded',
  'under_counsel_review',
  'closed'
);

CREATE TABLE "PersonalDataTransferRegisterEntry" (
  "id" TEXT NOT NULL,
  "processingActivityKey" TEXT NOT NULL,
  "dataCategoryCodes" TEXT[],
  "recipientKey" TEXT NOT NULL,
  "recipientVerifiedLabel" TEXT,
  "purpose" TEXT NOT NULL,
  "borderScope" "PersonalDataTransferBorderScope" NOT NULL DEFAULT 'unknown_pending_review',
  "consentPurposeKey" TEXT,
  "consentPurposeVersion" TEXT,
  "privacyNoticeVersionId" TEXT,
  "dataProcessingConsentId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "legalExceptionReference" TEXT,
  "reviewStatus" "PersonalDataTransferRegisterReviewStatus" NOT NULL DEFAULT 'draft',
  "legalSufficiencyStatus" TEXT NOT NULL DEFAULT 'COUNSEL_REVIEW_REQUIRED',
  "notes" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PersonalDataTransferRegisterEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PersonalDataTransferRegisterEntry_processingActivityKey_reviewStatus_idx"
  ON "PersonalDataTransferRegisterEntry"("processingActivityKey", "reviewStatus");
CREATE INDEX "PersonalDataTransferRegisterEntry_recipientKey_idx"
  ON "PersonalDataTransferRegisterEntry"("recipientKey");
CREATE INDEX "PersonalDataTransferRegisterEntry_borderScope_reviewStatus_idx"
  ON "PersonalDataTransferRegisterEntry"("borderScope", "reviewStatus");
CREATE INDEX "PersonalDataTransferRegisterEntry_dataProcessingConsentId_idx"
  ON "PersonalDataTransferRegisterEntry"("dataProcessingConsentId");
CREATE INDEX "PersonalDataTransferRegisterEntry_startedAt_idx"
  ON "PersonalDataTransferRegisterEntry"("startedAt");

ALTER TABLE "PersonalDataTransferRegisterEntry"
  ADD CONSTRAINT "PersonalDataTransferRegisterEntry_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
