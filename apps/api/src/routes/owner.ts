import { Router } from 'express';
import {
  createOwnerPropertySchema,
  createOwnerPropertyDraftSchema,
  ownerApplySchema,
  ownerAvailabilityQuerySchema,
  patchOwnerAvailabilitySchema,
  ownerRejectBookingSchema,
  updateOwnerPropertySchema,
  patchOwnerBookingModeSchema,
  addPropertyMediaUrlSchema,
  patchPropertyMediaSchema,
  reorderPropertyMediaSchema,
  putOwnerAvailabilityRulesSchema,
  generateAvailabilitySchema,
  applyRuleToFutureSchema,
  createPropertyPromotionSchema,
  updatePropertyPromotionSchema,
  createPropertyCouponSchema,
  createSponsoredOrderSchema,
} from '@mazare3/shared';
import {
  attachUser,
  requireAuth,
  requireApprovedOwnerChain,
  requireCustomerOnly,
  type AuthenticatedRequest,
} from '../middleware/auth.js';
import { AppError, formatZodErrors } from '../lib/errors.js';
import { asyncHandler } from '../middleware/error-handler.js';
import {
  getOwnerSummary,
  getOwnerPropertyById,
  listOwnerAvailability,
  listOwnerBookings,
  listOwnerProperties,
  patchOwnerAvailabilitySlot,
  listOwnerAvailabilityRules,
  putOwnerAvailabilityRules,
  deleteOwnerAvailabilityRule,
  previewOwnerAvailabilityGeneration,
  generateOwnerAvailability,
  previewOwnerApplyRuleToFuture,
  applyOwnerRuleToFuture,
  getOwnerAvailabilityHealth,
} from '../services/owner.service.js';
import { listOwnerPayouts } from '../services/payout-operations.service.js';
import {
  getOwnerSettlementForOwner,
  listOwnerSettlementsForOwner,
} from '../services/owner-settlement.service.js';
import { listOwnerReviews } from '../services/review.service.js';
import { acceptOwnerBooking, rejectOwnerBooking } from '../services/booking.service.js';
import { getOwnerPerformance } from '../services/owner-performance.service.js';
import {
  getMyOwnerApplication,
  submitOwnerApplication,
} from '../services/owner-application.service.js';
import {
  acceptPartnerAgreement,
  getOwnerAccessibleDocument,
  getPartnerAgreement,
  getPartnerOnboarding,
  getPartnerRequirements,
  patchPartnerOnboardingProfile,
  putPartnerPayoutProfile,
  submitPartnerOnboarding,
  uploadPartnerDocument,
  deletePartnerDocument,
} from '../services/partner-onboarding.service.js';
import { readPartnerDocumentFile } from '../services/partner-documents/private-storage.js';
import { partnerDocumentUpload } from '../middleware/partner-document-upload.js';
import {
  acceptPartnerAgreementSchema,
  patchPartnerOnboardingProfileSchema,
  putPartnerPayoutProfileSchema,
} from '@mazare3/shared';
import {
  createOwnerProperty,
  createOwnerPropertyDraft,
  getOwnerPropertyForEdit,
  submitOwnerPropertyForReview,
  updateOwnerProperty,
} from '../services/owner-property.service.js';
import {
  createOwnerPromotion,
  listOwnerPromotions,
  updateOwnerPromotion,
  activateOwnerPromotion,
  pauseOwnerPromotion,
} from '../services/promotion.service.js';
import {
  activateOwnerCoupon,
  createOwnerCoupon,
  listOwnerCoupons,
  pauseOwnerCoupon,
} from '../services/coupon.service.js';
import { propertyMediaUpload } from '../middleware/property-media-upload.js';
import {
  addPropertyMediaFile,
  addPropertyMediaUrl,
  deletePropertyMedia,
  patchPropertyMedia,
  reorderPropertyMedia,
  setPropertyMediaCover,
} from '../services/property-media/property-media.service.js';
import {
  createOwnerSponsoredOrder,
  listActiveSponsoredPackages,
  listOwnerSponsoredOrders,
} from '../services/sponsorship.service.js';

export const ownerRouter = Router();

ownerRouter.post(
  '/apply',
  ...requireCustomerOnly,
  attachUser,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = ownerApplySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await submitOwnerApplication(
      req.session!.userId,
      req.session!.role,
      parsed.data,
      req,
    );
    res.status(201).json({ data });
  }),
);

