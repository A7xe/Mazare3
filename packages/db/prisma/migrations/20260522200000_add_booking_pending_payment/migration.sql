-- Add enum value in its own migration (PostgreSQL requires commit before use)
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'pending_payment';
