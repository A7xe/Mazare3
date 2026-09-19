'use client';

import type {
  CreateOwnerPropertyDraftInput,
  CreateOwnerPropertyInput,
  OwnerApplicationView,
  OwnerApplyInput,
  OwnerAvailabilitySlotRow,
  OwnerBookingRow,
  OwnerDashboardSummary,
  OwnerPerformanceMetrics,
  OwnerPerformanceRange,
  OwnerPropertyCard,
  OwnerPropertyDetail,
  OwnerPropertyEdit,
  PatchOwnerAvailabilityInput,
  PropertyMediaItem,
  UpdateOwnerPropertyInput,
  PropertyAvailabilityRuleView,
  AvailabilityRuleInput,
  AvailabilityGenerationResult,
  AdminAvailabilityHealth,
  ApplyRuleToFutureInput,
  PublicBookingSummary,
  PropertyPromotionRow,
  PropertyCouponRow,
} from '@mazare3/shared';
import { getApiBaseUrl } from './api';

export class OwnerApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'OwnerApiError';
  }
}

async function ownerFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new OwnerApiError(
      (body as { error?: string }).error ?? 'Request failed',
      (body as { code?: string }).code,
      res.status,
    );
  }
  return body as T;
}

async function ownerFetchRaw<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: init?.headers,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new OwnerApiError(
      (body as { error?: string }).error ?? 'Request failed',
      (body as { code?: string }).code,
      res.status,
    );
  }
  return body as T;
}

