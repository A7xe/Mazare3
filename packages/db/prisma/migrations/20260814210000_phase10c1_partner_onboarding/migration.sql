-- Phase 10C.1: partner onboarding, private verification, commercial terms (additive)

CREATE TYPE "PartnerEntityType" AS ENUM ('individual', 'business');
CREATE TYPE "PartnerVerificationStatus" AS ENUM (
  'draft', 'submitted', 'under_review', 'changes_requested',
  'approved', 'rejected', 'suspended', 'legacy_approved'
);
CREATE TYPE "PartnerDocumentType" AS ENUM (
  'identity', 'property_ownership', 'management_authorization',
  'business_registration', 'payout_proof', 'other'
);
CREATE TYPE "OwnerDocumentReviewStatus" AS ENUM (
  'uploaded', 'under_review', 'approved', 'rejected', 'superseded'
);
CREATE TYPE "OwnerPayoutReviewStatus" AS ENUM ('pending', 'reviewed', 'rejected');
CREATE TYPE "PartnerAgreementStatus" AS ENUM ('draft', 'active', 'archived');
CREATE TYPE "PartnerCommercialTermsStatus" AS ENUM (
  'draft', 'scheduled', 'active', 'superseded', 'expired'
);
CREATE TYPE "CommissionSource" AS ENUM ('property_terms', 'owner_terms', 'platform_default');

