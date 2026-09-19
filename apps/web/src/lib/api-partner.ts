'use client';

import type {
  AcceptPartnerAgreementInput,
  PatchPartnerOnboardingProfileInput,
  PutPartnerPayoutProfileInput,
} from '@mazare3/shared';
import { getApiBaseUrl } from './api';

export type PartnerEntityType = 'individual' | 'business';

export type PartnerVerificationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'legacy_approved';

export type PartnerDocumentType =
  | 'identity'
  | 'property_ownership'
  | 'management_authorization'
  | 'business_registration'
  | 'payout_proof'
  | 'other'
  | 'representation_authority'
  | 'lease_or_sublease_authority';

export type AccountHolderOperatorRelation =
  | 'is_contracting_party'
  | 'acts_for_entity'
  | 'authorised_representative'
  | 'authorised_manager';

export type PartnerDocumentView = {
  id: string;
  documentType: PartnerDocumentType;
  requirementId: string | null;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  reviewStatus: 'uploaded' | 'under_review' | 'approved' | 'rejected' | 'superseded';
  rejectionReason: string | null;
  uploadedAt: string;
  reviewedAt: string | null;
  superseded: boolean;
};

export type PartnerReadiness = {
  profileComplete: boolean;
  requiredDocumentsComplete: boolean;
  requiredDocumentsApproved: boolean;
  payoutProfileComplete: boolean;
  payoutProfileApproved: boolean;
  agreementAccepted: boolean;
  commercialTermsReady: boolean;
  unresolvedChanges: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  missingRequirements: string[];
};

export type PartnerPayoutView = {
  complete: boolean;
  beneficiaryNameMasked: string | null;
  bankNameMasked: string | null;
  ibanMasked: string | null;
  reviewStatus:
    | 'pending'
    | 'reviewed'
    | 'rejected'
    | 'action_required'
    | 'reassessment_required'
    | null;
  reviewReason: string | null;
  reviewReasonCategory?: string | null;
  beneficiaryRelationship?: string | null;
  nameMatchHint?: string | null;
  payoutCountry?: string | null;
  payoutReadiness?: string | null;
  updatedAt: string | null;
};

export type PartnerAgreementView = {
  id: string;
  version: string;
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  summaryEn: string;
  contentAr: string;
  contentEn: string;
  effectiveAt: string;
  legalReviewPlaceholder: boolean;
};

export type PartnerAcceptedAgreementView = {
  agreementId: string;
  version: string;
  acceptedAt: string;
  acceptedLocale: string | null;
};

export type PartnerOnboardingView = {
  started: boolean;
  ownerProfileId: string | null;
  ownerStatus: string | null;
  verificationStatus: PartnerVerificationStatus | null;
  entityType: PartnerEntityType | null;
  accountHolderRelation: AccountHolderOperatorRelation | null;
  legacyApproved: boolean;
  complianceNotice: boolean;
  displayName: string;
  businessName: string | null;
  phone: string;
  city: string | null;
  area: string | null;
  bio: string | null;
  approximateFarmCount: number | null;
  legalName: string | null;
  operatingPhone: string | null;
  operatingCity: string | null;
  operatingArea: string | null;
  contactEmail: string | null;
  changeRequestReason: string | null;
  openChangeRequests: {
    id: string;
    fieldKey: string;
    reason: string;
    createdAt: string;
  }[];
  rejectionReason: string | null;
  suspensionReason: string | null;
  submittedAt: string | null;
  documents: PartnerDocumentView[];
  payout: PartnerPayoutView;
  currentAgreement: PartnerAgreementView | null;
  acceptedAgreement: PartnerAcceptedAgreementView | null;
  commercialTerms: {
    source: 'property_terms' | 'owner_terms' | 'platform_default';
    commissionPercent: number;
    termsId: string | null;
  };
  readiness: PartnerReadiness;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PartnerRequirementRow = {
  id: string;
  documentType: PartnerDocumentType;
  required: boolean;
  optional: boolean;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  sortOrder: number;
  currentDocument: PartnerDocumentView | null;
};

export type PartnerAgreementBundle = {
  current: PartnerAgreementView | null;
  accepted: PartnerAcceptedAgreementView | null;
};

export class PartnerApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'PartnerApiError';
  }
}

async function partnerFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new PartnerApiError(
      (body as { error?: string }).error ?? 'Request failed',
      (body as { code?: string }).code,
      res.status,
      (body as { details?: unknown }).details,
    );
  }
  return body as T;
}

export async function fetchPartnerOnboarding() {
  return partnerFetch<{ data: PartnerOnboardingView }>('/owner/onboarding');
}

export async function patchPartnerOnboarding(input: PatchPartnerOnboardingProfileInput) {
  return partnerFetch<{ data: PartnerOnboardingView }>('/owner/onboarding', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchPartnerRequirements() {
  return partnerFetch<{ data: PartnerRequirementRow[] }>('/owner/onboarding/requirements');
}

export async function fetchOwnerPayoutRequirements() {
  return partnerFetch<{ data: PartnerRequirementRow[] }>('/owner/payout-requirements');
}

export async function uploadPartnerDocument(file: File, requirementId: string) {
  const form = new FormData();
  form.append('file', file);
  form.append('requirementId', requirementId);
  return partnerFetch<{ data: PartnerDocumentView }>('/owner/onboarding/documents', {
    method: 'POST',
    body: form,
  });
}

export async function putPartnerPayoutProfile(input: PutPartnerPayoutProfileInput) {
  return partnerFetch<{ data: PartnerOnboardingView }>('/owner/payout-profile', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function fetchPartnerAgreement() {
  return partnerFetch<{ data: PartnerAgreementBundle }>('/owner/partner-agreement');
}

export async function acceptPartnerAgreement(input: AcceptPartnerAgreementInput) {
  return partnerFetch<{ data: PartnerAgreementBundle }>('/owner/partner-agreement/accept', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function submitPartnerOnboarding() {
  return partnerFetch<{ data: PartnerOnboardingView }>('/owner/onboarding/submit', {
    method: 'POST',
  });
}
