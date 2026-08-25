import type { PaymentProvider } from '@mazare3/shared';
import { AppError } from '../../lib/errors.js';
import { isAppEnvProduction } from '../../config/app-env.js';
import {
  assertProviderCanCreateIntent,
  getActivePaymentProvider,
  loadPaymentConfig,
} from '../../config/payment-config.js';
import { PaytabsSafetyError } from '../../config/paytabs-config.js';
import { CardGatewayPaymentProvider } from './card-gateway-payment-provider.js';
import { CliqPaymentProvider } from './cliq-payment-provider.js';
import type { PaymentGateway } from './payment-provider.interface.js';
import { ProviderNotConfiguredError } from './provider-not-configured.error.js';
import { MockPaymentGateway } from './test-payment-provider.js';
import { PayTabsPaymentGateway } from './paytabs-payment-gateway.js';

export { resolveProviderForMethod } from '../../config/payment-config.js';

export function getPaymentGateway(provider: PaymentProvider): PaymentGateway {
  if (isAppEnvProduction() && (provider === 'test' || loadPaymentConfig().provider === 'test')) {
    throw new AppError(
      500,
      'PAYMENT_PROVIDER_MISCONFIGURED',
      'Mock/test payment gateway is not available in production',
    );
  }

  const config = loadPaymentConfig();

  if (config.provider === 'test') {
    return new MockPaymentGateway();
  }

  assertProviderCanCreateIntent(provider);

  switch (provider) {
    case 'paytabs':
      return new PayTabsPaymentGateway();
    case 'cliq':
      return new CliqPaymentProvider();
    case 'card_gateway':
      return new CardGatewayPaymentProvider();
    case 'test':
    default:
      return new MockPaymentGateway();
  }
}

/** @deprecated Prefer getPaymentGateway. */
export function getPaymentProviderAdapter(provider: PaymentProvider): PaymentGateway {
  return getPaymentGateway(provider);
}

export function throwPaymentProviderError(err: unknown): never {
  if (err instanceof ProviderNotConfiguredError) {
    throw new AppError(501, 'PROVIDER_NOT_CONFIGURED', err.message);
  }
  if (err instanceof PaytabsSafetyError) {
    throw new AppError(
      500,
      'PAYMENT_PROVIDER_MISCONFIGURED',
      'PayTabs is not safely configured for this environment',
    );
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith('PROVIDER_NOT_CONFIGURED:')) {
    const name = msg.split(':')[1] ?? 'unknown';
    throw new AppError(
      501,
      'PROVIDER_NOT_CONFIGURED',
      `Provider "${name}" is not configured yet`,
    );
  }
  if (msg.startsWith('PAYMENT_METHOD_NOT_AVAILABLE:')) {
    throw new AppError(400, 'PAYMENT_METHOD_NOT_AVAILABLE', 'This payment method is not available');
  }
  if (msg.startsWith('PAYTABS_')) {
    throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'Payment provider request failed');
  }
  if (err instanceof AppError) {
    throw err;
  }
  throw err instanceof Error ? err : new Error(String(err));
}

export function getActiveProviderLabel(): PaymentProvider {
  return getActivePaymentProvider();
}
