-- Additive: snapshot columns on Booking (10C.1 follow-up; prior migration did not add them)

DO $$ BEGIN
  CREATE TYPE "CommissionSource" AS ENUM ('property_terms', 'owner_terms', 'platform_default');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "commercialTermsId" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "commissionSource" "CommissionSource";
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "ownerPayoutDelayHours" INTEGER;

DO $$ BEGIN
  ALTER TABLE "Booking"
    ADD CONSTRAINT "Booking_commercialTermsId_fkey"
    FOREIGN KEY ("commercialTermsId") REFERENCES "PartnerCommercialTerms"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;
