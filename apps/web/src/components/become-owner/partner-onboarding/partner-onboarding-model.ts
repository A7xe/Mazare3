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
  'review',
] as const;

export type PartnerOnboardingStepId = (typeof PARTNER_ONBOARDING_STEPS)[number];

/** Canonical post-approval payout setup (not a Partner wizard step). */
export const OWNER_PAYOUT_SETUP_HREF = '/owner/payout';

/** Legacy URL/bookmark ids — map to current step ids. */
export const LEGACY_PARTNER_STEP_ALIASES: Record<string, PartnerOnboardingStepId> = {
  requirements: 'documents',
  about: 'entity',
  about_you: 'entity',
  details: 'contact',
  partner_details: 'contact',
  /** PF-3 — Agreement is no longer a wizard step; open Review. */
  agreement: 'review',
  /** PF-5 — Payout moved post-approval; bookmarks open Review (or owner payout when approved). */
  payout: 'review',
  transfer: 'review',
};

/**
 * Resolve `?step=` / resume navigation ids.
 * Old `requirements` → documents; `agreement` → review (PF-3).
 * `about` / `about_you` → About You; `details` / `partner_details` → Partner Details.
 * Legacy `payout` → review (approved owners should use OWNER_PAYOUT_SETUP_HREF).
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
  reviewStatus: string | null;
} | null | undefined): PartnerPayoutUiState {
  if (!payout?.complete) return 'missing';
  if (
    payout.reviewStatus === 'rejected' ||
    payout.reviewStatus === 'action_required' ||
    payout.reviewStatus === 'reassessment_required'
  ) {
    return 'needs_attention';
  }
  if (payout.reviewStatus === 'reviewed') return 'reviewed';
  return 'saved'; // pending or null after save
}

/** Derived payout readiness — mirrors API owner-payout-readiness (view/API only). */
export function deriveOwnerPayoutReadiness(payout: {
  complete?: boolean;
  reviewStatus?: string | null;
  beneficiaryRelationship?: string | null;
  payoutReadiness?: string | null;
} | null | undefined): 'not_configured' | 'pending_review' | 'ready' | 'needs_attention' {
  if (payout?.payoutReadiness === 'ready') return 'ready';
  if (payout?.payoutReadiness === 'not_configured') return 'not_configured';
  if (payout?.payoutReadiness === 'needs_attention') return 'needs_attention';
  if (payout?.payoutReadiness === 'pending_review') return 'pending_review';
  if (!payout?.complete) return 'not_configured';
  if (payout.reviewStatus === 'reviewed') {
    if (
      payout.beneficiaryRelationship === 'authorised_third_party' ||
      payout.beneficiaryRelationship === 'other_review_required'
    ) {
      return 'pending_review';
    }
    return 'ready';
  }
  if (
    payout.reviewStatus === 'rejected' ||
    payout.reviewStatus === 'action_required' ||
    payout.reviewStatus === 'reassessment_required'
  ) {
    return 'needs_attention';
  }
  return 'pending_review';
}

