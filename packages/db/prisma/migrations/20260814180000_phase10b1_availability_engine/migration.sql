-- Phase 10B.1: real availability engine (additive, non-destructive)
-- Existing AvailabilitySlot rows keep source=legacy and NULL startAt/endAt.
-- Existing Booking rows keep usesLegacyTiming=true and NULL bookingStartAt/endAt.

CREATE TYPE "AvailabilitySlotSource" AS ENUM ('legacy', 'generated', 'manual');

CREATE TABLE "PropertyAvailabilityRule" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "period" "AvailabilityPeriod" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyAvailabilityRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PropertyAvailabilityRule_weekday_check" CHECK ("weekday" >= 0 AND "weekday" <= 6),
    CONSTRAINT "PropertyAvailabilityRule_price_nonneg" CHECK ("price" >= 0)
);

CREATE UNIQUE INDEX "PropertyAvailabilityRule_propertyId_weekday_period_key"
    ON "PropertyAvailabilityRule"("propertyId", "weekday", "period");

CREATE INDEX "PropertyAvailabilityRule_propertyId_idx"
    ON "PropertyAvailabilityRule"("propertyId");

ALTER TABLE "PropertyAvailabilityRule"
    ADD CONSTRAINT "PropertyAvailabilityRule_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AvailabilitySlot"
    ADD COLUMN "startAt" TIMESTAMP(3),
    ADD COLUMN "endAt" TIMESTAMP(3),
    ADD COLUMN "source" "AvailabilitySlotSource" NOT NULL DEFAULT 'legacy',
    ADD COLUMN "ruleId" TEXT,
    ADD COLUMN "priceOverridden" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AvailabilitySlot"
    ADD CONSTRAINT "AvailabilitySlot_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "PropertyAvailabilityRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AvailabilitySlot_propertyId_startAt_endAt_idx"
    ON "AvailabilitySlot"("propertyId", "startAt", "endAt");

ALTER TABLE "Booking"
    ADD COLUMN "bookingStartAt" TIMESTAMP(3),
    ADD COLUMN "bookingEndAt" TIMESTAMP(3),
    ADD COLUMN "usesLegacyTiming" BOOLEAN NOT NULL DEFAULT true;
