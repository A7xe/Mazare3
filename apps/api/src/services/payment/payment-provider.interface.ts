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
  /**
   * CB-4 Managed Form temporary payment_token from paylib.js.
   * When set, adapters must use Managed Form sale (not HPP page create).
   * Never log or persist beyond the provider request.
   */
  paymentToken?: string;
  /**
   * CB-5A — request PayTabs persistent card tokenization (tokenise=2).
   * Only when customer explicitly opts in. Never default true.
   */
  tokenise?: boolean;
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
  status: 'pending' | 'succeeded' | 'failed';
  /** Hosted payment page or 3DS challenge URL when the PSP requires browser redirect. */
  redirectUrl?: string | null;
  /** CB-4 Managed Form normalized outcome. */
  managedFormOutcome?: 'redirect_3ds' | 'authorised' | 'declined' | 'pending' | null;
  /**
   * CB-5B — saved-card charge outcome (ecom redirect or recurring direct).
   * Distinct from Managed Form new-card outcomes.
   */
  savedCardOutcome?:
    | 'ecom_redirect'
    | 'authorised'
    | 'declined'
    | 'pending'
    | 'invalid_token'
    | null;
  /**
   * CB-5A — persistent card token capture from trusted provider response (immediate path).
   * Never includes Managed Form temporary payment_token.
   */
  persistentCard?: {
    providerToken: string;
    providerOriginalTransactionRef: string | null;
    brand: string | null;
    maskedDisplay: string | null;
    last4: string | null;
    expiryMonth: number | null;
    expiryYear: number | null;
  } | null;
  /** Opaque trusted provider payload fragment for vault capture (callback/MF). */
  providerRaw?: unknown;
};

/** CB-5B — charge a vaulted PayTabs card (server-resolved credentials only). */
export type ChargeSavedPaymentMethodParams = {
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
  purpose: string;
  idempotencyKey: string;
  description?: string;
  customer?: CreatePaymentCustomer;
  /** Decrypted persistent PayTabs card token — never log. */
  providerToken: string;
  /** Required for recurring_direct; optional for ecom. */
  providerOriginalTransactionRef: string | null;
  mode: 'ecom_cvv_redirect' | 'recurring_direct';
  /** Opaque SavedPaymentMethod id for audit only. */
  savedPaymentMethodId: string;
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
  /** Phase 3C.4E.2B — provider-reported capture amount (JOD), when present. */
  amount?: number | null;
  /** Phase 3C.4E.2B — provider-reported currency, when present. */
  currency?: string | null;
  /** Purpose parsed from cart_id when present. */
  cartPurpose?: string | null;
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

  /**
   * CB-5A — revoke a persistent PayTabs card token (server-side only).
   * Optional on gateways that do not support vaulting.
   */
  deleteCardToken?(params: { token: string }): Promise<{
    status: 'succeeded' | 'already_absent' | 'failed';
  }>;

  /**
   * CB-5B — charge a vaulted saved card (ecom CVV redirect or approved recurring_direct).
   * Optional only on gateways that never support saved cards.
   */
  chargeSavedPaymentMethod?(
    params: ChargeSavedPaymentMethodParams,
  ): Promise<ProviderIntentResult>;
}

/** @deprecated Prefer PaymentGateway. */
export type PaymentProviderAdapter = PaymentGateway;

export function providerIdempotencyKey(paymentId: string, purpose: string): string {
  return `mazare3_pay_${paymentId}_${purpose}`;
}

export function providerRefundIdempotencyKey(
  refundRequestId: string,
  paymentOrAllocationKey?: string,
): string {
  // Phase 3C.4E.2A — per-capture key when paymentId (or allocation discriminator) provided.
  return paymentOrAllocationKey
    ? `mazare3_refund_${refundRequestId}_${paymentOrAllocationKey}`
    : `mazare3_refund_${refundRequestId}`;
}
