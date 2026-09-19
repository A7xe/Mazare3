-- Phase 3C.4B.1.3 — Breach access & notification evidence hardening (LOCAL only).

-- Super Admin flag (grants all privacy_breach_* capabilities)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "superAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Capabilities
CREATE TYPE "AdminCapability" AS ENUM (
  'privacy_breach_view',
  'privacy_breach_manage',
  'privacy_breach_notification_approve',
  'privacy_breach_authority_record',
  'privacy_breach_discovery_correct_later'
);

CREATE TABLE "UserCapabilityGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "capability" "AdminCapability" NOT NULL,
  "grantedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserCapabilityGrant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserCapabilityGrant_userId_capability_key" ON "UserCapabilityGrant"("userId", "capability");
CREATE INDEX "UserCapabilityGrant_capability_idx" ON "UserCapabilityGrant"("capability");
ALTER TABLE "UserCapabilityGrant"
  ADD CONSTRAINT "UserCapabilityGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCapabilityGrant"
  ADD CONSTRAINT "UserCapabilityGrant_grantedByUserId_fkey"
  FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Expand incident-level channel statuses
ALTER TYPE "BreachNotificationChannelStatus" ADD VALUE 'attempted';
ALTER TYPE "BreachNotificationChannelStatus" ADD VALUE 'partially_sent';
ALTER TYPE "BreachNotificationChannelStatus" ADD VALUE 'failed';
ALTER TYPE "BreachNotificationChannelStatus" ADD VALUE 'manual_followup_required';

-- Rename Customer-narrow Art.20 fields → Affected Data Subject terminology
ALTER TABLE "PersonalDataBreachIncident" RENAME COLUMN "customerNotificationRequired" TO "dataSubjectNotificationRequired";
ALTER TABLE "PersonalDataBreachIncident" RENAME COLUMN "customerNotificationDueAt" TO "dataSubjectNotificationDueAt";
ALTER TABLE "PersonalDataBreachIncident" RENAME COLUMN "customerNotificationStatus" TO "dataSubjectNotificationStatus";
ALTER TABLE "PersonalDataBreachIncident" RENAME COLUMN "customerNoticeDraftJson" TO "dataSubjectNoticeDraftJson";
ALTER TABLE "PersonalDataBreachIncident" RENAME COLUMN "customerNoticeContentHash" TO "dataSubjectNoticeContentHash";
ALTER TABLE "PersonalDataBreachIncident" RENAME COLUMN "customerNoticeApprovedAt" TO "dataSubjectNoticeApprovedAt";
ALTER TABLE "PersonalDataBreachIncident" RENAME COLUMN "customerNoticeSentAt" TO "dataSubjectNoticeSentAt";

DROP INDEX IF EXISTS "PersonalDataBreachIncident_customerNotificationDueAt_idx";
CREATE INDEX "PersonalDataBreachIncident_dataSubjectNotificationDueAt_idx"
  ON "PersonalDataBreachIncident"("dataSubjectNotificationDueAt");

ALTER TABLE "PersonalDataBreachIncident" ADD COLUMN IF NOT EXISTS "discoveryCorrectionReviewedByUserId" TEXT;
ALTER TABLE "PersonalDataBreachIncident" ADD COLUMN IF NOT EXISTS "discoveryCorrectionReviewedAt" TIMESTAMP(3);
ALTER TABLE "PersonalDataBreachIncident" ADD COLUMN IF NOT EXISTS "assessmentHistory" JSONB;

CREATE TYPE "BreachRecipientNoticeState" AS ENUM (
  'not_required',
  'pending',
  'prepared',
  'approved',
  'attempted',
  'sent',
  'delivery_confirmed',
  'failed',
  'manual_followup_required'
);

CREATE TYPE "BreachDataSubjectCategoryLabel" AS ENUM (
  'customer',
  'owner_partner',
  'visitor_unauthenticated',
  'admin_staff',
  'mixed',
  'unknown_or_non_account'
);

CREATE TABLE "PersonalDataBreachRecipientNotice" (
  "id" TEXT NOT NULL,
  "breachIncidentId" TEXT NOT NULL,
  "subjectCategory" "BreachDataSubjectCategoryLabel" NOT NULL,
  "userId" TEXT,
  "ownerProfileId" TEXT,
  "externalRef" TEXT,
  "contactChannel" TEXT NOT NULL DEFAULT 'email',
  "contentHash" TEXT,
  "state" "BreachRecipientNoticeState" NOT NULL DEFAULT 'pending',
  "preparedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "attemptedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureCategory" TEXT,
  "fallbackManualStatus" TEXT,
  "deliveryState" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PersonalDataBreachRecipientNotice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PersonalDataBreachRecipientNotice_breachIncidentId_state_idx"
  ON "PersonalDataBreachRecipientNotice"("breachIncidentId", "state");
CREATE INDEX "PersonalDataBreachRecipientNotice_userId_idx"
  ON "PersonalDataBreachRecipientNotice"("userId");
ALTER TABLE "PersonalDataBreachRecipientNotice"
  ADD CONSTRAINT "PersonalDataBreachRecipientNotice_breachIncidentId_fkey"
  FOREIGN KEY ("breachIncidentId") REFERENCES "PersonalDataBreachIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonalDataBreachRecipientNotice"
  ADD CONSTRAINT "PersonalDataBreachRecipientNotice_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PersonalDataBreachDeadlineHistory" (
  "id" TEXT NOT NULL,
  "breachIncidentId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "discoveryAt" TIMESTAMP(3) NOT NULL,
  "dataSubjectDueAt" TIMESTAMP(3),
  "authorityDueAt" TIMESTAMP(3),
  "reason" TEXT,
  "reviewerUserId" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "previousSnapshot" JSONB,
  CONSTRAINT "PersonalDataBreachDeadlineHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PersonalDataBreachDeadlineHistory_breachIncidentId_recordedAt_idx"
  ON "PersonalDataBreachDeadlineHistory"("breachIncidentId", "recordedAt");
ALTER TABLE "PersonalDataBreachDeadlineHistory"
  ADD CONSTRAINT "PersonalDataBreachDeadlineHistory_breachIncidentId_fkey"
  FOREIGN KEY ("breachIncidentId") REFERENCES "PersonalDataBreachIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonalDataBreachDeadlineHistory"
  ADD CONSTRAINT "PersonalDataBreachDeadlineHistory_reviewerUserId_fkey"
  FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
