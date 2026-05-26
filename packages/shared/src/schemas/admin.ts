import { z } from 'zod';

export const adminAvailabilityQuerySchema = z.object({
  propertyId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const patchAdminUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
});

export const patchAdminOwnerStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'suspended']),
  rejectionReason: z.string().max(500).optional(),
});

export const patchAdminPropertyStatusSchema = z.object({
  status: z.enum([
    'draft',
    'pending_review',
    'changes_requested',
    'approved',
    'published',
    'unpublished',
    'suspended',
    'rejected',
  ]),
});

export const patchAdminAvailabilitySchema = z
  .object({
    status: z.enum(['available', 'blocked']).optional(),
    price: z.coerce.number().positive().optional(),
  })
  .refine((data) => data.status !== undefined || data.price !== undefined, {
    message: 'Provide status and/or price to update',
  });

export type AdminAvailabilityQuery = z.infer<typeof adminAvailabilityQuerySchema>;
export type PatchAdminUserStatusInput = z.infer<typeof patchAdminUserStatusSchema>;
export type PatchAdminOwnerStatusInput = z.infer<typeof patchAdminOwnerStatusSchema>;
export type PatchAdminPropertyStatusInput = z.infer<typeof patchAdminPropertyStatusSchema>;
export type PatchAdminAvailabilityInput = z.infer<typeof patchAdminAvailabilitySchema>;
