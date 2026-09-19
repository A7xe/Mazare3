import { z } from 'zod';
import {
  DATA_SUBJECT_REQUEST_STATUSES,
  DATA_SUBJECT_REQUEST_TYPES,
  FOUNDER_APPROVAL_STATUSES,
  LEGAL_ACCEPTANCE_CONTEXTS,
  LEGAL_DOCUMENT_TYPES,
  LEGAL_LANGUAGES,
  LEGAL_REVIEW_STATUSES,
  PRIVACY_CONSENT_PURPOSES,
} from '../legal-policy';
import { DATA_PROCESSING_CONSENT_PURPOSES } from '../jordan-prior-consent';

export const legalDocumentTypeSchema = z.enum(LEGAL_DOCUMENT_TYPES);
export const legalLanguageSchema = z.enum(LEGAL_LANGUAGES);
export const legalAcceptanceContextSchema = z.enum(LEGAL_ACCEPTANCE_CONTEXTS);
export const privacyConsentPurposeSchema = z.enum(PRIVACY_CONSENT_PURPOSES);
export const dataProcessingConsentPurposeSchema = z.enum(DATA_PROCESSING_CONSENT_PURPOSES);
export const dataSubjectRequestTypeSchema = z.enum(DATA_SUBJECT_REQUEST_TYPES);
export const dataSubjectRequestStatusSchema = z.enum(DATA_SUBJECT_REQUEST_STATUSES);
export const legalReviewStatusSchema = z.enum(LEGAL_REVIEW_STATUSES);
export const founderApprovalStatusSchema = z.enum(FOUNDER_APPROVAL_STATUSES);

export const createLegalDraftReleaseSchema = z.object({
  documentType: legalDocumentTypeSchema,
  version: z.string().min(1).max(64),
  requiresReacceptance: z.boolean().optional(),
  materialChange: z.boolean().optional(),
  changelog: z.string().max(20_000).optional().nullable(),
  summaryOfChanges: z.string().max(20_000).optional().nullable(),
  effectiveAt: z.string().datetime().optional().nullable(),
  versions: z
    .array(
      z.object({
        language: legalLanguageSchema,
        title: z.string().min(1).max(500),
        content: z.string().min(1).max(500_000),
        sourceRef: z.string().max(500).optional().nullable(),
      }),
    )
    .min(1)
    .max(2),
});

export const updateLegalDraftReleaseSchema = z.object({
  requiresReacceptance: z.boolean().optional(),
  materialChange: z.boolean().optional(),
  changelog: z.string().max(20_000).optional().nullable(),
  summaryOfChanges: z.string().max(20_000).optional().nullable(),
  effectiveAt: z.string().datetime().optional().nullable(),
  versions: z
    .array(
      z.object({
        language: legalLanguageSchema,
        title: z.string().min(1).max(500),
        content: z.string().min(1).max(500_000),
        sourceRef: z.string().max(500).optional().nullable(),
      }),
    )
    .min(1)
    .max(2)
    .optional(),
});

export const publishLegalReleaseSchema = z.object({
  releaseId: z.string().min(1),
  effectiveAt: z.string().datetime().optional().nullable(),
});

export const scheduleLegalReleaseSchema = z.object({
  releaseId: z.string().min(1),
  effectiveAt: z.string().datetime(),
});

export const recordLegalAcceptanceSchema = z.object({
  documentVersionId: z.string().min(1),
  context: legalAcceptanceContextSchema,
  sourceSurface: z.string().max(200).optional(),
  relatedBookingId: z.string().min(1).optional(),
  relatedOwnerProfileId: z.string().min(1).optional(),
});

export const grantPrivacyConsentSchema = z.object({
  purposeCode: privacyConsentPurposeSchema,
  consentVersion: z.string().min(1).max(64),
  noticeVersionId: z.string().min(1).optional(),
  sourceSurface: z.string().max(200).optional(),
});

