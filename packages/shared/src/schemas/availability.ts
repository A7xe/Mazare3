import { z } from 'zod';
import { AVAILABILITY_PERIODS } from '../constants';
import { validateAvailabilityRuleTimes } from '../availability-schedule';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be HH:mm');

export const availabilityRuleInputSchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    period: z.enum(AVAILABILITY_PERIODS),
    enabled: z.boolean().default(true),
    startTime: hhmm,
    endTime: hhmm,
    price: z.coerce.number().min(0).max(999999.99),
  })
  .superRefine((data, ctx) => {
    const check = validateAvailabilityRuleTimes(data.period, data.startTime, data.endTime);
    if (!check.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: check.message, path: ['endTime'] });
    }
  });

export const putOwnerAvailabilityRulesSchema = z.object({
  rules: z.array(availabilityRuleInputSchema).max(28),
});

export const generateAvailabilitySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const applyRuleToFutureSchema = z.object({
  applyPrice: z.boolean().optional(),
  applyTimes: z.boolean().optional(),
});

export type AvailabilityRuleInput = z.infer<typeof availabilityRuleInputSchema>;
export type PutOwnerAvailabilityRulesInput = z.infer<typeof putOwnerAvailabilityRulesSchema>;
export type GenerateAvailabilityInput = z.infer<typeof generateAvailabilitySchema>;
export type ApplyRuleToFutureInput = z.infer<typeof applyRuleToFutureSchema>;
