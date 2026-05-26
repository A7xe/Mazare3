import { z } from 'zod';
import { PAYMENT_METHODS } from '../constants';

export const createPaymentIntentSchema = z.object({
  bookingId: z.string().min(1),
  method: z.enum(PAYMENT_METHODS),
  idempotencyKey: z.string().min(8).max(64).optional(),
});

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;
