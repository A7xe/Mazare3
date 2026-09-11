import { Router } from 'express';
import {
  adminAvailabilityQuerySchema,
  patchAdminAvailabilitySchema,
  patchAdminOwnerStatusSchema,
  patchAdminPropertyStatusSchema,
  patchAdminPropertyVerificationSchema,
  patchAdminUserStatusSchema,
  approvePartnerSchema,
  createPartnerCommercialTermsSchema,
  partnerReasonSchema,
  patchPartnerDocumentReviewSchema,
  previewPartnerCommercialTermsSchema,
  requestPartnerChangesSchema,
  reviewPartnerPayoutSchema,
} from '@mazare3/shared';
import { asyncHandler } from '../middleware/error-handler.js';
import { requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { AppError, formatZodErrors } from '../lib/errors.js';
import {
  getAdminSummary,
  getAdminPropertyById,
  getAdminUserById,
  getAdminAvailabilityHealth,
  listAdminAuditLogs,
  listAdminAvailability,
  listAdminBookings,
  listAdminOwners,
  patchAdminOwnerStatus,
  listAdminProperties,
  listAdminUsers,
  patchAdminAvailabilitySlot,
  patchAdminPropertyStatus,
  patchAdminPropertyVerification,
  patchAdminUserStatus,
} from '../services/admin.service.js';
import {
  disableAdminPromotion,
  listAdminPropertyPromotions,
} from '../services/promotion.service.js';
import {
  disableAdminCoupon,
  listAdminPropertyCoupons,
} from '../services/coupon.service.js';
import {
  activateAdminPlacement,
  createAdminPlacement,
  listAdminPropertyPlacements,
  pauseAdminPlacement,
} from '../services/placement.service.js';
import {
  activateSponsoredOrder,
  approveSponsoredOrder,
  confirmSponsoredPayment,
  createAdminSponsoredPackage,
  listAdminSponsoredOrders,
  listAdminSponsoredPackages,
  rejectSponsoredOrder,
  setAdminSponsoredPackageStatus,
  updateAdminSponsoredPackage,
} from '../services/sponsorship.service.js';
import { CatalogPackageStatus, SponsoredOrderStatus } from '@mazare3/db';
import {
  activateAdminPlatformCoupon,
  createAdminPlatformCoupon,
  listAdminPlatformCoupons,
  pauseAdminPlatformCoupon,
} from '../services/platform-coupon.service.js';
import {
  activateCommercialTerms,
  createCommercialTerms,
  listOwnerCommercialTerms,
  mapTermsRow,
  resolveCommercialTerms,
} from '../services/commercial-terms.service.js';
import {
  approvePartner,
  getAdminPartnerDetail,
  listAdminPartners,
  rejectPartner,
  requestPartnerChanges,
  restorePartner,
  reviewPartnerDocument,
  reviewPartnerPayout,
  streamAdminPartnerDocument,
  suspendPartner,
} from '../services/partner-admin.service.js';
import { listAdminPayments } from '../services/payment.service.js';
import { reconcilePayTabsPayment } from '../services/paytabs-reconciliation.service.js';
import {
  listAdminRefundRequests,
  patchAdminRefundRequest,
} from '../services/refund-request.service.js';
import { listAdminDisputes, patchAdminDispute } from '../services/dispute.service.js';
import {
  getAdminSupportTicket,
  listAdminSupportTickets,
  patchAdminSupportTicket,
} from '../services/support.service.js';
import {
  listAdminPayouts,
  markAdminPayoutPaid,
} from '../services/payout-operations.service.js';
import { getAdminPartnerPerformance } from '../services/owner-performance.service.js';
import {
  cancelOwnerSettlement,
  createOwnerSettlement,
  finalizeOwnerSettlement,
  getOwnerSettlement,
  listOwnerSettlementsForAdmin,
  getOwnerSettlementCycleInfo,
  markOwnerSettlementPaid,
  previewOwnerSettlement,
} from '../services/owner-settlement.service.js';
import {
  hideReview,
  listAdminReviews,
  restoreReview,
} from '../services/review.service.js';
import {
  patchAdminRefundRequestSchema,
  patchAdminDisputeSchema,
  patchAdminSupportTicketSchema,
  adminSupportTicketListQuerySchema,
  markAdminPayoutPaidSchema,
  createOwnerSettlementSchema,
  markOwnerSettlementPaidSchema,
  hideReviewSchema,
  createPlatformCouponSchema,
  createPropertyPlacementSchema,
  createSponsoredPackageSchema,
  updateSponsoredPackageSchema,
  confirmSponsoredPaymentSchema,
  sponsoredOrderAdminNoteSchema,
} from '@mazare3/shared';

export const adminRouter = Router();

adminRouter.use(...requireAdmin);

adminRouter.get(
  '/platform-coupons',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminPlatformCoupons();
    res.json({ data });
  }),
);

