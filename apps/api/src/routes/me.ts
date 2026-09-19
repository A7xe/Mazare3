import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { attachUser, requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  createRefundRequestSchema,
  createDisputeSchema,
  createReviewSchema,
  createBookingSupportTicketSchema,
  requestRescheduleSchema,
  respondRescheduleSchema,
  reportArrivalProblemSchema,
  customerForceMajeureChoiceSchema,
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
import { ensureCheckInCodeForCustomer } from '../services/check-in.service.js';
import {
  requestCustomerReschedule,
  respondToRescheduleRequest,
  previewReschedulePricing,
  mapPendingRescheduleByBookingIds,
} from '../services/reschedule.service.js';
import { reportOwnerArrivalProblem } from '../services/no-show.service.js';
import { customerElectForceMajeureResolution } from '../services/force-majeure.service.js';
import {
  bookingLegalAckSchema,
  createDataSubjectRequestSchema,
  grantPrivacyConsentSchema,
  grantDataProcessingConsentSchema,
  dataProcessingConsentPurposeSchema,
  privacyConsentPurposeSchema,
  recordLegalAcceptanceSchema,
} from '@mazare3/shared';
import { recordAcceptance, getAcceptanceStatus } from '../services/legal/legal-acceptance.service.js';
import {
  evaluateCustomerReacceptanceGates,
  evaluateOwnerReacceptanceGates,
} from '../services/legal/legal-reacceptance.service.js';
import {
  grantConsent,
  withdrawConsent,
  listConsentsForUser,
} from '../services/legal/privacy-consent.service.js';
import {
  grantDataProcessingConsent,
  withdrawDataProcessingConsent,
  listPriorConsentStatusForUser,
  listPriorConsentHistoryForUser,
} from '../services/legal/data-processing-consent.service.js';
import {
  createDataSubjectRequest,
  listDataSubjectRequestsForUser,
} from '../services/legal/data-subject-request.service.js';
import {
  createSnapshotForBooking,
  getCustomerLegalSnapshotSummary,
} from '../services/legal/booking-legal-snapshot.service.js';
import { LegalDocumentType } from '@mazare3/db';

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

/** Customer-safe legal snapshot — titles/versions/dates only (no content hashes). */
meRouter.get(
  '/bookings/:id/legal-snapshot',
  requireCustomerRole,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Booking id is required');
    }
    const booking = await getMyBookingById(req.session!.userId, id);
    if (!booking) {
      throw new AppError(404, 'NOT_FOUND', 'Booking not found');
    }
    const data = await getCustomerLegalSnapshotSummary(id);
    res.json({ data });
  }),
);

/** Phase 3C.4D.6 — Customer Booking-time listing snapshot (immutable evidence). */
meRouter.get(
  '/bookings/:id/listing-snapshot',
  requireCustomerRole,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Booking id is required');
    }
    const { getCustomerBookingListingSnapshot } = await import(
      '../services/booking-listing-snapshot.service.js'
    );
    const data = await getCustomerBookingListingSnapshot(req.session!.userId, id);
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

meRouter.get(
  '/bookings/:id/check-in-code',
  requireCustomerRole,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await ensureCheckInCodeForCustomer(req.session!.userId, req.params.id!);
    res.json({ data });
  }),
);

meRouter.get(
  '/bookings/:id/reschedule-preview',
  requireCustomerRole,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const toSlotId = String(req.query.toSlotId ?? '').trim();
    if (!toSlotId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'toSlotId is required');
    }
    // Ownership check via booking lookup inside preview after verifying user booking
    const booking = await getMyBookingById(req.session!.userId, req.params.id!);
    if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
    const forceMajeure =
      req.query.forceMajeure === '1' ||
      req.query.forceMajeure === 'true' ||
      booking.forceMajeureResolution?.awaitingCustomerChoice === true;
    const voluntaryUpgrade =
      req.query.voluntaryUpgrade === '1' || req.query.voluntaryUpgrade === 'true';
    const data = await previewReschedulePricing(req.params.id!, toSlotId, 'customer', {
      forceMajeure,
      voluntaryUpgrade,
    });
    res.json({ data });
  }),
);

meRouter.post(
  '/bookings/:id/reschedule',
  requireCustomerRole,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = requestRescheduleSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await requestCustomerReschedule({
      customerUserId: req.session!.userId,
      bookingId: req.params.id!,
      toSlotId: parsed.data.toSlotId,
      req,
    });
    res.status(201).json({ data });
  }),
);

meRouter.post(
  '/reschedule-requests/:id/respond',
  requireCustomerRole,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = respondRescheduleSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await respondToRescheduleRequest({
      responderUserId: req.session!.userId,
      role: req.session!.role,
      requestId: req.params.id!,
      accept: parsed.data.accept,
      req,
    });
    res.json({ data });
  }),
);

meRouter.post(
  '/bookings/:id/report-arrival-problem',
  requireCustomerRole,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = reportArrivalProblemSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await reportOwnerArrivalProblem({
      customerUserId: req.session!.userId,
      bookingId: req.params.id!,
      type: parsed.data.type,
      description: parsed.data.description,
      req,
    });
    res.status(201).json({ data });
  }),
);

