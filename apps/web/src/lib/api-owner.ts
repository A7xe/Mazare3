'use client';

import type {
  CreateOwnerPropertyInput,
  OwnerApplicationView,
  OwnerApplyInput,
  OwnerAvailabilitySlotRow,
  OwnerBookingRow,
  OwnerDashboardSummary,
  OwnerPropertyCard,
  OwnerPropertyDetail,
  OwnerPropertyEdit,
  PatchOwnerAvailabilityInput,
  UpdateOwnerPropertyInput,
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

export async function createOwnerProperty(input: CreateOwnerPropertyInput) {
  return ownerFetch<{ data: OwnerPropertyEdit }>('/owner/properties', {
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
