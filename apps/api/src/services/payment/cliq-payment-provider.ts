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
 * CliQ adapter stub (Phase 10G.1 boundary).
 * Live create/verify/refund land in a later PSP selection phase.
 */
export class CliqPaymentProvider implements PaymentGateway {
  readonly provider: PaymentProvider = 'cliq';

  async createPayment(_params: CreatePaymentParams): Promise<ProviderIntentResult> {
    throw new ProviderNotConfiguredError('cliq');
  }

  async createIntent(params: CreatePaymentParams): Promise<ProviderIntentResult> {
    return this.createPayment(params);
  }

  async retrievePayment(_params: RetrievePaymentParams): Promise<ProviderPaymentResult> {
    throw new ProviderNotConfiguredError('cliq');
  }

  async verifyWebhook(_params: VerifyWebhookParams): Promise<NormalizedGatewayEvent | null> {
    // Signature verification + normalize TBD when CliQ is selected.
    return null;
  }

  async refundPayment(_params: RefundPaymentParams): Promise<RefundPaymentResult> {
    throw new ProviderNotConfiguredError('cliq');
  }
}
