import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { attachUser, requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  cancelMyBooking,
  getMyBookingById,
  listMyBookings,
} from '../services/booking.service.js';

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
