CREATE TABLE "PlatformCoupon" (
    "id" TEXT NOT NULL,
    "normalizedCode" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "discountType" "PromotionDiscountType" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "minBookingAmount" DECIMAL(10,2),
    "maxUses" INTEGER,
    "maxUsesPerCustomer" INTEGER NOT NULL DEFAULT 1,
    "propertyId" TEXT,
    "status" "PromotionStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformCoupon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformCouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CouponRedemptionStatus" NOT NULL DEFAULT 'reserved',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformCouponRedemption_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Booking" ADD COLUMN "platformCouponId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "platformCouponCodeSnapshot" TEXT;
ALTER TABLE "Booking" ADD COLUMN "platformDiscountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "merchantBookingValue" DECIMAL(10,2);
ALTER TABLE "Booking" ADD COLUMN "commissionBasisAmount" DECIMAL(10,2);

CREATE UNIQUE INDEX "PlatformCoupon_normalizedCode_key" ON "PlatformCoupon"("normalizedCode");
CREATE INDEX "PlatformCoupon_status_startsAt_endsAt_idx" ON "PlatformCoupon"("status", "startsAt", "endsAt");
CREATE INDEX "PlatformCoupon_propertyId_status_idx" ON "PlatformCoupon"("propertyId", "status");
CREATE UNIQUE INDEX "PlatformCouponRedemption_bookingId_key" ON "PlatformCouponRedemption"("bookingId");
CREATE INDEX "PlatformCouponRedemption_couponId_status_idx" ON "PlatformCouponRedemption"("couponId", "status");
CREATE INDEX "PlatformCouponRedemption_couponId_userId_status_idx" ON "PlatformCouponRedemption"("couponId", "userId", "status");
CREATE INDEX "Booking_platformCouponId_idx" ON "Booking"("platformCouponId");

ALTER TABLE "PlatformCoupon" ADD CONSTRAINT "PlatformCoupon_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformCouponRedemption" ADD CONSTRAINT "PlatformCouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "PlatformCoupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformCouponRedemption" ADD CONSTRAINT "PlatformCouponRedemption_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformCouponRedemption" ADD CONSTRAINT "PlatformCouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_platformCouponId_fkey" FOREIGN KEY ("platformCouponId") REFERENCES "PlatformCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
