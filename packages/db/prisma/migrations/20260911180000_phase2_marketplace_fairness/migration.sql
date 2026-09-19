-- Phase 2 — Mazare3 Jordan Fair Marketplace fairness (additive)

-- Extend DisputeType
ALTER TYPE "DisputeType" ADD VALUE IF NOT EXISTS 'customer_no_show';
ALTER TYPE "DisputeType" ADD VALUE IF NOT EXISTS 'owner_no_show';
ALTER TYPE "DisputeType" ADD VALUE IF NOT EXISTS 'force_majeure';

-- New enums
CREATE TYPE "CheckInStatus" AS ENUM ('not_open', 'available', 'verified', 'disputed', 'expired');
CREATE TYPE "OwnerCancellationReason" AS ENUM (
  'property_unavailable', 'owner_emergency', 'maintenance_failure',
  'double_booking_owner_fault', 'property_damage', 'access_problem',
  'force_majeure', 'other'
);
CREATE TYPE "BookingIncidentType" AS ENUM (
  'customer_no_show_report', 'owner_no_show_report', 'access_denied_report',
  'property_unavailable_report', 'force_majeure', 'check_in_dispute'
);
CREATE TYPE "BookingIncidentStatus" AS ENUM ('open', 'under_review', 'confirmed', 'rejected', 'resolved');
CREATE TYPE "OwnerReliabilityCategory" AS ENUM (
  'owner_cancel', 'owner_no_show', 'access_denied', 'approval_timeout',
  'force_majeure', 'admin_confirmed', 'waived'
);
CREATE TYPE "OwnerFinancialAdjustmentStatus" AS ENUM ('pending', 'applied', 'waived');
CREATE TYPE "OwnerFinancialAdjustmentType" AS ENUM (
  'owner_cancel_penalty', 'owner_no_show_penalty', 'access_denied_penalty', 'other'
);
CREATE TYPE "BookingRescheduleRequestStatus" AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'expired');
CREATE TYPE "BookingRescheduleRequestedBy" AS ENUM ('customer', 'owner', 'admin');
CREATE TYPE "Mazare3GoodwillCreditStatus" AS ENUM ('pending', 'issued', 'cancelled');

-- Booking additive columns
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "originalBookingStartAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "latestRescheduledAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "rescheduleCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "checkInStatus" "CheckInStatus" NOT NULL DEFAULT 'not_open';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "checkInCodeHash" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "checkInCodeSalt" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "checkInVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "checkInExpiresAt" TIMESTAMP(3);

-- BookingIncident
CREATE TABLE IF NOT EXISTS "BookingIncident" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "type" "BookingIncidentType" NOT NULL,
  "status" "BookingIncidentStatus" NOT NULL DEFAULT 'open',
  "openedByUserId" TEXT NOT NULL,
  "reason" TEXT,
  "evidenceText" TEXT,
  "adminNote" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingIncident_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BookingIncident_bookingId_status_idx" ON "BookingIncident"("bookingId", "status");
CREATE INDEX IF NOT EXISTS "BookingIncident_type_status_idx" ON "BookingIncident"("type", "status");
ALTER TABLE "BookingIncident" ADD CONSTRAINT "BookingIncident_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingIncident" ADD CONSTRAINT "BookingIncident_openedByUserId_fkey"
  FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OwnerReliabilityIncident