export function isPayoutRelatedPartnerFieldKey(fieldKey: string): boolean {
  const key = fieldKey.trim().toLowerCase();
  if (key === 'document:payout_proof') return true;
  if (key === 'payout' || key === 'payout_profile' || key === 'transfer') return true;
  if (key.includes('iban') || key.includes('payout')) return true;
  return false;
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
  beneficiaryRelationship?: string;
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
  if (
    !form.beneficiaryRelationship ||
    ![
      'operator_self',
      'operator_legal_entity',
      'authorised_third_party',
      'other_review_required',
    ].includes(form.beneficiaryRelationship)
  ) {
    errors.beneficiaryRelationship = 'beneficiaryRelationship';
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

/** Meaningful saved progress — opening the page / GET alone must not count. */
export function hasMeaningfulPartnerProgress(view: PartnerOnboardingView | null | undefined): boolean {
  if (!view || view.started === false || !view.ownerProfileId) return false;
  if (view.verificationStatus && view.verificationStatus !== 'draft') return true;
  const name = emptyIfPartnerPlaceholder(view.displayName, PLACEHOLDER_PARTNER_NAME);
  const phone = emptyIfPartnerPlaceholder(view.phone, PLACEHOLDER_PARTNER_PHONE);
  // About You saved (name + partner city/area) is the first meaningful persistence.
  if (name.length >= 2 && (view.city?.trim().length ?? 0) >= 2 && (view.area?.trim().length ?? 0) >= 2) {
    return true;
  }
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
 *
 * entity = About You; contact = Partner Details (entity type + bio + contact).
 */
export function derivePartnerSectionCompletion(
  view: PartnerOnboardingView | null | undefined,
  requirements: PartnerRequirementRow[],
): PartnerSectionCompletion {
  if (!view || view.started === false || !view.ownerProfileId) {
    return {
      entity: false,
      contact: false,
      documents: false,
      review: false,
    };
  }

  const name = emptyIfPartnerPlaceholder(view.displayName, PLACEHOLDER_PARTNER_NAME);
  const phone = emptyIfPartnerPlaceholder(view.phone, PLACEHOLDER_PARTNER_PHONE);
  // About You — partner identity + location (not farm location). Farm count optional.
  const entity =
    name.length >= 2 &&
    (view.city?.trim().length ?? 0) >= 2 &&
    (view.area?.trim().length ?? 0) >= 2;

  // Partner Details — entity type, bio, phone, operating fallbacks.
  const contact =
    Boolean(view.entityType) &&
    (view.bio?.trim().length ?? 0) >= 20 &&
    phone.length >= 8 &&
    (view.legalName || name).trim().length >= 2 &&
    (view.operatingPhone || phone).trim().length >= 8 &&
    (view.operatingCity || view.city || '').trim().length >= 2 &&
    (view.operatingArea || view.area || '').trim().length >= 2;

  const documents =
    view.readiness.requiredDocumentsComplete ||
    (requirements.length > 0 &&
      requirements.filter((r) => r.required).every((r) => Boolean(r.currentDocument)));

  // Review is complete only when the application can submit (includes agreement).
  const review = view.readiness.canSubmit;

  return {
    entity,
    contact,
    documents,
    review,
  };
}

/**
 * Domain-derived resume landing step for editable drafts.
 * Does not lock completed steps from later navigation.
 */
export function derivePartnerResumeStep(
  completion: PartnerSectionCompletion,
  opts?: { status?: PartnerVerificationStatus | null; preferStep?: PartnerOnboardingStepId | null },
): PartnerOnboardingStepId {
  if (opts?.preferStep && (PARTNER_ONBOARDING_STEPS as readonly string[]).includes(opts.preferStep)) {
    return opts.preferStep;
  }
  for (const id of PARTNER_ONBOARDING_STEPS) {
    if (id === 'review') return 'review';
    if (!completion[id]) return id;
  }
  return 'review';
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
  if (key === 'agreement') return 'review';
  if (key === 'unresolved_changes') return 'review';
  return 'review';
}

/**
 * Prefer Documents when a change-request marks a document as needing attention.
 * Agreement corrections land on Review (where acceptance lives after PF-3).
 */
export function preferCorrectionStep(
  view: PartnerOnboardingView | null | undefined,
  requirements: PartnerRequirementRow[],
): PartnerOnboardingStepId | null {
  if (!view || view.verificationStatus !== 'changes_requested') return null;
  const needsDoc = requirements.some(
    (r) => partnerDocumentUiState(r.currentDocument) === 'needs_attention',
  );
  if (needsDoc) return 'documents';
  if (!hasAcceptedCurrentPartnerAgreement(view)) return 'review';
  return null;
}

/** Map admin/document change-request fieldKey → wizard step (PF-3 agreement → review). */
export function stepForPartnerChangeFieldKey(fieldKey: string): PartnerOnboardingStepId {
  const key = fieldKey.trim().toLowerCase();
  if (key === 'document:payout_proof' || isPayoutRelatedPartnerFieldKey(key)) {
    // PF-5: payout corrections are not Partner wizard steps — Review is safe fallback.
    return 'review';
  }
  if (key.startsWith('document:')) return 'documents';
  if (key === 'agreement' || key === 'terms' || key.includes('agreement')) return 'review';
  if (
    key === 'about' ||
    key === 'about_you' ||
    key === 'entity' ||
    key === 'displayname' ||
    key === 'display_name' ||
    key === 'city' ||
    key === 'area'
  ) {
    return 'entity';
  }
  if (
    key === 'contact' ||
    key === 'details' ||
    key === 'partner_details' ||
    key === 'phone' ||
    key === 'bio' ||
    key === 'entitytype' ||
    key === 'entity_type' ||
    key === 'businessname' ||
    key === 'business_name'
  ) {
    return 'contact';
  }
  if (key === 'profile') return 'entity';
  // Generic application / unknown → Review summary
  return 'review';
}

export type PartnerCorrectionAction = {
  id: string;
  step: PartnerOnboardingStepId;
  fieldKey: string;
  titleKey: string;
  reason: string | null;
  documentType?: string;
};

/**
 * Build partner-visible correction actions from open change requests +
 * document/payout needs-attention state (no invented admin notes).
 */
export function derivePartnerCorrectionActions(
  view: PartnerOnboardingView | null | undefined,
  requirements: PartnerRequirementRow[] = [],
): PartnerCorrectionAction[] {
  if (!view || view.verificationStatus !== 'changes_requested') return [];
  const actions: PartnerCorrectionAction[] = [];
  const seen = new Set<string>();

  const push = (action: PartnerCorrectionAction) => {
    const dedupe = `${action.step}:${action.fieldKey}:${action.documentType ?? ''}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    actions.push(action);
  };

  for (const req of view.openChangeRequests ?? []) {
    // PF-5: legacy payout CRs must not create Partner funnel correction loops.
    if (isPayoutRelatedPartnerFieldKey(req.fieldKey)) continue;
    const step = stepForPartnerChangeFieldKey(req.fieldKey);
    const docType = req.fieldKey.startsWith('document:')
      ? req.fieldKey.slice('document:'.length)
      : undefined;
    push({
      id: req.id,
      step,
      fieldKey: req.fieldKey,
      titleKey:
        step === 'documents'
          ? 'tracking.actionDocument'
          : step === 'entity'
            ? 'tracking.actionAbout'
            : step === 'contact'
              ? 'tracking.actionDetails'
              : step === 'review'
                ? 'tracking.actionAgreement'
                : 'tracking.actionApplication',
      reason: req.reason,
      documentType: docType,
    });
  }

  for (const row of requirements) {
    if (row.documentType === 'payout_proof') continue;
    if (partnerDocumentUiState(row.currentDocument) !== 'needs_attention') continue;
    push({
      id: `doc-${row.id}`,
      step: 'documents',
      fieldKey: `document:${row.documentType}`,
      titleKey: 'tracking.actionDocument',
      reason: row.currentDocument?.rejectionReason ?? view.changeRequestReason,
      documentType: row.documentType,
    });
  }

  // Payout needs-attention is handled on /owner/payout after approval — not Partner corrections.

  if (actions.length === 0 && view.changeRequestReason) {
    push({
      id: 'application',
      step: preferCorrectionStep(view, requirements) ?? 'review',
      fieldKey: 'application',
      titleKey: 'tracking.actionApplication',
      reason: view.changeRequestReason,
    });
  }

  return actions;
}

export type PartnerTimelineMilestoneId =
  | 'received'
  | 'under_review'
  | 'decision'
  | 'farm_setup'
  | 'publish';

export type PartnerTimelineMilestoneState =
  | 'complete'
  | 'current'
  | 'upcoming'
  | 'requires_action'
  | 'approved'
  | 'rejected'
  | 'future';

export type PartnerTimelineMilestone = {
  id: PartnerTimelineMilestoneId;
  state: PartnerTimelineMilestoneState;
  group: 'partner' | 'marketplace';
};

/** Domain-derived tracking milestones — no fake operational stages. */
export function derivePartnerTrackingTimeline(
  status: PartnerVerificationStatus | null | undefined,
): PartnerTimelineMilestone[] {
  const s = status ?? 'draft';
  const partnerApproved = s === 'approved' || s === 'legacy_approved';
  const rejected = s === 'rejected';
  const suspended = s === 'suspended';
  const changes = s === 'changes_requested';
  const underReview = s === 'under_review';
  const submitted = s === 'submitted';

  let received: PartnerTimelineMilestoneState = 'upcoming';
  let review: PartnerTimelineMilestoneState = 'upcoming';
  let decision: PartnerTimelineMilestoneState = 'upcoming';

  if (submitted) {
    received = 'current';
    review = 'upcoming';
    decision = 'upcoming';
  } else if (underReview) {
    received = 'complete';
    review = 'current';
    decision = 'upcoming';
  } else if (changes) {
    received = 'complete';
    review = 'complete';
    decision = 'requires_action';
  } else if (partnerApproved) {
    received = 'complete';
    review = 'complete';
    decision = 'approved';
  } else if (rejected) {
    received = 'complete';
    review = 'complete';
    decision = 'rejected';
  } else if (suspended) {
    received = 'complete';
    review = 'complete';
    decision = 'rejected'; // visual distinct via copy; state used for icon
  }

  return [
    { id: 'received', state: received, group: 'partner' },
    { id: 'under_review', state: review, group: 'partner' },
    { id: 'decision', state: decision, group: 'partner' },
    {
      id: 'farm_setup',
      state: partnerApproved ? 'current' : 'future',
      group: 'marketplace',
    },
    {
      id: 'publish',
      state: 'future',
      group: 'marketplace',
    },
  ];
}
