import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import {
  handlePaymentWebhook,
  parseWebhookProvider,
} from '../services/payment-webhook.service.js';

export const paymentWebhooksRouter = Router();

paymentWebhooksRouter.post(
  '/:provider',
  asyncHandler(async (req, res) => {
    const provider = parseWebhookProvider(req.params.provider);
    const signature =
      (req.headers['x-webhook-signature'] as string | undefined) ??
      (req.headers['x-signature'] as string | undefined);

    // TODO Phase 6C: verifyWebhookSignature(provider, rawBody, signature) before any payment update.
    void signature;

    const result = await handlePaymentWebhook(provider, req.body, signature);
    res.json({ data: result });
  }),
);
