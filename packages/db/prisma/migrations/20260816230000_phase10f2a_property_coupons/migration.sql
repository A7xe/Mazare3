-- CreateEnum
CREATE TYPE "CouponRedemptionStatus" AS ENUM ('reserved', 'redeemed', 'released');

-- CreateTable
CREATE TABLE "PropertyCoupon" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "normalizedCode" TEXT NOT NULL,
    "discountType" "PromotionDiscountType" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "minBookingAmount" DECIMAL(10,2),
    "maxUses" INTEGER,
    "maxUsesPerCustomer" INTEGER NOT NULL DEFAULT 1,
    "status" "PromotionStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CouponRedemptionStatus" NOT NULL DEFAULT 'reserved',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "couponId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "couponCodeSnapshot" TEXT;
ALTER TABLE "Booking" ADD COLUMN "couponDiscountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "priceBeforeCoupon" DECIMAL(10,2);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyCoupon_propertyId_normalizedCode_key" ON "PropertyCoupon"("propertyId", "normalizedCode");
CREATE INDEX "PropertyCoupon_propertyId_status_idx" ON "PropertyCoupon"("propertyId", "status");
CREATE INDEX "PropertyCoupon_status_startsAt_endsAt_idx" ON "PropertyCoupon"("status", "startsAt", "endsAt");
CREATE UNIQUE INDEX "CouponRedemption_bookingId_key" ON "CouponRedemption"("bookingId");
CREATE INDEX "CouponRedemption_couponId_status_idx" ON "CouponRedemption"("couponId", "status");
CREATE INDEX "CouponRedemption_couponId_userId_status_idx" ON "CouponRedemption"("couponId", "userId", "status");
CREATE INDEX "Booking_couponId_idx" ON "Booking"("couponId");

-- AddForeignKey
ALTER TABLE "PropertyCoupon" ADD CONSTRAINT "PropertyCoupon_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "PropertyCoupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "PropertyCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
