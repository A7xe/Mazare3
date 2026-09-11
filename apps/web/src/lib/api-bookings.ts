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

export async function cancelBooking(id: string) {
  return bookingFetch<{ data: PublicBookingSummary }>(`/me/bookings/${id}/cancel`, {
    method: 'POST',
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
