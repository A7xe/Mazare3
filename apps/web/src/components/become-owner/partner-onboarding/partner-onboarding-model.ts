import type {
  PartnerDocumentView,
  PartnerOnboardingView,
  PartnerRequirementRow,
  PartnerVerificationStatus,
} from '@/lib/api-partner';

export const PARTNER_ONBOARDING_STEPS = [
  'entity',
  'contact',
  'documents',
  'payout',
  'agreement',
  'review',
] as const;

export type PartnerOnboardingStepId = (typeof PARTNER_ONBOARDING_STEPS)[number];

/** Legacy URL/bookmark ids — both map to the combined Documents step. */
export const LEGACY_PARTNER_STEP_ALIASES: Record<string, PartnerOnboardingStepId> = {
  requirements: 'documents',
};

/**
 * Resolve `?step=` / resume navigation ids.
 * Old `requirements` and `documents` both open the combined Documents step.
 */
export function resolvePartnerOnboardingStepId(
  raw: string | null | undefined,
): PartnerOnboardingStepId | null {
  if (!raw) return null;
  const aliased = LEGACY_PARTNER_STEP_ALIASES[raw];
  if (aliased) return aliased;
  if ((PARTNER_ONBOARDING_STEPS as readonly string[]).includes(raw)) {
    return raw as PartnerOnboardingStepId;
  }
  return null;
}

export const EDITABLE_PARTNER_STATUSES: PartnerVerificationStatus[] = ['draft', 'changes_requested'];
export const APPROVED_PARTNER_STATUSES: PartnerVerificationStatus[] = ['approved', 'legacy_approved'];
export const PENDING_PARTNER_STATUSES: PartnerVerificationStatus[] = ['submitted', 'under_review'];

export const PLACEHOLDER_PARTNER_NAME = 'شريك جديد';
export const PLACEHOLDER_PARTNER_PHONE = '00000000';

/** Matches API default PARTNER_DOCUMENT_MAX_MB (server remains authoritative). */
export const PARTNER_DOC_MAX_MB_DEFAULT = 8;
export const PARTNER_DOC_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
export const PARTNER_DOC_ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export function emptyIfPartnerPlaceholder(value: string | null | undefined, placeholder: string) {
  if (!value || value === placeholder) return '';
  return value;
}

/**
 * True when persisted operating location is a genuine override of partner city/area.
 * Exact copies of Step 1 city/area (legacy duplicate writes) are treated as not distinct.
 */
export function hasDistinctOperatingLocation(params: {
  city?: string | null;
  area?: string | null;
  operatingCity?: string | null;
  operatingArea?: string | null;
}): boolean {
  const city = (params.city ?? '').trim();
  const area = (params.area ?? '').trim();
  const opCity = (params.operatingCity ?? '').trim();
  const opArea = (params.operatingArea ?? '').trim();
  if (!opCity && !opArea) return false;
  if (opCity === city && opArea === area) return false;
  const cityDistinct = Boolean(opCity && opCity !== city);
  const areaDistinct = Boolean(opArea && opArea !== area);
  return cityDistinct || areaDistinct;
}

/** Strip internal legal-review prefixes from checklist copy for applicants. */
export function cleanPartnerRequirementText(text: string): string {
  return text
    .replace(/^\[LEGAL REVIEW REQUIRED BEFORE PRODUCTION\]\s*/i, '')
    .replace(/^\[للمراجعة القانونية قبل الإنتاج\]\s*/i, '')
    .trim();
}

/** Applicant-facing document state mapped from OwnerDocumentReviewStatus. */
export type PartnerDocUiState =
  | 'missing'
  | 'uploaded'
  | 'under_review'
  | 'accepted'
  | 'needs_attention';

export function partnerDocumentUiState(
  doc: PartnerDocumentView | null | undefined,
): PartnerDocUiState {
  if (!doc || doc.superseded || doc.reviewStatus === 'superseded') return 'missing';
  if (doc.reviewStatus === 'rejected') return 'needs_attention';
  if (doc.reviewStatus === 'approved') return 'accepted';
  if (doc.reviewStatus === 'under_review') return 'under_review';
  return 'uploaded';
}

