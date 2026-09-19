-- Phase 3C.4E.4B — Booking visit outcome (additive; no historical backfill).
-- LOCAL/DEV only. Do not apply to Production without explicit rollout.

CREATE TYPE "BookingVisitOutcome" AS ENUM (
  'pending_visit',
  'checked_in',
  'completed',
  'customer_no_show',
  'owner_no_show',
  'access_denied',
  'force_majeure',
  'disputed',
  'resolved_other'
);

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "visitOutcome" "BookingVisitOutcome",
  ADD COLUMN IF NOT EXISTS "visitOutcomeAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "visitOutcomeSource" TEXT;

CREATE INDEX IF NOT EXISTS "Booking_visitOutcome_status_idx"
  ON "Booking"("visitOutcome", "status");
