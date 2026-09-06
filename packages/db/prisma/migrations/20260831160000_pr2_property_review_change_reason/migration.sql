-- PR-2: durable owner-safe Property change-request reason (additive only).
-- Existing rows remain unchanged (nullable columns, no backfill).

ALTER TABLE "Property" ADD COLUMN "reviewChangeReason" TEXT;
ALTER TABLE "Property" ADD COLUMN "reviewChangeRequestedAt" TIMESTAMP(3);