export function countRequiredPartnerDocuments(requirements: PartnerRequirementRow[]) {
  const required = requirements.filter((r) => r.required);
  const uploaded = required.filter((r) => Boolean(r.currentDocument)).length;
  return { requiredTotal: required.length, uploadedRequired: uploaded, optionalTotal: requirements.filter((r) => !r.required).length };
}

export function missingRequiredPartnerDocuments(requirements: PartnerRequirementRow[]) {
  return requirements.filter((r) => r.required && !r.currentDocument);
}

export function getPartnerPayoutProofRequirement(requirements: PartnerRequirementRow[]) {
  return requirements.find((r) => r.documentType === 'payout_proof') ?? null;
}

/** Applicant-facing payout review status (OwnerPayoutReviewStatus). */
export type PartnerPayoutUiState = 'missing' | 'saved' | 'reviewed' | 'needs_attention';

export function partnerPayoutUiState(payout: {
  complete: boolean;
  reviewStatus: 'pending' | 'reviewed' | 'rejected' | null;
} | null | undefined): PartnerPayoutUiState {
  if (!payout?.complete) return 'missing';
  if (payout.reviewStatus === 'rejected') return 'needs_attention';
  if (payout.reviewStatus === 'reviewed') return 'reviewed';
  return 'saved'; // pending or null after save
}

/** Reject masked/placeholder strings so they are never PATCH'd as real IBANs. */
export function looksLikeMaskedPayoutValue(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.includes('•') || v.includes('*')) return true;
  if (/^x{4,}$/i.test(v.replace(/\s+/g, ''))) return true;
  return false;
}

export function validatePartnerPayoutForm(form: {
  beneficiaryName: string;
  bankName: string;
  iban: string;
}): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (form.beneficiaryName.trim().length < 2) errors.beneficiaryName = 'beneficiaryName';
  if (form.bankName.trim().length < 2) errors.bankName = 'bankName';
  const iban = form.iban.trim();
  if (iban.length < 8 || iban.length > 40) errors.iban = 'iban';
  if (looksLikeMaskedPayoutValue(iban)) errors.iban = 'ibanMasked';
  if (looksLikeMaskedPayoutValue(form.beneficiaryName) || looksLikeMaskedPayoutValue(form.bankName)) {
    errors.beneficiaryName = errors.beneficiaryName ?? 'masked';
  }
  return Object.keys(errors).length ? errors : null;
}

export function validatePartnerDocumentFile(file: File): 'ok' | 'type' | 'size' {
  const type = (file.type || '').toLowerCase();
  const typeOk =
    PARTNER_DOC_ALLOWED_TYPES.includes(type as (typeof PARTNER_DOC_ALLOWED_TYPES)[number]) ||
    type === 'image/jpg';
  if (!typeOk) return 'type';
  const maxBytes = PARTNER_DOC_MAX_MB_DEFAULT * 1024 * 1024;
  if (file.size > maxBytes) return 'size';
  return 'ok';
}

/** Meaningful saved progress — opening the page alone must not count. */
export function hasMeaningfulPartnerProgress(view: PartnerOnboardingView | null | undefined): boolean {
  if (!view) return false;
  if (view.verificationStatus !== 'draft') return true;
  const name = emptyIfPartnerPlaceholder(view.displayName, PLACEHOLDER_PARTNER_NAME);
  const phone = emptyIfPartnerPlaceholder(view.phone, PLACEHOLDER_PARTNER_PHONE);
  if (view.entityType && name.length >= 2 && (view.bio?.trim().length ?? 0) >= 20) return true;
  if (view.entityType && name.length >= 2 && phone.length >= 8) return true;
  if (view.documents.length > 0) return true;
  if (view.payout.complete) return true;
  if (view.acceptedAgreement) return true;
  if (view.readiness.profileComplete) return true;
  return false;
}

export type PartnerSectionCompletion = Record<PartnerOnboardingStepId, boolean>;

