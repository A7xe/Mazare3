import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { AppError } from '../lib/errors.js';
import { isInternalQaRoutesEnabled } from '../lib/qa-mode.js';
import {
  backdatePaymentExpiryForQa,
  expireStalePayments,
} from '../services/payment.service.js';
import {
  qaBackdateBookingSlot,
  qaBackdatePayoutEligible,
} from '../services/internal-qa.service.js';

export const internalRouter = Router();

function requireInternalQa() {
  if (!isInternalQaRoutesEnabled()) {
    throw new AppError(403, 'FORBIDDEN', 'Internal QA routes are disabled');
  }
}

internalRouter.post(
  '/payments/expire-stale',
  asyncHandler(async (_req, res) => {
    requireInternalQa();
    const result = await expireStalePayments();
    res.json({ data: result });
  }),
);

internalRouter.post(
  '/bookings/:id/backdate-slot',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const id = req.params.id;
    const date = (req.body as { date?: string })?.date;
    if (!id || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'booking id and date (YYYY-MM-DD) required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await qaBackdateBookingSlot(id, date);
    res.json({ data });
  }),
);

internalRouter.post(
  '/payments/:id/backdate-payout-eligible',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Payment id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await qaBackdatePayoutEligible(id);
    res.json({ data });
  }),
);

internalRouter.post(
  '/payments/:id/backdate-expiry',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Payment id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    await backdatePaymentExpiryForQa(id);
    res.json({ data: { ok: true } });
  }),
);
