import { z } from 'zod';
import { AVAILABILITY_PERIODS } from '../constants';

export const promotionDiscountTypes = ['percentage', 'fixed_amount'] as const;
export const promotionStatuses = ['draft', 'active', 'paused', 'expired'] as const;

const propertyPromotionFields = z.object({
  titleAr: z.string().trim().min(2).max(80),
  titleEn: z.string().trim().min(2).max(80),
  discountType: z.enum(promotionDiscountTypes),
  discountValue: z.coerce.number().positive(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  period: z.enum(AVAILABILITY_PERIODS).nullable().optional(),
});

function refinePromotionDatesAndPercent(
  val: {
    discountType?: 'percentage' | 'fixed_amount';
    discountValue?: number;
    startsAt?: Date;
    endsAt?: Date;
  },
  ctx: z.RefinementCtx,
) {
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

export const createPropertyPromotionSchema = propertyPromotionFields.superRefine(
  refinePromotionDatesAndPercent,
);

export const updatePropertyPromotionSchema = propertyPromotionFields.partial().superRefine(
  refinePromotionDatesAndPercent,
);

export type CreatePropertyPromotionInput = z.infer<typeof createPropertyPromotionSchema>;
export type UpdatePropertyPromotionInput = z.infer<typeof updatePropertyPromotionSchema>;
