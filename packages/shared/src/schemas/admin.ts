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

/** Owner-facing change-request reason — required only when status is changes_requested. */
export const PROPERTY_REVIEW_CHANGE_REASON_MIN = 8;
export const PROPERTY_REVIEW_CHANGE_REASON_MAX = 2000;

/** Owner-facing rejection reason — required only when status is rejected. */
export const PROPERTY_REVIEW_REJECTION_REASON_MIN = PROPERTY_REVIEW_CHANGE_REASON_MIN;
export const PROPERTY_REVIEW_REJECTION_REASON_MAX = PROPERTY_REVIEW_CHANGE_REASON_MAX;

export const patchAdminPropertyStatusSchema = z
  .object({
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
    reason: z.string().max(PROPERTY_REVIEW_CHANGE_REASON_MAX).optional(),
  })
  .superRefine((data, ctx) => {
    const trimmed = data.reason?.trim() ?? '';
    if (data.status === 'changes_requested') {
      if (trimmed.length < PROPERTY_REVIEW_CHANGE_REASON_MIN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `reason is required when requesting changes (min ${PROPERTY_REVIEW_CHANGE_REASON_MIN} characters)`,
          path: ['reason'],
        });
      }
    }
    if (data.status === 'rejected') {
      if (trimmed.length < PROPERTY_REVIEW_REJECTION_REASON_MIN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `reason is required when rejecting (min ${PROPERTY_REVIEW_REJECTION_REASON_MIN} characters)`,
          path: ['reason'],
        });
      }
    }
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