/**
 * Truthful section completion from persisted onboarding + requirements.
 * Visiting a step does not mark it complete.
 */
export function derivePartnerSectionCompletion(
  view: PartnerOnboardingView | null | undefined,
  requirements: PartnerRequirementRow[],
): PartnerSectionCompletion {
  if (!view) {
    return {
      entity: false,
      contact: false,
      documents: false,
      payout: false,
      agreement: false,
      review: false,
    };
  }

  const name = emptyIfPartnerPlaceholder(view.displayName, PLACEHOLDER_PARTNER_NAME);
  const phone = emptyIfPartnerPlaceholder(view.phone, PLACEHOLDER_PARTNER_PHONE);
  // Step 1 — partner identity (phone belongs to Contact / Step 2).
  const entity =
    Boolean(view.entityType) &&
    name.length >= 2 &&
    (view.city?.trim().length ?? 0) >= 2 &&
    (view.area?.trim().length ?? 0) >= 2 &&
    (view.bio?.trim().length ?? 0) >= 20;

  // Step 2 — contact (primary phone required; operating fields fall back to Step 1).
  const contact =
    phone.length >= 8 &&
    (view.legalName || name).trim().length >= 2 &&
    (view.operatingPhone || phone).trim().length >= 8 &&
    (view.operatingCity || view.city || '').trim().length >= 2 &&
    (view.operatingArea || view.area || '').trim().length >= 2;

  // Combined Documents — complete only when all required canonical docs are present
  // (same applicant submit gate; optional docs do not count).
  const documents =
    view.readiness.requiredDocumentsComplete ||
    (requirements.length > 0 &&
      requirements.filter((r) => r.required).every((r) => Boolean(r.currentDocument)));

  const payout = view.readiness.payoutProfileComplete || view.payout.complete;
  // Current active agreement only — stale acceptance of an old id does not count.
  const agreement =
    view.readiness.agreementAccepted ||
    Boolean(
      view.currentAgreement &&
        view.acceptedAgreement &&
        view.acceptedAgreement.agreementId === view.currentAgreement.id,
    );
  const review = view.readiness.canSubmit;

  return {
    entity,
    contact,
    documents,
    payout,
    agreement,
    review,
  };
}

export function partnerProgressPercent(completion: PartnerSectionCompletion): number {
  const total = PARTNER_ONBOARDING_STEPS.length;
  const done = PARTNER_ONBOARDING_STEPS.filter((id) => completion[id]).length;
  return Math.round((done / total) * 100);
}

export function partnerCompletedSectionCount(completion: PartnerSectionCompletion): number {
  return PARTNER_ONBOARDING_STEPS.filter((id) => completion[id]).length;
}

/** Applicant submit-gate missing keys (exclude admin-only commercial_terms / *_approved). */
export const APPLICANT_SUBMIT_MISSING_KEYS = [
  'profile',
  'required_documents',
  'payout_profile',
  'agreement',
  'unresolved_changes',
] as const;

export function hasAcceptedCurrentPartnerAgreement(
  view: PartnerOnboardingView | null | undefined,
): boolean {
  if (!view) return false;
  if (view.readiness.agreementAccepted) return true;
  return Boolean(
    view.currentAgreement &&
      view.acceptedAgreement &&
      view.acceptedAgreement.agreementId === view.currentAgreement.id,
  );
}

export function applicantSubmitMissingKeys(view: PartnerOnboardingView | null | undefined): string[] {
  if (!view) return [...APPLICANT_SUBMIT_MISSING_KEYS];
  return view.readiness.missingRequirements.filter((k) =>
    (APPLICANT_SUBMIT_MISSING_KEYS as readonly string[]).includes(k),
  );
}

export function stepForApplicantMissingKey(
  key: string,
  completion: PartnerSectionCompletion,
): PartnerOnboardingStepId {
  if (key === 'profile') return completion.entity ? 'contact' : 'entity';
  if (key === 'required_documents') return 'documents';
  if (key === 'payout_profile') return 'payout';
  if (key === 'agreement') return 'agreement';
  if (key === 'unresolved_changes') return 'review';
  return 'review';
}
