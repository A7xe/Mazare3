import { Router } from 'express';
import { createBookingSchema } from '@mazare3/shared';
import { asyncHandler } from '../middleware/error-handler.js';
import {
  attachUser,
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { createBooking } from '../services/booking.service.js';

export const bookingsRouter = Router();

bookingsRouter.post(
  '/',
  requireAuth,
  attachUser,
  requireRole('customer'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid booking payload', parsed.error.flatten());
    }

    const data = await createBooking(req.session!.userId, parsed.data, req);
    res.status(201).json({ data });
  }),
);
