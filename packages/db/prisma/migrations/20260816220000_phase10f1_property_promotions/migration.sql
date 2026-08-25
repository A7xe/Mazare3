-- CreateEnum
CREATE TYPE "PromotionDiscountType" AS ENUM ('percentage', 'fixed_amount');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('draft', 'active', 'paused', 'expired');

-- CreateTable
CREATE TABLE "PropertyPromotion" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "discountType" "PromotionDiscountType" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "period" "AvailabilityPeriod",
    "status" "PromotionStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyPromotion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "originalSlotPrice" DECIMAL(10,2);
ALTER TABLE "Booking" ADD COLUMN "promotionDiscountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "promotionId" TEXT;

UPDATE "Booking" SET "originalSlotPrice" = "totalAmount" WHERE "originalSlotPrice" IS NULL;

ALTER TABLE "Booking" ALTER COLUMN "originalSlotPrice" SET NOT NULL;

-- CreateIndex
CREATE INDEX "PropertyPromotion_propertyId_status_idx" ON "PropertyPromotion"("propertyId", "status");
CREATE INDEX "PropertyPromotion_status_startsAt_endsAt_idx" ON "PropertyPromotion"("status", "startsAt", "endsAt");
CREATE INDEX "Booking_promotionId_idx" ON "Booking"("promotionId");

-- AddForeignKey
ALTER TABLE "PropertyPromotion" ADD CONSTRAINT "PropertyPromotion_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "PropertyPromotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
