-- Phase 6B.1: Full payment policy, commission, payout fields
CREATE TYPE "PayoutStatus" AS ENUM ('not_ready', 'pending', 'eligible', 'paid', 'blocked');
CREATE TYPE "RefundStatus" AS ENUM ('none', 'pending', 'approved', 'rejected', 'processed');

ALTER TABLE "Payment" ADD COLUMN "bookingTotalAmount" DECIMAL(10,2);
ALTER TABLE "Payment" ADD COLUMN "customerPayableAmount" DECIMAL(10,2);
ALTER TABLE "Payment" ADD COLUMN "platformCommissionAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "customerServiceFeeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "ownerGrossAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "ownerNetPayoutAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "payoutStatus" "PayoutStatus" NOT NULL DEFAULT 'not_ready';
ALTER TABLE "Payment" ADD COLUMN "payoutAvailableAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "cancellationRefundAmount" DECIMAL(10,2);
ALTER TABLE "Payment" ADD COLUMN "cancellationPenaltyAmount" DECIMAL(10,2);
ALTER TABLE "Payment" ADD COLUMN "refundStatus" "RefundStatus" NOT NULL DEFAULT 'none';

UPDATE "Payment"
SET
  "bookingTotalAmount" = "amount",
  "customerPayableAmount" = "amount",
  "ownerGrossAmount" = "amount",
  "ownerNetPayoutAmount" = ROUND("amount" * 0.88, 2),
  "platformCommissionAmount" = ROUND("amount" * 0.12, 2)
WHERE "bookingTotalAmount" IS NULL;

ALTER TABLE "Payment" ALTER COLUMN "bookingTotalAmount" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "customerPayableAmount" SET NOT NULL;

CREATE INDEX "Payment_payoutStatus_idx" ON "Payment"("payoutStatus");
