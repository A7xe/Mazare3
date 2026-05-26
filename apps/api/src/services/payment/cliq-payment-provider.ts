import type { PaymentProvider } from '@mazare3/shared';
import type {
  CreateIntentParams,
  PaymentProviderAdapter,
  ProviderIntentResult,
} from './payment-provider.interface.js';
import { ProviderNotConfiguredError } from './provider-not-configured.error.js';

/** Phase 6B placeholder — no live CliQ API calls until Phase 6C. */
export class CliqPaymentProvider implements PaymentProviderAdapter {
  readonly provider: PaymentProvider = 'cliq';

  async createIntent(_params: CreateIntentParams): Promise<ProviderIntentResult> {
    throw new ProviderNotConfiguredError('cliq');
  }
}
