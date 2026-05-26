import type { PaymentProvider } from '@mazare3/shared';
import { PAYMENT_PROVIDERS } from '@mazare3/shared';

export type CliqConfig = {
  merchantAlias: string;
  apiBaseUrl: string;
  apiKey: string;
  webhookSecret: string;
};

export type CardGatewayConfig = {
  providerName: string;
  apiBaseUrl: string;
  merchantId: string;
  apiKey: string;
  webhookSecret: string;
};

export type PaymentConfig = {
  /** Platform-wide active provider mode. */
  provider: PaymentProvider;
  currency: string;
  simulateEnabled: boolean;
  livePaymentsEnabled: boolean;
  cliq: { configured: boolean };
  cardGateway: { configured: boolean; providerName: string | null };
};

function parseProvider(raw: string | undefined): PaymentProvider {
  const value = (raw ?? 'test').trim().toLowerCase();
  if ((PAYMENT_PROVIDERS as readonly string[]).includes(value)) {
    return value as PaymentProvider;
  }
  return 'test';
}

function isNonEmpty(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function isCliqConfigured(): boolean {
  return (
    isNonEmpty(process.env.CLIQ_MERCHANT_ALIAS) &&
    isNonEmpty(process.env.CLIQ_API_BASE_URL) &&
    isNonEmpty(process.env.CLIQ_API_KEY) &&
    isNonEmpty(process.env.CLIQ_WEBHOOK_SECRET)
  );
}

export function isCardGatewayConfigured(): boolean {
  return (
    isNonEmpty(process.env.CARD_GATEWAY_PROVIDER) &&
    isNonEmpty(process.env.CARD_GATEWAY_API_BASE_URL) &&
    isNonEmpty(process.env.CARD_GATEWAY_MERCHANT_ID) &&
    isNonEmpty(process.env.CARD_GATEWAY_API_KEY) &&
    isNonEmpty(process.env.CARD_GATEWAY_WEBHOOK_SECRET)
  );
}

export function loadPaymentConfig(): PaymentConfig {
  const provider = parseProvider(process.env.PAYMENT_PROVIDER);
  const currency = (process.env.PAYMENT_CURRENCY ?? 'JOD').trim().toUpperCase();
  const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';

  const simulateEnabled =
    !isProduction && process.env.PAYMENT_SIMULATE_ENABLED === 'true';

  const cliqConfigured = isCliqConfigured();
  const cardConfigured = isCardGatewayConfigured();

  const livePaymentsEnabled =
    provider === 'test'
      ? false
      : provider === 'cliq'
        ? cliqConfigured
        : provider === 'card_gateway'
          ? cardConfigured
          : false;

  return {
    provider,
    currency,
    simulateEnabled,
    livePaymentsEnabled,
    cliq: { configured: cliqConfigured },
    cardGateway: {
      configured: cardConfigured,
      providerName: process.env.CARD_GATEWAY_PROVIDER?.trim() || null,
    },
  };
}

/** Provider used for new payment intents (test mode forces test adapter). */
export function getActivePaymentProvider(): PaymentProvider {
  const { provider } = loadPaymentConfig();
  return provider;
}

export function resolveProviderForMethod(
  method: import('@mazare3/shared').PaymentMethod,
): PaymentProvider {
  const active = getActivePaymentProvider();
  if (active === 'test') {
    return 'test';
  }
  switch (method) {
    case 'card':
      return 'card_gateway';
    case 'cliq':
      return 'cliq';
    case 'manual_test':
    default:
      return 'test';
  }
}

export function assertProviderCanCreateIntent(provider: PaymentProvider): void {
  const config = loadPaymentConfig();

  if (config.provider === 'test') {
    return;
  }

  if (provider === 'cliq' && !config.cliq.configured) {
    throw new Error('PROVIDER_NOT_CONFIGURED:cliq');
  }
  if (provider === 'card_gateway' && !config.cardGateway.configured) {
    throw new Error('PROVIDER_NOT_CONFIGURED:card_gateway');
  }

  if (config.provider === 'cliq' && provider === 'card_gateway') {
    throw new Error('PAYMENT_METHOD_NOT_AVAILABLE:card');
  }
  if (config.provider === 'card_gateway' && provider === 'cliq') {
    throw new Error('PAYMENT_METHOD_NOT_AVAILABLE:cliq');
  }
}