export async function submitOwnerApplication(input: OwnerApplyInput) {
  return ownerFetch<{ data: OwnerApplicationView }>('/owner/apply', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchMyOwnerApplication() {
  return ownerFetch<{ data: OwnerApplicationView | null }>('/owner/application/me');
}

export async function fetchOwnerSummary() {
  return ownerFetch<{ data: OwnerDashboardSummary }>('/owner/summary');
}

export type OwnerLegalCommercialSummary = {
  ownerAgreement: {
    id: string;
    version: string;
    effectiveAt: string;
    acceptedAt: string | null;
    acceptedVersion: string | null;
  } | null;
  commission: {
    arrangement: 'standard_18' | 'verified_15' | 'custom';
    source: string;
    commissionPercent: number;
    termsId: string | null;
    version: number | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    status: string | null;
  };
  customTermsAcceptanceMissing: boolean;
  latestCustomAcceptance: {
    id: string;
    commercialTermsId: string;
    acceptedAt: string;
  } | null;
};

export async function fetchOwnerLegalCommercialSummary() {
  return ownerFetch<{ data: OwnerLegalCommercialSummary }>('/owner/legal-commercial-summary');
}

export async function fetchOwnerPerformance(range: OwnerPerformanceRange = '30d') {
  return ownerFetch<{ data: OwnerPerformanceMetrics }>(`/owner/performance?range=${range}`);
}

export async function fetchOwnerProperties() {
  return ownerFetch<{ data: OwnerPropertyCard[] }>('/owner/properties');
}

export async function fetchOwnerProperty(id: string) {
  return ownerFetch<{ data: OwnerPropertyDetail }>(`/owner/properties/${id}`);
}

export async function fetchOwnerBookings() {
  return ownerFetch<{ data: OwnerBookingRow[] }>('/owner/bookings');
}

/** Phase 3C.4D.6 — Owner view of Booking-time listing snapshot. */
export async function fetchOwnerBookingListingSnapshot(bookingId: string) {
  return ownerFetch<{
    data: import('@/components/bookings/booking-listing-snapshot-panel').ListingSnapshotApiResult;
  }>(`/owner/bookings/${encodeURIComponent(bookingId)}/listing-snapshot`);
}

export async function acceptOwnerBooking(id: string) {
  return ownerFetch<{ data: PublicBookingSummary }>(`/owner/bookings/${id}/accept`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function rejectOwnerBooking(id: string, reason?: string) {
  return ownerFetch<{ data: PublicBookingSummary }>(`/owner/bookings/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function previewOwnerCancel(bookingId: string, reasonCode: string) {
  const sp = new URLSearchParams({ reasonCode });
  return ownerFetch<{
    data: {
      customerRefund: number;
      ownerPayout: number;
      ownerPenaltyJod: number;
      forceMajeure: boolean;
    };
  }>(`/owner/bookings/${bookingId}/cancel-preview?${sp}`);
}

export async function cancelOwnerBooking(
  bookingId: string,
  input: { reasonCode: string; note?: string },
) {
  return ownerFetch<{ data: unknown }>(`/owner/bookings/${bookingId}/cancel`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function verifyOwnerCheckIn(bookingId: string, pin: string) {
  return ownerFetch<{ data: { verified: boolean } }>(`/owner/bookings/${bookingId}/verify-check-in`, {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });
}

export async function reportCustomerNoShowOwner(bookingId: string, evidence?: string) {
  return ownerFetch<{ data: unknown }>(`/owner/bookings/${bookingId}/report-no-show`, {
    method: 'POST',
    body: JSON.stringify({ evidence }),
  });
}

export type OwnerReschedulePreviewResult = {
  bookingId: string;
  toSlotId: string;
  fromMerchantValue: number;
  toListMerchantValue: number;
  pricingMode: string;
  customerContractedValue: number;
  commissionBasisValue: number;
  customerPayableDelta: number;
  ownerAbsorbsAmount: number;
  priceDelta: number;
};

export async function previewOwnerReschedule(bookingId: string, toSlotId: string) {
  const sp = new URLSearchParams({ toSlotId });
  return ownerFetch<{ data: OwnerReschedulePreviewResult }>(
    `/owner/bookings/${bookingId}/reschedule-preview?${sp}`,
    { cache: 'no-store' },
  );
}

export async function requestOwnerReschedule(bookingId: string, toSlotId: string) {
  return ownerFetch<{ data: unknown }>(`/owner/bookings/${bookingId}/reschedule`, {
    method: 'POST',
    body: JSON.stringify({ toSlotId }),
  });
}

export async function respondToOwnerReschedule(requestId: string, accept: boolean) {
  return ownerFetch<{ data: unknown }>(`/owner/reschedule-requests/${requestId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ accept }),
  });
}

export async function fetchOwnerAvailability(propertyId: string, from: string, to: string) {
  const sp = new URLSearchParams({ propertyId, from, to });
  return ownerFetch<{ data: OwnerAvailabilitySlotRow[] }>(`/owner/availability?${sp}`);
}

export async function patchOwnerAvailabilitySlot(slotId: string, input: PatchOwnerAvailabilityInput) {
  return ownerFetch<{ data: OwnerAvailabilitySlotRow }>(`/owner/availability/${slotId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchOwnerAvailabilityRules(propertyId: string) {
  return ownerFetch<{ data: PropertyAvailabilityRuleView[] }>(
    `/owner/properties/${propertyId}/availability-rules`,
  );
}

export async function putOwnerAvailabilityRules(propertyId: string, rules: AvailabilityRuleInput[]) {
  return ownerFetch<{ data: PropertyAvailabilityRuleView[] }>(
    `/owner/properties/${propertyId}/availability-rules`,
    { method: 'PUT', body: JSON.stringify({ rules }) },
  );
}

export async function fetchOwnerAvailabilityHealth(propertyId: string) {
  return ownerFetch<{ data: AdminAvailabilityHealth }>(
    `/owner/properties/${propertyId}/availability-health`,
  );
}

export async function previewOwnerAvailabilityGenerate(propertyId: string) {
  return ownerFetch<{ data: AvailabilityGenerationResult }>(
    `/owner/properties/${propertyId}/availability/generate-preview`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export async function generateOwnerAvailability(propertyId: string) {
  return ownerFetch<{ data: AvailabilityGenerationResult }>(
    `/owner/properties/${propertyId}/availability/generate`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export async function previewOwnerApplyRuleToFuture(propertyId: string, ruleId: string) {
  return ownerFetch<{ data: { count: number } }>(
    `/owner/properties/${propertyId}/availability-rules/${ruleId}/apply-future-preview`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export async function applyOwnerRuleToFuture(
  propertyId: string,
  ruleId: string,
  input: ApplyRuleToFutureInput = {},
) {
  return ownerFetch<{ data: { updated: number } }>(
    `/owner/properties/${propertyId}/availability-rules/${ruleId}/apply-future`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function createOwnerProperty(input: CreateOwnerPropertyInput) {
  return ownerFetch<{ data: OwnerPropertyEdit }>('/owner/properties', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** AF-1.1c — Create incomplete Add Farm draft from Basic Information only. */
export async function createOwnerPropertyDraft(input: CreateOwnerPropertyDraftInput) {
  return ownerFetch<{ data: OwnerPropertyEdit }>('/owner/properties/draft', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchOwnerPropertyEdit(id: string) {
  return ownerFetch<{ data: OwnerPropertyEdit }>(`/owner/properties/${id}/edit`);
}

export async function updateOwnerProperty(id: string, input: UpdateOwnerPropertyInput) {
  return ownerFetch<{ data: OwnerPropertyEdit }>(`/owner/properties/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function submitOwnerPropertyReview(id: string) {
  return ownerFetch<{ data: OwnerPropertyEdit }>(`/owner/properties/${id}/submit-review`, {
    method: 'POST',
  });
}

export async function uploadOwnerPropertyMediaFile(
  propertyId: string,
  file: File,
  opts?: { altAr?: string | null; altEn?: string | null },
) {
  const form = new FormData();
  form.append('file', file);
  if (opts?.altAr !== undefined) form.append('altAr', opts.altAr ?? '');
  if (opts?.altEn !== undefined) form.append('altEn', opts.altEn ?? '');

  return ownerFetchRaw<{ data: { media: PropertyMediaItem[] } }>(
    `/owner/properties/${propertyId}/media`,
    {
      method: 'POST',
      body: form,
    },
  );
}

export async function addOwnerPropertyMediaUrl(
  propertyId: string,
  url: string,
  opts?: { altAr?: string | null; altEn?: string | null },
) {
  return ownerFetch<{ data: { media: PropertyMediaItem[] } }>(
    `/owner/properties/${propertyId}/media`,
    {
      method: 'POST',
      body: JSON.stringify({
        url,
        ...(opts?.altAr !== undefined ? { altAr: opts.altAr } : {}),
        ...(opts?.altEn !== undefined ? { altEn: opts.altEn } : {}),
      }),
    },
  );
}

export async function patchOwnerPropertyMedia(
  propertyId: string,
  mediaId: string,
  input: { altAr?: string | null; altEn?: string | null },
) {
  return ownerFetch<{ data: { media: PropertyMediaItem[] } }>(
    `/owner/properties/${propertyId}/media/${mediaId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export async function deleteOwnerPropertyMedia(propertyId: string, mediaId: string) {
  return ownerFetch<{ data: { media: PropertyMediaItem[] } }>(
    `/owner/properties/${propertyId}/media/${mediaId}`,
    {
      method: 'DELETE',
    },
  );
}

export async function setOwnerPropertyMediaCover(propertyId: string, mediaId: string) {
  return ownerFetch<{ data: { media: PropertyMediaItem[] } }>(
    `/owner/properties/${propertyId}/media/${mediaId}/set-cover`,
    {
      method: 'POST',
    },
  );
}

export async function reorderOwnerPropertyMedia(
  propertyId: string,
  mediaIds: string[],
) {
  return ownerFetch<{ data: { media: PropertyMediaItem[] } }>(
    `/owner/properties/${propertyId}/media/reorder`,
    {
      method: 'PATCH',
      body: JSON.stringify({ mediaIds }),
    },
  );
}

export async function fetchOwnerReviews() {
  return ownerFetch<{ data: Array<{
    id: string;
    publicCode: string;
    propertySlug: string;
    propertyTitleAr: string;
    propertyTitleEn: string;
    customerDisplayName: string;
    rating: number;
    comment: string | null;
    status: string;
    createdAt: string;
  }> }>('/owner/reviews');
}

export async function fetchOwnerPromotions(propertyId: string) {
  return ownerFetch<{ data: PropertyPromotionRow[] }>(`/owner/properties/${propertyId}/promotions`);
}

export async function createOwnerPromotion(
  propertyId: string,
  input: {
    titleAr: string;
    titleEn: string;
    discountType: 'percentage' | 'fixed_amount';
    discountValue: number;
    startsAt: string;
    endsAt: string;
    period?: 'morning' | 'evening' | 'full_day' | 'overnight' | null;
  },
) {
  return ownerFetch<{ data: PropertyPromotionRow }>(`/owner/properties/${propertyId}/promotions`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function activateOwnerPromotion(propertyId: string, promoId: string) {
  return ownerFetch<{ data: PropertyPromotionRow }>(
    `/owner/properties/${propertyId}/promotions/${promoId}/activate`,
    { method: 'POST' },
  );
}

export async function pauseOwnerPromotion(propertyId: string, promoId: string) {
  return ownerFetch<{ data: PropertyPromotionRow }>(
    `/owner/properties/${propertyId}/promotions/${promoId}/pause`,
    { method: 'POST' },
  );
}

export async function fetchOwnerCoupons(propertyId: string) {
  return ownerFetch<{ data: PropertyCouponRow[] }>(`/owner/properties/${propertyId}/coupons`);
}

export async function createOwnerCoupon(
  propertyId: string,
  input: {
    code: string;
    discountType: 'percentage' | 'fixed_amount';
    discountValue: number;
    startsAt: string;
    endsAt: string;
    minBookingAmount?: number | null;
    maxUses?: number | null;
    maxUsesPerCustomer?: number;
  },
) {
  return ownerFetch<{ data: PropertyCouponRow }>(`/owner/properties/${propertyId}/coupons`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function activateOwnerCoupon(propertyId: string, couponId: string) {
  return ownerFetch<{ data: PropertyCouponRow }>(
    `/owner/properties/${propertyId}/coupons/${couponId}/activate`,
    { method: 'POST' },
  );
}

export async function pauseOwnerCoupon(propertyId: string, couponId: string) {
  return ownerFetch<{ data: PropertyCouponRow }>(
    `/owner/properties/${propertyId}/coupons/${couponId}/pause`,
    { method: 'POST' },
  );
}

export async function fetchOwnerSponsorshipPackages() {
  return ownerFetch<{ data: import('@mazare3/shared').SponsoredPlacementPackageRow[] }>(
    '/owner/sponsorship-packages',
  );
}

export async function fetchOwnerSponsorshipOrders(propertyId: string) {
  return ownerFetch<{ data: import('@mazare3/shared').SponsoredPlacementOrderRow[] }>(
    `/owner/properties/${propertyId}/sponsorship-orders`,
  );
}

export async function createOwnerSponsorshipOrder(propertyId: string, packageId: string) {
  return ownerFetch<{ data: import('@mazare3/shared').SponsoredPlacementOrderRow }>(
    `/owner/properties/${propertyId}/sponsorship-orders`,
    { method: 'POST', body: JSON.stringify({ packageId }) },
  );
}

/** Phase 3C.4D.3 — Property authority package */
export type OperatorPartyView = {
  id: string;
  ownerProfileId: string;
  entityKind: 'individual' | 'sole_establishment' | 'legal_entity';
  legalName: string;
  registrationNumber: string | null;
  registrationAuthority: string | null;
  country: string;
  contactEmail: string | null;
  contactPhone: string | null;
  isDefaultContractingOperator: boolean;
};

export type PropertyAuthorityPackage = {
  propertyId: string;
  accountHolderRelation: string | null;
  partnerKycStatus: string | null;
  partnerEntityType: string | null;
  contractingOperator: OperatorPartyView | null;
  declaredPropertyOwnerRelation: string | null;
  declaredPropertyOwner: OperatorPartyView | null;
  authorityBasis: string | null;
  authorityReviewStatus: string;
  authorityReviewReason: string | null;
  authorityReviewedAt: string | null;
  authorityAttestedAt: string | null;
  authorityAttestationVersion: string | null;
  platformVerificationStatus: string;
  evidence: Array<{
    id: string;
    documentType: string;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
    reviewStatus: string;
    propertyScoped: boolean;
    uploadedAt: string;
  }>;
  reviewEvents: Array<{
    id: string;
    previousStatus: string;
    newStatus: string;
    reasonCategory: string | null;
    reasonText: string | null;
    createdAt: string;
  }>;
  missingForSubmit: string[];
  canSubmitAuthorityPackage: boolean;
};

export async function listOperatorParties() {
  return ownerFetch<{ data: OperatorPartyView[] }>('/owner/operator-parties');
}

export async function upsertOperatorParty(input: {
  id?: string;
  entityKind: OperatorPartyView['entityKind'];
  legalName: string;
  registrationNumber?: string | null;
  registrationAuthority?: string | null;
  country?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  isDefaultContractingOperator?: boolean;
}) {
  return ownerFetch<{ data: OperatorPartyView }>('/owner/operator-parties', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchPropertyAuthority(propertyId: string) {
  return ownerFetch<{ data: PropertyAuthorityPackage }>(
    `/owner/properties/${propertyId}/authority`,
  );
}

export async function patchPropertyAuthority(
  propertyId: string,
  input: {
    contractingOperatorPartyId?: string | null;
    declaredPropertyOwnerRelation?: string;
    declaredPropertyOwnerPartyId?: string | null;
    authorityBasis?: string;
  },
) {
  return ownerFetch<{ data: PropertyAuthorityPackage }>(
    `/owner/properties/${propertyId}/authority`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export async function attestPropertyAuthority(propertyId: string, sourceSurface?: string) {
  return ownerFetch<{ data: PropertyAuthorityPackage }>(
    `/owner/properties/${propertyId}/authority/attest`,
    {
      method: 'POST',
      body: JSON.stringify({ accepted: true, sourceSurface }),
    },
  );
}

export async function uploadPropertyAuthorityDocument(
  propertyId: string,
  file: File,
  documentType: string,
) {
  const form = new FormData();
  form.append('file', file);
  form.append('documentType', documentType);
  return ownerFetchRaw<{ data: PropertyAuthorityPackage }>(
    `/owner/properties/${propertyId}/authority/documents`,
    { method: 'POST', body: form },
  );
}

/** Phase 3C.4D.4A — Property activity + regulatory */
export async function fetchPropertyRegulatory(propertyId: string) {
  return ownerFetch<{ data: Record<string, unknown> }>(
    `/owner/properties/${propertyId}/regulatory`,
  );
}

export async function putPropertyActivities(
  propertyId: string,
  activities: Array<{
    activityCode: string;
    otherDescription?: string | null;
    active?: boolean;
  }>,
) {
  return ownerFetch<{ data: Record<string, unknown> }>(
    `/owner/properties/${propertyId}/activities`,
    { method: 'PUT', body: JSON.stringify({ activities }) },
  );
}

export async function uploadRegulatoryEvidenceFile(
  propertyId: string,
  requirementId: string,
  file: File,
  meta?: { label?: string; documentNumber?: string; issuerName?: string; expiresAt?: string },
) {
  const form = new FormData();
  form.append('file', file);
  if (meta?.label) form.append('label', meta.label);
  if (meta?.documentNumber) form.append('documentNumber', meta.documentNumber);
  if (meta?.issuerName) form.append('issuerName', meta.issuerName);
  if (meta?.expiresAt) form.append('expiresAt', meta.expiresAt);
  return ownerFetchRaw<{ data: Record<string, unknown> }>(
    `/owner/properties/${propertyId}/regulatory/requirements/${requirementId}/evidence`,
    { method: 'POST', body: form },
  );
}

/** Phase 3C.4D.5 — Pool safety */
export async function fetchPropertyPoolSafety(propertyId: string) {
  return ownerFetch<{ data: Record<string, unknown> }>(
    `/owner/properties/${propertyId}/pool-safety`,
  );
}

export async function putPropertyPoolSafety(
  propertyId: string,
  body: Record<string, unknown>,
) {
  return ownerFetch<{ data: Record<string, unknown> }>(
    `/owner/properties/${propertyId}/pool-safety`,
    { method: 'PUT', body: JSON.stringify(body) },
  );
}

export async function attestPropertyPoolSafety(propertyId: string) {
  return ownerFetch<{ data: Record<string, unknown> }>(
    `/owner/properties/${propertyId}/pool-safety/attest`,
    {
      method: 'POST',
      body: JSON.stringify({
        accepted: true,
        sourceSurface: 'owner.add_farm_pool_safety',
      }),
    },
  );
}
