CREATE TYPE "OwnerDecisionOutcome" AS ENUM ('accepted', 'rejected', 'timed_out');

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "ownerDecisionOutcome" "OwnerDecisionOutcome";

UPDATE "Booking" AS b
SET "ownerDecisionOutcome" = 'accepted'
FROM "AuditLog" AS a
WHERE b."ownerDecisionOutcome" IS NULL
  AND a."entityType" = 'booking'
  AND a."entityId" = b.id
  AND a.action = 'booking.owner_accepted';

UPDATE "Booking" AS b
SET "ownerDecisionOutcome" = 'rejected'
FROM "AuditLog" AS a
WHERE b."ownerDecisionOutcome" IS NULL
  AND a."entityType" = 'booking'
  AND a."entityId" = b.id
  AND a.action = 'booking.owner_rejected';

UPDATE "Booking" AS b
SET "ownerDecisionOutcome" = 'timed_out'
FROM "AuditLog" AS a
WHERE b."ownerDecisionOutcome" IS NULL
  AND a."entityType" = 'booking'
  AND a."entityId" = b.id
  AND a.action = 'booking.owner_approval_expired';

UPDATE "Booking"
SET "ownerDecisionOutcome" = 'accepted'
WHERE "ownerDecisionOutcome" IS NULL
  AND "instantBookingEnabled" = false
  AND "ownerDecisionAt" IS NOT NULL
  AND "holdExpiresAt" IS NOT NULL;

UPDATE "Booking"
SET "ownerDecisionOutcome" = 'rejected'
WHERE "ownerDecisionOutcome" IS NULL
  AND "instantBookingEnabled" = false
  AND "ownerDecisionAt" IS NOT NULL
  AND "holdExpiresAt" IS NULL
  AND status = 'cancelled';

UPDATE "Booking"
SET "ownerDecisionOutcome" = 'timed_out'
WHERE "ownerDecisionOutcome" IS NULL
  AND "instantBookingEnabled" = false
  AND "ownerDecisionAt" IS NULL
  AND status = 'expired'
  AND "ownerApprovalExpiresAt" IS NOT NULL;
