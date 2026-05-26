import { randomBytes } from 'node:crypto';
import type { PaymentProvider } from '@mazare3/shared';
import type {
  CreateIntentParams,
  PaymentProviderAdapter,
  ProviderIntentResult,
} from './payment-provider.interface.js';

export class TestPaymentProvider implements PaymentProviderAdapter {
  readonly provider: PaymentProvider = 'test';

  async createIntent(params: CreateIntentParams): Promise<ProviderIntentResult> {
    const ref = `test_${params.paymentId.slice(0, 8)}_${randomBytes(4).toString('hex')}`;
    return {
      provider: this.provider,
      providerRef: ref,
      status: 'pending',
    };
  }
}
