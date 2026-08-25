-- Phase 10H.2A — additive arrival-instruction fields on Property.
-- Reuses existing city/area/address/coordinate columns. No drops, no rewrites.

ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "arrivalInstructionsAr" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "arrivalInstructionsEn" TEXT;
