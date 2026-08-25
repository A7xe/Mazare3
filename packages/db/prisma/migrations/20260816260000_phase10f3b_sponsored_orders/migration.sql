-- CreateEnum
CREATE TYPE "CatalogPackageStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "SponsoredOrderStatus" AS ENUM ('pending_review', 'approved_pending_payment', 'paid', 'active', 'completed', 'rejected', 'cancelled');

-- CreateTable
CREATE TABLE "SponsoredPlacementPackage" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "priceAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "status" "CatalogPackageStatus" NOT NULL DEFAULT 'inactive',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsoredPlacementPackage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SponsoredPlacementPackage_status_idx" ON "SponsoredPlacementPackage"("status");

-- CreateTable
CREATE TABLE "SponsoredPlacementOrder" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "packageId" TEXT,
    "packageNameArSnapshot" TEXT NOT NULL,
    "packageNameEnSnapshot" TEXT NOT NULL,
    "durationDaysSnapshot" INTEGER NOT NULL,
    "priceAmountSnapshot" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "advertisingRevenueAmount" DECIMAL(10,2),
    "status" "SponsoredOrderStatus" NOT NULL DEFAULT 'pending_review',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "paymentDate" DATE,
    "adminNote" TEXT,
    "placementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsoredPlacementOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SponsoredPlacementOrder_placementId_key" ON "SponsoredPlacementOrder"("placementId");
CREATE INDEX "SponsoredPlacementOrder_ownerId_status_idx" ON "SponsoredPlacementOrder"("ownerId", "status");
CREATE INDEX "SponsoredPlacementOrder_propertyId_status_idx" ON "SponsoredPlacementOrder"("propertyId", "status");
CREATE INDEX "SponsoredPlacementOrder_status_idx" ON "SponsoredPlacementOrder"("status");

ALTER TABLE "SponsoredPlacementOrder" ADD CONSTRAINT "SponsoredPlacementOrder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "OwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SponsoredPlacementOrder" ADD CONSTRAINT "SponsoredPlacementOrder_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SponsoredPlacementOrder" ADD CONSTRAINT "SponsoredPlacementOrder_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "SponsoredPlacementPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SponsoredPlacementOrder" ADD CONSTRAINT "SponsoredPlacementOrder_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "PropertyPlacement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
