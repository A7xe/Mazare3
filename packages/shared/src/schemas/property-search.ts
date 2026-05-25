import { z } from 'zod';
import { AVAILABILITY_PERIODS, PROPERTY_SORT_OPTIONS, PROPERTY_TYPES } from '../constants';

export const propertySearchQuerySchema = z.object({
  q: z.string().max(120).optional(),
  area: z.string().max(80).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  guests: z.coerce.number().int().min(1).max(100).optional(),
  propertyType: z.enum(PROPERTY_TYPES).optional(),
  amenities: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined)),
  hasPool: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  verifiedOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === 'true' ? true : undefined)),
  sort: z.enum(PROPERTY_SORT_OPTIONS).optional().default('recommended'),
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
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
