-- Existing listings currently behave as instant checkout; keep that until an owner opts out.
UPDATE "Property" SET "instantBookingEnabled" = true;

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "instantBookingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "ownerDecisionAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "ownerDecisionReason" TEXT;