ownerRouter.get(
  '/application/me',
  requireAuth,
  attachUser,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getMyOwnerApplication(req.session!.userId);
    res.json({ data });
  }),
);

const ownerOnboardingAuth = [requireAuth, attachUser] as const;

ownerRouter.get(
  '/onboarding',
  ...ownerOnboardingAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getPartnerOnboarding(req.session!.userId);
    res.json({ data });
  }),
);

async function patchOnboardingHandler(req: AuthenticatedRequest, res: import('express').Response) {
  const parsed = patchPartnerOnboardingProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
  }
  const data = await patchPartnerOnboardingProfile(req.session!.userId, parsed.data, req);
  res.json({ data });
}

ownerRouter.patch('/onboarding', ...ownerOnboardingAuth, asyncHandler(patchOnboardingHandler));
ownerRouter.patch('/onboarding/profile', ...ownerOnboardingAuth, asyncHandler(patchOnboardingHandler));

ownerRouter.get(
  '/onboarding/requirements',
  ...ownerOnboardingAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getPartnerRequirements(req.session!.userId);
    res.json({ data });
  }),
);

ownerRouter.post(
  '/onboarding/documents',
  ...ownerOnboardingAuth,
  partnerDocumentUpload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const file = req.file;
    if (!file) {
      throw new AppError(400, 'VALIDATION_ERROR', 'File is required');
    }
    const data = await uploadPartnerDocument({
      userId: req.session!.userId,
      buffer: file.buffer,
      declaredMime: file.mimetype,
      originalName: file.originalname,
      requirementId: typeof req.body?.requirementId === 'string' ? req.body.requirementId : undefined,
      documentType: typeof req.body?.documentType === 'string' ? req.body.documentType : undefined,
      req,
    });
    res.status(201).json({ data });
  }),
);

ownerRouter.delete(
  '/onboarding/documents/:id',
  ...ownerOnboardingAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await deletePartnerDocument(req.session!.userId, req.params.id!, req);
    res.json({ data: { ok: true } });
  }),
);

ownerRouter.get(
  '/onboarding/documents/:id/file',
  ...ownerOnboardingAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const doc = await getOwnerAccessibleDocument(req.session!.userId, req.params.id!);
    const buffer = await readPartnerDocumentFile(doc.storageKey);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalFileName)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }),
);

ownerRouter.post(
  '/onboarding/submit',
  ...ownerOnboardingAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await submitPartnerOnboarding(req.session!.userId, req);
    res.json({ data });
  }),
);

ownerRouter.get(
  '/payout-profile',
  ...ownerOnboardingAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const view = await getPartnerOnboarding(req.session!.userId);
    res.json({ data: view.payout });
  }),
);

ownerRouter.put(
  '/payout-profile',
  ...ownerOnboardingAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = putPartnerPayoutProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await putPartnerPayoutProfile(req.session!.userId, parsed.data, req);
    res.json({ data });
  }),
);

ownerRouter.get(
  '/partner-agreement',
  ...ownerOnboardingAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getPartnerAgreement(req.session!.userId);
    res.json({ data });
  }),
);

ownerRouter.post(
  '/partner-agreement/accept',
  ...ownerOnboardingAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = acceptPartnerAgreementSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await acceptPartnerAgreement(
      req.session!.userId,
      parsed.data.agreementId,
      parsed.data.acceptedLocale,
      req,
    );
    res.json({ data });
  }),
);

ownerRouter.get(
  '/commercial-terms',
  ...ownerOnboardingAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const view = await getPartnerOnboarding(req.session!.userId);
    res.json({ data: view.commercialTerms });
  }),
);

ownerRouter.use(...requireApprovedOwnerChain);

ownerRouter.get(
  '/summary',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getOwnerSummary(req.session!.userId, req.session!.role, req);
    res.json({ data });
  }),
);

ownerRouter.get(
  '/performance',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getOwnerPerformance(
      req.session!.userId,
      req.session!.role,
      req.query.range,
    );
    res.json({ data });
  }),
);

ownerRouter.get(
  '/properties',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listOwnerProperties(req.session!.userId, req.session!.role);
    res.json({ data });
  }),
);

ownerRouter.post(
  '/properties',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createOwnerPropertySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await createOwnerProperty(
      req.session!.userId,
      req.session!.role,
      parsed.data,
      req,
    );
    res.status(201).json({ data });
  }),
);

