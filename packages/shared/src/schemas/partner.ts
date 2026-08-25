import { z } from 'zod';

export const partnerEntityTypeSchema = z.enum(['individual', 'business']);
export const partnerVerificationStatusSchema = z.enum([
  'draft',
  'submitted',
  'under_review',
  'changes_requested',
  'approved',
  'rejected',
  'suspended',
  'legacy_approved',
]);

export const partnerDocumentTypeSchema = z.enum([
  'identity',
  'property_ownership',
  'management_authorization',
  'business_registration',
  'payout_proof',
  'other',
]);

export const patchPartnerOnboardingProfileSchema = z.object({
  entityType: partnerEntityTypeSchema.optional(),
  displayName: z.string().min(2).max(120).optional(),
  businessName: z.string().max(120).nullable().optional(),
  phone: z.string().min(8).max(20).optional(),
  city: z.string().min(2).max(80).optional(),
  area: z.string().min(2).max(120).optional(),
  bio: z.string().min(20).max(2000).optional(),
  approximateFarmCount: z.coerce.number().int().min(0).max(500).nullable().optional(),
  legalName: z.string().min(2).max(160).optional(),
  operatingPhone: z.string().min(8).max(20).optional(),
  operatingCity: z.string().min(2).max(80).optional(),
  operatingArea: z.string().min(2).max(120).optional(),
  contactEmail: z.string().email().max(160).optional(),
});

export const putPartnerPayoutProfileSchema = z.object({
  beneficiaryName: z.string().min(2).max(160),
  bankName: z.string().min(2).max(160),
  iban: z.string().min(8).max(40),
  optionalNotes: z.string().max(500).optional(),
});

export const acceptPartnerAgreementSchema = z.object({
  agreementId: z.string().min(1),
  acceptedLocale: z.enum(['ar', 'en']).optional(),
});

export const patchPartnerDocumentReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reason: z.string().max(1000).optional(),
});

export const requestPartnerChangesSchema = z.object({
  reason: z.string().min(8).max(2000),
  fieldKeys: z.array(z.string().min(1).max(80)).max(20).optional(),
});

export const partnerReasonSchema = z.object({
  reason: z.string().min(8).max(2000),
});

export const approvePartnerSchema = z.object({
  usePlatformDefaultCommission: z.boolean().optional(),
});

export const reviewPartnerPayoutSchema = z.object({
  status: z.enum(['reviewed', 'rejected']),
  reason: z.string().max(1000).optional(),
});

export const createPartnerCommercialTermsSchema = z.object({
  propertyId: z.string().min(1).nullable().optional(),
  commissionPercent: z.coerce.number().min(0).max(100).optional(),
  commissionBps: z.coerce.number().int().min(0).max(10000).optional(),
  payoutDelayHours: z.coerce.number().int().min(0).max(720).nullable().optional(),
  effectiveFrom: z.string().min(10),
  effectiveTo: z.string().min(10).nullable().optional(),
  internalNote: z.string().max(2000).nullable().optional(),
});

export const previewPartnerCommercialTermsSchema = z.object({
  propertyId: z.string().min(1).optional(),
});

export type PatchPartnerOnboardingProfileInput = z.infer<typeof patchPartnerOnboardingProfileSchema>;
export type PutPartnerPayoutProfileInput = z.infer<typeof putPartnerPayoutProfileSchema>;
export type AcceptPartnerAgreementInput = z.infer<typeof acceptPartnerAgreementSchema>;
export type PatchPartnerDocumentReviewInput = z.infer<typeof patchPartnerDocumentReviewSchema>;
export type RequestPartnerChangesInput = z.infer<typeof requestPartnerChangesSchema>;
export type ApprovePartnerInput = z.infer<typeof approvePartnerSchema>;
export type ReviewPartnerPayoutInput = z.infer<typeof reviewPartnerPayoutSchema>;
export type CreatePartnerCommercialTermsInput = z.infer<typeof createPartnerCommercialTermsSchema>;
