-- Phase 3C.4D.6 — Immutable Booking-time listing snapshot (additive)
-- Local/dev only. No legacy snapshot backfill. Production: DO NOT APPLY.

DO $$ BEGIN
  CREATE TYPE "BookingPropertySnapshotKind" AS ENUM ('initial');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "PropertyMedia"
  ADD COLUMN IF NOT EXISTS "removedFromListingAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "PropertyMedia_propertyId_removedFromListingAt_idx"
  ON "PropertyMedia"("propertyId", "removedFromListingAt");

CREATE TABLE IF NOT EXISTS "BookingPropertySnapshot" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "kind" "BookingPropertySnapshotKind" NOT NULL DEFAULT 'initial',
  "schemaVersion" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "propertyUpdatedAt" TIMESTAMP(3),
  "payload" JSONB NOT NULL,
  "integrityHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingPropertySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BookingPropertySnapshot_bookingId_kind_key"
  ON "BookingPropertySnapshot"("bookingId", "kind");
CREATE INDEX IF NOT EXISTS "BookingPropertySnapshot_propertyId_idx"
  ON "BookingPropertySnapshot"("propertyId");
CREATE INDEX IF NOT EXISTS "BookingPropertySnapshot_createdAt_idx"
  ON "BookingPropertySnapshot"("createdAt");

DO $$ BEGIN
  ALTER TABLE "BookingPropertySnapshot"
    ADD CONSTRAINT "BookingPropertySnapshot_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Booking.propertyId: Restrict delete so historical Bookings are not cascaded away with Property
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_propertyId_fkey";
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- No fabricated legacy BookingPropertySnapshot rows.