/** AF-1.1c — Add Farm Step-1 incomplete draft (location/price may be null). */
ownerRouter.post(
  '/properties/draft',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createOwnerPropertyDraftSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await createOwnerPropertyDraft(
      req.session!.userId,
      req.session!.role,
      parsed.data,
      req,
    );
    res.status(201).json({ data });
  }),
);

ownerRouter.get(
  '/properties/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await getOwnerPropertyById(req.session!.userId, req.session!.role, id);
    if (!data) {
      res.status(404).json({ error: 'Property not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ data });
  }),
);

ownerRouter.get(
  '/properties/:id/promotions',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await listOwnerPromotions(req.session!.userId, req.session!.role, id);
    res.json({ data });
  }),
);

ownerRouter.post(
  '/properties/:id/promotions',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = createPropertyPromotionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await createOwnerPromotion(
      req.session!.userId,
      req.session!.role,
      id,
      parsed.data,
      req,
    );
    res.status(201).json({ data });
  }),
);

ownerRouter.patch(
  '/properties/:id/promotions/:promoId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    const promoId = req.params.promoId;
    if (!id || !promoId) {
      res.status(400).json({ error: 'Ids are required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = updatePropertyPromotionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await updateOwnerPromotion(
      req.session!.userId,
      req.session!.role,
      id,
      promoId,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

ownerRouter.post(
  '/properties/:id/promotions/:promoId/activate',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await activateOwnerPromotion(
      req.session!.userId,
      req.session!.role,
      req.params.id!,
      req.params.promoId!,
      req,
    );
    res.json({ data });
  }),
);

ownerRouter.post(
  '/properties/:id/promotions/:promoId/pause',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await pauseOwnerPromotion(
      req.session!.userId,
      req.session!.role,
      req.params.id!,
      req.params.promoId!,
      req,
    );
    res.json({ data });
  }),
);

ownerRouter.get(
  '/properties/:id/coupons',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await listOwnerCoupons(req.session!.userId, req.session!.role, id);
    res.json({ data });
  }),
);

ownerRouter.post(
  '/properties/:id/coupons',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = createPropertyCouponSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await createOwnerCoupon(
      req.session!.userId,
      req.session!.role,
      id,
      parsed.data,
      req,
    );
    res.status(201).json({ data });
  }),
);

ownerRouter.post(
  '/properties/:id/coupons/:couponId/activate',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await activateOwnerCoupon(
      req.session!.userId,
      req.session!.role,
      req.params.id!,
      req.params.couponId!,
      req,
    );
    res.json({ data });
  }),
);

ownerRouter.post(
  '/properties/:id/coupons/:couponId/pause',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await pauseOwnerCoupon(
      req.session!.userId,
      req.session!.role,
      req.params.id!,
      req.params.couponId!,
      req,
    );
    res.json({ data });
  }),
);

ownerRouter.get(
  '/properties/:id/edit',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await getOwnerPropertyForEdit(req.session!.userId, req.session!.role, id);
    if (!data) {
      res.status(404).json({ error: 'Property not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ data });
  }),
);

ownerRouter.patch(
  '/properties/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const raw = req.body && typeof req.body === 'object' ? req.body : {};
    const rawKeys = Object.keys(raw);
    const parsed =
      rawKeys.length === 1 && rawKeys[0] === 'instantBookingEnabled'
        ? patchOwnerBookingModeSchema.safeParse(raw)
        : updateOwnerPropertySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await updateOwnerProperty(
      req.session!.userId,
      req.session!.role,
      id,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

ownerRouter.post(
  '/properties/:id/submit-review',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await submitOwnerPropertyForReview(
      req.session!.userId,
      req.session!.role,
      id,
      req,
    );
    res.json({ data });
  }),
);

ownerRouter.get(
  '/bookings',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listOwnerBookings(req.session!.userId, req.session!.role);
    res.json({ data });
  }),
);

ownerRouter.post(
  '/bookings/:id/accept',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Booking id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await acceptOwnerBooking(req.session!.userId, req.session!.role, id, req);
    res.json({ data });
  }),
);

ownerRouter.post(
  '/bookings/:id/reject',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Booking id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = ownerRejectBookingSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await rejectOwnerBooking(
      req.session!.userId,
      req.session!.role,
      id,
      parsed.data.reason,
      req,
    );
    res.json({ data });
  }),
);

ownerRouter.get(
  '/payouts',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listOwnerPayouts(req.session!.userId, req.session!.role);
    res.json({ data });
  }),
);

