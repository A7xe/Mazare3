'use client';

import type { CreateBookingInput, PublicBookingSummary, RebookIntent } from '@mazare3/shared';
import { getApiBaseUrl } from './api';

export class BookingApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'BookingApiError';
  }
}

async function bookingFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new BookingApiError(
      (body as { error?: string }).error ?? 'Request failed',
      (body as { code?: string }).code,
      res.status,
    );
  }
  return body as T;
}

export async function validatePropertyCoupon(
  slug: string,
  input: { code: string; date: string; period: string },
) {
  return bookingFetch<{ data: import('@mazare3/shared').CouponValidationResult }>(
    `/properties/${slug}/coupons/validate`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function validatePlatformCoupon(
  slug: string,
  input: { code: string; date: string; period: string },
) {
  return bookingFetch<{ data: import('@mazare3/shared').PlatformCouponValidationResult }>(
    `/properties/${slug}/platform-coupons/validate`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function fetchBookingQuote(
  slug: string,
  input: {
    date: string;
    period: string;
    guestsCount: number;
    couponCode?: string;
  },
  init?: { signal?: AbortSignal },
) {
  return bookingFetch<{ data: import('@mazare3/shared').BookingQuote }>(
    `/properties/${slug}/booking-quote`,
    {
      method: 'POST',
      body: JSON.stringify(input),
      signal: init?.signal,
    },
  );
}

export async function createBooking(input: CreateBookingInput) {
  return bookingFetch<{ data: PublicBookingSummary }>('/bookings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchRebookIntent(bookingId: string) {
  return bookingFetch<{ data: RebookIntent }>(`/me/bookings/${bookingId}/rebook-intent`, {
    cache: 'no-store',
  });
}

export async function fetchMyBookings() {
  return bookingFetch<{ data: PublicBookingSummary[] }>('/me/bookings', {
    cache: 'no-store',
  });
}

export async function fetchMyBooking(id: string) {
  return bookingFetch<{ data: PublicBookingSummary }>(`/me/bookings/${id}`, {
    cache: 'no-store',
  });
}

/** Phase 3C.4D.6 — immutable Booking-time listing snapshot (Customer-safe). */
export async function fetchMyBookingListingSnapshot(bookingId: string) {
  return bookingFetch<{
    data: import('@/components/bookings/booking-listing-snapshot-panel').ListingSnapshotApiResult;
  }>(`/me/bookings/${encodeURIComponent(bookingId)}/listing-snapshot`, {
    cache: 'no-store',
  });
}

export async function cancelBooking(id: string) {
  return bookingFetch<{ data: PublicBookingSummary }>(`/me/bookings/${id}/cancel`, {
    method: 'POST',
  });
}

export async function fetchCheckInCode(bookingId: string) {
  return bookingFetch<{
    data: { status: string; code?: string | null; opensAt?: string; expiresAt?: string };
  }>(`/me/bookings/${bookingId}/check-in-code`);
}

export async function reportArrivalProblem(
  bookingId: string,
  input: { type: string; description: string },
) {
  return bookingFetch<{ data: unknown }>(`/me/bookings/${bookingId}/report-arrival-problem`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function requestBookingReschedule(bookingId: string, toSlotId: string) {
  return bookingFetch<{ data: unknown }>(`/me/bookings/${bookingId}/reschedule`, {
    method: 'POST',
    body: JSON.stringify({ toSlotId }),
  });
}

export type ReschedulePreviewResult = {
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

export async function previewReschedule(
  bookingId: string,
  toSlotId: string,
  opts?: { forceMajeure?: boolean; voluntaryUpgrade?: boolean },
) {
  const sp = new URLSearchParams({ toSlotId });
  if (opts?.forceMajeure) sp.set('forceMajeure', '1');
  if (opts?.voluntaryUpgrade) sp.set('voluntaryUpgrade', '1');
  return bookingFetch<{ data: ReschedulePreviewResult }>(
    `/me/bookings/${bookingId}/reschedule-preview?${sp}`,
    { cache: 'no-store' },
  );
}

export async function chooseForceMajeureResolution(
  bookingId: string,
  input: {
    choice: 'FULL_REFUND' | 'EQUIVALENT_RESCHEDULE';
    toSlotId?: string;
    voluntaryUpgrade?: boolean;
    source?: string;
  },
) {
  return bookingFetch<{ data: unknown }>(`/me/bookings/${bookingId}/force-majeure/choose`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function respondToReschedule(requestId: string, accept: boolean) {
  return bookingFetch<{ data: unknown }>(`/me/reschedule-requests/${requestId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ accept }),
  });
}

export async function submitBookingReview(
  bookingId: string,
  input: { rating: number; comment?: string },
) {
  return bookingFetch<{ data: { id: string; rating: number } }>(`/me/bookings/${bookingId}/review`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function bookingDraftKey(slug: string) {
  return `mazare3_booking_draft_${slug}`;
}

export type BookingDraft = {
  date: string;
  period: string;
  guests: number;
};

export function saveBookingDraft(slug: string, draft: BookingDraft) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(bookingDraftKey(slug), JSON.stringify(draft));
}

export function loadBookingDraft(slug: string): BookingDraft | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(bookingDraftKey(slug));
    if (!raw) return null;
    return JSON.parse(raw) as BookingDraft;
  } catch {
    return null;
  }
}

export function clearBookingDraft(slug: string) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(bookingDraftKey(slug));
}
