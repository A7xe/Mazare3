import { z } from 'zod';
import {
  AVAILABILITY_PERIODS,
  PROPERTY_SORT_OPTIONS,
  PROPERTY_TYPES,
  SEARCH_DEFAULT_PAGE_SIZE,
  SEARCH_MAX_PAGE_SIZE,
} from '../constants';

const emptyToUndef = (v: unknown) => {
  if (v === '' || v == null) return undefined;
  return v;
};

const optionalBoolTrue = z
  .preprocess(emptyToUndef, z.enum(['true', 'false']).optional())
  .transform((v) => (v === 'true' ? true : undefined));

const optionalBool = z
  .preprocess(emptyToUndef, z.enum(['true', 'false']).optional())
  .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined));

const optionalPositiveInt = (fallback: number, min: number, max?: number) =>
  z.preprocess((v) => {
    if (v === '' || v == null) return fallback;
    return v;
  }, z.coerce.number().int().min(min).max(max ?? 1_000_000));

const optionalNum = (min: number, max?: number) =>
  z.preprocess((v) => {
    if (v === '' || v == null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }, z.number().min(min).max(max ?? Number.MAX_SAFE_INTEGER).optional());

const optionalInt = (min: number, max: number) =>
  z.preprocess((v) => {
    if (v === '' || v == null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }, z.number().int().min(min).max(max).optional());

export const propertySearchQuerySchema = z.object({
  q: z.preprocess(emptyToUndef, z.string().max(120).optional()),
  city: z.preprocess(emptyToUndef, z.string().max(80).optional()),
  area: z.preprocess(emptyToUndef, z.string().max(80).optional()),
  date: z.preprocess(emptyToUndef, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  period: z.preprocess(emptyToUndef, z.enum(AVAILABILITY_PERIODS).optional()),
  minPrice: optionalNum(0),
  maxPrice: optionalNum(0),
  guests: optionalInt(1, 100),
  propertyType: z.preprocess(emptyToUndef, z.enum(PROPERTY_TYPES).optional()),
  amenities: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined)),
  hasPool: optionalBool,
  allowsOvernight: optionalBoolTrue,
  allowsEvents: optionalBoolTrue,
  featured: optionalBoolTrue,
  verifiedOnly: optionalBoolTrue,
  verified: optionalBoolTrue,
  sort: z.preprocess(
    (v) => (v === '' || v == null ? 'recommended' : v),
    z.enum(PROPERTY_SORT_OPTIONS),
  ),
  /** Coarse browser geolocation for distance_asc / nearby rails (marketplace precision only). */
  lat: optionalNum(-90, 90),
  lng: optionalNum(-180, 180),
  page: optionalPositiveInt(1, 1),
  pageSize: optionalPositiveInt(SEARCH_DEFAULT_PAGE_SIZE, 1, SEARCH_MAX_PAGE_SIZE),
});

export type PropertySearchQuery = z.infer<typeof propertySearchQuerySchema>;

export const availabilityQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const createBookingSchema = z.object({
  propertySlug: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: z.enum(AVAILABILITY_PERIODS),
  guestsCount: z.coerce.number().int().min(1).max(100),
  expectedTotalAmount: z.coerce.number().positive().optional(),
  couponCode: z.string().trim().min(1).max(24).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const discoveryQuerySchema = z.object({
  city: z.preprocess(emptyToUndef, z.string().max(80).optional()),
  area: z.preprocess(emptyToUndef, z.string().max(80).optional()),
  date: z.preprocess(emptyToUndef, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  period: z.preprocess(emptyToUndef, z.enum(AVAILABILITY_PERIODS).optional()),
  guests: optionalInt(1, 100),
  lat: optionalNum(-90, 90),
  lng: optionalNum(-180, 180),
});

export type DiscoveryQuery = z.infer<typeof discoveryQuerySchema>;
