import { randomBytes } from 'node:crypto';
import type { PaymentProvider } from '@mazare3/shared';
import { isAppEnvProduction } from '../../config/app-env.js';
import type {
  CreatePaymentParams,
  NormalizedGatewayEvent,
  PaymentGateway,
  ProviderIntentResult,
  ProviderPaymentResult,
  RefundPaymentParams,
  RefundPaymentResult,
  RetrievePaymentParams,
  VerifyWebhookParams,
} from './payment-provider.interface.js';

/**
 * Local/QA mock PSP adapter (DB enum value remains `test`).
 * Must never be selected when APP_ENV=production — validated at startup and registry.
 */
export class MockPaymentGateway implements PaymentGateway {
  readonly provider: PaymentProvider = 'test';

  constructor() {
    if (isAppEnvProduction()) {
      throw new Error('MockPaymentGateway must not be constructed when APP_ENV=production');
    }
  }

  async createPayment(params: CreatePaymentParams): Promise<ProviderIntentResult> {
    return this.createIntent(params);
  }

  async createIntent(params: CreatePaymentParams): Promise<ProviderIntentResult> {
    const ref = `mock_${params.paymentId.slice(0, 8)}_${params.idempotencyKey.slice(-8)}_${randomBytes(3).toString('hex')}`;
    return {
      provider: this.provider,
      providerRef: ref,
      status: 'pending',
    };
  }

  async retrievePayment(params: RetrievePaymentParams): Promise<ProviderPaymentResult> {
    return {
      provider: this.provider,
      providerRef: params.providerRef ?? `mock_${params.paymentId}`,
      status: 'pending',
      providerStatus: 'mock_pending',
    };
  }

  /**
   * Mock webhooks are only for non-production QA.
   * Accepts JSON with type + paymentId (or providerPaymentId matching providerRef lookup upstream).
   * No cryptographic signature yet — real PSPs will verify in their adapters.
   */
  async verifyWebhook(params: VerifyWebhookParams): Promise<NormalizedGatewayEvent | null> {
    if (isAppEnvProduction()) {
      return null;
    }

    const body =
      params.payload && typeof params.payload === 'object'
        ? (params.payload as Record<string, unknown>)
        : null;
    if (!body) return null;

    const typeRaw = String(body.type ?? body.eventType ?? '').trim().toLowerCase();
    const typeMap: Record<string, NormalizedGatewayEvent['type']> = {
      payment_succeeded: 'payment_succeeded',
      'payment.succeeded': 'payment_succeeded',
      succeeded: 'payment_succeeded',
      payment_failed: 'payment_failed',
      'payment.failed': 'payment_failed',
      failed: 'payment_failed',
      refund_succeeded: 'refund_succeeded',
      'refund.succeeded': 'refund_succeeded',
      refund_failed: 'refund_failed',
      'refund.failed': 'refund_failed',
    };
    const type = typeMap[typeRaw];
    if (!type) return null;

    const paymentId =
      typeof body.paymentId === 'string'
        ? body.paymentId
        : typeof body.payment_id === 'string'
          ? body.payment_id
          : null;
    const providerPaymentId =
      typeof body.providerPaymentId === 'string'
        ? body.providerPaymentId
        : typeof body.providerRef === 'string'
          ? body.providerRef
          : typeof body.provider_ref === 'string'
            ? body.provider_ref
            : null;

    if (!paymentId && !providerPaymentId) return null;

    const providerEventId =
      typeof body.providerEventId === 'string'
        ? body.providerEventId
        : typeof body.eventId === 'string'
          ? body.eventId
          : typeof body.id === 'string'
            ? body.id
            : null;

    return {
      type,
      paymentId,
      providerPaymentId,
      providerEventId,
      raw: params.payload,
    };
  }

  async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult> {
    return {
      providerRef: params.providerRef ?? `mock_refund_${params.refundRequestId.slice(0, 8)}`,
      status: 'succeeded',
      providerStatus: 'mock_refunded',
    };
  }
}

/** @deprecated Prefer MockPaymentGateway — same adapter, historic name. */
export class TestPaymentProvider extends MockPaymentGateway {}
