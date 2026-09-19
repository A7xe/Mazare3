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
    public details?: unknown,
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
      (body as { details?: unknown }).details,
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

export type CreateManagedFormPaymentClientInput = {
  bookingId: string;
  paymentToken: string;
  idempotencyKey?: string;
  contactEmail?: string;
  contactPhone?: string;
  /** CB-5A — opt-in only; server ignores when tokenization capability is off. */
  saveCard?: boolean;
  /** CB-6 — Deposit vs Full; server validates. Never send amount/purpose. */
  initialPaymentChoice?: 'deposit' | 'full';
};

/** CB-4 — temporary Managed Form token only. Never send PAN/CVV. */
export async function createManagedFormPayment(input: CreateManagedFormPaymentClientInput) {
  return paymentFetch<{ data: PaymentSummary }>('/payments/managed-form', {
    method: 'POST',
    body: JSON.stringify({
      bookingId: input.bookingId,
      paymentToken: input.paymentToken,
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      ...(input.contactEmail ? { contactEmail: input.contactEmail } : {}),
      ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
      ...(input.saveCard === true ? { saveCard: true } : {}),
      ...(input.initialPaymentChoice
        ? { initialPaymentChoice: input.initialPaymentChoice }
        : {}),
    }),
  });
}

export type CreateSavedCardPaymentClientInput = {
  bookingId: string;
  savedPaymentMethodId: string;
  idempotencyKey?: string;
  contactEmail?: string;
  contactPhone?: string;
  /** CB-6 — Deposit vs Full; server validates. Never send amount/purpose. */
  initialPaymentChoice?: 'deposit' | 'full';
};

/** CB-5B — opaque savedPaymentMethodId only. Never send vault token/CVV/amount. */
export async function createSavedCardPayment(input: CreateSavedCardPaymentClientInput) {
  return paymentFetch<{ data: PaymentSummary }>('/payments/saved-card', {
    method: 'POST',
    body: JSON.stringify({
      bookingId: input.bookingId,
      savedPaymentMethodId: input.savedPaymentMethodId,
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      ...(input.contactEmail ? { contactEmail: input.contactEmail } : {}),
      ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
      ...(input.initialPaymentChoice
        ? { initialPaymentChoice: input.initialPaymentChoice }
        : {}),
    }),
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

export type CreateRescheduleDifferencePaymentInput = {
  rescheduleRequestId: string;
  method: import('@mazare3/shared').PaymentMethod;
  idempotencyKey?: string;
  contactEmail?: string;
  contactPhone?: string;
};

export async function createRescheduleDifferencePayment(
  input: CreateRescheduleDifferencePaymentInput,
) {
  return paymentFetch<{ data: PaymentSummary }>('/payments/reschedule-difference', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
