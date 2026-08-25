import { z } from 'zod';
import { jodToFils } from '../money';

export const createSponsoredPackageSchema = z.object({
  nameAr: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().min(2).max(80),
  durationDays: z.coerce.number().int().min(1).max(365),
  priceAmount: z.coerce.number().positive().refine((n) => jodToFils(n) >= 1, 'Amount must be at least 0.01 JOD'),
  currency: z.literal('JOD').optional(),
});

export const updateSponsoredPackageSchema = createSponsoredPackageSchema.partial();

export const createSponsoredOrderSchema = z.object({
  packageId: z.string().trim().min(1),
});

export const confirmSponsoredPaymentSchema = z.object({
  paymentReference: z.string().trim().min(1).max(200),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const sponsoredOrderAdminNoteSchema = z.object({
  adminNote: z.string().trim().max(2000).optional(),
});

export type CreateSponsoredPackageInput = z.infer<typeof createSponsoredPackageSchema>;
export type UpdateSponsoredPackageInput = z.infer<typeof updateSponsoredPackageSchema>;
export type CreateSponsoredOrderInput = z.infer<typeof createSponsoredOrderSchema>;
export type ConfirmSponsoredPaymentInput = z.infer<typeof confirmSponsoredPaymentSchema>;
