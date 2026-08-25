import { z } from 'zod';
import { PAYMENT_METHODS, PAYMENT_PURPOSES } from '../constants';

export const createPaymentIntentSchema = z.object({
  bookingId: z.string().min(1),
  method: z.enum(PAYMENT_METHODS),
  purpose: z.enum(PAYMENT_PURPOSES).optional(),
  idempotencyKey: z.string().min(8).max(64).optional(),
});

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;
