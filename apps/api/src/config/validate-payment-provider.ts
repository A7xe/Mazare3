import { isAppEnvProduction } from './app-env.js';
import {
  isCardGatewayConfigured,
  isCliqConfigured,
  loadPaymentConfig,
} from './payment-config.js';
import {
  collectPaytabsSafetyErrors,
  loadPaytabsConfig,
} from './paytabs-config.js';

export class PaymentProviderStartupError extends Error {
  readonly code = 'PAYMENT_PROVIDER_MISCONFIGURED';

  constructor(message: string) {
    super(message);
    this.name = 'PaymentProviderStartupError';
  }
}

function isPaytabsSelected(config: ReturnType<typeof loadPaymentConfig>): boolean {
  return config.provider === 'paytabs' || config.gatewayProviderRaw === 'paytabs';
}

/**
 * Fail closed when the selected gateway cannot safely run.
 * PayTabs TEST/LIVE profile rules apply whenever PayTabs is selected.
 * Mock/test is forbidden on APP_ENV=production.
 */
export function validatePaymentProviderAtStartup(): void {
  const config = loadPaymentConfig();
  const errors: string[] = [];
  const raw = config.gatewayProviderRaw;

  if (isPaytabsSelected(config)) {
    errors.push(
      ...collectPaytabsSafetyErrors(loadPaytabsConfig(), {
        paytabsSelected: true,
        simulateEnabled: process.env.PAYMENT_SIMULATE_ENABLED === 'true',
      }),
    );
  } else {
    errors.push(
      ...collectPaytabsSafetyErrors(loadPaytabsConfig(), {
        paytabsSelected: false,
        simulateEnabled: process.env.PAYMENT_SIMULATE_ENABLED === 'true',
      }),
    );
  }

  if (!isAppEnvProduction()) {
    if (errors.length > 0) {
      const detail = errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n');
      throw new PaymentProviderStartupError(
        `Payment gateway misconfiguration:\n${detail}\nSee .env.example (PayTabs Jordan placeholders).`,
      );
    }
    return;
  }

  if (config.provider === 'test' || raw === 'mock' || raw === 'test') {
    errors.push(
      'PAYMENT_GATEWAY_PROVIDER=mock (or PAYMENT_PROVIDER=test) is not allowed when APP_ENV=production. Select paytabs with PAYTABS_PROFILE_MODE=live (or another real provider) with complete credentials.',
    );
  }

  if (config.provider === 'cliq' && !isCliqConfigured()) {
    errors.push(
      'PAYMENT_PROVIDER=cliq / PAYMENT_GATEWAY_PROVIDER=cliq requires CLIQ_MERCHANT_ALIAS, CLIQ_API_BASE_URL, CLIQ_API_KEY, and CLIQ_WEBHOOK_SECRET.',
    );
  }

  if (config.provider === 'card_gateway' && !isCardGatewayConfigured()) {
    errors.push(
      'PAYMENT_GATEWAY_PROVIDER=card_gateway requires CARD_GATEWAY_PROVIDER, CARD_GATEWAY_API_BASE_URL, CARD_GATEWAY_MERCHANT_ID, CARD_GATEWAY_API_KEY, and CARD_GATEWAY_WEBHOOK_SECRET.',
    );
  }

  if (config.provider !== 'test' && !config.livePaymentsEnabled) {
    errors.push(
      `PAYMENT_GATEWAY_PROVIDER=${raw || config.provider} is set but provider credentials are incomplete (fail closed).`,
    );
  }

  if (process.env.PAYMENT_SIMULATE_ENABLED === 'true') {
    errors.push('PAYMENT_SIMULATE_ENABLED must not be true when APP_ENV=production.');
  }

  if (process.env.DISABLE_AUTH_RATE_LIMIT === 'true') {
    errors.push('DISABLE_AUTH_RATE_LIMIT must not be true when APP_ENV=production.');
  }

  if (process.env.ENABLE_INTERNAL_QA_ROUTES === 'true') {
    errors.push('ENABLE_INTERNAL_QA_ROUTES must not be true when APP_ENV=production.');
  }

  if (errors.length > 0) {
    const detail = errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n');
    throw new PaymentProviderStartupError(
      `Payment gateway misconfiguration (APP_ENV=production):\n${detail}\nSee docs/staging-payment-checklist.md and docs/payment-provider-decision.md.`,
    );
  }
}
