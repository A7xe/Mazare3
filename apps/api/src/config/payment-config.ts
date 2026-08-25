import type { PaymentProvider } from '@mazare3/shared';
import { PAYMENT_PROVIDERS } from '@mazare3/shared';
import { isNonProductionAppEnv } from './app-env.js';
import { isPaytabsConfigured, loadPaytabsConfig } from './paytabs-config.js';

export type PaymentConfig = {
  /**
   * Platform-wide active gateway mode.
   * Env: PAYMENT_GATEWAY_PROVIDER (preferred) or PAYMENT_PROVIDER.
   * `mock` is an alias for the local/QA adapter stored as enum `test`.
   */
  provider: PaymentProvider;
  /** Raw gateway selector before mock→test normalization (for diagnostics). */
  gatewayProviderRaw: string;
  currency: string;
  simulateEnabled: boolean;
  livePaymentsEnabled: boolean;
  cliq: { configured: boolean };
  cardGateway: { configured: boolean; providerName: string | null };
  paytabs: {
    configured: boolean;
    region: string;
    baseUrl: string;
    profileMode: 'test' | 'live' | 'invalid';
  };
};

function parseProvider(raw: string | undefined): PaymentProvider {
  const value = (raw ?? 'mock').trim().toLowerCase();
  if (value === 'mock') return 'test';
  if ((PAYMENT_PROVIDERS as readonly string[]).includes(value)) {
    return value as PaymentProvider;
  }
  return 'test';
}

function resolveGatewayProviderRaw(): string {
  const gateway = process.env.PAYMENT_GATEWAY_PROVIDER?.trim();
  if (gateway) return gateway.toLowerCase();
  const legacy = process.env.PAYMENT_PROVIDER?.trim();
  if (legacy) return legacy.toLowerCase();
  return 'mock';
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
  const gatewayProviderRaw = resolveGatewayProviderRaw();
  const provider = parseProvider(gatewayProviderRaw);
  const currency = (process.env.PAYMENT_CURRENCY ?? 'JOD').trim().toUpperCase();
  const simulateEnabled =
    isNonProductionAppEnv() && process.env.PAYMENT_SIMULATE_ENABLED === 'true';

  const cliqConfigured = isCliqConfigured();
  const cardConfigured = isCardGatewayConfigured();
  const paytabs = loadPaytabsConfig();

  const livePaymentsEnabled =
    provider === 'test'
      ? false
      : provider === 'cliq'
        ? cliqConfigured
        : provider === 'card_gateway'
          ? cardConfigured
          : provider === 'paytabs'
            ? paytabs.configured
            : false;

  return {
    provider,
    gatewayProviderRaw,
    currency,
    simulateEnabled,
    livePaymentsEnabled,
    cliq: { configured: cliqConfigured },
    cardGateway: {
      configured: cardConfigured,
      providerName: process.env.CARD_GATEWAY_PROVIDER?.trim() || null,
    },
    paytabs: {
      configured: paytabs.configured,
      region: paytabs.region,
      baseUrl: paytabs.baseUrl,
      profileMode: paytabs.profileModeValid ? paytabs.profileMode : 'invalid',
    },
  };
}

/** Provider used for new payment intents (mock/test mode forces mock adapter). */
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
  if (active === 'paytabs') {
    return 'paytabs';
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
  if (provider === 'paytabs' && !isPaytabsConfigured()) {
    throw new Error('PROVIDER_NOT_CONFIGURED:paytabs');
  }

  if (config.provider === 'cliq' && provider === 'card_gateway') {
    throw new Error('PAYMENT_METHOD_NOT_AVAILABLE:card');
  }
  if (config.provider === 'card_gateway' && provider === 'cliq') {
    throw new Error('PAYMENT_METHOD_NOT_AVAILABLE:cliq');
  }
  if (config.provider === 'paytabs' && provider !== 'paytabs' && provider !== 'test') {
    throw new Error('PAYMENT_METHOD_NOT_AVAILABLE:alt');
  }
}

/** True when the configured gateway is the local mock (`mock` / `test`). */
export function isMockPaymentGateway(): boolean {
  return loadPaymentConfig().provider === 'test';
}