/** Phase 3C.4B.1.4 — Jordan Prior Consent grant (not optional marketing PrivacyConsent). */
export const grantDataProcessingConsentSchema = z.object({
  purposeKey: dataProcessingConsentPurposeSchema,
  language: z.enum(['ar', 'en']),
  /** Must be true — checkbox evidence; server stores purpose text from SSOT. */
  explicitConsent: z.literal(true),
  sourceSurface: z.string().max(200).optional(),
  relatedEntityType: z.string().max(100).optional(),
  relatedEntityId: z.string().max(100).optional(),
  privacyNoticeVersionId: z.string().min(1).optional(),
});

export const createDataSubjectRequestSchema = z.object({
  type: dataSubjectRequestTypeSchema,
  description: z.string().max(10_000).optional(),
  email: z.string().email().optional(),
});

export const updateDataSubjectRequestStatusSchema = z.object({
  status: dataSubjectRequestStatusSchema,
  adminNote: z.string().max(10_000).optional().nullable(),
  rejectionReason: z.string().max(10_000).optional().nullable(),
});

/**
 * Phase 3C.2 — PATCH legal release governance (counsel + founder).
 * Reason is required for audit. Does not activate Production releases.
 * Future Production activation must require legalReviewStatus approved
 * (or approved_with_changes) + founderApprovalStatus approved — not enforced here.
 */
export const patchLegalReleaseGovernanceSchema = z
  .object({
    legalReviewStatus: legalReviewStatusSchema.optional(),
    legalReviewReference: z.string().max(500).optional().nullable(),
    legalReviewNote: z.string().max(20_000).optional().nullable(),
    founderApprovalStatus: founderApprovalStatusSchema.optional(),
    founderApprovalNote: z.string().max(20_000).optional().nullable(),
    reason: z.string().min(1).max(2_000),
  })
  .refine(
    (v) =>
      v.legalReviewStatus !== undefined ||
      v.legalReviewReference !== undefined ||
      v.legalReviewNote !== undefined ||
      v.founderApprovalStatus !== undefined ||
      v.founderApprovalNote !== undefined,
    { message: 'At least one governance field must be provided' },
  );

export const recordCommercialTermsAcceptanceSchema = z.object({
  commercialTermsId: z.string().min(1),
  documentHash: z.string().max(128).optional(),
  sourceSurface: z.string().max(200).optional(),
});

export const bookingLegalAckSchema = z.object({
  acceptedDocumentVersionIds: z.object({
    terms: z.string().min(1).optional(),
    cancellation: z.string().min(1).optional(),
    bookingTerms: z.string().min(1).optional(),
    privacy: z.string().min(1).optional(),
  }),
});

export const acceptedDocumentVersionIdsSchema = z
  .object({
    terms: z.string().min(1).optional(),
    cancellation: z.string().min(1).optional(),
    bookingTerms: z.string().min(1).optional(),
    privacy: z.string().min(1).optional(),
  })
  .optional();

export type CreateLegalDraftReleaseInput = z.infer<typeof createLegalDraftReleaseSchema>;
export type UpdateLegalDraftReleaseInput = z.infer<typeof updateLegalDraftReleaseSchema>;
export type PublishLegalReleaseInput = z.infer<typeof publishLegalReleaseSchema>;
export type ScheduleLegalReleaseInput = z.infer<typeof scheduleLegalReleaseSchema>;
export type RecordLegalAcceptanceInput = z.infer<typeof recordLegalAcceptanceSchema>;
export type GrantPrivacyConsentInput = z.infer<typeof grantPrivacyConsentSchema>;
export type GrantDataProcessingConsentInput = z.infer<typeof grantDataProcessingConsentSchema>;
export type CreateDataSubjectRequestInput = z.infer<typeof createDataSubjectRequestSchema>;
export type UpdateDataSubjectRequestStatusInput = z.infer<
  typeof updateDataSubjectRequestStatusSchema
>;
export type PatchLegalReleaseGovernanceInput = z.infer<
  typeof patchLegalReleaseGovernanceSchema
>;
export type RecordCommercialTermsAcceptanceInput = z.infer<
  typeof recordCommercialTermsAcceptanceSchema
>;
export type BookingLegalAckInput = z.infer<typeof bookingLegalAckSchema>;
export type AcceptedDocumentVersionIds = NonNullable<
  z.infer<typeof acceptedDocumentVersionIdsSchema>
>;