CREATE TABLE IF NOT EXISTS "OwnerReliabilityIncident" (
  "id" TEXT NOT NULL,
  "ownerProfileId" TEXT NOT NULL,
  "bookingId" TEXT,
  "category" "OwnerReliabilityCategory" NOT NULL,
  "reason" TEXT NOT NULL,
  "penaltyAmount" DECIMAL(10,2),
  "waived" BOOLEAN NOT NULL DEFAULT false,
  "waivedReason" TEXT,
  "waivedAt" TIMESTAMP(3),
  "waivedByUserId" TEXT,
  "adminNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OwnerReliabilityIncident_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OwnerReliabilityIncident_ownerProfileId_category_idx"
  ON "OwnerReliabilityIncident"("ownerProfileId", "category");
CREATE INDEX IF NOT EXISTS "OwnerReliabilityIncident_bookingId_idx" ON "OwnerReliabilityIncident"("bookingId");
ALTER TABLE "OwnerReliabilityIncident" ADD CONSTRAINT "OwnerReliabilityIncident_ownerProfileId_fkey"
  FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OwnerFinancialAdjustment
CREATE TABLE IF NOT EXISTS "OwnerFinancialAdjustment" (
  "id" TEXT NOT NULL,
  "ownerProfileId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "settlementId" TEXT,
  "type" "OwnerFinancialAdjustmentType" NOT NULL,
  "status" "OwnerFinancialAdjustmentStatus" NOT NULL DEFAULT 'pending',
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'JOD',
  "reason" TEXT NOT NULL,
  "adminNote" TEXT,
  "appliedAt" TIMESTAMP(3),
  "waivedAt" TIMESTAMP(3),
  "waivedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OwnerFinancialAdjustment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OwnerFinancialAdjustment_ownerProfileId_status_idx"
  ON "OwnerFinancialAdjustment"("ownerProfileId", "status");
CREATE INDEX IF NOT EXISTS "OwnerFinancialAdjustment_bookingId_idx" ON "OwnerFinancialAdjustment"("bookingId");
CREATE INDEX IF NOT EXISTS "OwnerFinancialAdjustment_settlementId_idx" ON "OwnerFinancialAdjustment"("settlementId");
ALTER TABLE "OwnerFinancialAdjustment" ADD CONSTRAINT "OwnerFinancialAdjustment_ownerProfileId_fkey"
  FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OwnerFinancialAdjustment" ADD CONSTRAINT "OwnerFinancialAdjustment_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OwnerFinancialAdjustment" ADD CONSTRAINT "OwnerFinancialAdjustment_settlementId_fkey"
  FOREIGN KEY ("settlementId") REFERENCES "OwnerSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- BookingRescheduleRequest
CREATE TABLE IF NOT EXISTS "BookingRescheduleRequest" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "requestedBy" "BookingRescheduleRequestedBy" NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "status" "BookingRescheduleRequestStatus" NOT NULL DEFAULT 'pending',
  "fromSlotId" TEXT NOT NULL,
  "toSlotId" TEXT NOT NULL,
  "fromMerchantValue" DECIMAL(10,2) NOT NULL,
  "toMerchantValue" DECIMAL(10,2) NOT NULL,
  "priceDelta" DECIMAL(10,2) NOT NULL,
  "exemptFromRescheduleLimit" BOOLEAN NOT NULL DEFAULT false,
  "exemptFromCancelAnchor" BOOLEAN NOT NULL DEFAULT false,
  "respondedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "adminNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingRescheduleRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BookingRescheduleRequest_bookingId_status_idx"
  ON "BookingRescheduleRequest"("bookingId", "status");
CREATE INDEX IF NOT EXISTS "BookingRescheduleRequest_requestedByUserId_idx"
  ON "BookingRescheduleRequest"("requestedByUserId");
ALTER TABLE "BookingRescheduleRequest" ADD CONSTRAINT "BookingRescheduleRequest_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingRescheduleRequest" ADD CONSTRAINT "BookingRescheduleRequest_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mazare3GoodwillCredit
CREATE TABLE IF NOT EXISTS "Mazare3GoodwillCredit" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "bookingId" TEXT,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'JOD',
  "reason" TEXT NOT NULL,
  "status" "Mazare3GoodwillCreditStatus" NOT NULL DEFAULT 'pending',
  "createdByAdminId" TEXT,
  "issuedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Mazare3GoodwillCredit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Mazare3GoodwillCredit_customerId_status_idx"
  ON "Mazare3GoodwillCredit"("customerId", "status");
CREATE INDEX IF NOT EXISTS "Mazare3GoodwillCredit_bookingId_idx" ON "Mazare3GoodwillCredit"("bookingId");
ALTER TABLE "Mazare3GoodwillCredit" ADD CONSTRAINT "Mazare3GoodwillCredit_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mazare3GoodwillCredit" ADD CONSTRAINT "Mazare3GoodwillCredit_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Mazare3GoodwillCredit" ADD CONSTRAINT "Mazare3GoodwillCredit_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