ownerRouter.get(
  '/settlements',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listOwnerSettlementsForOwner(req.session!.userId, req.session!.role);
    res.json({ data });
  }),
);

ownerRouter.get(
  '/settlements/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getOwnerSettlementForOwner(
      req.session!.userId,
      req.session!.role,
      req.params.id!,
    );
    res.json({ data });
  }),
);

ownerRouter.get(
  '/reviews',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listOwnerReviews(req.session!.userId, req.session!.role);
    res.json({ data });
  }),
);

ownerRouter.post(
  '/reviews/:id/hide',
  asyncHandler(async () => {
    throw new AppError(403, 'FORBIDDEN', 'Owners cannot hide or edit customer reviews');
  }),
);

ownerRouter.post(
  '/reviews/:id/restore',
  asyncHandler(async () => {
    throw new AppError(403, 'FORBIDDEN', 'Owners cannot restore or edit customer reviews');
  }),
);

ownerRouter.get(
  '/availability',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = ownerAvailabilityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid query', formatZodErrors(parsed.error));
    }
    const data = await listOwnerAvailability(
      req.session!.userId,
      req.session!.role,
      parsed.data,
    );
    res.json({ data });
  }),
);

ownerRouter.get(
  '/properties/:id/availability-rules',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await listOwnerAvailabilityRules(req.session!.userId, req.session!.role, id);
    res.json({ data });
  }),
);

ownerRouter.put(
  '/properties/:id/availability-rules',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = putOwnerAvailabilityRulesSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await putOwnerAvailabilityRules(
      req.session!.userId,
      req.session!.role,
      id,
      parsed.data.rules,
      req,
    );
    res.json({ data });
  }),
);

ownerRouter.delete(
  '/properties/:id/availability-rules/:ruleId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    const ruleId = req.params.ruleId;
    if (!id || !ruleId) {
      res.status(400).json({ error: 'Property id and rule id are required', code: 'VALIDATION_ERROR' });
      return;
    }
    await deleteOwnerAvailabilityRule(req.session!.userId, req.session!.role, id, ruleId);
    res.json({ data: { ok: true } });
  }),
);

ownerRouter.post(
  '/properties/:id/availability-rules/:ruleId/apply-future-preview',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    const ruleId = req.params.ruleId;
    if (!id || !ruleId) {
      res.status(400).json({ error: 'Property id and rule id are required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await previewOwnerApplyRuleToFuture(
      req.session!.userId,
      req.session!.role,
      id,
      ruleId,
    );
    res.json({ data });
  }),
);

ownerRouter.post(
  '/properties/:id/availability-rules/:ruleId/apply-future',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    const ruleId = req.params.ruleId;
    if (!id || !ruleId) {
      res.status(400).json({ error: 'Property id and rule id are required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = applyRuleToFutureSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await applyOwnerRuleToFuture(
      req.session!.userId,
      req.session!.role,
      id,
      ruleId,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

ownerRouter.get(
  '/properties/:id/availability-health',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await getOwnerAvailabilityHealth(req.session!.userId, req.session!.role, id);
    res.json({ data });
  }),
);

ownerRouter.post(
  '/properties/:id/availability/generate-preview',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = generateAvailabilitySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await previewOwnerAvailabilityGeneration(
      req.session!.userId,
      req.session!.role,
      id,
      parsed.data,
    );
    res.json({ data });
  }),
);

