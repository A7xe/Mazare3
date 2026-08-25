-- Phase 9A: in-app notifications foundation

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "roleTarget" "UserRole",
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");
CREATE INDEX "Notification_roleTarget_isRead_createdAt_idx" ON "Notification"("roleTarget", "isRead", "createdAt");
CREATE INDEX "Notification_type_entityId_userId_idx" ON "Notification"("type", "entityId", "userId");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
