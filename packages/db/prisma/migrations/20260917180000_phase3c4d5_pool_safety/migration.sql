-- Phase 3C.4D.5 — Pool & Property safety conditional compliance (additive)
-- Local/dev only. No auto-verify, no fabricated attestations, no Production apply.

DO $$ BEGIN
  CREATE TYPE "PoolWaterFeatureKind" AS ENUM (
    'swimming_pool',
    'children_pool',
    'jacuzzi_hot_tub',
    'decorative_water_feature',
    'agricultural_reservoir_or_tank',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PoolSeasonality" AS ENUM ('permanent', 'seasonal', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PropertySafetyDisclosureCategory" AS ENUM (
    'access_limitation',
    'stairs_accessibility',
    'open_water_hazard',
    'child_restriction',
    'construction_maintenance',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Property"
  ADD COLUMN IF NOT EXISTS "poolSafetyAttestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "poolSafetyAttestationVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "poolSafetyAttestedByUserId" TEXT;

CREATE TABLE IF NOT EXISTS "PropertyPoolSafetyProfile" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "waterFeatureKind" "PoolWaterFeatureKind" NOT NULL DEFAULT 'swimming_pool',
  "isIndoor" BOOLEAN,
  "isOutdoor" BOOLEAN,
  "minDepthMeters" DECIMAL(4,2),
  "maxDepthMeters" DECIMAL(4,2),
  "childrenAllowed" BOOLEAN,
  "childrenRequireAdultSupervision" BOOLEAN,
  "seasonality" "PoolSeasonality" NOT NULL DEFAULT 'unknown',
  "accessRestrictionsAr" TEXT,
  "accessRestrictionsEn" TEXT,
  "otherWarningsAr" TEXT,
  "otherWarningsEn" TEXT,
  "profileComplete" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyPoolSafetyProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PropertyPoolSafetyProfile_propertyId_key"
  ON "PropertyPoolSafetyProfile"("propertyId");

CREATE TABLE IF NOT EXISTS "PropertySafetyDisclosure" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "category" "PropertySafetyDisclosureCategory" NOT NULL,
  "descriptionAr" TEXT NOT NULL,
  "descriptionEn" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertySafetyDisclosure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PropertySafetyDisclosure_propertyId_active_idx"
  ON "PropertySafetyDisclosure"("propertyId", "active");
CREATE INDEX IF NOT EXISTS "PropertySafetyDisclosure_category_idx"
  ON "PropertySafetyDisclosure"("category");

DO $$ BEGIN
  ALTER TABLE "PropertyPoolSafetyProfile"
    ADD CONSTRAINT "PropertyPoolSafetyProfile_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PropertySafetyDisclosure"
    ADD CONSTRAINT "PropertySafetyDisclosure_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Legacy: no auto pool profiles, attestations, or N/A decisions.
