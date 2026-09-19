/**
 * Phase 3C.4D.3 — Owner / entity / authority schemas (shared Zod).
 * Authority approval ≠ KYC ≠ platform_verified ≠ regulatory readiness.
 */
import { z } from 'zod';

export const OPERATOR_ENTITY_KINDS = [
  'individual',
  'sole_establishment',
  'legal_entity',
] as const;

export const ACCOUNT_HOLDER_OPERATOR_RELATIONS = [
  'is_contracting_party',
  'acts_for_entity',
  'authorised_representative',
  'authorised_manager',
] as const;

export const DECLARED_PROPERTY_OWNER_RELATIONS = [
  'same_as_contracting_operator',
  'other_individual',
  'legal_entity',
  'other',
] as const;

export const PROPERTY_AUTHORITY_BASES = [
  'owner',
  'authorised_manager',
  'authorised_representative',
  'lessee',
  'sublessee',
  'other',
] as const;

export const PROPERTY_AUTHORITY_REVIEW_STATUSES = [
  'not_submitted',
  'under_review',
  'action_required',
  'approved',
  'rejected',
  'reassessment_required',
] as const;

export const AUTHORITY_DOCUMENT_TYPES = [
  'property_ownership',
  'management_authorization',
  'representation_authority',
  'lease_or_sublease_authority',
  'other',
] as const;

/** Attestation corpus — bump when copy changes; do not edit locked Owner Agreement. */
export const AUTHORITY_ATTESTATION_KEY = 'property_authority_to_offer' as const;
export const AUTHORITY_ATTESTATION_CORPUS_VERSION = '3c4d3-authority-attest-v1' as const;

export const upsertOperatorPartySchema = z.object({
  id: z.string().cuid().optional(),
  entityKind: z.enum(OPERATOR_ENTITY_KINDS),
  legalName: z.string().min(2).max(200),
  registrationNumber: z.string().max(80).optional().nullable(),
  registrationAuthority: z.string().max(120).optional().nullable(),
  country: z.string().min(2).max(2).optional().default('JO'),
  contactEmail: z.string().email().max(200).optional().nullable(),
  contactPhone: z.string().min(8).max(20).optional().nullable(),
  isDefaultContractingOperator: z.boolean().optional().default(false),
});

export const patchAccountHolderRelationSchema = z.object({
  accountHolderRelation: z.enum(ACCOUNT_HOLDER_OPERATOR_RELATIONS),
});

export const patchPropertyAuthoritySchema = z.object({
  contractingOperatorPartyId: z.string().cuid().optional().nullable(),
  declaredPropertyOwnerRelation: z.enum(DECLARED_PROPERTY_OWNER_RELATIONS).optional(),
  declaredPropertyOwnerPartyId: z.string().cuid().optional().nullable(),
  authorityBasis: z.enum(PROPERTY_AUTHORITY_BASES).optional(),
});

export const recordAuthorityAttestationSchema = z.object({
  accepted: z.literal(true),
  sourceSurface: z.string().min(3).max(120).optional(),
});

export const adminPropertyAuthorityDecisionSchema = z.object({
  decision: z.enum(['approve', 'request_changes', 'reject']),
  reasonCategory: z.string().min(2).max(80).optional(),
  reasonText: z.string().min(3).max(2000).optional(),
});

export type UpsertOperatorPartyInput = z.infer<typeof upsertOperatorPartySchema>;
export type PatchPropertyAuthorityInput = z.infer<typeof patchPropertyAuthoritySchema>;
export type AdminPropertyAuthorityDecisionInput = z.infer<
  typeof adminPropertyAuthorityDecisionSchema
>;

/** Product rules: which evidence types satisfy a declared authority basis. */
export function requiredAuthorityDocumentTypesForBasis(
  basis: (typeof PROPERTY_AUTHORITY_BASES)[number],
): readonly (typeof AUTHORITY_DOCUMENT_TYPES)[number][] {
  switch (basis) {
    case 'owner':
      return ['property_ownership'];
    case 'authorised_manager':
      return ['management_authorization'];
    case 'authorised_representative':
      return ['representation_authority', 'management_authorization'];
    case 'lessee':
    case 'sublessee':
      return ['lease_or_sublease_authority'];
    case 'other':
      return ['other', 'property_ownership', 'management_authorization'];
    default:
      return ['other'];
  }
}
