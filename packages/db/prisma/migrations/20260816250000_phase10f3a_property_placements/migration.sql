-- CreateEnum
CREATE TYPE "PlacementType" AS ENUM ('featured', 'sponsored');

-- CreateTable
CREATE TABLE "PropertyPlacement" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "placementType" "PlacementType" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "PromotionStatus" NOT NULL DEFAULT 'draft',
    "adminNote" TEXT,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyPlacement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PropertyPlacement_propertyId_status_idx" ON "PropertyPlacement"("propertyId", "status");
CREATE INDEX "PropertyPlacement_status_startsAt_endsAt_idx" ON "PropertyPlacement"("status", "startsAt", "endsAt");
CREATE INDEX "PropertyPlacement_placementType_status_idx" ON "PropertyPlacement"("placementType", "status");

ALTER TABLE "PropertyPlacement" ADD CONSTRAINT "PropertyPlacement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyPlacement" ADD CONSTRAINT "PropertyPlacement_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
