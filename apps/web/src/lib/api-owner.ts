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
