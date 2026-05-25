'use client';

import type {
  OwnerAvailabilitySlotRow,
  OwnerBookingRow,
  OwnerDashboardSummary,
  OwnerPropertyCard,
  OwnerPropertyDetail,
  PatchOwnerAvailabilityInput,
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

export async function fetchOwnerSummary() {
  return ownerFetch<{ data: OwnerDashboardSummary }>('/owner/summary');
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
