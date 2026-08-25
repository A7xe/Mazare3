'use client';

import type {
  CreatePaymentIntentInput,
  PaymentPublicConfig,
  PaymentSummary,
} from '@mazare3/shared';
import { getApiBaseUrl } from './api';

export class PaymentApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'PaymentApiError';
  }
}

async function paymentFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new PaymentApiError(
      (body as { error?: string }).error ?? 'Request failed',
      (body as { code?: string }).code,
      res.status,
    );
  }
  return body as T;
}

export async function createPaymentIntent(input: CreatePaymentIntentInput) {
  return paymentFetch<{ data: PaymentSummary }>('/payments/create-intent', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchPayment(id: string) {
  return paymentFetch<{ data: PaymentSummary }>(`/payments/${id}`);
}

export async function simulatePaymentSuccess(id: string) {
  return paymentFetch<{ data: PaymentSummary }>(`/payments/${id}/simulate-success`, {
    method: 'POST',
  });
}

export async function simulatePaymentFailure(id: string) {
  return paymentFetch<{ data: PaymentSummary }>(`/payments/${id}/simulate-failure`, {
    method: 'POST',
  });
}

/** Informational only — never marks payment succeeded. */
export async function acknowledgeBrowserPaymentReturn(id: string) {
  return paymentFetch<{ data: PaymentSummary }>(`/payments/${id}/browser-return`, {
    method: 'POST',
  });
}

export async function fetchPaymentConfig() {
  return paymentFetch<{ data: PaymentPublicConfig }>('/payments/config', {
    cache: 'no-store',
  });
}

export async function fetchCheckoutBooking(bookingId: string) {
  return paymentFetch<{ data: import('@mazare3/shared').CheckoutBookingView }>(
    `/me/bookings/${bookingId}/checkout`,
  );
}
