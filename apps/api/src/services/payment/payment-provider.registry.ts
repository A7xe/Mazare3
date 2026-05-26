import type { PaymentProvider } from '@mazare3/shared';
import { AppError } from '../../lib/errors.js';
import {
  assertProviderCanCreateIntent,
  getActivePaymentProvider,
  loadPaymentConfig,
} from '../../config/payment-config.js';
import { CardGatewayPaymentProvider } from './card-gateway-payment-provider.js';
import { CliqPaymentProvider } from './cliq-payment-provider.js';
import type { PaymentProviderAdapter } from './payment-provider.interface.js';
import { ProviderNotConfiguredError } from './provider-not-configured.error.js';
import { TestPaymentProvider } from './test-payment-provider.js';

export { resolveProviderForMethod } from '../../config/payment-config.js';

export function getPaymentProviderAdapter(provider: PaymentProvider): PaymentProviderAdapter {
  const config = loadPaymentConfig();

  if (config.provider === 'test') {
    return new TestPaymentProvider();
  }

  assertProviderCanCreateIntent(provider);

  switch (provider) {
    case 'cliq':
      return new CliqPaymentProvider();
    case 'card_gateway':
      return new CardGatewayPaymentProvider();
    case 'test':
    default:
      return new TestPaymentProvider();
  }
}

export function throwPaymentProviderError(err: unknown): never {
  if (err instanceof ProviderNotConfiguredError) {
    throw new AppError(501, 'PROVIDER_NOT_CONFIGURED', err.message);
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith('PROVIDER_NOT_CONFIGURED:')) {
    const provider = msg.split(':')[1] ?? 'unknown';
    throw new AppError(
      501,
      'PROVIDER_NOT_CONFIGURED',
      `Provider "${provider}" is not configured yet`,
    );
  }
  if (msg.startsWith('PAYMENT_METHOD_NOT_AVAILABLE:')) {
    throw new AppError(400, 'PAYMENT_METHOD_NOT_AVAILABLE', 'This payment method is not available');
  }
  if (err instanceof AppError) {
    throw err;
  }
  throw err instanceof Error ? err : new Error(String(err));
}

export function getActiveProviderLabel(): PaymentProvider {
  return getActivePaymentProvider();
}
