'use client';

import type { CreateBookingInput, PublicBookingSummary } from '@mazare3/shared';
import { getApiBaseUrl } from './api';

export class BookingApiError extends Error {
  constructor(
    message: string,
    public code?: string,
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
    );
  }
  return body as T;
}

export async function createBooking(input: CreateBookingInput) {
  return bookingFetch<{ data: PublicBookingSummary }>('/bookings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchMyBookings() {
  return bookingFetch<{ data: PublicBookingSummary[] }>('/me/bookings', {
    cache: 'no-store',
  });
}

export async function cancelBooking(id: string) {
  return bookingFetch<{ data: PublicBookingSummary }>(`/me/bookings/${id}/cancel`, {
    method: 'POST',
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
