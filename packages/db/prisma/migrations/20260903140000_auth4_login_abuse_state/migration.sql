-- AUTH-4: identifier-aware login abuse state (temporary cooldown, not permanent lockout).
-- Additive only. identifierKey stores HMAC digest — never raw email.

CREATE TABLE IF NOT EXISTS "LoginAbuseState" (
    "identifierKey" TEXT NOT NULL,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cooldownUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAbuseState_pkey" PRIMARY KEY ("identifierKey")
);

CREATE INDEX IF NOT EXISTS "LoginAbuseState_expiresAt_idx" ON "LoginAbuseState"("expiresAt");
CREATE INDEX IF NOT EXISTS "LoginAbuseState_cooldownUntil_idx" ON "LoginAbuseState"("cooldownUntil");
