'use client';

import type { OwnerPayoutSummaryRow } from '@mazare3/shared';
import { getApiBaseUrl } from './api';

async function ownerFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? 'Request failed');
  }
  return body as T;
}

export async function fetchOwnerPayouts() {
  return ownerFetch<{ data: OwnerPayoutSummaryRow[] }>('/owner/payouts');
}
