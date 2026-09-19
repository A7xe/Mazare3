-- Phase 3C.4A.3 — Force majeure Customer resolution election (additive)

CREATE TYPE "ForceMajeureCustomerChoice" AS ENUM ('FULL_REFUND', 'EQUIVALENT_RESCHEDULE');

ALTER TABLE "BookingIncident" ADD COLUMN IF NOT EXISTS "customerResolutionChoice" "ForceMajeureCustomerChoice";
ALTER TABLE "BookingIncident" ADD COLUMN IF NOT EXISTS "customerResolutionChosenAt" TIMESTAMP(3);
ALTER TABLE "BookingIncident" ADD COLUMN IF NOT EXISTS "customerResolutionChosenByUserId" TEXT;
ALTER TABLE "BookingIncident" ADD COLUMN IF NOT EXISTS "customerResolutionSource" TEXT;
ALTER TABLE "BookingIncident" ADD COLUMN IF NOT EXISTS "customerChosenTargetSlotId" TEXT;
ALTER TABLE "BookingIncident" ADD COLUMN IF NOT EXISTS "customerResolutionInvalidatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "BookingIncident_customerResolutionChosenByUserId_idx"
  ON "BookingIncident"("customerResolutionChosenByUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BookingIncident_customerResolutionChosenByUserId_fkey'
  ) THEN
    ALTER TABLE "BookingIncident"
      ADD CONSTRAINT "BookingIncident_customerResolutionChosenByUserId_fkey"
      FOREIGN KEY ("customerResolutionChosenByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
