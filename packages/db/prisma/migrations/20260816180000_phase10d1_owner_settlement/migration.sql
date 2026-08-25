CREATE TYPE "OwnerSettlementStatus" AS ENUM ('draft', 'ready', 'paid', 'cancelled');

CREATE TABLE "OwnerSettlement" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "status" "OwnerSettlementStatus" NOT NULL DEFAULT 'draft',
  "itemCount" INTEGER NOT NULL DEFAULT 0,
  "grossBookingAmount" DECIMAL(10,2) NOT NULL,
  "platformCommissionTotal" DECIMAL(10,2) NOT NULL,
  "refundAdjustmentTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "ownerNetAmount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'JOD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "finalizedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "paymentReference" TEXT,
  "adminNote" TEXT,

  CONSTRAINT "OwnerSettlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OwnerSettlementItem" (
  "id" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "payoutId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "publicCode" TEXT NOT NULL,
  "bookingDate" DATE NOT NULL,
  "bookingTotalAmount" DECIMAL(10,2) NOT NULL,
  "platformCommissionAmount" DECIMAL(10,2) NOT NULL,
  "ownerNetPayoutAmount" DECIMAL(10,2) NOT NULL,
  "payoutAmount" DECIMAL(10,2) NOT NULL,
  "refundAdjustmentAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "releasedAt" TIMESTAMP(3),

  CONSTRAINT "OwnerSettlementItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OwnerSettlement_ownerId_status_idx" ON "OwnerSettlement"("ownerId", "status");
CREATE INDEX "OwnerSettlement_status_idx" ON "OwnerSettlement"("status");
CREATE INDEX "OwnerSettlementItem_settlementId_idx" ON "OwnerSettlementItem"("settlementId");
CREATE INDEX "OwnerSettlementItem_payoutId_idx" ON "OwnerSettlementItem"("payoutId");
CREATE INDEX "OwnerSettlementItem_paymentId_idx" ON "OwnerSettlementItem"("paymentId");
CREATE INDEX "OwnerSettlementItem_bookingId_idx" ON "OwnerSettlementItem"("bookingId");

CREATE UNIQUE INDEX "OwnerSettlementItem_payoutId_active_key"
  ON "OwnerSettlementItem"("payoutId")
  WHERE "releasedAt" IS NULL;

CREATE UNIQUE INDEX "OwnerSettlementItem_paymentId_active_key"
  ON "OwnerSettlementItem"("paymentId")
  WHERE "releasedAt" IS NULL;

ALTER TABLE "OwnerSettlement"
  ADD CONSTRAINT "OwnerSettlement_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "OwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OwnerSettlementItem"
  ADD CONSTRAINT "OwnerSettlementItem_settlementId_fkey"
  FOREIGN KEY ("settlementId") REFERENCES "OwnerSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OwnerSettlementItem"
  ADD CONSTRAINT "OwnerSettlementItem_payoutId_fkey"
  FOREIGN KEY ("payoutId") REFERENCES "OwnerPayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
