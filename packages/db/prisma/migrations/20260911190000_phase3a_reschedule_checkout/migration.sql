-- Phase 3A — reschedule checkout (additive only)

-- Enum extensions
ALTER TYPE "PaymentPurpose" ADD VALUE IF NOT EXISTS 'reschedule_difference';
ALTER TYPE "BookingRescheduleRequestStatus" ADD VALUE IF NOT EXISTS 'accepted_pending_payment';
ALTER TYPE "AvailabilitySlotStatus" ADD VALUE IF NOT EXISTS 'held';

-- BookingRescheduleRequest pricing / hold snapshots
ALTER TABLE "BookingRescheduleRequest" ADD COLUMN IF NOT EXISTS "customerPayableDelta" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "BookingRescheduleRequest" ADD COLUMN IF NOT EXISTS "ownerAbsorbsAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "BookingRescheduleRequest" ADD COLUMN IF NOT EXISTS "pricingMode" TEXT;
ALTER TABLE "BookingRescheduleRequest" ADD COLUMN IF NOT EXISTS "listToMerchantValue" DECIMAL(10,2);
ALTER TABLE "BookingRescheduleRequest" ADD COLUMN IF NOT EXISTS "deltaPaymentId" TEXT;
ALTER TABLE "BookingRescheduleRequest" ADD COLUMN IF NOT EXISTS "targetSlotHeldUntil" TIMESTAMP(3);
ALTER TABLE "BookingRescheduleRequest" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "BookingRescheduleRequest" ADD COLUMN IF NOT EXISTS "customerContractedValue" DECIMAL(10,2);
ALTER TABLE "BookingRescheduleRequest" ADD COLUMN IF NOT EXISTS "commissionBasisValue" DECIMAL(10,2);

-- Backfill Phase 2 rows before NOT NULL
UPDATE "BookingRescheduleRequest"
SET
  "customerContractedValue" = COALESCE("customerContractedValue", "toMerchantValue"),
  "commissionBasisValue" = COALESCE("commissionBasisValue", "toMerchantValue"),
  "listToMerchantValue" = COALESCE("listToMerchantValue", "toMerchantValue"),
  "pricingMode" = COALESCE("pricingMode", 'customer_market')
WHERE "customerContractedValue" IS NULL
   OR "commissionBasisValue" IS NULL
   OR "pricingMode" IS NULL;

ALTER TABLE "BookingRescheduleRequest" ALTER COLUMN "customerContractedValue" SET NOT NULL;
ALTER TABLE "BookingRescheduleRequest" ALTER COLUMN "commissionBasisValue" SET NOT NULL;
ALTER TABLE "BookingRescheduleRequest" ALTER COLUMN "pricingMode" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "BookingRescheduleRequest_deltaPaymentId_key"
  ON "BookingRescheduleRequest"("deltaPaymentId");
CREATE INDEX IF NOT EXISTS "BookingRescheduleRequest_status_expiresAt_idx"
  ON "BookingRescheduleRequest"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "BookingRescheduleRequest_status_targetSlotHeldUntil_idx"
  ON "BookingRescheduleRequest"("status", "targetSlotHeldUntil");

-- Payment link to reschedule delta
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "rescheduleRequestId" TEXT;
CREATE INDEX IF NOT EXISTS "Payment_rescheduleRequestId_idx" ON "Payment"("rescheduleRequestId");
