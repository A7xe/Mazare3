-- Phase 1 — Mazare3 Jordan Fair Marketplace financial policy (additive)
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cancellationReasonCode" TEXT;
