import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { attachUser, requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  createRefundRequestSchema,
  createDisputeSchema,
} from '@mazare3/shared';
import { AppError, formatZodErrors } from '../lib/errors.js';
import {
  cancelMyBooking,
  getCheckoutBooking,
  getMyBookingById,
  listMyBookings,
} from '../services/booking.service.js';
import {
  createRefundRequest,
  listMyRefundRequests,
} from '../services/refund-request.service.js';
import { createDispute, listMyDisputes } from '../services/dispute.service.js';

export const meRouter = Router();

meRouter.use(requireAuth, attachUser);

meRouter.get(
  '/bookings',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listMyBookings(req.session!.userId);
    res.json({ data });
  }),
);

meRouter.get(
  '/bookings/:id/checkout',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Booking id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await getCheckoutBooking(req.session!.userId, id);
    if (!data) {
      res.status(404).json({ error: 'Booking not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ data });
  }),
);

meRouter.get(
  '/bookings/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Booking id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await getMyBookingById(req.session!.userId, id);
    if (!data) {
      res.status(404).json({ error: 'Booking not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ data });
  }),
);

meRouter.get(
  '/refund-requests',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listMyRefundRequests(req.session!.userId);
    res.json({ data });
  }),
);

meRouter.post(
  '/bookings/:id/refund-request',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Booking id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = createRefundRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await createRefundRequest(
      req.session!.userId,
      id,
      parsed.data,
      req,
    );
    res.status(201).json({ data });
  }),
);

meRouter.get(
  '/disputes',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listMyDisputes(req.session!.userId);
    res.json({ data });
  }),
);

meRouter.post(
  '/bookings/:id/disputes',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Booking id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = createDisputeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await createDispute(req.session!.userId, id, parsed.data, req);
    res.status(201).json({ data });
  }),
);

meRouter.post(
  '/bookings/:id/cancel',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Booking id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await cancelMyBooking(req.session!.userId, id, req);
    res.json({ data });
  }),
);
