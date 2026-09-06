import { z } from 'zod';
import { PAYMENT_METHODS, PAYMENT_PURPOSES } from '../constants';

export const createPaymentIntentSchema = z.object({
  bookingId: z.string().min(1),
  method: z.enum(PAYMENT_METHODS),
  purpose: z.enum(PAYMENT_PURPOSES).optional(),
  idempotencyKey: z.string().min(8).max(64).optional(),
  /** JIT payment contact — not an auth identity. Used when User lacks email/phone for PayTabs. */
  contactEmail: z.string().trim().min(3).max(254).optional(),
  contactPhone: z.string().trim().min(8).max(32).optional(),
});

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;
