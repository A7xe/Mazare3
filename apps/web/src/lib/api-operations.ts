'use client';

import type {
  CreateDisputeInput,
  CreateRefundRequestInput,
  DisputeSummary,
  RefundRequestSummary,
} from '@mazare3/shared';
import { getApiBaseUrl } from './api';

export class OperationsApiError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'OperationsApiError';
  }
}

async function meFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new OperationsApiError(
      (body as { error?: string }).error ?? 'Request failed',
      (body as { code?: string }).code,
    );
  }
  return body as T;
}

export async function requestRefund(bookingId: string, input: CreateRefundRequestInput) {
  return meFetch<{ data: RefundRequestSummary }>(`/me/bookings/${bookingId}/refund-request`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchMyRefundRequests() {
  return meFetch<{ data: RefundRequestSummary[] }>('/me/refund-requests');
}

export async function openDispute(bookingId: string, input: CreateDisputeInput) {
  return meFetch<{ data: DisputeSummary }>(`/me/bookings/${bookingId}/disputes`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchMyDisputes() {
  return meFetch<{ data: DisputeSummary[] }>('/me/disputes');
}
