/**
 * Phase 3C.4D.4A — Property activity + regulatory requirement shared schemas.
 * Activity ≠ automatic licence. Owner cannot self-verify / self-N/A.
 */
import { z } from 'zod';

export const PROPERTY_ACTIVITY_CODES = [
  'day_use',
  'overnight_accommodation',
  'events',
  'swimming_pool',
  'food_service',
  'other',
] as const;

export const REGULATORY_REQUIREMENT_TYPES = [
  'tourism_regulatory_status',
  'municipal_or_professional_licence',
  'pool_regulatory_assessment',
  'civil_liability_insurance',
  'other',
] as const;

export const REGULATORY_APPLICABILITIES = [
  'unassessed',
  'applicable',
  'not_applicable_confirmed',
  'regulatory_confirmation_required',
] as const;

export const REGULATORY_COMPLIANCE_STATUSES = [
  'not_assessed',
  'under_review',
  'action_required',
  'verified',
  'rejected',
  'expired',
] as const;

export const PROPERTY_REGULATORY_READINESS_STATES = [
  'not_started',
  'incomplete',
  'under_review',
  'action_required',
  'ready',
  'expired_or_blocked',
] as const;

/** Product warning threshold only — not a legal validity period. */
export const REGULATORY_DOCUMENT_EXPIRY_WARNING_DAYS_DEFAULT = 30;

export const putPropertyActivitiesSchema = z.object({
  activities: z
    .array(
      z.object({
        activityCode: z.enum(PROPERTY_ACTIVITY_CODES),
        otherDescription: z.string().max(200).optional().nullable(),
        active: z.boolean().optional().default(true),
      }),
    )
    .min(1)
    .max(12),
});

export const adminRegulatoryDecisionSchema = z.object({
  applicability: z.enum(REGULATORY_APPLICABILITIES).optional(),
  complianceStatus: z.enum(REGULATORY_COMPLIANCE_STATUSES).optional(),
  issuingAuthority: z.string().max(160).optional().nullable(),
  referenceNumber: z.string().max(120).optional().nullable(),
  issueDate: z.string().datetime().optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  reasonCategory: z.string().min(2).max(80).optional(),
  reasonText: z.string().max(2000).optional(),
});

export type PutPropertyActivitiesInput = z.infer<typeof putPropertyActivitiesSchema>;
export type AdminRegulatoryDecisionInput = z.infer<typeof adminRegulatoryDecisionSchema>;

/** Assessment seeds from activities — creates assessment rows, never marks applicable/verified. */
export function requirementTypesSuggestedByActivities(
  codes: readonly (typeof PROPERTY_ACTIVITY_CODES)[number][],
): (typeof REGULATORY_REQUIREMENT_TYPES)[number][] {
  const out = new Set<(typeof REGULATORY_REQUIREMENT_TYPES)[number]>();
  // Conservative municipal assessment at Property regulatory review level
  out.add('municipal_or_professional_licence');
  if (codes.includes('overnight_accommodation')) {
    out.add('tourism_regulatory_status');
  }
  if (codes.includes('swimming_pool')) {
    out.add('pool_regulatory_assessment');
  }
  // civil_liability_insurance intentionally NOT auto-seeded as required
  return [...out];
}

export function isRequirementSatisfiedForReadiness(params: {
  applicability: (typeof REGULATORY_APPLICABILITIES)[number];
  complianceStatus: (typeof REGULATORY_COMPLIANCE_STATUSES)[number];
  expiresAt: Date | null | undefined;
  now?: Date;
}): boolean {
  if (params.applicability === 'not_applicable_confirmed') return true;
  if (params.applicability !== 'applicable') return false;
  if (params.complianceStatus !== 'verified') return false;
  if (params.expiresAt && params.expiresAt.getTime() <= (params.now ?? new Date()).getTime()) {
    return false;
  }
  return true;
}
