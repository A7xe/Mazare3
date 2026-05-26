import { z } from 'zod';
import { PROPERTY_TYPES } from '../constants';

export const ownerApplySchema = z.object({
  displayName: z.string().min(2).max(120),
  businessName: z.string().max(120).optional(),
  phone: z.string().min(8).max(20),
  city: z.string().min(2).max(80),
  area: z.string().min(2).max(120),
  bio: z.string().min(20).max(2000),
  approximateFarmCount: z.coerce.number().int().min(0).max(500).optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the platform terms' }),
  }),
});

const propertyRuleSchema = z.object({
  titleAr: z.string().min(2).max(200),
  titleEn: z.string().max(200).optional(),
});

export const createOwnerPropertySchema = z.object({
  type: z.enum(PROPERTY_TYPES),
  titleAr: z.string().min(3).max(200),
  titleEn: z.string().max(200).optional(),
  descriptionAr: z.string().min(20).max(8000),
  descriptionEn: z.string().max(8000).optional(),
  city: z.string().min(2).max(80),
  area: z.string().min(2).max(120),
  approximateAddress: z.string().min(5).max(300),
  exactAddress: z.string().min(5).max(500),
  basePrice: z.coerce.number().positive(),
  capacity: z.coerce.number().int().min(1).max(500),
  allowsOvernight: z.boolean().optional().default(true),
  allowsFamilies: z.boolean().optional().default(true),
  allowsYouth: z.boolean().optional().default(false),
  poolsCount: z.coerce.number().int().min(0).max(20).optional().default(0),
  amenityKeys: z.array(z.string().min(1)).max(20).optional().default([]),
  imageUrls: z.array(z.string().url()).min(1).max(12),
  rules: z.array(propertyRuleSchema).max(20).optional().default([]),
});

export const updateOwnerPropertySchema = createOwnerPropertySchema.partial();

export type OwnerApplyInput = z.infer<typeof ownerApplySchema>;
export type CreateOwnerPropertyInput = z.infer<typeof createOwnerPropertySchema>;
export type UpdateOwnerPropertyInput = z.infer<typeof updateOwnerPropertySchema>;
