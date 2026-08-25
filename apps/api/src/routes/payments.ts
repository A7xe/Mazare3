import { Router } from 'express';
import { createPaymentIntentSchema } from '@mazare3/shared';
import { asyncHandler } from '../middleware/error-handler.js';
import {
  attachUser,
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.js';
import { AppError, formatZodErrors } from '../lib/errors.js';
import {
  acknowledgeBrowserPaymentReturn,
  createPaymentIntent,
  getPaymentForUser,
  simulatePaymentFailure,
  simulatePaymentSuccess,
} from '../services/payment.service.js';

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth, attachUser, requireRole('customer'));

paymentsRouter.post(
  '/create-intent',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createPaymentIntentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    // Amount is never accepted from the client — only bookingId/method/purpose/idempotencyKey.
    const data = await createPaymentIntent(req.session!.userId, parsed.data, req);
    res.status(201).json({ data });
  }),
);

paymentsRouter.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Payment id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await getPaymentForUser(req.session!.userId, id);
    if (!data) {
      res.status(404).json({ error: 'Payment not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ data });
  }),
);

/**
 * PSP browser return / success-page callback.
 * Informational only — does not capture or mark payment succeeded.
 */
paymentsRouter.post(
  '/:id/browser-return',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Payment id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await acknowledgeBrowserPaymentReturn(req.session!.userId, id);
    res.json({
      data,
      meta: {
        paymentTruth: 'webhook_or_server_verify',
        note: 'Browser return acknowledged; payment status unchanged by this endpoint',
      },
    });
  }),
);

paymentsRouter.post(
  '/:id/simulate-success',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Payment id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await simulatePaymentSuccess(req.session!.userId, id, req);
    res.json({ data });
  }),
);

paymentsRouter.post(
  '/:id/simulate-failure',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Payment id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await simulatePaymentFailure(req.session!.userId, id, req);
    res.json({ data });
  }),
);
