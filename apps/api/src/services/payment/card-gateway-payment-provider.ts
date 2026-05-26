import type { PaymentProvider } from '@mazare3/shared';
import type {
  CreateIntentParams,
  PaymentProviderAdapter,
  ProviderIntentResult,
} from './payment-provider.interface.js';
import { ProviderNotConfiguredError } from './provider-not-configured.error.js';

/** Phase 6B placeholder — no live card gateway API calls until Phase 6C. */
export class CardGatewayPaymentProvider implements PaymentProviderAdapter {
  readonly provider: PaymentProvider = 'card_gateway';

  async createIntent(_params: CreateIntentParams): Promise<ProviderIntentResult> {
    throw new ProviderNotConfiguredError('card_gateway');
  }
}
