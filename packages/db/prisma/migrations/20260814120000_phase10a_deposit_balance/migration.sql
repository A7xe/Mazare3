-- Phase 10A: deposit + remaining balance (non-destructive)
-- Existing bookings/payments are backfilled as full payment (purpose=full).

CREATE TYPE "PaymentCollectionMode" AS ENUM ('full', 'deposit_balance');
CREATE TYPE "BookingPaymentState" AS ENUM (
  'unpaid',
  'deposit_pending',
  'deposit_paid',
  'balance_pending',
  'fully_paid',
  'balance_overdue',
  'partially_refunded',
  'refunded'
);
CREATE TYPE "PaymentPurpose" AS ENUM ('full', 'deposit', 'balance');

ALTER TABLE "Property" ADD COLUMN "depositPercent" DECIMAL(5,2);

ALTER TABLE "Payment" ADD COLUMN "purpose" "PaymentPurpose" NOT NULL DEFAULT 'full';

ALTER TABLE "Booking"
  ADD COLUMN "paymentCollectionMode" "PaymentCollectionMode",
  ADD COLUMN "paymentState" "BookingPaymentState",
  ADD COLUMN "depositPercent" DECIMAL(5,2),
  ADD COLUMN "depositAmount" DECIMAL(10,2),
  ADD COLUMN "remainingAmount" DECIMAL(10,2),
  ADD COLUMN "platformCommissionPercent" DECIMAL(5,2),
  ADD COLUMN "platformCommissionAmount" DECIMAL(10,2),
  ADD COLUMN "ownerNetPayoutAmount" DECIMAL(10,2),
  ADD COLUMN "customerServiceFeeAmount" DECIMAL(10,2),
  ADD COLUMN "customerPayableTotal" DECIMAL(10,2),
  ADD COLUMN "balanceDueAt" TIMESTAMP(3),
  ADD COLUMN "holdExpiresAt" TIMESTAMP(3),
  ADD COLUMN "depositPaidAt" TIMESTAMP(3),
  ADD COLUMN "fullyPaidAt" TIMESTAMP(3);

-- Legacy rows: treat as 100% full payment snapshots (commission 12% fallback, then overlay from Payment).
UPDATE "Booking" AS b
SET
  "paymentCollectionMode" = 'full',
  "depositPercent" = 100,
  "depositAmount" = b."totalAmount",
  "remainingAmount" = 0,
  "platformCommissionPercent" = 12,
  "platformCommissionAmount" = ROUND(b."totalAmount" * 0.12, 2),
  "ownerNetPayoutAmount" = ROUND(b."totalAmount" - ROUND(b."totalAmount" * 0.12, 2), 2),
  "customerServiceFeeAmount" = 0,
  "customerPayableTotal" = b."totalAmount",
  "paymentState" = CASE
    WHEN EXISTS (
      SELECT 1 FROM "Payment" p
      WHERE p."bookingId" = b.id AND p.status = 'succeeded'
    ) THEN 'fully_paid'::"BookingPaymentState"
    ELSE 'unpaid'::"BookingPaymentState"
  END,
  "fullyPaidAt" = (
    SELECT p."succeededAt"
    FROM "Payment" p
    WHERE p."bookingId" = b.id AND p.status = 'succeeded'
    ORDER BY p."succeededAt" ASC NULLS LAST
    LIMIT 1
  ),
  "depositPaidAt" = (
    SELECT p."succeededAt"
    FROM "Payment" p
    WHERE p."bookingId" = b.id AND p.status = 'succeeded'
    ORDER BY p."succeededAt" ASC NULLS LAST
    LIMIT 1
  );

UPDATE "Booking" AS b
SET
  "platformCommissionAmount" = p."platformCommissionAmount",
  "ownerNetPayoutAmount" = p."ownerNetPayoutAmount",
  "customerServiceFeeAmount" = COALESCE(p."customerServiceFeeAmount", 0),
  "customerPayableTotal" = p."customerPayableAmount"
FROM (
  SELECT DISTINCT ON ("bookingId")
    "bookingId",
    "platformCommissionAmount",
    "ownerNetPayoutAmount",
    "customerServiceFeeAmount",
    "customerPayableAmount"
  FROM "Payment"
  WHERE status = 'succeeded'
  ORDER BY "bookingId", "createdAt" DESC
) AS p
WHERE p."bookingId" = b.id;

ALTER TABLE "Booking"
  ALTER COLUMN "paymentCollectionMode" SET DEFAULT 'deposit_balance',
  ALTER COLUMN "paymentCollectionMode" SET NOT NULL,
  ALTER COLUMN "paymentState" SET DEFAULT 'unpaid',
  ALTER COLUMN "paymentState" SET NOT NULL,
  ALTER COLUMN "depositPercent" SET NOT NULL,
  ALTER COLUMN "depositAmount" SET NOT NULL,
  ALTER COLUMN "remainingAmount" SET NOT NULL,
  ALTER COLUMN "platformCommissionPercent" SET NOT NULL,
  ALTER COLUMN "platformCommissionAmount" SET NOT NULL,
  ALTER COLUMN "ownerNetPayoutAmount" SET NOT NULL,
  ALTER COLUMN "customerServiceFeeAmount" SET DEFAULT 0,
  ALTER COLUMN "customerServiceFeeAmount" SET NOT NULL,
  ALTER COLUMN "customerPayableTotal" SET NOT NULL;

CREATE INDEX "Booking_paymentState_idx" ON "Booking"("paymentState");
CREATE INDEX "Booking_holdExpiresAt_idx" ON "Booking"("holdExpiresAt");
CREATE INDEX "Booking_balanceDueAt_idx" ON "Booking"("balanceDueAt");
CREATE INDEX "Payment_bookingId_purpose_status_idx" ON "Payment"("bookingId", "purpose", "status");
