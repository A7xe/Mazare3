-- Phase 3C.4E.2A — Multi-capture refund integrity (additive only).
-- LOCAL/DEV. Do not apply to Production in this phase.

CREATE TYPE "RefundAllocationStatus" AS ENUM ('pending', 'succeeded', 'failed', 'cancelled');

ALTER TABLE "RefundRequest"
  ADD COLUMN IF NOT EXISTS "refundedAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "RefundPaymentAllocation" (
  "id" TEXT NOT NULL,
  "refundRequestId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "allocatedAmount" DECIMAL(10, 2) NOT NULL,
  "refundedAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "status" "RefundAllocationStatus" NOT NULL DEFAULT 'pending',
  "providerRefundRef" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "lastAttemptAt" TIMESTAMP(3),
  "succeededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RefundPaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RefundPaymentAllocation_idempotencyKey_key"
  ON "RefundPaymentAllocation"("idempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "RefundPaymentAllocation_refundRequestId_paymentId_key"
  ON "RefundPaymentAllocation"("refundRequestId", "paymentId");

CREATE INDEX IF NOT EXISTS "RefundPaymentAllocation_paymentId_status_idx"
  ON "RefundPaymentAllocation"("paymentId", "status");

CREATE INDEX IF NOT EXISTS "RefundPaymentAllocation_refundRequestId_status_idx"
  ON "RefundPaymentAllocation"("refundRequestId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RefundPaymentAllocation_refundRequestId_fkey'
  ) THEN
    ALTER TABLE "RefundPaymentAllocation"
      ADD CONSTRAINT "RefundPaymentAllocation_refundRequestId_fkey"
      FOREIGN KEY ("refundRequestId") REFERENCES "RefundRequest"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RefundPaymentAllocation_paymentId_fkey'
  ) THEN
    ALTER TABLE "RefundPaymentAllocation"
      ADD CONSTRAINT "RefundPaymentAllocation_paymentId_fkey"
      FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
