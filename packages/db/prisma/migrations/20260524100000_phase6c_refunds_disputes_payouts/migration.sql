-- Phase 6C: Refund requests, disputes, owner payout operations (internal only)

CREATE TYPE "RefundRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'processed', 'cancelled');
CREATE TYPE "DisputeType" AS ENUM ('property_mismatch', 'owner_cancelled', 'access_problem', 'cleanliness_issue', 'other');
CREATE TYPE "DisputeStatus" AS ENUM ('open', 'under_review', 'resolved', 'rejected');
CREATE TYPE "OwnerPayoutRecordStatus" AS ENUM ('pending', 'eligible', 'paid', 'blocked', 'cancelled');

CREATE TABLE "RefundRequest" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "policyRefundAmount" DECIMAL(10,2) NOT NULL,
    "requestedAmount" DECIMAL(10,2) NOT NULL,
    "approvedAmount" DECIMAL(10,2),
    "status" "RefundRequestStatus" NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "openedByUserId" TEXT NOT NULL,
    "type" "DisputeType" NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'open',
    "description" TEXT NOT NULL,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OwnerPayout" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "status" "OwnerPayoutRecordStatus" NOT NULL DEFAULT 'eligible',
    "periodFrom" DATE NOT NULL,
    "periodTo" DATE NOT NULL,
    "paidAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "manualReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerPayout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RefundRequest_bookingId_status_idx" ON "RefundRequest"("bookingId", "status");
CREATE INDEX "RefundRequest_customerId_status_idx" ON "RefundRequest"("customerId", "status");
CREATE INDEX "RefundRequest_paymentId_idx" ON "RefundRequest"("paymentId");

CREATE INDEX "Dispute_bookingId_status_idx" ON "Dispute"("bookingId", "status");
CREATE INDEX "Dispute_openedByUserId_idx" ON "Dispute"("openedByUserId");

CREATE UNIQUE INDEX "OwnerPayout_paymentId_key" ON "OwnerPayout"("paymentId");
CREATE INDEX "OwnerPayout_ownerId_status_idx" ON "OwnerPayout"("ownerId", "status");
CREATE INDEX "OwnerPayout_bookingId_idx" ON "OwnerPayout"("bookingId");

ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OwnerPayout" ADD CONSTRAINT "OwnerPayout_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "OwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OwnerPayout" ADD CONSTRAINT "OwnerPayout_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