meRouter.post(
  '/bookings/:id/force-majeure/choose',
  requireCustomerRole,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = customerForceMajeureChoiceSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await customerElectForceMajeureResolution({
      customerUserId: req.session!.userId,
      bookingId: req.params.id!,
      choice: parsed.data.choice,
      toSlotId: parsed.data.toSlotId,
      voluntaryUpgrade: parsed.data.voluntaryUpgrade,
      source: parsed.data.source ?? 'customer_my_bookings',
      req,
    });
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

meRouter.post(
  '/legal/accept',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = recordLegalAcceptanceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await recordAcceptance(req.session!.userId, parsed.data, { req });
    res.status(201).json({ data });
  }),
);

meRouter.get(
  '/legal/status',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.session!.userId;
    const customer = await evaluateCustomerReacceptanceGates(userId);
    const owner = await evaluateOwnerReacceptanceGates(userId);
    const terms = await getAcceptanceStatus(userId, LegalDocumentType.terms_and_conditions);
    const privacy = await getAcceptanceStatus(userId, LegalDocumentType.privacy_policy);
    const cancellation = await getAcceptanceStatus(
      userId,
      LegalDocumentType.cancellation_refund_policy,
    );
    const bookingTerms = await getAcceptanceStatus(userId, LegalDocumentType.booking_terms);
    const priorConsent = await listPriorConsentStatusForUser(userId);
    res.json({
      data: {
        customer,
        owner,
        priorConsent,
        byType: {
          terms_and_conditions: terms,
          privacy_policy: privacy,
          cancellation_refund_policy: cancellation,
          booking_terms: bookingTerms,
          owner_agreement: owner.gates[0] ?? null,
        },
      },
    });
  }),
);

meRouter.post(
  '/privacy-consents',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = grantPrivacyConsentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await grantConsent(req.session!.userId, parsed.data, req);
    res.status(201).json({ data });
  }),
);

meRouter.post(
  '/privacy-consents/:purpose/withdraw',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const purpose = privacyConsentPurposeSchema.safeParse(req.params.purpose);
    if (!purpose.success) {
      throw new AppError(400, 'INVALID_PURPOSE', 'Unknown privacy consent purpose');
    }
    const data = await withdrawConsent(req.session!.userId, purpose.data, req);
    res.json({ data });
  }),
);

meRouter.get(
  '/privacy-consents',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listConsentsForUser(req.session!.userId);
    res.json({ data });
  }),
);

meRouter.post(
  '/prior-consents',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = grantDataProcessingConsentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await grantDataProcessingConsent(req.session!.userId, parsed.data, req);
    res.status(201).json({ data });
  }),
);

meRouter.post(
  '/prior-consents/:purpose/withdraw',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const purpose = dataProcessingConsentPurposeSchema.safeParse(req.params.purpose);
    if (!purpose.success) {
      throw new AppError(400, 'INVALID_PURPOSE', 'Unknown Prior Consent purpose');
    }
    const data = await withdrawDataProcessingConsent(req.session!.userId, purpose.data, req);
    res.json({ data });
  }),
);

meRouter.get(
  '/prior-consents',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listPriorConsentStatusForUser(req.session!.userId);
    res.json({ data });
  }),
);

meRouter.get(
  '/prior-consents/history',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listPriorConsentHistoryForUser(req.session!.userId);
    res.json({ data });
  }),
);

meRouter.post(
  '/data-subject-requests',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createDataSubjectRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await createDataSubjectRequest(req.session!.userId, parsed.data, req);
    res.status(201).json({ data });
  }),
);

meRouter.get(
  '/data-subject-requests',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listDataSubjectRequestsForUser(req.session!.userId);
    res.json({ data });
  }),
);

meRouter.post(
  '/bookings/:id/legal-ack',
  requireCustomerRole,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const bookingId = req.params.id;
    if (!bookingId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Booking id is required');
    }
    const parsed = bookingLegalAckSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const booking = await getMyBookingById(req.session!.userId, bookingId);
    if (!booking) {
      throw new AppError(404, 'NOT_FOUND', 'Booking not found');
    }

    const ids = parsed.data.acceptedDocumentVersionIds;
    const acceptances = [];
    const pairs: Array<{ id?: string; context: 'checkout' }> = [
      { id: ids.terms, context: 'checkout' },
      { id: ids.cancellation, context: 'checkout' },
      { id: ids.bookingTerms, context: 'checkout' },
      { id: ids.privacy, context: 'checkout' },
    ];
    for (const pair of pairs) {
      if (!pair.id) continue;
      acceptances.push(
        await recordAcceptance(
          req.session!.userId,
          {
            documentVersionId: pair.id,
            context: pair.context,
            sourceSurface: 'me.bookings.legal-ack',
            relatedBookingId: bookingId,
          },
          { req },
        ),
      );
    }

    const snapshot = await createSnapshotForBooking(bookingId, {
      versionIds: {
        termsVersionId: ids.terms,
        cancellationPolicyVersionId: ids.cancellation,
        bookingTermsVersionId: ids.bookingTerms,
        privacyNoticeVersionId: ids.privacy,
      },
    });

    res.status(201).json({ data: { acceptances, snapshot } });
  }),
);