adminRouter.post(
  '/platform-coupons',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createPlatformCouponSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid coupon payload', formatZodErrors(parsed.error));
    }
    const data = await createAdminPlatformCoupon(req.session!.userId, parsed.data, req);
    res.status(201).json({ data });
  }),
);

adminRouter.post(
  '/platform-coupons/:id/activate',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await activateAdminPlatformCoupon(req.session!.userId, req.params.id!, req);
    res.json({ data });
  }),
);

adminRouter.post(
  '/platform-coupons/:id/pause',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await pauseAdminPlatformCoupon(req.session!.userId, req.params.id!, req);
    res.json({ data });
  }),
);

adminRouter.get(
  '/summary',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getAdminSummary(req.session!.userId, req);
    res.json({ data });
  }),
);

adminRouter.get(
  '/users',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminUsers();
    res.json({ data });
  }),
);

adminRouter.get(
  '/users/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'User id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await getAdminUserById(id);
    if (!data) {
      res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ data });
  }),
);

adminRouter.patch(
  '/users/:id/status',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'User id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = patchAdminUserStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await patchAdminUserStatus(
      req.session!.userId,
      id,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.get(
  '/owners',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminOwners();
    res.json({ data });
  }),
);

adminRouter.patch(
  '/owners/:id/status',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Owner id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = patchAdminOwnerStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await patchAdminOwnerStatus(
      req.session!.userId,
      id,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.get(
  '/partners',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listAdminPartners({
      verificationStatus: typeof req.query.verificationStatus === 'string' ? req.query.verificationStatus : undefined,
      entityType: typeof req.query.entityType === 'string' ? req.query.entityType : undefined,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
    });
    res.json({ data });
  }),
);

adminRouter.get(
  '/partners/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getAdminPartnerDetail(req.params.id!);
    res.json({ data });
  }),
);

adminRouter.get(
  '/partners/:id/performance',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getAdminPartnerPerformance(req.params.id!, req.query.range);
    res.json({ data });
  }),
);

adminRouter.get(
  '/partners/:id/settlement-preview',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const through =
      typeof req.query.through === 'string'
        ? req.query.through
        : new Date().toISOString().slice(0, 10);
    const data = await previewOwnerSettlement(req.params.id!, through);
    res.json({ data });
  }),
);

adminRouter.get(
  '/partners/:id/settlements',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listOwnerSettlementsForAdmin(req.params.id!);
    const cycle = await getOwnerSettlementCycleInfo(req.params.id!);
    res.json({ data, cycle });
  }),
);

adminRouter.post(
  '/partners/:id/settlements',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createOwnerSettlementSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await createOwnerSettlement(
      req.session!.userId,
      req.params.id!,
      parsed.data,
      req,
    );
    res.status(201).json({ data });
  }),
);

adminRouter.get(
  '/settlements/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getOwnerSettlement(req.params.id!, true);
    res.json({ data });
  }),
);

adminRouter.post(
  '/settlements/:id/finalize',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await finalizeOwnerSettlement(req.session!.userId, req.params.id!, req);
    res.json({ data });
  }),
);

adminRouter.post(
  '/settlements/:id/mark-paid',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = markOwnerSettlementPaidSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await markOwnerSettlementPaid(
      req.session!.userId,
      req.params.id!,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.post(
  '/settlements/:id/cancel',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await cancelOwnerSettlement(req.session!.userId, req.params.id!, req);
    res.json({ data });
  }),
);

adminRouter.get(
  '/reviews',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminReviews();
    res.json({ data });
  }),
);

adminRouter.post(
  '/reviews/:id/hide',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = hideReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await hideReview(req.session!.userId, req.params.id!, parsed.data, req);
    res.json({ data });
  }),
);

adminRouter.post(
  '/reviews/:id/restore',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await restoreReview(req.session!.userId, req.params.id!, req);
    res.json({ data });
  }),
);

adminRouter.patch(
  '/partners/:id/documents/:documentId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = patchPartnerDocumentReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await reviewPartnerDocument({
      actorUserId: req.session!.userId,
      ownerProfileId: req.params.id!,
      documentId: req.params.documentId!,
      input: parsed.data,
      req,
    });
    res.json({ data });
  }),
);

adminRouter.get(
  '/partners/:id/documents/:documentId/file',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const file = await streamAdminPartnerDocument({
      actorUserId: req.session!.userId,
      ownerProfileId: req.params.id!,
      documentId: req.params.documentId!,
      req,
    });
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.originalFileName)}"`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(file.buffer);
  }),
);

adminRouter.post(
  '/partners/:id/request-changes',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = requestPartnerChangesSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await requestPartnerChanges({
      actorUserId: req.session!.userId,
      ownerProfileId: req.params.id!,
      input: parsed.data,
      req,
    });
    res.json({ data });
  }),
);

