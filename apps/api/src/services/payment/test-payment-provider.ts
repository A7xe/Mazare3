import { randomBytes } from 'node:crypto';
import type { PaymentProvider } from '@mazare3/shared';
import { isAppEnvProduction } from '../../config/app-env.js';
import type {
  ChargeSavedPaymentMethodParams,
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
 *
 * CB-4 Managed Form seam — when `paymentToken` is present, outcome is driven by:
 * - token prefix / exact values (deterministic E2E)
 * - or MOCK_MANAGED_FORM_OUTCOME env: authorised | declined | redirect_3ds | pending | network_unknown
 */
export class MockPaymentGateway implements PaymentGateway {
  readonly provider: PaymentProvider = 'test';

  /** Last managed-form create call count — E2E double-click assertions. */
  static managedFormCreateCount = 0;
  /** CB-5B — saved-card charge call count for double-click assertions. */
  static savedCardChargeCount = 0;

  constructor() {
    if (isAppEnvProduction()) {
      throw new Error('MockPaymentGateway must not be constructed when APP_ENV=production');
    }
  }

  async createPayment(params: CreatePaymentParams): Promise<ProviderIntentResult> {
    return this.createIntent(params);
  }

  async createIntent(params: CreatePaymentParams): Promise<ProviderIntentResult> {
    const token = params.paymentToken?.trim();
    if (token) {
      return this.createManagedFormIntent(params, token);
    }

    const ref = `mock_${params.paymentId.slice(0, 8)}_${params.idempotencyKey.slice(-8)}_${randomBytes(3).toString('hex')}`;
    return {
      provider: this.provider,
      providerRef: ref,
      status: 'pending',
    };
  }

  private async createManagedFormIntent(
    params: CreatePaymentParams,
    paymentToken: string,
  ): Promise<ProviderIntentResult> {
    MockPaymentGateway.managedFormCreateCount += 1;

    // Reject sentinel that asserts raw card never reaches provider — should never happen.
    if (
      /^(4\d{12,18}|5\d{12,18})$/.test(paymentToken) ||
      paymentToken.toLowerCase() === 'cvv' ||
      paymentToken.includes('|')
    ) {
      throw new Error('MOCK_PCI_BOUNDARY: raw card material must never reach the gateway');
    }

    const outcomeEnv = (process.env.MOCK_MANAGED_FORM_OUTCOME ?? '').trim().toLowerCase();
    let outcome = outcomeEnv;
    if (!outcome) {
      if (paymentToken.startsWith('mf_decline_')) outcome = 'declined';
      else if (paymentToken.startsWith('mf_3ds_')) outcome = 'redirect_3ds';
      else if (paymentToken.startsWith('mf_pending_')) outcome = 'pending';
      else if (paymentToken.startsWith('mf_unknown_')) outcome = 'network_unknown';
      else outcome = 'authorised';
    }

    if (outcome === 'network_unknown') {
      throw new Error('MOCK_NETWORK_UNKNOWN');
    }

    const ref = `mock_mf_${params.paymentId.slice(0, 8)}_${randomBytes(3).toString('hex')}`;

    if (outcome === 'declined') {
      return {
        provider: this.provider,
        providerRef: ref,
        status: 'failed',
        redirectUrl: null,
        managedFormOutcome: 'declined',
      };
    }

    if (outcome === 'redirect_3ds') {
      const front = (process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3010').replace(
        /\/$/,
        '',
      );
      return {
        provider: this.provider,
        providerRef: ref,
        status: 'pending',
        redirectUrl: `${front}/ar/checkout/${params.bookingId}/return?paymentId=${encodeURIComponent(params.paymentId)}&mock3ds=1`,
        managedFormOutcome: 'redirect_3ds',
      };
    }

    if (outcome === 'pending') {
      return {
        provider: this.provider,
        providerRef: ref,
        status: 'pending',
        redirectUrl: null,
        managedFormOutcome: 'pending',
      };
    }

    const tokenise = params.tokenise === true;
    // Stable mock persistent token so repeated successes upsert (fingerprint dedupe), not duplicate rows.
    const persistentToken = tokenise ? '2C4651BF67A3EC34C6B691F8MOCKCARD01' : null;
    const providerRaw = tokenise
      ? {
          source: 'mock_managed_form',
          tran_ref: ref,
          token: persistentToken,
          payment_result: { response_status: 'A' },
          payment_info: {
            payment_method: 'Visa',
            card_scheme: 'Visa',
            payment_description: 'Visa **** 4242',
            expiryMonth: 12,
            expiryYear: 2030,
          },
        }
      : {
          source: 'mock_managed_form',
          tran_ref: ref,
          payment_result: { response_status: 'A' },
        };

    return {
      provider: this.provider,
      providerRef: ref,
      status: 'succeeded',
      redirectUrl: null,
      managedFormOutcome: 'authorised',
      persistentCard: persistentToken
        ? {
            providerToken: persistentToken,
            providerOriginalTransactionRef: ref,
            brand: 'Visa',
            maskedDisplay: 'Visa •••• 4242',
            last4: '4242',
            expiryMonth: 12,
            expiryYear: 2030,
          }
        : null,
      providerRaw,
    };
  }

  async deleteCardToken(params: { token: string }): Promise<{
    status: 'succeeded' | 'already_absent' | 'failed';
  }> {
    const mode = (process.env.MOCK_TOKEN_DELETE_OUTCOME ?? 'succeeded').trim().toLowerCase();
    if (mode === 'already_absent' || params.token.startsWith('mock_absent_')) {
      return { status: 'already_absent' };
    }
    if (mode === 'failed' || params.token.startsWith('mock_fail_')) {
      return { status: 'failed' };
    }
    return { status: 'succeeded' };
  }

  /** CB-5B mock — ecom redirect or recurring direct outcomes. */
  async chargeSavedPaymentMethod(
    params: ChargeSavedPaymentMethodParams,
  ): Promise<ProviderIntentResult> {
    MockPaymentGateway.savedCardChargeCount += 1;
    const token = params.providerToken.trim();
    if (!token || token.toLowerCase() === 'cvv' || /^(4\d{12,18}|5\d{12,18})$/.test(token)) {
      throw new Error('MOCK_PCI_BOUNDARY: raw card material must never reach the gateway');
    }

    const outcomeEnv = (process.env.MOCK_SAVED_CARD_OUTCOME ?? '').trim().toLowerCase();
    let outcome = outcomeEnv;
    if (!outcome) {
      if (token.startsWith('mock_invalid_') || token.includes('INVALID')) outcome = 'invalid_token';
      else if (token.startsWith('mock_decline_')) outcome = 'declined';
      else if (token.startsWith('mock_unknown_')) outcome = 'network_unknown';
      else if (params.mode === 'ecom_cvv_redirect') outcome = 'ecom_redirect';
      else outcome = 'authorised';
    }

    if (outcome === 'network_unknown') {
      throw new Error('MOCK_NETWORK_UNKNOWN');
    }

    const ref = `mock_sc_${params.paymentId.slice(0, 8)}_${randomBytes(3).toString('hex')}`;
    const front = (
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3010'
    ).replace(/\/$/, '');

    if (outcome === 'invalid_token') {
      return {
        provider: this.provider,
        providerRef: ref,
        status: 'failed',
        redirectUrl: null,
        savedCardOutcome: 'invalid_token',
        providerRaw: {
          source: 'mock_saved_card',
          mode: params.mode,
          message: 'Invalid token',
        },
      };
    }

    if (outcome === 'declined') {
      return {
        provider: this.provider,
        providerRef: ref,
        status: 'failed',
        redirectUrl: null,
        savedCardOutcome: 'declined',
        providerRaw: { source: 'mock_saved_card', mode: params.mode, payment_result: { response_status: 'D' } },
      };
    }

    if (outcome === 'ecom_redirect' || params.mode === 'ecom_cvv_redirect') {
      // Even if mode is ecom, honour explicit authorised override for rare tests.
      if (outcome === 'authorised' && params.mode === 'recurring_direct') {
        /* fall through */
      } else if (outcome !== 'authorised') {
        return {
          provider: this.provider,
          providerRef: ref,
          status: 'pending',
          redirectUrl: `${front}/ar/checkout/${params.bookingId}/return?paymentId=${encodeURIComponent(params.paymentId)}&mockSavedEcom=1`,
          savedCardOutcome: 'ecom_redirect',
          providerRaw: {
            source: 'mock_saved_card',
            mode: 'ecom_cvv_redirect',
            tran_class: 'ecom',
            token_present: true,
            redirect_url: true,
          },
        };
      }
    }

    // recurring_direct authorised (or forced authorised)
    return {
      provider: this.provider,
      providerRef: ref,
      status: 'succeeded',
      redirectUrl: null,
      savedCardOutcome: 'authorised',
      providerRaw: {
        source: 'mock_saved_card',
        mode: params.mode,
        tran_class: params.mode === 'recurring_direct' ? 'recurring' : 'ecom',
        tran_ref: params.providerOriginalTransactionRef,
        payment_result: { response_status: 'A' },
      },
    };
  }

  async retrievePayment(params: RetrievePaymentParams): Promise<ProviderPaymentResult> {
    const force =
      (process.env.MOCK_MANAGED_FORM_RETRIEVE ?? '').trim().toLowerCase() ||
      (params.providerRef?.includes('_ok') ? 'succeeded' : '');
    if (force === 'succeeded') {
      return {
        provider: this.provider,
        providerRef: params.providerRef ?? `mock_${params.paymentId}`,
        status: 'succeeded',
        providerStatus: 'mock_A',
      };
    }
    if (force === 'failed') {
      return {
        provider: this.provider,
        providerRef: params.providerRef ?? `mock_${params.paymentId}`,
        status: 'failed',
        providerStatus: 'mock_D',
      };
    }
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
