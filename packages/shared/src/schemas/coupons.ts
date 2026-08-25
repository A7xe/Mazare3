import { z } from 'zod';

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

const couponFields = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .transform(normalizeCouponCode)
    .refine((v) => /^[A-Z0-9_-]+$/.test(v), 'Code may contain letters, numbers, _ or -'),
  discountType: z.enum(['percentage', 'fixed_amount']),
  discountValue: z.coerce.number().positive(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  minBookingAmount: z.coerce.number().positive().nullable().optional(),
  maxUses: z.coerce.number().int().positive().nullable().optional(),
  maxUsesPerCustomer: z.coerce.number().int().positive().optional(),
});

function refineCoupon(val: z.infer<typeof couponFields> | Partial<z.infer<typeof couponFields>>, ctx: z.RefinementCtx) {
  if (
    val.discountType === 'percentage' &&
    val.discountValue != null &&
    (val.discountValue <= 0 || val.discountValue > 100)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discountValue'],
      message: 'Percentage must be greater than 0 and at most 100',
    });
  }
  if (val.startsAt && val.endsAt && !(val.endsAt.getTime() > val.startsAt.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endsAt'],
      message: 'End must be after start',
    });
  }
}

export const createPropertyCouponSchema = couponFields.superRefine(refineCoupon);
export const updatePropertyCouponSchema = couponFields.partial().superRefine(refineCoupon);

export const validatePropertyCouponSchema = z.object({
  code: z.string().trim().min(1).max(24),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: z.enum(['morning', 'evening', 'full_day', 'overnight']),
});

const platformCouponFields = couponFields.extend({
  titleAr: z.string().trim().min(2).max(80),
  titleEn: z.string().trim().min(2).max(80),
  propertyId: z.string().trim().min(1).nullable().optional(),
});

export const createPlatformCouponSchema = platformCouponFields.superRefine(refineCoupon);
export const updatePlatformCouponSchema = platformCouponFields.partial().superRefine(refineCoupon);

export type CreatePropertyCouponInput = z.infer<typeof createPropertyCouponSchema>;
export type UpdatePropertyCouponInput = z.infer<typeof updatePropertyCouponSchema>;
export type ValidatePropertyCouponInput = z.infer<typeof validatePropertyCouponSchema>;
export type CreatePlatformCouponInput = z.infer<typeof createPlatformCouponSchema>;
export type UpdatePlatformCouponInput = z.infer<typeof updatePlatformCouponSchema>;
