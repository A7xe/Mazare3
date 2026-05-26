import { PAYMENT_PROVIDERS, type PaymentProvider } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
const WEBHOOK_PROVIDERS = ['test', 'cliq', 'card_gateway'] as const;
export type WebhookProvider = (typeof WEBHOOK_PROVIDERS)[number];

export function parseWebhookProvider(raw: string | undefined): WebhookProvider {
  const value = (raw ?? '').trim().toLowerCase();
  if (!(WEBHOOK_PROVIDERS as readonly string[]).includes(value)) {
    throw new AppError(400, 'UNKNOWN_PROVIDER', 'Unknown payment webhook provider');
  }
  return value as WebhookProvider;
}

/**
 * Verify webhook signature from provider.
 * TODO Phase 6C: implement HMAC verification per provider using CLIQ_WEBHOOK_SECRET / CARD_GATEWAY_WEBHOOK_SECRET.
 */
export function verifyWebhookSignature(
  _provider: WebhookProvider,
  _rawBody: string,
  _signatureHeader: string | undefined,
): boolean {
  // Placeholder: reject unsigned webhooks in live mode until implemented.
  return false;
}

export type WebhookHandleResult = {
  handled: boolean;
  message: string;
};

export async function handlePaymentWebhook(
  provider: WebhookProvider,
  _payload: unknown,
  _signatureHeader: string | undefined,
): Promise<WebhookHandleResult> {
  if (provider === 'test') {
    return { handled: true, message: 'Test webhook acknowledged (no state change)' };
  }

  if (provider === 'cliq') {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'CliQ webhook handler is not implemented yet');
  }

  if (provider === 'card_gateway') {
    throw new AppError(
      501,
      'NOT_IMPLEMENTED',
      'Card gateway webhook handler is not implemented yet',
    );
  }

  throw new AppError(400, 'UNKNOWN_PROVIDER', 'Unknown payment webhook provider');
}

export function isKnownPaymentProvider(value: string): value is PaymentProvider {
  return (PAYMENT_PROVIDERS as readonly string[]).includes(value);
}
