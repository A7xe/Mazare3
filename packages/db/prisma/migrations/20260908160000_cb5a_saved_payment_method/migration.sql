-- CB-5A: additive SavedPaymentMethod vault (persistent PayTabs token only; never PAN/CVV).
CREATE TABLE "SavedPaymentMethod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerTokenCipher" TEXT NOT NULL,
    "providerTokenFingerprint" TEXT NOT NULL,
    "providerOriginalTransactionRef" TEXT,
    "brand" TEXT,
    "maskedDisplay" TEXT,
    "last4" TEXT,
    "expiryMonth" INTEGER,
    "expiryYear" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedPaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedPaymentMethod_userId_provider_providerTokenFingerprint_key"
  ON "SavedPaymentMethod"("userId", "provider", "providerTokenFingerprint");

CREATE INDEX "SavedPaymentMethod_userId_revokedAt_idx"
  ON "SavedPaymentMethod"("userId", "revokedAt");

CREATE INDEX "SavedPaymentMethod_userId_isDefault_idx"
  ON "SavedPaymentMethod"("userId", "isDefault");

ALTER TABLE "SavedPaymentMethod"
  ADD CONSTRAINT "SavedPaymentMethod_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
