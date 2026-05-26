-- Phase 5B: owner application fields on OwnerProfile
ALTER TABLE "OwnerProfile" ADD COLUMN "city" TEXT;
ALTER TABLE "OwnerProfile" ADD COLUMN "area" TEXT;
ALTER TABLE "OwnerProfile" ADD COLUMN "bio" TEXT;
ALTER TABLE "OwnerProfile" ADD COLUMN "approximateFarmCount" INTEGER;
ALTER TABLE "OwnerProfile" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
