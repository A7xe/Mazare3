import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { attachUser, requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  createRefundRequestSchema,
  createDisputeSchema,
  createReviewSchema,
  createBookingSupportTicketSchema,
} from '@mazare3/shared';
import { AppError, formatZodErrors } from '../lib/errors.js';
import {
  cancelMyBooking,
  getCheckoutBooking,
  getMyBookingById,
  listMyBookings,
  getRebookIntent,
} from '../services/booking.service.js';
import {
  createRefundRequest,
  listMyRefundRequests,
} from '../services/refund-request.service.js';
import { createDispute, listMyDisputes } from '../services/dispute.service.js';
import {
  createBookingSupportTicket,
  getMySupportTicket,
  listMySupportTickets,
} from '../services/support.service.js';
import { supportRateLimiter } from '../middleware/rate-limit.js';
import {
  listMyNotifications,
  markAllRead,
  markRead,
} from '../services/notification.service.js';
import { UserRole } from '@mazare3/db';
import { createBookingReview } from '../services/review.service.js';
import {
  addFavorite,
  listBookableFavorites,
  listFavoritePropertyIds,
  removeFavorite,
} from '../services/favorite.service.js';
import {
  listSavedPaymentMethodsForUser,
  revokeSavedPaymentMethod,
  setDefaultSavedPaymentMethod,
} from '../services/saved-payment-method.service.js';
import { getCustomerHomePersonalization } from '../services/home-personalization.service.js';

export const meRouter = Router();

meRouter.use(requireAuth, attachUser);

const requireCustomerRole = requireRole('customer');

meRouter.get(
  '/home-personalization',
  requireCustomerRole,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getCustomerHomePersonalization(req.session!.userId);
    res.json({ data });
  }),
);

meRouter.get(
  '/favorites/ids',
  requireCustomerRole,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const propertyIds = await listFavoritePropertyIds(req.session!.userId);
    res.json({ data: { propertyIds } });
  }),
);

meRouter.get(
  '/favorites',
  requireCustomerRole,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listBookableFavorites(req.session!.userId);
    res.json({ data });
  }),
);

meRouter.post(
  '/favorites/:propertyId',
  requireCustomerRole,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const propertyId = req.params.propertyId;
    if (!propertyId) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await addFavorite(req.session!.userId, propertyId);
    res.json({ data });
  }),
);

meRouter.delete(
  '/favorites/:propertyId',
  requireCustomerRole,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const propertyId = req.params.propertyId;
    if (!propertyId) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await removeFavorite(req.session!.userId, propertyId);
    res.json({ data });
  }),
);

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
  '/bookings/:id/rebook-intent',
  requireCustomerRole,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Booking id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await getRebookIntent(req.session!.userId, id);
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

meRouter.get(
  '/support',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listMySupportTickets(req.session!.userId);
    res.json({ data });
  }),
);

meRouter.get(
  '/support/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Support request id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await getMySupportTicket(req.session!.userId, id);
    res.json({ data });
  }),
);

meRouter.post(
  '/bookings/:id/support',
  supportRateLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Booking id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = createBookingSupportTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await createBookingSupportTicket(req.session!.userId, id, parsed.data, req);
    res.status(201).json({ data });
  }),
);

meRouter.get(
  '/notifications',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 30;
    const data = await listMyNotifications(
      req.session!.userId,
      req.session!.role as UserRole,
      limit,
    );
    res.json({ data });
  }),
);

meRouter.patch(
  '/notifications/read-all',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await markAllRead(req.session!.userId, req.session!.role as UserRole);
    res.json({ data });
  }),
);

meRouter.patch(
  '/notifications/:id/read',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Notification id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await markRead(req.session!.userId, req.session!.role as UserRole, id);
    res.json({ data });
  }),
);

meRouter.post(
  '/bookings/:id/review',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Booking id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await createBookingReview(req.session!.userId, id, parsed.data);
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

/** CB-5A — list saved payment methods (masked metadata only; never providerToken). */
meRouter.get(
  '/payment-methods',
  requireCustomerRole,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listSavedPaymentMethodsForUser(req.session!.userId);
    res.json({ data });
  }),
);

meRouter.post(
  '/payment-methods/:id/default',
  requireCustomerRole,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Payment method id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await setDefaultSavedPaymentMethod(req.session!.userId, id, req);
    res.json({ data });
  }),
);

meRouter.delete(
  '/payment-methods/:id',
  requireCustomerRole,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Payment method id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await revokeSavedPaymentMethod(req.session!.userId, id, req);
    res.json({ data });
  }),
);
