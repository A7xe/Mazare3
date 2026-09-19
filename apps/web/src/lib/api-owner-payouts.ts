'use client';

import type { OwnerPayoutSummaryRow, OwnerSettlementSummary } from '@mazare3/shared';
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

export async function fetchOwnerSettlements() {
  return ownerFetch<{ data: OwnerSettlementSummary[] }>('/owner/settlements');
}

export type OwnerFinancialAdjustmentRow = {
  id: string;
  bookingId: string;
  bookingPublicCode: string | null;
  type: string;
  status: string;
  amount: number;
  currency: string;
  reason: string;
  createdAt: string;
  appliedAt: string | null;
  waivedAt: string | null;
  settlementId: string | null;
};

export async function fetchOwnerFinancialAdjustments() {
  return ownerFetch<{ data: OwnerFinancialAdjustmentRow[] }>('/owner/financial-adjustments');
}
