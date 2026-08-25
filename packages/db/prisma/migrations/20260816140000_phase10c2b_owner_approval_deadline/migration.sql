ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "ownerApprovalExpiresAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Booking_ownerApprovalExpiresAt_idx" ON "Booking"("ownerApprovalExpiresAt");
