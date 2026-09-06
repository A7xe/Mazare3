-- PR-5: owner-visible property rejection reason (additive only)
ALTER TABLE "Property" ADD COLUMN "reviewRejectionReason" TEXT;
ALTER TABLE "Property" ADD COLUMN "reviewRejectedAt" TIMESTAMP(3);
