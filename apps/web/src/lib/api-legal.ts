'use client';

import type {
  AcceptedDocumentVersionIds,
  BookingLegalAckInput,
  CreateDataSubjectRequestInput,
  GrantDataProcessingConsentInput,
  GrantPrivacyConsentInput,
  RecordLegalAcceptanceInput,
} from '@mazare3/shared';
import { getApiBaseUrl } from './api';

export class LegalApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'LegalApiError';
  }
}

async function legalFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new LegalApiError(
      (body as { error?: string }).error ?? 'Request failed',
      (body as { code?: string }).code,
      res.status,
    );
  }
  return body as T;
}

export type PublicLegalDocument = {
  id: string;
  releaseId: string;
  documentType: string;
  version: string;
  language: string;
  title: string;
  content: string;
  contentHash: string;
  status: string;
  publishedAt: string | null;
  effectiveAt: string | null;
  supersededAt: string | null;
  createdAt: string;
  sourceRef: string | null;
};

export type LegalAcceptanceRow = {
  id: string;
  userId: string;
  documentVersionId: string;
  releaseId: string;
  documentType: string;
  documentVersion: string;
  documentHash: string;
  language: string;
  acceptedAt: string;
  acceptanceContext: string;
  relatedBookingId: string | null;
  relatedOwnerProfileId: string | null;
  sourceSurface: string | null;
  explicitAction: boolean;
  evidenceSource: string;
  withdrawnAt: string | null;
};

export type LegalAcceptanceStatus = {
  status: 'accepted' | 'missing' | 'superseded_still_valid' | 'reacceptance_required';
  activeReleaseId: string | null;
  activeVersionIds: string[];
  latestAcceptance: LegalAcceptanceRow | null;
};

export type ReacceptanceGate = {
  documentType: string;
  status: string;
  blocking: boolean;
  softGate: boolean;
  message: string | null;
};

export type MeLegalStatus = {
  customer: {
    gates: ReacceptanceGate[];
    requiresAction: boolean;
  };
  owner: {
    gates: ReacceptanceGate[];
    ownerAgreementReacceptanceRequired: boolean;
  };
  priorConsent?: {
    corpusVersion: string;
    purposes: Array<{
      purposeKey: string;
      validity: string;
      durationStatus: string;
      active: {
        id: string;
        purposeKey: string;
        purposeVersion: string;
        grantedAt: string;
        withdrawnAt: string | null;
        durationStatus: string;
        sourceSurface: string | null;
      } | null;
    }>;
  };
  byType: {
    terms_and_conditions: LegalAcceptanceStatus;
    privacy_policy: LegalAcceptanceStatus;
    cancellation_refund_policy: LegalAcceptanceStatus;
    booking_terms: LegalAcceptanceStatus;
    owner_agreement: ReacceptanceGate | null;
  };
};

export type PrivacyConsentRow = {
  id: string;
  userId: string;
  purposeCode: string;
  consentVersion: string;
  noticeVersionId: string | null;
  status: 'granted' | 'withdrawn';
  grantedAt: string;
  withdrawnAt: string | null;
  sourceSurface: string | null;
};

export type DataSubjectRequestRow = {
  id: string;
  userId: string;
  email: string | null;
  type: string;
  status: string;
  description: string | null;
  adminNote: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  handledByUserId: string | null;
};

export async function fetchActiveLegalDocument(
  type: string,
  lang: 'ar' | 'en' = 'ar',
): Promise<PublicLegalDocument | null> {
  const res = await fetch(
    `${getApiBaseUrl()}/legal/documents/${encodeURIComponent(type)}?lang=${lang}`,
    { credentials: 'include', cache: 'no-store' },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new LegalApiError(`Failed to load legal document ${type}`, undefined, res.status);
  }
  const body = (await res.json()) as { data: PublicLegalDocument };
  return body.data;
}

export async function fetchLegalDocumentVersion(
  type: string,
  versionId: string,
): Promise<PublicLegalDocument | null> {
  const res = await fetch(
    `${getApiBaseUrl()}/legal/documents/${encodeURIComponent(type)}/versions/${encodeURIComponent(versionId)}`,
    { credentials: 'include', cache: 'no-store' },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new LegalApiError(`Failed to load legal version ${versionId}`, undefined, res.status);
  }
  const body = (await res.json()) as { data: PublicLegalDocument };
  return body.data;
}

/** Resolve Terms + Privacy version IDs required for signup (separate acknowledgements). */
export async function resolveSignupLegalVersionIds(locale: 'ar' | 'en'): Promise<{
  acceptedTermsVersionId: string;
  acknowledgedPrivacyVersionId: string;
}> {
  const [terms, privacy] = await Promise.all([
    fetchActiveLegalDocument('terms_and_conditions', locale),
    fetchActiveLegalDocument('privacy_policy', locale),
  ]);
  if (!terms?.id || !privacy?.id) {
    throw new LegalApiError('LEGAL_VERSIONS_UNAVAILABLE', 'LEGAL_VERSIONS_UNAVAILABLE');
  }
  return {
    acceptedTermsVersionId: terms.id,
    acknowledgedPrivacyVersionId: privacy.id,
  };
}

