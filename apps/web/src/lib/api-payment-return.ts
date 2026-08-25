'use client';

export class PaymentReturnError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'PaymentReturnError';
  }
}

export type PaymentReturnStatus = {
  id: string;
  status: string;
  purpose?: string;
  bookingId?: string;
};

async function returnFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new PaymentReturnError(
      (body as { error?: string }).error ?? 'Request failed',
      res.status,
      (body as { code?: string }).code,
    );
  }
  return body as T;
}

/** Same-origin status. Never calls the API origin from the browser. */
export async function fetchPaymentReturnStatus(paymentId: string) {
  return returnFetch<{ data: PaymentReturnStatus }>(
    `/api/payment-return/${encodeURIComponent(paymentId)}`,
  );
}

/** Informational ack only — the BFF must not finalize payment. */
export async function acknowledgePaymentReturn(paymentId: string) {
  return returnFetch<{ data: PaymentReturnStatus }>(
    `/api/payment-return/${encodeURIComponent(paymentId)}/ack`,
    { method: 'POST' },
  );
}
