-- Phase 3C.4B.1.4 — Jordan Prior Consent evidence (DataProcessingConsent).
-- LOCAL/DEV only. Does not fabricate historical consent for existing users.

CREATE TYPE "DataProcessingConsentPurpose" AS ENUM (
  'account_registration_and_authentication',
  'marketplace_booking_processing',
  'payment_and_refund_processing',
  'saved_payment_method_processing',
  'support_and_dispute_processing',
  'owner_account_and_marketplace_operation',
  'owner_identity_and_authority_verification',
  'property_and_exact_location_processing',
  'owner_payout_and_financial_processing'
);

CREATE TYPE "DataProcessingConsentStatus" AS ENUM (
  'granted',
  'withdrawn',
  'superseded',
  'expired'
);

CREATE TABLE "DataProcessingConsent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purposeKey" "DataProcessingConsentPurpose" NOT NULL,
  "purposeVersion" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "consentText" TEXT NOT NULL,
  "consentTextHash" TEXT NOT NULL,
  "status" "DataProcessingConsentStatus" NOT NULL DEFAULT 'granted',
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawnAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "durationStatus" TEXT NOT NULL DEFAULT 'DURATION_REQUIRES_LEGAL_REVIEW',
  "validityEvent" TEXT,
  "sourceSurface" TEXT,
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  "privacyNoticeVersionId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DataProcessingConsent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DataProcessingConsent_userId_purposeKey_status_idx" ON "DataProcessingConsent"("userId", "purposeKey", "status");
CREATE INDEX "DataProcessingConsent_purposeKey_status_idx" ON "DataProcessingConsent"("purposeKey", "status");
CREATE INDEX "DataProcessingConsent_consentTextHash_idx" ON "DataProcessingConsent"("consentTextHash");
CREATE INDEX "DataProcessingConsent_grantedAt_idx" ON "DataProcessingConsent"("grantedAt");

ALTER TABLE "DataProcessingConsent" ADD CONSTRAINT "DataProcessingConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
