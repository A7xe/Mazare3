import { z } from 'zod';
import {
  BREACH_AFFECTED_DATA_CATEGORIES,
  BREACH_DATA_SUBJECT_CATEGORIES,
  BREACH_NOTIFICATION_CHANNEL_STATUSES,
  LEGAL_NOTIFICATION_ASSESSMENTS,
  PERSONAL_DATA_BREACH_INCIDENT_KINDS,
  PERSONAL_DATA_BREACH_WORKFLOW_STATUSES,
  SEVERE_HARM_ASSESSMENT_STATUSES,
} from '../personal-data-breach.js';

export const personalDataBreachIncidentKindSchema = z.enum(PERSONAL_DATA_BREACH_INCIDENT_KINDS);
export const personalDataBreachWorkflowStatusSchema = z.enum(
  PERSONAL_DATA_BREACH_WORKFLOW_STATUSES,
);
export const severeHarmAssessmentStatusSchema = z.enum(SEVERE_HARM_ASSESSMENT_STATUSES);
export const legalNotificationAssessmentSchema = z.enum(LEGAL_NOTIFICATION_ASSESSMENTS);
export const breachNotificationChannelStatusSchema = z.enum(BREACH_NOTIFICATION_CHANNEL_STATUSES);
export const breachAffectedDataCategorySchema = z.enum(BREACH_AFFECTED_DATA_CATEGORIES);
export const breachDataSubjectCategorySchema = z.enum(BREACH_DATA_SUBJECT_CATEGORIES);

export const createPersonalDataBreachIncidentSchema = z.object({
  title: z.string().min(3).max(300),
  internalSummary: z.string().max(5_000).optional().nullable(),
  incidentKind: personalDataBreachIncidentKindSchema,
  discoveredAt: z.string().datetime(),
  occurredAt: z.string().datetime().optional().nullable(),
  discoverySource: z.string().max(500).optional().nullable(),
  affectedSystems: z.array(z.string().max(120)).max(40).optional(),
  affectedDataCategories: z.array(breachAffectedDataCategorySchema).max(40).optional(),
  affectedDataSubjectCategories: z.array(breachDataSubjectCategorySchema).max(20).optional(),
  estimatedAffectedCount: z.number().int().min(0).max(10_000_000).optional().nullable(),
  /** User/owner ID references only — no bulk PII copies. */
  affectedSubjectRefs: z
    .array(
      z.object({
        kind: z.enum(['customer_user', 'owner_user', 'owner_profile', 'group', 'non_account']),
        id: z.string().max(120).optional(),
        label: z.string().max(200).optional(),
      }),
    )
    .max(500)
    .optional(),
  involvesSensitivePersonalData: z.boolean().optional(),
  involvesFinancialSensitiveData: z.boolean().optional(),
  involvesKycData: z.boolean().optional(),
  involvesCredentialsAuthData: z.boolean().optional(),
  dataWasEncrypted: z.boolean().optional().nullable(),
  encryptionKeysCompromised: z.boolean().optional().nullable(),
  sourceMechanismDescription: z.string().max(10_000).optional().nullable(),
  likelyConsequences: z.string().max(10_000).optional().nullable(),
  internalNotes: z.string().max(20_000).optional().nullable(),
});

export const updatePersonalDataBreachIncidentSchema = z.object({
  title: z.string().min(3).max(300).optional(),
  internalSummary: z.string().max(5_000).optional().nullable(),
  workflowStatus: personalDataBreachWorkflowStatusSchema.optional(),
  occurredAt: z.string().datetime().optional().nullable(),
  containedAt: z.string().datetime().optional().nullable(),
  discoverySource: z.string().max(500).optional().nullable(),
  affectedSystems: z.array(z.string().max(120)).max(40).optional(),
  affectedDataCategories: z.array(breachAffectedDataCategorySchema).max(40).optional(),
  affectedDataSubjectCategories: z.array(breachDataSubjectCategorySchema).max(20).optional(),
  estimatedAffectedCount: z.number().int().min(0).max(10_000_000).optional().nullable(),
  affectedSubjectRefs: z
    .array(
      z.object({
        kind: z.enum(['customer_user', 'owner_user', 'owner_profile', 'group', 'non_account']),
        id: z.string().max(120).optional(),
        label: z.string().max(200).optional(),
      }),
    )
    .max(500)
    .optional(),
  involvesSensitivePersonalData: z.boolean().optional(),
  involvesFinancialSensitiveData: z.boolean().optional(),
  involvesKycData: z.boolean().optional(),
  involvesCredentialsAuthData: z.boolean().optional(),
  dataWasEncrypted: z.boolean().optional().nullable(),
  encryptionKeysCompromised: z.boolean().optional().nullable(),
  sourceMechanismDescription: z.string().max(10_000).optional().nullable(),
  containmentActions: z.string().max(20_000).optional().nullable(),
  remediationActions: z.string().max(20_000).optional().nullable(),
  containmentChecklist: z.record(z.string(), z.boolean()).optional(),
  likelyConsequences: z.string().max(10_000).optional().nullable(),
  severeHarmAssessment: severeHarmAssessmentStatusSchema.optional(),
  severeHarmReason: z.string().max(10_000).optional().nullable(),
  severeHarmFactorKeys: z.array(z.string().max(80)).max(40).optional(),
  legalNotificationAssessment: legalNotificationAssessmentSchema.optional(),
  dataSubjectNotificationRequired: z.boolean().optional(),
  /** @deprecated alias */
  customerNotificationRequired: z.boolean().optional(),
  authorityNotificationRequired: z.boolean().optional(),
  internalNotes: z.string().max(20_000).optional().nullable(),
  /**
   * Explicit human confirmation required to set severe_harm_likely /
   * data-subject/authority notification required.
   */
  humanConfirmation: z.boolean().optional(),
});