CREATE TABLE "OwnerVerificationProfile" (
    "id" TEXT NOT NULL,
    "ownerProfileId" TEXT NOT NULL,
    "entityType" "PartnerEntityType",
    "verificationStatus" "PartnerVerificationStatus" NOT NULL DEFAULT 'draft',
    "legalName" TEXT,
    "operatingPhone" TEXT,
    "operatingCity" TEXT,
    "operatingArea" TEXT,
    "contactEmail" TEXT,
    "changeRequestReason" TEXT,
    "changeRequestAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "suspensionReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspendedByUserId" TEXT,
    "previousVerificationStatus" "PartnerVerificationStatus",
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "restoredAt" TIMESTAMP(3),
    "usePlatformDefaultCommission" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerVerificationProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OwnerVerificationProfile_ownerProfileId_key" ON "OwnerVerificationProfile"("ownerProfileId");
CREATE INDEX "OwnerVerificationProfile_verificationStatus_idx" ON "OwnerVerificationProfile"("verificationStatus");
CREATE INDEX "OwnerVerificationProfile_entityType_idx" ON "OwnerVerificationProfile"("entityType");

ALTER TABLE "OwnerVerificationProfile"
  ADD CONSTRAINT "OwnerVerificationProfile_ownerProfileId_fkey"
  FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PartnerDocumentRequirement" (
    "id" TEXT NOT NULL,
    "documentType" "PartnerDocumentType" NOT NULL,
    "entityType" "PartnerEntityType",
    "required" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "labelAr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerDocumentRequirement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerDocumentRequirement_active_documentType_idx" ON "PartnerDocumentRequirement"("active", "documentType");

CREATE TABLE "OwnerDocument" (
    "id" TEXT NOT NULL,
    "ownerProfileId" TEXT NOT NULL,
    "requirementId" TEXT,
    "documentType" "PartnerDocumentType" NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "reviewStatus" "OwnerDocumentReviewStatus" NOT NULL DEFAULT 'uploaded',
    "rejectionReason" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OwnerDocument_ownerProfileId_documentType_idx" ON "OwnerDocument"("ownerProfileId", "documentType");
CREATE INDEX "OwnerDocument_reviewStatus_idx" ON "OwnerDocument"("reviewStatus");

ALTER TABLE "OwnerDocument"
  ADD CONSTRAINT "OwnerDocument_ownerProfileId_fkey"
  FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OwnerPayoutProfile" (
    "id" TEXT NOT NULL,
    "ownerProfileId" TEXT NOT NULL,
    "beneficiaryNameCipher" TEXT NOT NULL,
    "bankNameCipher" TEXT NOT NULL,
    "ibanCipher" TEXT NOT NULL,
    "ibanLast4" TEXT NOT NULL,
    "ibanFingerprint" TEXT NOT NULL,
    "optionalNotesCipher" TEXT,
    "reviewStatus" "OwnerPayoutReviewStatus" NOT NULL DEFAULT 'pending',
    "reviewReason" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerPayoutProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OwnerPayoutProfile_ownerProfileId_key" ON "OwnerPayoutProfile"("ownerProfileId");

ALTER TABLE "OwnerPayoutProfile"
  ADD CONSTRAINT "OwnerPayoutProfile_ownerProfileId_fkey"
  FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PartnerAgreement" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "PartnerAgreementStatus" NOT NULL DEFAULT 'draft',
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "summaryAr" TEXT NOT NULL,
    "summaryEn" TEXT NOT NULL,
    "contentAr" TEXT NOT NULL,
    "contentEn" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "legalReviewPlaceholder" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerAgreement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerAgreement_version_key" ON "PartnerAgreement"("version");
CREATE INDEX "PartnerAgreement_status_effectiveAt_idx" ON "PartnerAgreement"("status", "effectiveAt");

CREATE TABLE "PartnerAgreementAcceptance" (
    "id" TEXT NOT NULL,
    "ownerProfileId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedLocale" TEXT,

    CONSTRAINT "PartnerAgreementAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerAgreementAcceptance_ownerProfileId_agreementId_key" ON "PartnerAgreementAcceptance"("ownerProfileId", "agreementId");
CREATE INDEX "PartnerAgreementAcceptance_userId_idx" ON "PartnerAgreementAcceptance"("userId");

ALTER TABLE "PartnerAgreementAcceptance"
  ADD CONSTRAINT "PartnerAgreementAcceptance_ownerProfileId_fkey"
  FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerAgreementAcceptance"
  ADD CONSTRAINT "PartnerAgreementAcceptance_agreementId_fkey"
  FOREIGN KEY ("agreementId") REFERENCES "PartnerAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PartnerCommercialTerms" (
    "id" TEXT NOT NULL,
    "ownerProfileId" TEXT NOT NULL,
    "propertyId" TEXT,
    "commissionBps" INTEGER NOT NULL,
    "payoutDelayHours" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "PartnerCommercialTermsStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "internalNote" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "activatedByUserId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerCommercialTerms_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerCommercialTerms_ownerProfileId_status_effectiveFrom_idx" ON "PartnerCommercialTerms"("ownerProfileId", "status", "effectiveFrom");
CREATE INDEX "PartnerCommercialTerms_propertyId_status_effectiveFrom_idx" ON "PartnerCommercialTerms"("propertyId", "status", "effectiveFrom");

ALTER TABLE "PartnerCommercialTerms"
  ADD CONSTRAINT "PartnerCommercialTerms_ownerProfileId_fkey"
  FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerCommercialTerms"
  ADD CONSTRAINT "PartnerCommercialTerms_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OwnerOnboardingChangeRequest" (
    "id" TEXT NOT NULL,
    "ownerProfileId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerOnboardingChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OwnerOnboardingChangeRequest_ownerProfileId_resolved_idx" ON "OwnerOnboardingChangeRequest"("ownerProfileId", "resolved");

ALTER TABLE "OwnerOnboardingChangeRequest"
  ADD CONSTRAINT "OwnerOnboardingChangeRequest_ownerProfileId_fkey"
  FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD COLUMN "commercialTermsId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "commissionSource" "CommissionSource";
ALTER TABLE "Booking" ADD COLUMN "ownerPayoutDelayHours" INTEGER;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_commercialTermsId_fkey"
  FOREIGN KEY ("commercialTermsId") REFERENCES "PartnerCommercialTerms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing approved owners remain operational (legacy_approved). Pending apps stay submitted.
INSERT INTO "OwnerVerificationProfile" (
  "id", "ownerProfileId", "verificationStatus", "usePlatformDefaultCommission",
  "submittedAt", "createdAt", "updatedAt"
)
SELECT
  'ovp_' || "id",
  "id",
  CASE "status"
    WHEN 'approved' THEN 'legacy_approved'::"PartnerVerificationStatus"
    WHEN 'pending' THEN 'submitted'::"PartnerVerificationStatus"
    WHEN 'rejected' THEN 'rejected'::"PartnerVerificationStatus"
    WHEN 'suspended' THEN 'suspended'::"PartnerVerificationStatus"
    ELSE 'draft'::"PartnerVerificationStatus"
  END,
  ("status" = 'approved'),
  CASE WHEN "status" IN ('pending', 'approved', 'rejected', 'suspended') THEN "createdAt" ELSE NULL END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "OwnerProfile";

INSERT INTO "PartnerDocumentRequirement" (
  "id", "documentType", "entityType", "required", "active",
  "labelAr", "labelEn", "descriptionAr", "descriptionEn", "sortOrder", "createdAt", "updatedAt"
) VALUES
(
  'req_identity_all', 'identity', NULL, true, true,
  'وثيقة إثبات الهوية', 'Identity document',
  '[للمراجعة القانونية قبل الإنتاج] وثيقة هوية سارية للشخص المسؤول عن الحساب.',
  '[LEGAL REVIEW REQUIRED BEFORE PRODUCTION] A valid identity document for the account holder.',
  10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'req_ownership_all', 'property_ownership', NULL, true, true,
  'إثبات ملكية العقار', 'Proof of property ownership',
  '[للمراجعة القانونية قبل الإنتاج] مستند يوضح علاقة الشريك بالعقار (ملكية أو حق إدارة).',
  '[LEGAL REVIEW REQUIRED BEFORE PRODUCTION] A document showing the partner’s relationship to the property.',
  20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'req_auth_individual', 'management_authorization', 'individual', false, true,
  'تفويض إدارة العقار (إن وجد)', 'Authorization to manage the property (if applicable)',
  '[للمراجعة القانونية قبل الإنتاج] مطلوب إذا كان مقدم الطلب يدير العقار نيابة عن المالك.',
  '[LEGAL REVIEW REQUIRED BEFORE PRODUCTION] Required if the applicant manages the property on behalf of the owner.',
  30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'req_business_reg', 'business_registration', 'business', true, true,
  'وثيقة تسجيل النشاط', 'Business registration document',
  '[للمراجعة القانونية قبل الإنتاج] مستند تسجيل النشاط التشغيلي — تصنيف المنصة وليس استشارة قانونية.',
  '[LEGAL REVIEW REQUIRED BEFORE PRODUCTION] Operating registration document — a platform classification, not legal advice.',
  40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'req_payout_all', 'payout_proof', NULL, true, true,
  'إثبات حساب القبض', 'Bank / payout-account proof',
  '[للمراجعة القانونية قبل الإنتاج] إثبات يطابق بيانات التحويل اليدوي الحالية.',
  '[LEGAL REVIEW REQUIRED BEFORE PRODUCTION] Proof matching the current manual payout details.',
  50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT INTO "PartnerAgreement" (
  "id", "version", "status", "effectiveAt",
  "titleAr", "titleEn", "summaryAr", "summaryEn", "contentAr", "contentEn",
  "contentHash", "legalReviewPlaceholder", "createdAt", "updatedAt"
) VALUES (
  'agr_dev_placeholder_v1',
  'dev-placeholder-1',
  'active',
  CURRENT_TIMESTAMP,
  'اتفاقية شريك المنصة (مسودة تطوير)',
  'Platform partner agreement (development draft)',
  'مسودة تشغيلية للمراجعة القانونية — لا تُعد عقدًا نهائيًا.',
  'Operational draft for legal review — not a final contract.',
  'هذه نسخة تطوير مؤقتة لاتفاقية الشريك على منصة مزارع الأردن. المحتوى يحتاج مراجعة قانونية قبل الإنتاج. القبول هنا لأغراض ضمان الجودة فقط.',
  'This is a temporary development copy of the Mazare3 Jordan partner agreement. Content requires legal review before production. Acceptance here is for QA only.',
  'placeholder-dev-v1-not-legal',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
