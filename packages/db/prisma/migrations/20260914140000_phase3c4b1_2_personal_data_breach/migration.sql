-- Phase 3C.4B.1.2 — Personal data breach readiness (LOCAL migration; do not apply to Production in this phase).
-- Dedicated privacy/security domain — NOT BookingIncident.

CREATE TYPE "PersonalDataBreachIncidentKind" AS ENUM ('security_incident_only', 'personal_data_breach');
CREATE TYPE "PersonalDataBreachWorkflowStatus" AS ENUM (
  'reported',
  'triage',
  'investigating',
  'contained',
  'legal_assessment',
  'notification_required',
  'notification_in_progress',
  'monitoring',
  'closed'
);
CREATE TYPE "SevereHarmAssessmentStatus" AS ENUM (
  'unassessed',
  'assessing',
  'severe_harm_likely',
  'severe_harm_not_likely',
  'legal_review_required'
);
CREATE TYPE "LegalNotificationAssessment" AS ENUM (
  'not_assessed',
  'not_notifiable',
  'notifiable_pending_confirmation',
  'notifiable_confirmed',
  'legal_review_required'
);
CREATE TYPE "BreachNotificationChannelStatus" AS ENUM (
  'not_required',
  'pending_review',
  'required',
  'prepared',
  'approved_for_send',
  'sent',
  'confirmed',
  'overdue'
);

CREATE TABLE "PersonalDataBreachIncident" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "internalSummary" TEXT,
  "incidentKind" "PersonalDataBreachIncidentKind" NOT NULL,
  "workflowStatus" "PersonalDataBreachWorkflowStatus" NOT NULL DEFAULT 'reported',
  "discoveredAt" TIMESTAMP(3) NOT NULL,
  "initiallyRecordedDiscoveryAt" TIMESTAMP(3) NOT NULL,
  "correctedDiscoveryAt" TIMESTAMP(3),
  "discoveryCorrectionReason" TEXT,
  "occurredAt" TIMESTAMP(3),
  "containedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "discoverySource" TEXT,
  "affectedSystems" JSONB,
  "affectedDataCategories" JSONB,
  "affectedDataSubjectCategories" JSONB,
  "estimatedAffectedCount" INTEGER,
  "affectedSubjectRefs" JSONB,
  "involvesSensitivePersonalData" BOOLEAN NOT NULL DEFAULT false,
  "involvesFinancialSensitiveData" BOOLEAN NOT NULL DEFAULT false,
  "involvesKycData" BOOLEAN NOT NULL DEFAULT false,
  "involvesCredentialsAuthData" BOOLEAN NOT NULL DEFAULT false,
  "dataWasEncrypted" BOOLEAN,
  "encryptionKeysCompromised" BOOLEAN,
  "sourceMechanismDescription" TEXT,
  "containmentActions" TEXT,
  "remediationActions" TEXT,
  "containmentChecklist" JSONB,
  "likelyConsequences" TEXT,
  "severeHarmAssessment" "SevereHarmAssessmentStatus" NOT NULL DEFAULT 'unassessed',
  "severeHarmReason" TEXT,
  "severeHarmFactorKeys" JSONB,
  "legalNotificationAssessment" "LegalNotificationAssessment" NOT NULL DEFAULT 'not_assessed',
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "customerNotificationRequired" BOOLEAN NOT NULL DEFAULT false,
  "authorityNotificationRequired" BOOLEAN NOT NULL DEFAULT false,
  "customerNotificationDueAt" TIMESTAMP(3),
  "authorityNotificationDueAt" TIMESTAMP(3),
  "customerNotificationStatus" "BreachNotificationChannelStatus" NOT NULL DEFAULT 'not_required',
  "authorityNotificationStatus" "BreachNotificationChannelStatus" NOT NULL DEFAULT 'not_required',
  "customerNoticeDraftJson" JSONB,
  "customerNoticeContentHash" TEXT,
  "customerNoticeApprovedAt" TIMESTAMP(3),
  "customerNoticeSentAt" TIMESTAMP(3),
  "authorityPackJson" JSONB,
  "authorityPackApprovedAt" TIMESTAMP(3),
  "authoritySubmittedAt" TIMESTAMP(3),
  "authoritySubmissionReference" TEXT,
  "authoritySubmittedByUserId" TEXT,
  "internalNotes" TEXT,
  "reportedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PersonalDataBreachIncident_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PersonalDataBreachIncident_workflowStatus_discoveredAt_idx"
  ON "PersonalDataBreachIncident"("workflowStatus", "discoveredAt");
CREATE INDEX "PersonalDataBreachIncident_incidentKind_severeHarmAssessment_idx"
  ON "PersonalDataBreachIncident"("incidentKind", "severeHarmAssessment");
CREATE INDEX "PersonalDataBreachIncident_customerNotificationDueAt_idx"
  ON "PersonalDataBreachIncident"("customerNotificationDueAt");
CREATE INDEX "PersonalDataBreachIncident_authorityNotificationDueAt_idx"
  ON "PersonalDataBreachIncident"("authorityNotificationDueAt");
CREATE INDEX "PersonalDataBreachIncident_createdAt_idx"
  ON "PersonalDataBreachIncident"("createdAt");

ALTER TABLE "PersonalDataBreachIncident"
  ADD CONSTRAINT "PersonalDataBreachIncident_reportedByUserId_fkey"
  FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PersonalDataBreachIncident"
  ADD CONSTRAINT "PersonalDataBreachIncident_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
