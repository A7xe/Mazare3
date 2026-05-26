'use client';

import type {
  AdminAuditLogRow,
  AdminBookingRow,
  AdminDashboardSummary,
  AdminOwnerRow,
  AdminPropertyDetail,
  AdminPropertyRow,
  AdminUserRow,
  AdminRefundRequestRow,
  AdminDisputeRow,
  AdminPayoutRow,
  OwnerAvailabilitySlotRow,
  PatchAdminRefundRequestInput,
  PatchAdminDisputeInput,
  MarkAdminPayoutPaidInput,
  PatchAdminAvailabilityInput,
  PatchAdminOwnerStatusInput,
  PatchAdminPropertyStatusInput,
  PatchAdminUserStatusInput,
} from '@mazare3/shared';
import { getApiBaseUrl } from './api';

export class AdminApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AdminApiError(
      (body as { error?: string }).error ?? 'Request failed',
      (body as { code?: string }).code,
      res.status,
    );
  }
  return body as T;
}

export async function fetchAdminSummary() {
  return adminFetch<{ data: AdminDashboardSummary }>('/admin/summary');
}

export async function fetchAdminUsers() {
  return adminFetch<{ data: AdminUserRow[] }>('/admin/users');
}

export async function patchAdminUserStatus(userId: string, input: PatchAdminUserStatusInput) {
  return adminFetch<{ data: AdminUserRow }>(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchAdminOwners() {
  return adminFetch<{ data: AdminOwnerRow[] }>('/admin/owners');
}

export async function patchAdminOwnerStatus(ownerId: string, input: PatchAdminOwnerStatusInput) {
  return adminFetch<{ data: AdminOwnerRow }>(`/admin/owners/${ownerId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchAdminProperties() {
  return adminFetch<{ data: AdminPropertyRow[] }>('/admin/properties');
}

export async function fetchAdminProperty(id: string) {
  return adminFetch<{ data: AdminPropertyDetail }>(`/admin/properties/${id}`);
}

export async function patchAdminPropertyStatus(propertyId: string, input: PatchAdminPropertyStatusInput) {
  return adminFetch<{ data: AdminPropertyDetail }>(`/admin/properties/${propertyId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchAdminBookings() {
  return adminFetch<{ data: AdminBookingRow[] }>('/admin/bookings');
}

export async function fetchAdminAvailability(propertyId: string, from: string, to: string) {
  const sp = new URLSearchParams({ propertyId, from, to });
  return adminFetch<{ data: OwnerAvailabilitySlotRow[] }>(`/admin/availability?${sp}`);
}

export async function patchAdminAvailabilitySlot(slotId: string, input: PatchAdminAvailabilityInput) {
  return adminFetch<{ data: OwnerAvailabilitySlotRow }>(`/admin/availability/${slotId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchAdminPayments() {
  return adminFetch<{ data: import('@mazare3/shared').AdminPaymentRow[] }>('/admin/payments');
}

export async function fetchAdminAuditLogs(limit = 100) {
  return adminFetch<{ data: AdminAuditLogRow[] }>(`/admin/audit-logs?limit=${limit}`);
}

export async function fetchAdminRefundRequests() {
  return adminFetch<{ data: AdminRefundRequestRow[] }>('/admin/refund-requests');
}

export async function patchAdminRefundRequest(id: string, input: PatchAdminRefundRequestInput) {
  return adminFetch<{ data: AdminRefundRequestRow }>(`/admin/refund-requests/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchAdminDisputes() {
  return adminFetch<{ data: AdminDisputeRow[] }>('/admin/disputes');
}

export async function patchAdminDispute(id: string, input: PatchAdminDisputeInput) {
  return adminFetch<{ data: AdminDisputeRow }>(`/admin/disputes/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchAdminPayouts() {
  return adminFetch<{ data: AdminPayoutRow[] }>('/admin/payouts');
}

export async function markAdminPayoutPaid(paymentId: string, input: MarkAdminPayoutPaidInput) {
  return adminFetch<{ data: AdminPayoutRow }>(`/admin/payouts/${paymentId}/mark-paid`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
