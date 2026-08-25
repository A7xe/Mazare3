import { PAYMENT_PROVIDERS, type PaymentProvider } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { isAppEnvProduction } from '../config/app-env.js';
import { getPaymentGateway } from './payment/payment-provider.registry.js';
import { PayTabsPaymentGateway } from './payment/paytabs-payment-gateway.js';
import { applyNormalizedGatewayEvent } from './payment.service.js';
import { PaytabsSafetyError } from '../config/paytabs-config.js';
import { ProviderNotConfiguredError } from './payment/provider-not-configured.error.js';

const WEBHOOK_PROVIDERS = ['test', 'mock', 'cliq', 'card_gateway', 'paytabs'] as const;
export type WebhookProvider = (typeof WEBHOOK_PROVIDERS)[number];

export function parseWebhookProvider(raw: string | undefined): WebhookProvider {
  const value = (raw ?? '').trim().toLowerCase();
  if (!(WEBHOOK_PROVIDERS as readonly string[]).includes(value)) {
    throw new AppError(400, 'UNKNOWN_PROVIDER', 'Unknown payment webhook provider');
  }
  return value as WebhookProvider;
}

function toPaymentProvider(provider: WebhookProvider): PaymentProvider {
  if (provider === 'mock' || provider === 'test') return 'test';
  return provider;
}

/**
 * @deprecated Prefer gateway.verifyWebhook — kept for legacy imports.
 */
export function verifyWebhookSignature(
  _provider: WebhookProvider,
  _rawBody: string,
  _signatureHeader: string | undefined,
): boolean {
  return false;
}

export type WebhookHandleResult = {
  handled: boolean;
  message: string;
  paymentId?: string;
};

function resolveWebhookGateway(provider: WebhookProvider) {
  if (provider === 'paytabs') {
    try {
      return new PayTabsPaymentGateway();
    } catch (err) {
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
      throw err;
    }
  }
  return getPaymentGateway(toPaymentProvider(provider));
}

/**
 * Provider webhook → verify via selected gateway adapter → normalize → existing payment logic.
 * Browser redirects must never call this path as a substitute for a verified event.
 */
export async function handlePaymentWebhook(
  provider: WebhookProvider,
  payload: unknown,
  signatureHeader: string | undefined,
  rawBody?: string,
): Promise<WebhookHandleResult> {
  if ((provider === 'mock' || provider === 'test') && isAppEnvProduction()) {
    throw new AppError(403, 'FORBIDDEN', 'Mock payment webhooks are not available in production');
  }

  const gateway = resolveWebhookGateway(provider);
  const raw =
    rawBody ??
    (typeof payload === 'string' ? payload : JSON.stringify(payload ?? {}));

  const event = await gateway.verifyWebhook({
    rawBody: raw,
    signatureHeader,
    payload,
  });

  if (!event) {
    if (provider === 'test' || provider === 'mock') {
      const obj =
        payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
      const isPing =
        payload == null ||
        (obj != null &&
          (Object.keys(obj).length === 0 ||
            obj.ping === true ||
            obj.event === 'ping' ||
            obj.type === 'ping'));
      if (isPing) {
        return { handled: true, message: 'Test webhook acknowledged (no state change)' };
      }
      throw new AppError(400, 'INVALID_WEBHOOK', 'Webhook could not be verified or normalized');
    }
    if (provider === 'cliq' || provider === 'card_gateway') {
      throw new AppError(
        501,
        'NOT_IMPLEMENTED',
        `${provider} webhook verification is not implemented yet (PSP not selected)`,
      );
    }
    if (provider === 'paytabs') {
      throw new AppError(401, 'INVALID_WEBHOOK_SIGNATURE', 'PayTabs webhook signature invalid');
    }
    throw new AppError(400, 'INVALID_WEBHOOK', 'Webhook could not be verified or normalized');
  }

  return applyNormalizedGatewayEvent(event);
}

export function isKnownPaymentProvider(value: string): value is PaymentProvider {
  return (PAYMENT_PROVIDERS as readonly string[]).includes(value);
}
