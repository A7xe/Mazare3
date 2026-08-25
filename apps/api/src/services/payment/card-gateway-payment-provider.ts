import type { PaymentProvider } from '@mazare3/shared';
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
import { ProviderNotConfiguredError } from './provider-not-configured.error.js';

/**
 * Generic card-gateway adapter stub (Phase 10G.1 boundary).
 * A concrete Jordan PSP (HyperPay / PayTabs / Network / …) plugs in here later —
 * do not leak PSP-specific fields into booking services.
 */
export class CardGatewayPaymentProvider implements PaymentGateway {
  readonly provider: PaymentProvider = 'card_gateway';

  async createPayment(_params: CreatePaymentParams): Promise<ProviderIntentResult> {
    throw new ProviderNotConfiguredError('card_gateway');
  }

  async createIntent(params: CreatePaymentParams): Promise<ProviderIntentResult> {
    return this.createPayment(params);
  }

  async retrievePayment(_params: RetrievePaymentParams): Promise<ProviderPaymentResult> {
    throw new ProviderNotConfiguredError('card_gateway');
  }

  async verifyWebhook(_params: VerifyWebhookParams): Promise<NormalizedGatewayEvent | null> {
    // Signature verification + normalize TBD when a card PSP is selected.
    return null;
  }

  async refundPayment(_params: RefundPaymentParams): Promise<RefundPaymentResult> {
    throw new ProviderNotConfiguredError('card_gateway');
  }
}
