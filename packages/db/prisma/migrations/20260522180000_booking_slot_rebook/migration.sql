-- Drop one-booking-per-slot unique constraint so cancelled slots can be rebooked.
DROP INDEX IF EXISTS "Booking_availabilitySlotId_key";

-- Index for active-booking checks per slot
CREATE INDEX "Booking_availabilitySlotId_status_idx" ON "Booking"("availabilitySlotId", "status");