export const correctBreachDiscoverySchema = z.object({
  correctedDiscoveryAt: z.string().datetime(),
  reason: z.string().min(8).max(5_000),
  humanConfirmation: z.literal(true),
  /** Required when correctedDiscoveryAt is later than current effective discovery (extends clocks). */
  elevatedLaterCorrection: z.boolean().optional(),
});

export const reopenPersonalDataBreachIncidentSchema = z.object({
  humanConfirmation: z.literal(true),
  reason: z.string().min(8).max(5_000),
  nextWorkflowStatus: z
    .enum(['legal_assessment', 'investigating', 'notification_required'])
    .optional(),
});

export const addBreachRecipientNoticeSchema = z.object({
  subjectCategory: breachDataSubjectCategorySchema,
  userId: z.string().min(1).max(64).optional(),
  ownerProfileId: z.string().min(1).max(64).optional(),
  /** Minimal non-account ref — no bulk PII. */
  externalRef: z.string().min(1).max(200).optional(),
  contactChannel: z.enum(['email', 'in_app', 'manual', 'other']).optional(),
});

export const updateBreachRecipientNoticeSchema = z.object({
  state: z.enum([
    'not_required',
    'pending',
    'prepared',
    'approved',
    'attempted',
    'sent',
    'delivery_confirmed',
    'failed',
    'manual_followup_required',
  ]),
  failureCategory: z.string().max(200).optional().nullable(),
  fallbackManualStatus: z.string().max(200).optional().nullable(),
  contentHash: z.string().max(128).optional().nullable(),
  humanConfirmation: z.boolean().optional(),
});

export const prepareBreachCustomerNoticeSchema = z.object({
  whatHappenedEn: z.string().min(3).max(5_000),
  whatHappenedAr: z.string().min(3).max(5_000),
  affectedCategoriesEn: z.string().min(3).max(2_000),
  affectedCategoriesAr: z.string().min(3).max(2_000),
  likelyConsequencesEn: z.string().min(3).max(5_000),
  likelyConsequencesAr: z.string().min(3).max(5_000),
  actionsTakenEn: z.string().min(3).max(5_000),
  actionsTakenAr: z.string().min(3).max(5_000),
  practicalMeasuresEn: z.string().min(3).max(5_000),
  practicalMeasuresAr: z.string().min(3).max(5_000),
});

/** Preferred name — Affected Data Subjects (Art. 20). */
export const prepareBreachDataSubjectNoticeSchema = prepareBreachCustomerNoticeSchema;

export const approveBreachCustomerNoticeSchema = z.object({
  humanConfirmation: z.literal(true),
});

export const recordBreachCustomerNoticeSentSchema = z.object({
  humanConfirmation: z.literal(true),
  /** Synthetic / non-production send marker — never claim real mass email without evidence. */
  sendMode: z.enum(['synthetic_preview_only', 'manual_recorded']),
  note: z.string().max(2_000).optional(),
});

export const approveBreachAuthorityPackSchema = z.object({
  humanConfirmation: z.literal(true),
});

export const recordBreachAuthoritySubmissionSchema = z.object({
  humanConfirmation: z.literal(true),
  authoritySubmittedAt: z.string().datetime(),
  authoritySubmissionReference: z.string().min(1).max(300),
  note: z.string().max(2_000).optional(),
});

export type CreatePersonalDataBreachIncidentInput = z.infer<
  typeof createPersonalDataBreachIncidentSchema
>;
export type UpdatePersonalDataBreachIncidentInput = z.infer<
  typeof updatePersonalDataBreachIncidentSchema
>;
export type CorrectBreachDiscoveryInput = z.infer<typeof correctBreachDiscoverySchema>;
export type ReopenPersonalDataBreachIncidentInput = z.infer<
  typeof reopenPersonalDataBreachIncidentSchema
>;
export type AddBreachRecipientNoticeInput = z.infer<typeof addBreachRecipientNoticeSchema>;
export type UpdateBreachRecipientNoticeInput = z.infer<typeof updateBreachRecipientNoticeSchema>;
export type PrepareBreachCustomerNoticeInput = z.infer<typeof prepareBreachCustomerNoticeSchema>;
export type PrepareBreachDataSubjectNoticeInput = PrepareBreachCustomerNoticeInput;
export type ApproveBreachCustomerNoticeInput = z.infer<typeof approveBreachCustomerNoticeSchema>;
export type RecordBreachCustomerNoticeSentInput = z.infer<
  typeof recordBreachCustomerNoticeSentSchema
>;
export type ApproveBreachAuthorityPackInput = z.infer<typeof approveBreachAuthorityPackSchema>;
export type RecordBreachAuthoritySubmissionInput = z.infer<
  typeof recordBreachAuthoritySubmissionSchema
>;
