-- Phase 3C.4B.1 — DSR SLA foundation + Jordan rights enum coverage (additive)

ALTER TYPE "DataSubjectRequestType" ADD VALUE IF NOT EXISTS 'restriction';
ALTER TYPE "DataSubjectRequestType" ADD VALUE IF NOT EXISTS 'consent_withdrawal';

ALTER TABLE "DataSubjectRequest" ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3);
ALTER TABLE "DataSubjectRequest" ADD COLUMN IF NOT EXISTS "dueAt" TIMESTAMP(3);

UPDATE "DataSubjectRequest"
SET "receivedAt" = "createdAt"
WHERE "receivedAt" IS NULL;

-- Existing open rows: dueAt left null until touched; new creates always set dueAt in app.
-- Do not invent backfilled working-day deadlines incorrectly in SQL.

CREATE INDEX IF NOT EXISTS "DataSubjectRequest_status_dueAt_idx"
  ON "DataSubjectRequest"("status", "dueAt");