/** Resolve booking/checkout document version IDs (ACTIVE only). */
export async function resolveBookingLegalVersionIds(locale: 'ar' | 'en'): Promise<{
  terms: string;
  cancellation: string;
  bookingTerms: string;
  privacy: string | null;
}> {
  const set = await fetchCustomerBookingLegalSet(locale);
  if (!set.corpusReady) {
    throw new LegalApiError('LEGAL_VERSIONS_UNAVAILABLE', 'LEGAL_VERSIONS_UNAVAILABLE');
  }
  const terms = set.documents.terms?.versionId;
  const cancellation = set.documents.cancellation?.versionId;
  const bookingTerms = set.documents.bookingTerms?.versionId;
  if (!terms || !cancellation || !bookingTerms) {
    throw new LegalApiError('LEGAL_VERSIONS_UNAVAILABLE', 'LEGAL_VERSIONS_UNAVAILABLE');
  }
  return {
    terms,
    cancellation,
    bookingTerms,
    privacy: set.documents.privacy?.versionId ?? null,
  };
}

export type CustomerBookingLegalSet = {
  corpusReady: boolean;
  enforcementStrict: boolean;
  blockers: string[];
  acceptancePresentationKey: string;
  documents: {
    terms: { versionId: string; version: string; title: string; language: string } | null;
    cancellation: { versionId: string; version: string; title: string; language: string } | null;
    bookingTerms: { versionId: string; version: string; title: string; language: string } | null;
    privacy: { versionId: string; version: string; title: string; language: string } | null;
  };
};

export async function fetchCustomerBookingLegalSet(
  locale: 'ar' | 'en',
): Promise<CustomerBookingLegalSet> {
  const res = await legalFetch<{ data: CustomerBookingLegalSet }>(
    `/legal/customer-booking-set?lang=${locale}`,
  );
  return res.data;
}

export async function fetchMyLegalStatus() {
  return legalFetch<{ data: MeLegalStatus }>('/me/legal/status');
}

export async function acceptLegalDocument(input: RecordLegalAcceptanceInput) {
  return legalFetch<{ data: LegalAcceptanceRow }>('/me/legal/accept', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function grantPrivacyConsent(input: GrantPrivacyConsentInput) {
  return legalFetch<{ data: PrivacyConsentRow }>('/me/privacy-consents', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type PriorConsentStatusPayload = NonNullable<MeLegalStatus['priorConsent']>;

export type DataProcessingConsentRow = {
  id: string;
  userId: string;
  purposeKey: string;
  purposeVersion: string;
  language: string;
  consentTextHash: string;
  status: string;
  grantedAt: string;
  withdrawnAt: string | null;
  supersededAt: string | null;
  expiresAt: string | null;
  durationStatus: string;
  validityEvent: string | null;
  sourceSurface: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  privacyNoticeVersionId: string | null;
};

export async function grantPriorConsent(input: GrantDataProcessingConsentInput) {
  return legalFetch<{ data: DataProcessingConsentRow }>('/me/prior-consents', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function withdrawPriorConsent(purpose: string) {
  return legalFetch<{ data: DataProcessingConsentRow }>(
    `/me/prior-consents/${encodeURIComponent(purpose)}/withdraw`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export async function fetchPriorConsentStatus() {
  return legalFetch<{ data: PriorConsentStatusPayload }>('/me/prior-consents');
}

export async function withdrawPrivacyConsent(purpose: string) {
  return legalFetch<{ data: PrivacyConsentRow }>(
    `/me/privacy-consents/${encodeURIComponent(purpose)}/withdraw`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export async function listPrivacyConsents() {
  return legalFetch<{ data: PrivacyConsentRow[] }>('/me/privacy-consents');
}

export async function createDataSubjectRequest(input: CreateDataSubjectRequestInput) {
  return legalFetch<{ data: DataSubjectRequestRow }>('/me/data-subject-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listDataSubjectRequests() {
  return legalFetch<{ data: DataSubjectRequestRow[] }>('/me/data-subject-requests');
}

export async function ackBookingLegal(bookingId: string, input: BookingLegalAckInput) {
  return legalFetch<{
    data: { acceptances: LegalAcceptanceRow[]; snapshot: unknown };
  }>(`/me/bookings/${encodeURIComponent(bookingId)}/legal-ack`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type CustomerBookingLegalSnapshot = {
  bookingId: string;
  financialPolicyKey: string;
  createdAt: string;
  acceptedAt: string | null;
  documents: Array<{
    documentType: string;
    versionId: string;
    version: string;
    title: string;
    language: string;
    status: string;
    publishedAt: string | null;
    effectiveAt: string | null;
  }>;
  evidence: {
    bookingTermsVersion: string | null;
    cancellationPolicyVersion: string | null;
    termsVersion: string | null;
    financialPolicyKey: string;
    acceptedAt: string | null;
  };
};

export async function fetchBookingLegalSnapshot(bookingId: string) {
  return legalFetch<{ data: CustomerBookingLegalSnapshot | null }>(
    `/me/bookings/${encodeURIComponent(bookingId)}/legal-snapshot`,
  );
}

export type PublicLegalVersionMeta = {
  id: string;
  documentType: string;
  version: string;
  language: string;
  title: string;
  status: string;
  publishedAt: string | null;
  effectiveAt: string | null;
  supersededAt: string | null;
};

export async function fetchLegalDocumentVersions(
  type: string,
  lang: 'ar' | 'en' = 'ar',
): Promise<PublicLegalVersionMeta[]> {
  const res = await fetch(
    `${getApiBaseUrl()}/legal/documents/${encodeURIComponent(type)}/versions?lang=${lang}`,
    { credentials: 'include', cache: 'no-store' },
  );
  if (res.status === 404) return [];
  if (!res.ok) {
    throw new LegalApiError(`Failed to load legal versions for ${type}`, undefined, res.status);
  }
  const body = (await res.json()) as { data: PublicLegalVersionMeta[] };
  return body.data;
}

export type { AcceptedDocumentVersionIds };
