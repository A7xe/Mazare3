import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { AppError } from '../lib/errors.js';
import { getPaytabsCallbackSignatureHeader } from '../services/payment/paytabs-signature.js';
import {
  handlePaymentWebhook,
  parseWebhookProvider,
} from '../services/payment-webhook.service.js';

export const paymentWebhooksRouter = Router();

type RequestWithRawBody = { rawBody?: Buffer | string; body?: unknown };

function readWebhookRawBody(req: RequestWithRawBody, provider: string): string {
  if (typeof req.rawBody === 'string') return req.rawBody;
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');
  // PayTabs HMAC is over the exact posted bytes. Re-serializing parsed JSON is invalid.
  if (provider === 'paytabs') {
    throw new AppError(401, 'INVALID_WEBHOOK_SIGNATURE', 'PayTabs webhook signature invalid');
  }
  return JSON.stringify(req.body ?? {});
}

paymentWebhooksRouter.post(
  '/:provider',
  asyncHandler(async (req, res) => {
    const provider = parseWebhookProvider(req.params.provider);
    const signature = getPaytabsCallbackSignatureHeader(req.headers);
    const rawBody = readWebhookRawBody(req as RequestWithRawBody, provider);

    if (provider === 'paytabs') {
      console.info('[paytabs-webhook]', {
        signatureHeaderPresent: Boolean(signature?.trim()),
        rawBodyLength: Buffer.byteLength(rawBody, 'utf8'),
      });
    }

    const result = await handlePaymentWebhook(provider, req.body, signature, rawBody);
    res.json({ data: result });
  }),
);
