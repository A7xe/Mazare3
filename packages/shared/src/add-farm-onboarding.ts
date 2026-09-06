/**
 * Add Farm onboarding — presentation steps + deterministic readiness.
 * No DB persistence of wizard step or percentage.
 */

import { PROPERTY_TYPES, type PropertyType } from './constants';
import { MIN_MEDIA_FOR_SUBMIT_REVIEW } from './property-media-rules';

export const ADD_FARM_STEPS = [
  'basic',
  'location',
  'photos',
  'pricing',
  'review',
] as const;

export type AddFarmStepId = (typeof ADD_FARM_STEPS)[number];

export function isAddFarmStepId(value: string | null | undefined): value is AddFarmStepId {
  return Boolean(value && (ADD_FARM_STEPS as readonly string[]).includes(value));
}

export function addFarmStepIndex(step: AddFarmStepId): number {
  return ADD_FARM_STEPS.indexOf(step);
}

/** Inputs used for truthful listing-readiness (extendable per step). */
export type AddFarmReadinessInput = {
  titleAr?: string | null;
  descriptionAr?: string | null;
  type?: string | null;
  capacity?: number | null;
  city?: string | null;
  area?: string | null;
  approximateAddress?: string | null;
  exactAddress?: string | null;
  basePrice?: number | null;
  mediaCount?: number | null;
  amenityCount?: number | null;
};

export type AddFarmReadinessBreakdown = {
  basic: boolean;
  location: boolean;
  photos: boolean;
  pricing: boolean;
  /** Review-ready when prior buckets satisfied (submit still needs media guards separately). */
  review: boolean;
  percent: number;
  completedSteps: number;
  totalSteps: number;
};

function nonEmpty(value: string | null | undefined, min = 1): boolean {
  return Boolean(value && value.trim().length >= min);
}

export function isAddFarmBasicComplete(input: AddFarmReadinessInput): boolean {
  const typeOk =
    Boolean(input.type) && (PROPERTY_TYPES as readonly string[]).includes(String(input.type));
  const capacityOk =
    typeof input.capacity === 'number' &&
    Number.isFinite(input.capacity) &&
    input.capacity >= 1 &&
    input.capacity <= 500;
  return (
    nonEmpty(input.titleAr, 3) &&
    nonEmpty(input.descriptionAr, 20) &&
    typeOk &&
    capacityOk
  );
}

export function isAddFarmLocationComplete(input: AddFarmReadinessInput): boolean {
  return (
    nonEmpty(input.city, 2) &&
    nonEmpty(input.area, 2) &&
    nonEmpty(input.approximateAddress, 5) &&
    nonEmpty(input.exactAddress, 5)
  );
}

/**
 * Photos step readiness for wizard Next / onboarding %.
 * Matches submit-review media floor (not publish’s recommended ≥3).
 */
export function isAddFarmPhotosComplete(input: AddFarmReadinessInput): boolean {
  return (input.mediaCount ?? 0) >= MIN_MEDIA_FOR_SUBMIT_REVIEW;
}

export function isAddFarmPricingComplete(input: AddFarmReadinessInput): boolean {
  return typeof input.basePrice === 'number' && Number.isFinite(input.basePrice) && input.basePrice > 0;
}

/**
 * Deterministic 0–100 readiness from real field completion.
 * Equal weight across the five wizard steps.
 */
export function calculatePropertyOnboardingReadiness(
  input: AddFarmReadinessInput,
): AddFarmReadinessBreakdown {
  const basic = isAddFarmBasicComplete(input);
  const location = isAddFarmLocationComplete(input);
  const photos = isAddFarmPhotosComplete(input);
  const pricing = isAddFarmPricingComplete(input);
  const review = basic && location && photos && pricing;
  const flags = [basic, location, photos, pricing, review];
  const completedSteps = flags.filter(Boolean).length;
  const totalSteps = flags.length;
  const percent = Math.round((completedSteps / totalSteps) * 100);
  return { basic, location, photos, pricing, review, percent, completedSteps, totalSteps };
}

export function isCanonicalPropertyType(value: string): value is PropertyType {
  return (PROPERTY_TYPES as readonly string[]).includes(value);
}