ownerRouter.post(
  '/properties/:id/availability/generate',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = generateAvailabilitySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await generateOwnerAvailability(
      req.session!.userId,
      req.session!.role,
      id,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

ownerRouter.patch(
  '/availability/:slotId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const slotId = req.params.slotId;
    if (!slotId) {
      res.status(400).json({ error: 'Slot id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = patchOwnerAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await patchOwnerAvailabilitySlot(
      req.session!.userId,
      req.session!.role,
      slotId,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Property media management (Phase 8A — local uploads, no external storage yet)
// Routes:
//   POST   /owner/properties/:id/media
//   PATCH  /owner/properties/:id/media/:mediaId
//   DELETE /owner/properties/:id/media/:mediaId
//   POST   /owner/properties/:id/media/:mediaId/set-cover
//   PATCH  /owner/properties/:id/media/reorder
// ─────────────────────────────────────────────────────────────────────────────

ownerRouter.post(
  '/properties/:id/media',
  propertyMediaUpload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const propertyId = req.params.id;
    if (!propertyId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Property id is required');
    }
    if (!req.session) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const actorUserId = req.session.userId;
    const role = req.session.role;

    const file = (req as any).file as unknown as { mimetype: string; size: number; originalname: string; buffer: Buffer } | undefined;
    const body = req.body ?? {};

    const altArRaw = typeof body.altAr === 'string' ? body.altAr : undefined;
    const altEnRaw = typeof body.altEn === 'string' ? body.altEn : undefined;

    const altAr = altArRaw?.trim() ? altArRaw.trim() : null;
    const altEn = altEnRaw?.trim() ? altEnRaw.trim() : null;

    const hasUrl = typeof body.url === 'string' && body.url.trim().length > 0;
    const hasFile = Boolean(file);

    if (hasFile === hasUrl) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Provide exactly one of: multipart file field "file" OR JSON body { url }',
      );
    }

    let data;
    if (hasFile && file) {
      data = await addPropertyMediaFile({
        actorUserId,
        role,
        propertyId,
        file: file as any,
        altAr,
        altEn,
        req,
      });
    } else {
      const parsed = addPropertyMediaUrlSchema.safeParse({ url: body.url, altAr, altEn });
      if (!parsed.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Invalid body',
          formatZodErrors(parsed.error),
        );
      }
      data = await addPropertyMediaUrl({
        actorUserId,
        role,
        propertyId,
        url: parsed.data.url,
        altAr: parsed.data.altAr ?? null,
        altEn: parsed.data.altEn ?? null,
        req,
      });
    }

    res.status(201).json({ data });
  }),
);

ownerRouter.patch(
  '/properties/:id/media/reorder',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const propertyId = req.params.id;
    if (!propertyId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Property id is required');
    }
    if (!req.session) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const parsed = reorderPropertyMediaSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid body',
        formatZodErrors(parsed.error),
      );
    }

    const data = await reorderPropertyMedia({
      actorUserId: req.session.userId,
      role: req.session.role,
      propertyId,
      mediaIds: parsed.data.mediaIds,
      req,
    });

    res.json({ data });
  }),
);

ownerRouter.patch(
  '/properties/:id/media/:mediaId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const propertyId = req.params.id;
    const mediaId = req.params.mediaId;
    if (!propertyId || !mediaId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Property id and media id are required');
    }
    if (!req.session) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const parsed = patchPropertyMediaSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid body',
        formatZodErrors(parsed.error),
      );
    }

    const data = await patchPropertyMedia({
      actorUserId: req.session.userId,
      role: req.session.role,
      propertyId,
      mediaId,
      altAr: parsed.data.altAr ?? null,
      altEn: parsed.data.altEn ?? null,
      req,
    });

    res.json({ data });
  }),
);

ownerRouter.delete(
  '/properties/:id/media/:mediaId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const propertyId = req.params.id;
    const mediaId = req.params.mediaId;
    if (!propertyId || !mediaId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Property id and media id are required');
    }
    if (!req.session) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const data = await deletePropertyMedia({
      actorUserId: req.session.userId,
      role: req.session.role,
      propertyId,
      mediaId,
      req,
    });

    res.json({ data });
  }),
);

ownerRouter.post(
  '/properties/:id/media/:mediaId/set-cover',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const propertyId = req.params.id;
    const mediaId = req.params.mediaId;
    if (!propertyId || !mediaId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Property id and media id are required');
    }
    if (!req.session) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const data = await setPropertyMediaCover({
      actorUserId: req.session.userId,
      role: req.session.role,
      propertyId,
      mediaId,
      req,
    });

    res.json({ data });
  }),
);

ownerRouter.get(
  '/sponsorship-packages',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listActiveSponsoredPackages();
    res.json({ data });
  }),
);

ownerRouter.get(
  '/properties/:id/sponsorship-orders',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) throw new AppError(400, 'VALIDATION_ERROR', 'Property id is required');
    const data = await listOwnerSponsoredOrders(req.session!.userId, id);
    res.json({ data });
  }),
);

ownerRouter.post(
  '/properties/:id/sponsorship-orders',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) throw new AppError(400, 'VALIDATION_ERROR', 'Property id is required');
    const parsed = createSponsoredOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid sponsorship request', formatZodErrors(parsed.error));
    }
    const data = await createOwnerSponsoredOrder(req.session!.userId, id, parsed.data, req);
    res.status(201).json({ data });
  }),
);
