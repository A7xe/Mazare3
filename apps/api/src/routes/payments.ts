import { Router } from 'express';
import {
  createManagedFormPaymentSchema,
  createPaymentIntentSchema,
  createSavedCardPaymentSchema,
} from '@mazare3/shared';
import { asyncHandler } from '../middleware/error-handler.js';
import {
  attachUser,
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.js';
import { requireTermsAcceptance } from '../middleware/require-terms-acceptance.js';
import { AppError, formatZodErrors } from '../lib/errors.js';
import {
  acknowledgeBrowserPaymentReturn,
  createManagedFormPayment,
  createPaymentIntent,
  createRescheduleDifferencePaymentIntent,
  createSavedCardPayment,
  getPaymentForUser,
  simulatePaymentFailure,
  simulatePaymentSuccess,
} from '../services/payment.service.js';
import { z } from 'zod';
import { PAYMENT_METHODS } from '@mazare3/shared';

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth, attachUser, requireRole('customer'));

paymentsRouter.post(
  '/create-intent',
  requireTermsAcceptance,
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

const createRescheduleDifferenceSchema = z.object({
  rescheduleRequestId: z.string().min(1),
  method: z.enum(PAYMENT_METHODS),
  idempotencyKey: z.string().min(8).max(64).optional(),
  contactEmail: z.string().trim().min(3).max(254).optional(),
  contactPhone: z.string().trim().min(8).max(32).optional(),
});

paymentsRouter.post(
  '/reschedule-difference',
  requireTermsAcceptance,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createRescheduleDifferenceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await createRescheduleDifferencePaymentIntent(
      req.session!.userId,
      parsed.data.rescheduleRequestId,
      parsed.data.method,
      req,
      {
        idempotencyKey: parsed.data.idempotencyKey,
        contactEmail: parsed.data.contactEmail,
        contactPhone: parsed.data.contactPhone,
      },
    );
    res.status(201).json({ data });
  }),
);

/**
 * CB-4 Managed Form — temporary payment_token from paylib only.
 * Never accepts PAN/CVV/amount/purpose from the client.
 */
paymentsRouter.post(
  '/managed-form',
  requireTermsAcceptance,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createManagedFormPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await createManagedFormPayment(req.session!.userId, parsed.data, req);
    res.status(201).json({ data });
  }),
);

/**
 * CB-5B — pay with a vaulted saved card.
 * Body: bookingId + savedPaymentMethodId only (no token/CVV/amount/purpose).
 */
paymentsRouter.post(
  '/saved-card',
  requireTermsAcceptance,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createSavedCardPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await createSavedCardPayment(req.session!.userId, parsed.data, req);
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