adminRouter.post(
  '/partners/:id/payout-review',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = reviewPartnerPayoutSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await reviewPartnerPayout({
      actorUserId: req.session!.userId,
      ownerProfileId: req.params.id!,
      input: parsed.data,
      req,
    });
    res.json({ data });
  }),
);

adminRouter.post(
  '/partners/:id/approve',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = approvePartnerSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await approvePartner({
      actorUserId: req.session!.userId,
      ownerProfileId: req.params.id!,
      input: parsed.data,
      req,
    });
    res.json({ data });
  }),
);

adminRouter.post(
  '/partners/:id/reject',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = partnerReasonSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await rejectPartner({
      actorUserId: req.session!.userId,
      ownerProfileId: req.params.id!,
      reason: parsed.data.reason,
      req,
    });
    res.json({ data });
  }),
);

adminRouter.post(
  '/partners/:id/suspend',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = partnerReasonSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await suspendPartner({
      actorUserId: req.session!.userId,
      ownerProfileId: req.params.id!,
      reason: parsed.data.reason,
      req,
    });
    res.json({ data });
  }),
);

adminRouter.post(
  '/partners/:id/restore',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await restorePartner({
      actorUserId: req.session!.userId,
      ownerProfileId: req.params.id!,
      req,
    });
    res.json({ data });
  }),
);

adminRouter.get(
  '/partners/:id/commercial-terms',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await listOwnerCommercialTerms(req.params.id!);
    res.json({ data: rows.map(mapTermsRow) });
  }),
);

adminRouter.post(
  '/partners/:id/commercial-terms/preview',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = previewPartnerCommercialTermsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await resolveCommercialTerms({
      ownerProfileId: req.params.id!,
      propertyId: parsed.data.propertyId,
    });
    res.json({ data });
  }),
);

adminRouter.post(
  '/partners/:id/commercial-terms',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createPartnerCommercialTermsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await createCommercialTerms({
      actorUserId: req.session!.userId,
      ownerProfileId: req.params.id!,
      input: parsed.data,
      req,
    });
    res.status(201).json({ data });
  }),
);

adminRouter.post(
  '/partners/:id/commercial-terms/:termsId/activate',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await activateCommercialTerms({
      actorUserId: req.session!.userId,
      ownerProfileId: req.params.id!,
      termsId: req.params.termsId!,
      req,
    });
    res.json({ data });
  }),
);

adminRouter.get(
  '/properties',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminProperties();
    res.json({ data });
  }),
);

adminRouter.get(
  '/properties/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await getAdminPropertyById(id);
    if (!data) {
      res.status(404).json({ error: 'Property not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ data });
  }),
);

adminRouter.get(
  '/properties/:id/promotions',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await listAdminPropertyPromotions(id);
    res.json({ data });
  }),
);

adminRouter.post(
  '/properties/:id/promotions/:promoId/disable',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await disableAdminPromotion(
      req.session!.userId,
      req.params.id!,
      req.params.promoId!,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.get(
  '/properties/:id/coupons',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await listAdminPropertyCoupons(id);
    res.json({ data });
  }),
);

adminRouter.post(
  '/properties/:id/coupons/:couponId/disable',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await disableAdminCoupon(
      req.session!.userId,
      req.params.id!,
      req.params.couponId!,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.get(
  '/properties/:id/placements',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await listAdminPropertyPlacements(id);
    res.json({ data });
  }),
);

adminRouter.post(
  '/properties/:id/placements',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createPropertyPlacementSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid placement payload', formatZodErrors(parsed.error));
    }
    const data = await createAdminPlacement(req.session!.userId, req.params.id!, parsed.data, req);
    res.status(201).json({ data });
  }),
);

adminRouter.post(
  '/properties/:id/placements/:placementId/activate',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await activateAdminPlacement(
      req.session!.userId,
      req.params.id!,
      req.params.placementId!,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.post(
  '/properties/:id/placements/:placementId/pause',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await pauseAdminPlacement(
      req.session!.userId,
      req.params.id!,
      req.params.placementId!,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.get(
  '/properties/:id/availability-health',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await getAdminAvailabilityHealth(id);
    res.json({ data });
  }),
);

adminRouter.patch(
  '/properties/:id/verification',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = patchAdminPropertyVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await patchAdminPropertyVerification(
      req.session!.userId,
      id,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.patch(
  '/properties/:id/status',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = patchAdminPropertyStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await patchAdminPropertyStatus(
      req.session!.userId,
      id,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.get(
  '/bookings',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminBookings();
    res.json({ data });
  }),
);

adminRouter.get(
  '/availability',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = adminAvailabilityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid query', formatZodErrors(parsed.error));
    }
    const data = await listAdminAvailability(parsed.data);
    res.json({ data });
  }),
);

adminRouter.patch(
  '/availability/:slotId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const slotId = req.params.slotId;
    if (!slotId) {
      res.status(400).json({ error: 'Slot id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = patchAdminAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await patchAdminAvailabilitySlot(
      req.session!.userId,
      slotId,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.get(
  '/payments',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminPayments();
    res.json({ data });
  }),
);

adminRouter.post(
  '/payments/:id/reconcile',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Payment id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await reconcilePayTabsPayment(id, {
      actorUserId: req.session!.userId,
      source: 'admin',
      req,
    });
    res.json({ data });
  }),
);

adminRouter.get(
  '/refund-requests',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminRefundRequests();
    res.json({ data });
  }),
);

