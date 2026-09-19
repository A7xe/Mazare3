-- Phase 3B — Legal / consent architecture (additive only)

CREATE TYPE "LegalDocumentType" AS ENUM (
  'terms_and_conditions',
  'privacy_policy',
  'cancellation_refund_policy',
  'owner_agreement',
  'booking_terms',
  'cookie_policy',
  'verification_policy',
  'community_review_policy'
);

CREATE TYPE "LegalDocumentStatus" AS ENUM (
  'draft',
  'scheduled',
  'active',
  'superseded',
  'archived'
);

CREATE TYPE "LegalAcceptanceContext" AS ENUM (
  'registration',
  'login_reacceptance',
  'checkout',
  'owner_onboarding',
  'owner_agreement_update',
  'policy_update',
  'privacy_consent',
  'marketing_consent',
  'commercial_terms_ack'
);

CREATE TYPE "LegalAcceptanceEvidenceSource" AS ENUM (
  'user_explicit_acceptance',
  'system_import_admin_exception'
);

CREATE TYPE "PrivacyConsentPurpose" AS ENUM (
  'marketing_email',
  'marketing_sms',
  'personalized_analytics',
  'optional_cookies'
);

CREATE TYPE "PrivacyConsentStatus" AS ENUM (
  'granted',
  'withdrawn'
);

CREATE TYPE "DataSubjectRequestType" AS ENUM (
  'access',
  'correction',
  'erasure',
  'objection',
  'portability',
  'privacy_inquiry'
);

CREATE TYPE "DataSubjectRequestStatus" AS ENUM (
  'requested',
  'under_review',
  'fulfilled',
  'partially_fulfilled',
  'rejected_with_reason'
);

