'use client';

import type { SavedPaymentMethodPublic } from '@mazare3/shared';
import { getApiBaseUrl } from './api';

export class PaymentMethodsApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'PaymentMethodsApiError';
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
    throw new PaymentMethodsApiError(
      (body as { error?: string }).error ?? 'Request failed',
      (body as { code?: string }).code,
      res.status,
    );
  }
  return body as T;
}

/** CB-5A — masked metadata only; never includes providerToken. */
export async function listMyPaymentMethods() {
  return meFetch<{ data: SavedPaymentMethodPublic[] }>('/me/payment-methods', {
    cache: 'no-store',
  });
}

export async function setDefaultMyPaymentMethod(id: string) {
  return meFetch<{ data: SavedPaymentMethodPublic }>(`/me/payment-methods/${id}/default`, {
    method: 'POST',
  });
}

export async function revokeMyPaymentMethod(id: string) {
  return meFetch<{ data: { revoked: true } }>(`/me/payment-methods/${id}`, {
    method: 'DELETE',
  });
}
