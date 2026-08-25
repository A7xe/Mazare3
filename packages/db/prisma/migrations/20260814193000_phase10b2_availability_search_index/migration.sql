-- Phase 10B.2: additive search index for date/period availability marketplace queries.
-- Non-destructive. Does not alter existing slot or booking rows.

CREATE INDEX IF NOT EXISTS "AvailabilitySlot_date_status_period_idx"
ON "AvailabilitySlot"("date", "status", "period");