CREATE TABLE "LegalRelease" (
  "id" TEXT NOT NULL,
  "documentType" "LegalDocumentType" NOT NULL,
  "version" TEXT NOT NULL,
  "status" "LegalDocumentStatus" NOT NULL DEFAULT 'draft',
  "requiresReacceptance" BOOLEAN NOT NULL DEFAULT false,
  "materialChange" BOOLEAN NOT NULL DEFAULT false,
  "changelog" TEXT,
  "summaryOfChanges" TEXT,
  "effectiveAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT,
  CONSTRAINT "LegalRelease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalDocumentVersion" (
  "id" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "documentType" "LegalDocumentType" NOT NULL,
  "version" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "status" "LegalDocumentStatus" NOT NULL DEFAULT 'draft',
  "publishedAt" TIMESTAMP(3),
  "effectiveAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT,
  "sourceRef" TEXT,
  CONSTRAINT "LegalDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalAcceptance" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "documentVersionId" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "documentType" "LegalDocumentType" NOT NULL,
  "documentVersion" TEXT NOT NULL,
  "documentHash" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptanceContext" "LegalAcceptanceContext" NOT NULL,
  "relatedBookingId" TEXT,
  "relatedOwnerProfileId" TEXT,
  "sourceSurface" TEXT,
  "explicitAction" BOOLEAN NOT NULL DEFAULT true,
  "evidenceSource" "LegalAcceptanceEvidenceSource" NOT NULL DEFAULT 'user_explicit_acceptance',
  "withdrawnAt" TIMESTAMP(3),
  "metadata" JSONB,
  CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingLegalSnapshot" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "financialPolicyKey" TEXT NOT NULL,
  "financialPolicyHash" TEXT NOT NULL,
  "termsVersionId" TEXT,
  "cancellationPolicyVersionId" TEXT,
  "bookingTermsVersionId" TEXT,
  "privacyNoticeVersionId" TEXT,
  "commissionPercent" DECIMAL(5,2) NOT NULL,
  "depositPercent" DECIMAL(5,2) NOT NULL,
  "cancellationRulesJson" JSONB NOT NULL,
  "balanceDueHoursBeforeStart" INTEGER NOT NULL,
  "fullPaymentWithinHours" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingLegalSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrivacyConsent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purposeCode" "PrivacyConsentPurpose" NOT NULL,
  "consentVersion" TEXT NOT NULL,
  "noticeVersionId" TEXT,
  "status" "PrivacyConsentStatus" NOT NULL DEFAULT 'granted',
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawnAt" TIMESTAMP(3),
  "sourceSurface" TEXT,
  "metadata" JSONB,
  CONSTRAINT "PrivacyConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercialTermsAcceptance" (
  "id" TEXT NOT NULL,
  "ownerProfileId" TEXT NOT NULL,
  "commercialTermsId" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedByUserId" TEXT NOT NULL,
  "evidenceSource" "LegalAcceptanceEvidenceSource" NOT NULL DEFAULT 'user_explicit_acceptance',
  "documentHash" TEXT,
  "adminIssuerUserId" TEXT,
  "metadata" JSONB,
  CONSTRAINT "CommercialTermsAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataSubjectRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT,
  "type" "DataSubjectRequestType" NOT NULL,
  "status" "DataSubjectRequestStatus" NOT NULL DEFAULT 'requested',
  "description" TEXT,
  "adminNote" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "handledByUserId" TEXT,
  CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalRelease_documentType_version_key" ON "LegalRelease"("documentType", "version");
CREATE INDEX "LegalRelease_documentType_status_idx" ON "LegalRelease"("documentType", "status");

CREATE UNIQUE INDEX "LegalDocumentVersion_releaseId_language_key" ON "LegalDocumentVersion"("releaseId", "language");
CREATE INDEX "LegalDocumentVersion_documentType_language_status_idx" ON "LegalDocumentVersion"("documentType", "language", "status");
CREATE INDEX "LegalDocumentVersion_contentHash_idx" ON "LegalDocumentVersion"("contentHash");

CREATE INDEX "LegalAcceptance_userId_documentType_idx" ON "LegalAcceptance"("userId", "documentType");
CREATE INDEX "LegalAcceptance_relatedBookingId_idx" ON "LegalAcceptance"("relatedBookingId");
CREATE INDEX "LegalAcceptance_documentVersionId_idx" ON "LegalAcceptance"("documentVersionId");
CREATE INDEX "LegalAcceptance_releaseId_idx" ON "LegalAcceptance"("releaseId");
CREATE INDEX "LegalAcceptance_relatedOwnerProfileId_idx" ON "LegalAcceptance"("relatedOwnerProfileId");

CREATE UNIQUE INDEX "BookingLegalSnapshot_bookingId_key" ON "BookingLegalSnapshot"("bookingId");
CREATE INDEX "BookingLegalSnapshot_financialPolicyKey_idx" ON "BookingLegalSnapshot"("financialPolicyKey");

CREATE INDEX "PrivacyConsent_userId_purposeCode_status_idx" ON "PrivacyConsent"("userId", "purposeCode", "status");
CREATE INDEX "PrivacyConsent_noticeVersionId_idx" ON "PrivacyConsent"("noticeVersionId");

CREATE UNIQUE INDEX "CommercialTermsAcceptance_ownerProfileId_commercialTermsId_key" ON "CommercialTermsAcceptance"("ownerProfileId", "commercialTermsId");
CREATE INDEX "CommercialTermsAcceptance_acceptedByUserId_idx" ON "CommercialTermsAcceptance"("acceptedByUserId");
CREATE INDEX "CommercialTermsAcceptance_commercialTermsId_idx" ON "CommercialTermsAcceptance"("commercialTermsId");

CREATE INDEX "DataSubjectRequest_userId_status_idx" ON "DataSubjectRequest"("userId", "status");
CREATE INDEX "DataSubjectRequest_email_idx" ON "DataSubjectRequest"("email");
CREATE INDEX "DataSubjectRequest_status_createdAt_idx" ON "DataSubjectRequest"("status", "createdAt");

ALTER TABLE "LegalDocumentVersion" ADD CONSTRAINT "LegalDocumentVersion_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "LegalRelease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "LegalRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_relatedBookingId_fkey" FOREIGN KEY ("relatedBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_relatedOwnerProfileId_fkey" FOREIGN KEY ("relatedOwnerProfileId") REFERENCES "OwnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BookingLegalSnapshot" ADD CONSTRAINT "BookingLegalSnapshot_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingLegalSnapshot" ADD CONSTRAINT "BookingLegalSnapshot_termsVersionId_fkey" FOREIGN KEY ("termsVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingLegalSnapshot" ADD CONSTRAINT "BookingLegalSnapshot_cancellationPolicyVersionId_fkey" FOREIGN KEY ("cancellationPolicyVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingLegalSnapshot" ADD CONSTRAINT "BookingLegalSnapshot_bookingTermsVersionId_fkey" FOREIGN KEY ("bookingTermsVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingLegalSnapshot" ADD CONSTRAINT "BookingLegalSnapshot_privacyNoticeVersionId_fkey" FOREIGN KEY ("privacyNoticeVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PrivacyConsent" ADD CONSTRAINT "PrivacyConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivacyConsent" ADD CONSTRAINT "PrivacyConsent_noticeVersionId_fkey" FOREIGN KEY ("noticeVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommercialTermsAcceptance" ADD CONSTRAINT "CommercialTermsAcceptance_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialTermsAcceptance" ADD CONSTRAINT "CommercialTermsAcceptance_commercialTermsId_fkey" FOREIGN KEY ("commercialTermsId") REFERENCES "PartnerCommercialTerms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialTermsAcceptance" ADD CONSTRAINT "CommercialTermsAcceptance_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