adminRouter.patch(
  '/refund-requests/:id/status',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Refund request id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = patchAdminRefundRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await patchAdminRefundRequest(
      req.session!.userId,
      id,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.get(
  '/disputes',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminDisputes();
    res.json({ data });
  }),
);

adminRouter.patch(
  '/disputes/:id/status',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Dispute id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = patchAdminDisputeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await patchAdminDispute(req.session!.userId, id, parsed.data, req);
    res.json({ data });
  }),
);

adminRouter.get(
  '/support',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = adminSupportTicketListQuerySchema.safeParse({
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      source: typeof req.query.source === 'string' ? req.query.source : undefined,
    });
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid query', formatZodErrors(parsed.error));
    }
    const data = await listAdminSupportTickets(parsed.data);
    res.json({ data });
  }),
);

adminRouter.get(
  '/support/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Support request id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await getAdminSupportTicket(id);
    res.json({ data });
  }),
);

adminRouter.patch(
  '/support/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Support request id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = patchAdminSupportTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await patchAdminSupportTicket(req.session!.userId, id, parsed.data, req);
    res.json({ data });
  }),
);

adminRouter.get(
  '/payouts',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminPayouts();
    res.json({ data });
  }),
);

adminRouter.post(
  '/payouts/:paymentId/mark-paid',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const paymentId = req.params.paymentId;
    if (!paymentId) {
      res.status(400).json({ error: 'Payment id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = markAdminPayoutPaidSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await markAdminPayoutPaid(
      req.session!.userId,
      paymentId,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.get(
  '/audit-logs',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const data = await listAdminAuditLogs(limit);
    res.json({ data });
  }),
);

adminRouter.get(
  '/sponsorship-packages',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminSponsoredPackages();
    res.json({ data });
  }),
);

adminRouter.post(
  '/sponsorship-packages',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createSponsoredPackageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid package payload', formatZodErrors(parsed.error));
    }
    const data = await createAdminSponsoredPackage(req.session!.userId, parsed.data, req);
    res.status(201).json({ data });
  }),
);

adminRouter.patch(
  '/sponsorship-packages/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = updateSponsoredPackageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid package payload', formatZodErrors(parsed.error));
    }
    const data = await updateAdminSponsoredPackage(req.session!.userId, req.params.id!, parsed.data, req);
    res.json({ data });
  }),
);

adminRouter.post(
  '/sponsorship-packages/:id/activate',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await setAdminSponsoredPackageStatus(
      req.session!.userId,
      req.params.id!,
      CatalogPackageStatus.active,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.post(
  '/sponsorship-packages/:id/deactivate',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await setAdminSponsoredPackageStatus(
      req.session!.userId,
      req.params.id!,
      CatalogPackageStatus.inactive,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.get(
  '/sponsorship-orders',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status =
      statusRaw && (Object.values(SponsoredOrderStatus) as string[]).includes(statusRaw)
        ? (statusRaw as SponsoredOrderStatus)
        : undefined;
    const data = await listAdminSponsoredOrders(status);
    res.json({ data });
  }),
);

adminRouter.post(
  '/sponsorship-orders/:id/approve',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = sponsoredOrderAdminNoteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid payload', formatZodErrors(parsed.error));
    }
    const data = await approveSponsoredOrder(req.session!.userId, req.params.id!, parsed.data.adminNote, req);
    res.json({ data });
  }),
);

adminRouter.post(
  '/sponsorship-orders/:id/reject',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = sponsoredOrderAdminNoteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid payload', formatZodErrors(parsed.error));
    }
    const data = await rejectSponsoredOrder(req.session!.userId, req.params.id!, parsed.data.adminNote, req);
    res.json({ data });
  }),
);

adminRouter.post(
  '/sponsorship-orders/:id/confirm-payment',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = confirmSponsoredPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid payment confirmation', formatZodErrors(parsed.error));
    }
    const data = await confirmSponsoredPayment(req.session!.userId, req.params.id!, parsed.data, req);
    res.json({ data });
  }),
);

adminRouter.post(
  '/sponsorship-orders/:id/activate',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await activateSponsoredOrder(req.session!.userId, req.params.id!, req);
    res.json({ data });
  }),
);
