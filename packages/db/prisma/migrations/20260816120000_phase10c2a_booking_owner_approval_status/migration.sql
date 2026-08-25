-- PostgreSQL requires a committed ADD VALUE before the enum is used elsewhere.
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'pending_owner_approval';
