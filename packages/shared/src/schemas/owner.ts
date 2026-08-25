import { z } from 'zod';

export const ownerAvailabilityQuerySchema = z.object({
  propertyId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const ownerRejectBookingSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type OwnerRejectBookingInput = z.infer<typeof ownerRejectBookingSchema>;

export const patchOwnerAvailabilitySchema = z
  .object({
    status: z.enum(['available', 'blocked']).optional(),
    price: z.coerce.number().positive().optional(),
  })
  .refine((data) => data.status !== undefined || data.price !== undefined, {
    message: 'Provide status and/or price to update',
  });

export type OwnerAvailabilityQuery = z.infer<typeof ownerAvailabilityQuerySchema>;
export type PatchOwnerAvailabilityInput = z.infer<typeof patchOwnerAvailabilitySchema>;
