import type { PaymentMethod, PaymentProvider } from '@mazare3/shared';

export type CreateIntentParams = {
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
};

export type ProviderIntentResult = {
  provider: PaymentProvider;
  providerRef: string;
  status: 'pending';
};

export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  createIntent(params: CreateIntentParams): Promise<ProviderIntentResult>;
}
