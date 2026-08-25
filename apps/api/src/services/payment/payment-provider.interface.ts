import type { PaymentMethod, PaymentProvider } from '@mazare3/shared';

export type CreatePaymentCustomer = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type CreatePaymentParams = {
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  purpose: string;
  /** Stable key derived from internal payment identity — never from the client amount. */
  idempotencyKey: string;
  /** Optional cart description (booking code / purpose). */
  description?: string;
  customer?: CreatePaymentCustomer;
};

/** @deprecated Prefer CreatePaymentParams — kept for call-site compatibility. */
export type CreateIntentParams = CreatePaymentParams;

export type ProviderPaymentResult = {
  provider: PaymentProvider;
  providerRef: string;
  status: 'pending' | 'succeeded' | 'failed';
  providerStatus?: string | null;
  /** Present when the PSP query returns a cart/transaction amount. */
  amount?: number | null;
  currency?: string | null;
  /** PSP merchant/profile id when the query includes it. */
  profileId?: string | null;
};

export type ProviderIntentResult = {
  provider: PaymentProvider;
  providerRef: string;
  status: 'pending';
  /** Hosted payment page URL when the PSP uses redirect (e.g. PayTabs). */
  redirectUrl?: string | null;
};

export type RetrievePaymentParams = {
  paymentId: string;
  providerRef: string | null;
};

export type RefundPaymentParams = {
  paymentId: string;
  providerRef: string | null;
  amount: number;
  currency: string;
  refundRequestId: string;
  /** Stable key so retries do not double-refund at the PSP. */
  idempotencyKey: string;
};

export type RefundPaymentResult = {
  providerRef: string;
  status: 'succeeded' | 'pending' | 'failed';
  providerStatus?: string | null;
  /** Operator audit only — never map onto customer payment APIs. */
  profileMode?: 'test' | 'live';
};

/**
 * Minimal normalized gateway events.
 * Provider payloads must be mapped here before touching booking/payment state machines.
 */
export type NormalizedGatewayEventType =
  | 'payment_succeeded'
  | 'payment_failed'
  | 'refund_succeeded'
  | 'refund_failed';

export type NormalizedGatewayEvent = {
  type: NormalizedGatewayEventType;
  /** Internal Mazare3 payment id when known. */
  paymentId: string | null;
  providerPaymentId: string | null;
  /** Provider event id for webhook idempotency (optional). */
  providerEventId: string | null;
  raw: unknown;
};

export type VerifyWebhookParams = {
  rawBody: string;
  signatureHeader: string | undefined;
  payload: unknown;
};

/**
 * Payment gateway boundary (Phase 10G.1).
 * Adapters talk to PSPs; booking/payment services stay authoritative for amounts and state.
 */
export interface PaymentGateway {
  readonly provider: PaymentProvider;

  createPayment(params: CreatePaymentParams): Promise<ProviderIntentResult>;

  /** Alias used by existing call sites. */
  createIntent(params: CreatePaymentParams): Promise<ProviderIntentResult>;

  retrievePayment(params: RetrievePaymentParams): Promise<ProviderPaymentResult>;

  /**
   * Verify authenticity (when credentials exist) and normalize into a domain event.
   * Returns null when the payload must be rejected (bad signature / unknown shape).
   */
  verifyWebhook(params: VerifyWebhookParams): Promise<NormalizedGatewayEvent | null>;

  refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult>;
}

/** @deprecated Prefer PaymentGateway. */
export type PaymentProviderAdapter = PaymentGateway;

export function providerIdempotencyKey(paymentId: string, purpose: string): string {
  return `mazare3_pay_${paymentId}_${purpose}`;
}

export function providerRefundIdempotencyKey(refundRequestId: string): string {
  return `mazare3_refund_${refundRequestId}`;
}
