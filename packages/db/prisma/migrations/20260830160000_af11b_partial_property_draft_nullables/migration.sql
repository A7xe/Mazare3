-- AF-1.1b: allow truthful incomplete Property drafts (location + basePrice optional).
-- Existing rows remain non-null; only DROPs NOT NULL (additive / backward-compatible).
-- Submit-review and publish gates must still require these fields in application code.

ALTER TABLE "Property" ALTER COLUMN "city" DROP NOT NULL;
ALTER TABLE "Property" ALTER COLUMN "area" DROP NOT NULL;
ALTER TABLE "Property" ALTER COLUMN "approximateAddress" DROP NOT NULL;
ALTER TABLE "Property" ALTER COLUMN "basePrice" DROP NOT NULL;
