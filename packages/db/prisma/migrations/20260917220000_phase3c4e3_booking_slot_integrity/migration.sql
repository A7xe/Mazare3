-- Phase 3C.4E.3 — Database-level Booking slot exclusivity (DISCRETE SLOT model).
-- At most ONE inventory-holding Booking per AvailabilitySlot.
-- Prisma cannot express partial unique indexes; this SQL is authoritative.
-- LOCAL/DEV only in this phase — do not apply to Production without conflict preflight.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT b."availabilitySlotId"
      FROM "Booking" b
      WHERE b.status IN (
        'pending_owner_approval'::"BookingStatus",
        'pending_payment'::"BookingStatus",
        'pending'::"BookingStatus",
        'confirmed'::"BookingStatus"
      )
      GROUP BY b."availabilitySlotId"
      HAVING COUNT(*) > 1
    ) conflicts
  ) THEN
    RAISE EXCEPTION
      'BOOKING_SLOT_LEGACY_CONFLICT_MANUAL_REVIEW_REQUIRED: resolve duplicate holding Bookings before creating Booking_one_holding_per_availability_slot';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Booking_one_holding_per_availability_slot"
ON "Booking" ("availabilitySlotId")
WHERE status IN (
  'pending_owner_approval',
  'pending_payment',
  'pending',
  'confirmed'
);

COMMENT ON INDEX "Booking_one_holding_per_availability_slot" IS
  'Phase 3C.4E.3: at most one inventory-holding Booking per AvailabilitySlot';
