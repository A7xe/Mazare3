-- Phase 10H.3B — additive customer support tickets.
-- Communication only. No booking/payment/refund/payout columns are altered.

CREATE TYPE "SupportTicketSource" AS ENUM ('booking', 'general');

CREATE TYPE "SupportTicketStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

CREATE TYPE "SupportTicketCategory" AS ENUM (
  'payment',
  'booking_status',
  'property_arrival',
  'cancellation_refund',
  'other'
);

CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL,
  "publicCode" TEXT NOT NULL,
  "source" "SupportTicketSource" NOT NULL,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'open',
  "category" "SupportTicketCategory" NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "userId" TEXT,
  "guestName" TEXT,
  "guestEmail" TEXT,
  "bookingId" TEXT,
  "adminResponse" TEXT,
  "adminRespondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportTicket_publicCode_key" ON "SupportTicket"("publicCode");

CREATE INDEX "SupportTicket_userId_status_idx" ON "SupportTicket"("userId", "status");

CREATE INDEX "SupportTicket_status_source_idx" ON "SupportTicket"("status", "source");

CREATE INDEX "SupportTicket_bookingId_idx" ON "SupportTicket"("bookingId");

CREATE INDEX "SupportTicket_guestEmail_idx" ON "SupportTicket"("guestEmail");

CREATE INDEX "SupportTicket_publicCode_idx" ON "SupportTicket"("publicCode");

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
