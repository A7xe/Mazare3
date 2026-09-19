/**
 * Phase 3C.4D.5 — Pool & Property safety disclosure schemas.
 * Pool safety disclosure ≠ regulatory verification ≠ platform_verified.
 * swimming_pool activity alone does NOT mean MoH licence required.
 */
import { z } from 'zod';

export const POOL_WATER_FEATURE_KINDS = [
  'swimming_pool',
  'children_pool',
  'jacuzzi_hot_tub',
  'decorative_water_feature',
  'agricultural_reservoir_or_tank',
  'other',
] as const;

export const POOL_SEASONALITIES = ['permanent', 'seasonal', 'unknown'] as const;

export const PROPERTY_SAFETY_DISCLOSURE_CATEGORIES = [
  'access_limitation',
  'stairs_accessibility',
  'open_water_hazard',
  'child_restriction',
  'construction_maintenance',
  'other',
] as const;

/** Amenity keys that indicate a swimming-pool offering (not jacuzzi-only / decorative). */
export const SWIMMING_POOL_AMENITY_KEYS = ['pool', 'heated_pool', 'indoor_pool'] as const;

export const POOL_SAFETY_ATTESTATION_KEY = 'property_pool_safety_disclosure' as const;
export const POOL_SAFETY_ATTESTATION_CORPUS_VERSION = '3c4d5-pool-safety-attest-v1' as const;

/** Application bounds for Owner-provided depth (metres) — not a legal standard. */
export const POOL_DEPTH_METERS_MIN = 0.1;
export const POOL_DEPTH_METERS_MAX = 15;

const depthSchema = z
  .number()
  .min(POOL_DEPTH_METERS_MIN)
  .max(POOL_DEPTH_METERS_MAX)
  .optional()
  .nullable();

export const putPoolSafetyProfileSchema = z
  .object({
    waterFeatureKind: z.enum(POOL_WATER_FEATURE_KINDS).optional(),
    isIndoor: z.boolean().optional().nullable(),
    isOutdoor: z.boolean().optional().nullable(),
    minDepthMeters: depthSchema,
    maxDepthMeters: depthSchema,
    childrenAllowed: z.boolean().optional().nullable(),
    childrenRequireAdultSupervision: z.boolean().optional().nullable(),
    seasonality: z.enum(POOL_SEASONALITIES).optional(),
    accessRestrictionsAr: z.string().max(2000).optional().nullable(),
    accessRestrictionsEn: z.string().max(2000).optional().nullable(),
    otherWarningsAr: z.string().max(2000).optional().nullable(),
    otherWarningsEn: z.string().max(2000).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (
      v.minDepthMeters != null &&
      v.maxDepthMeters != null &&
      v.minDepthMeters > v.maxDepthMeters
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minDepthMeters must be <= maxDepthMeters',
        path: ['minDepthMeters'],
      });
    }
  });

export const recordPoolSafetyAttestationSchema = z.object({
  accepted: z.literal(true),
  sourceSurface: z.string().max(80).optional(),
});

export const putSafetyDisclosureSchema = z.object({
  category: z.enum(PROPERTY_SAFETY_DISCLOSURE_CATEGORIES),
  descriptionAr: z.string().min(3).max(2000),
  descriptionEn: z.string().max(2000).optional().nullable(),
  active: z.boolean().optional().default(true),
});

export type PutPoolSafetyProfileInput = z.infer<typeof putPoolSafetyProfileSchema>;
export type RecordPoolSafetyAttestationInput = z.infer<typeof recordPoolSafetyAttestationSchema>;
export type PutSafetyDisclosureInput = z.infer<typeof putSafetyDisclosureSchema>;

export function amenityKeysIndicateSwimmingPool(
  amenityKeys: readonly string[],
): boolean {
  return SWIMMING_POOL_AMENITY_KEYS.some((k) => amenityKeys.includes(k));
}

export function isPoolSafetyProfileCompleteForSubmit(profile: {
  waterFeatureKind: string;
  childrenRequireAdultSupervision: boolean | null | undefined;
  seasonality: string;
}): boolean {
  if (profile.waterFeatureKind !== 'swimming_pool') {
    // Non-swimming water features: profile optional for submit; no forced pool path
    return true;
  }
  // Minimum: feature kind swimming_pool + adult-supervision stance declared + seasonality not blank
  if (profile.childrenRequireAdultSupervision == null) return false;
  if (!profile.seasonality || profile.seasonality === '') return false;
  return true;
}
