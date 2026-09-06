-- AUTH-5: shared rate-limit buckets for multi-instance IP auth limiting.
-- Additive only. keyHash stores HMAC digest — never raw IP.

CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
    "id" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RateLimitBucket_namespace_keyHash_key"
  ON "RateLimitBucket"("namespace", "keyHash");

CREATE INDEX IF NOT EXISTS "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");
