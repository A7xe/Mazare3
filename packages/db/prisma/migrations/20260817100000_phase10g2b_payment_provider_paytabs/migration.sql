-- Additive only: add PayTabs to PaymentProvider. Do not alter existing values.
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'paytabs';
