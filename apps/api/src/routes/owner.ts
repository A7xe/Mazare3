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
  ownerCancelBookingSchema,
  reportCustomerNoShowSchema,
  verifyCheckInSchema,
  requestRescheduleSchema,
  respondRescheduleSchema,
} from '@mazare3/shared';
import {
  attachUser,
  requireAuth,
  requireApprovedOwnerChain,
  requireCustomerOnly,
  type AuthenticatedRequest,
} from '../middleware/auth.js';
import { requireTermsAcceptance } from '../middleware/require-terms-acceptance.js';
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
import { listOwnerFinancialAdjustmentsForOwner } from '../services/owner-reliability.service.js';
import { listOwnerReviews } from '../services/review.service.js';
import { acceptOwnerBooking, rejectOwnerBooking } from '../services/booking.service.js';
import {
  cancelConfirmedBookingByOwner,
  previewOwnerCancellation,
} from '../services/owner-cancellation.service.js';
import { reportCustomerNoShow } from '../services/no-show.service.js';
import { verifyCheckInByOwner, getCheckInStatusForOwner } from '../services/check-in.service.js';
import {
  requestOwnerReschedule,
  respondToRescheduleRequest,
  previewReschedulePricing,
} from '../services/reschedule.service.js';
import { getOwnerPerformance } from '../services/owner-performance.service.js';
import {
  getMyOwnerApplication,
  submitOwnerApplication,
} from '../services/owner-application.service.js';
import {
  acceptPartnerAgreement,
  getOwnerAccessibleDocument,
  getOwnerPayoutRequirements,
  getPartnerAgreement,
  getPartnerOnboarding,
  getPartnerRequirements,
  patchPartnerOnboardingProfile,
  putPartnerPayoutProfile,
  submitPartnerOnboarding,
  uploadPartnerDocument,
  deletePartnerDocument,
} from '../services/partner-onboarding.service.js';
import { getOwnerLegalCommercialSummary } from '../services/legal/commercial-terms-acceptance.service.js';
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
  listOperatorParties,
  upsertOperatorParty,
  patchAccountHolderRelation,
  getPropertyAuthorityPackage,
  patchPropertyAuthority,
  recordPropertyAuthorityAttestation,
  uploadPropertyAuthorityEvidence,
  getOwnerAccessibleAuthorityDocument,
} from '../services/property-authority.service.js';
import {
  upsertOperatorPartySchema,
  patchAccountHolderRelationSchema,
  patchPropertyAuthoritySchema,
  recordAuthorityAttestationSchema,
  AUTHORITY_DOCUMENT_TYPES,
  putPropertyActivitiesSchema,
} from '@mazare3/shared';
import type { PartnerDocumentType } from '@mazare3/db';
import {
  putPropertyActivities,
  getPropertyRegulatoryPackage,
  uploadRegulatoryEvidence,
  getOwnerAccessibleRegulatoryEvidence,
} from '../services/property-regulatory.service.js';
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
  requireTermsAcceptance,
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

ownerRouter.get(
  '/payout-requirements',
  ...ownerOnboardingAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getOwnerPayoutRequirements(req.session!.userId);
    res.json({ data });
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

ownerRouter.get(
  '/legal-commercial-summary',
  ...ownerOnboardingAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const view = await getPartnerOnboarding(req.session!.userId);
    if (!view.ownerProfileId) {
      res.json({
        data: {
          ownerAgreement: null,
          commission: {
            arrangement: 'standard_18' as const,
            source: 'platform_default' as const,
            commissionPercent: 18,
            termsId: null,
            version: null,
            effectiveFrom: null,
            effectiveTo: null,
            status: null,
          },
          customTermsAcceptanceMissing: false,
          latestCustomAcceptance: null,
        },
      });
      return;
    }
    const data = await getOwnerLegalCommercialSummary(view.ownerProfileId);
    res.json({ data });
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

/** Phase 3C.4D.3 — operator parties (contracting / declared owner) */
ownerRouter.get(
  '/operator-parties',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listOperatorParties(req.session!.userId, req.session!.role);
    res.json({ data });
  }),
);

ownerRouter.post(
  '/operator-parties',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = upsertOperatorPartySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await upsertOperatorParty(
      req.session!.userId,
      req.session!.role,
      parsed.data,
      req,
    );
    res.status(201).json({ data });
  }),
);

ownerRouter.patch(
  '/onboarding/account-holder-relation',
  ...ownerOnboardingAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = patchAccountHolderRelationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await patchAccountHolderRelation(
      req.session!.userId,
      req.session!.role,
      parsed.data.accountHolderRelation,
      req,
    );
    res.json({ data });
  }),
);

ownerRouter.get(
  '/properties/:id/authority',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Property id is required');
    }
    const data = await getPropertyAuthorityPackage(
      req.session!.userId,
      req.session!.role,
      id,
    );
    res.json({ data });
  }),
);

ownerRouter.patch(
  '/properties/:id/authority',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Property id is required');
    }
    const parsed = patchPropertyAuthoritySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await patchPropertyAuthority(
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
  '/properties/:id/authority/attest',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Property id is required');
    }
    const parsed = recordAuthorityAttestationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await recordPropertyAuthorityAttestation(
      req.session!.userId,
      req.session!.role,
      id,
      parsed.data.sourceSurface,
      req,
    );
    res.json({ data });
  }),
);

ownerRouter.post(
  '/properties/:id/authority/documents',
  partnerDocumentUpload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Property id is required');
    }
    const file = req.file;
    if (!file) {
      throw new AppError(400, 'VALIDATION_ERROR', 'File is required');
    }
    const documentType = typeof req.body?.documentType === 'string' ? req.body.documentType : '';
    if (!(AUTHORITY_DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid authority document type');
    }
    const data = await uploadPropertyAuthorityEvidence({
      userId: req.session!.userId,
      role: req.session!.role,
      propertyId: id,
      documentType: documentType as PartnerDocumentType,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      buffer: file.buffer,
      req,
    });
    res.status(201).json({ data });
  }),
);

ownerRouter.get(
  '/properties/:id/authority/documents/:docId/file',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const docId = req.params.docId;
    if (!docId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Document id is required');
    }
    const { doc, buffer } = await getOwnerAccessibleAuthorityDocument(
      req.session!.userId,
      req.session!.role,
      docId,
    );
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(doc.originalFileName)}"`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }),
);

/** Phase 3C.4D.4A — Property activity + regulatory package */
ownerRouter.get(
  '/properties/:id/regulatory',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) throw new AppError(400, 'VALIDATION_ERROR', 'Property id is required');
    const data = await getPropertyRegulatoryPackage(
      req.session!.userId,
      req.session!.role,
      id,
    );
    res.json({ data });
  }),
);

ownerRouter.put(
  '/properties/:id/activities',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) throw new AppError(400, 'VALIDATION_ERROR', 'Property id is required');
    const parsed = putPropertyActivitiesSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await putPropertyActivities(
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
  '/properties/:id/regulatory/requirements/:requirementId/evidence',
  partnerDocumentUpload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    const requirementId = req.params.requirementId;
    if (!id || !requirementId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Property and requirement ids are required');
    }
    const file = req.file;
    if (!file) throw new AppError(400, 'VALIDATION_ERROR', 'File is required');
    const data = await uploadRegulatoryEvidence({
      userId: req.session!.userId,
      role: req.session!.role,
      propertyId: id,
      requirementId,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      buffer: file.buffer,
      label: typeof req.body?.label === 'string' ? req.body.label : undefined,
      documentNumber:
        typeof req.body?.documentNumber === 'string' ? req.body.documentNumber : undefined,
      issuerName: typeof req.body?.issuerName === 'string' ? req.body.issuerName : undefined,
      issueDate: typeof req.body?.issueDate === 'string' ? req.body.issueDate : undefined,
      expiresAt: typeof req.body?.expiresAt === 'string' ? req.body.expiresAt : undefined,
      req,
    });
    res.status(201).json({ data });
  }),
);

ownerRouter.get(
  '/properties/:id/regulatory/evidence/:evidenceId/file',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const evidenceId = req.params.evidenceId;
    if (!evidenceId) throw new AppError(400, 'VALIDATION_ERROR', 'Evidence id is required');
    const { evidence, buffer } = await getOwnerAccessibleRegulatoryEvidence(
      req.session!.userId,
      req.session!.role,
      evidenceId,
    );
    res.setHeader('Content-Type', evidence.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(evidence.originalFileName)}"`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }),
);

/** Phase 3C.4D.5 — Pool safety profile + attestation */
ownerRouter.get(
  '/properties/:id/pool-safety',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) throw new AppError(400, 'VALIDATION_ERROR', 'Property id is required');
    const { getPoolSafetyPackage, listSafetyDisclosures } = await import(
      '../services/property-pool-safety.service.js'
    );
    const data = await getPoolSafetyPackage(req.session!.userId, req.session!.role, id);
    const disclosures = await listSafetyDisclosures(id);
    res.json({ data: { ...data, safetyDisclosures: disclosures } });
  }),
);

ownerRouter.put(
  '/properties/:id/pool-safety',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) throw new AppError(400, 'VALIDATION_ERROR', 'Property id is required');
    const { putPoolSafetyProfileSchema } = await import('@mazare3/shared');
    const parsed = putPoolSafetyProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const { putPoolSafetyProfile } = await import('../services/property-pool-safety.service.js');
    const data = await putPoolSafetyProfile(
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
  '/properties/:id/pool-safety/attest',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) throw new AppError(400, 'VALIDATION_ERROR', 'Property id is required');
    const { recordPoolSafetyAttestationSchema } = await import('@mazare3/shared');
    const parsed = recordPoolSafetyAttestationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const { recordPoolSafetyAttestation } = await import(
      '../services/property-pool-safety.service.js'
    );
    const data = await recordPoolSafetyAttestation(
      req.session!.userId,
      req.session!.role,
      id,
      parsed.data.sourceSurface,
      req,
    );
    res.json({ data });
  }),
);

ownerRouter.post(
  '/properties/:id/safety-disclosures',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) throw new AppError(400, 'VALIDATION_ERROR', 'Property id is required');
    const { putSafetyDisclosureSchema } = await import('@mazare3/shared');
    const parsed = putSafetyDisclosureSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const { upsertSafetyDisclosure } = await import('../services/property-pool-safety.service.js');
    const data = await upsertSafetyDisclosure(
      req.session!.userId,
      req.session!.role,
      id,
      parsed.data,
      undefined,
      req,
    );
    res.status(201).json({ data });
  }),
);

ownerRouter.get(
  '/bookings',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listOwnerBookings(req.session!.userId, req.session!.role);
    res.json({ data });
  }),
);

/** Phase 3C.4D.6 — Owner view of Booking-time listing snapshot (what they accepted). */
ownerRouter.get(
  '/bookings/:id/listing-snapshot',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Booking id is required');
    }
    const { getOwnerBookingListingSnapshot } = await import(
      '../services/booking-listing-snapshot.service.js'
    );
    const data = await getOwnerBookingListingSnapshot(
      req.session!.userId,
      req.session!.role,
      id,
    );
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

ownerRouter.get(
  '/bookings/:id/cancel-preview',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    const reasonCode = String(req.query.reasonCode ?? 'OTHER');
    const preview = await previewOwnerCancellation(
      req.session!.userId,
      req.session!.role,
      id!,
      reasonCode as import('@mazare3/shared').OwnerCancellationReasonCode,
    );
    res.json({ data: preview });
  }),
);

ownerRouter.post(
  '/bookings/:id/cancel',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) throw new AppError(400, 'VALIDATION_ERROR', 'Booking id required');
    const parsed = ownerCancelBookingSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await cancelConfirmedBookingByOwner({
      ownerUserId: req.session!.userId,
      role: req.session!.role,
      bookingId: id,
      reasonCode: parsed.data.reasonCode,
      note: parsed.data.note,
      req,
    });
    res.json({ data });
  }),
);

ownerRouter.post(
  '/bookings/:id/report-no-show',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) throw new AppError(400, 'VALIDATION_ERROR', 'Booking id required');
    const parsed = reportCustomerNoShowSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await reportCustomerNoShow({
      ownerUserId: req.session!.userId,
      role: req.session!.role,
      bookingId: id,
      evidence: parsed.data.evidence,
      req,
    });
    res.json({ data });
  }),
);

ownerRouter.get(
  '/bookings/:id/check-in',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getCheckInStatusForOwner(
      req.session!.userId,
      req.session!.role,
      req.params.id!,
    );
    res.json({ data });
  }),
);

ownerRouter.post(
  '/bookings/:id/verify-check-in',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = verifyCheckInSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await verifyCheckInByOwner({
      ownerUserId: req.session!.userId,
      role: req.session!.role,
      bookingId: req.params.id!,
      pin: parsed.data.pin,
      req,
    });
    res.json({ data });
  }),
);

ownerRouter.get(
  '/bookings/:id/reschedule-preview',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const toSlotId = String(req.query.toSlotId ?? '').trim();
    if (!toSlotId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'toSlotId is required');
    }
    const data = await previewReschedulePricing(req.params.id!, toSlotId, 'owner');
    res.json({ data });
  }),
);

ownerRouter.post(
  '/bookings/:id/reschedule',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = requestRescheduleSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await requestOwnerReschedule({
      ownerUserId: req.session!.userId,
      role: req.session!.role,
      bookingId: req.params.id!,
      toSlotId: parsed.data.toSlotId,
      req,
    });
    res.json({ data });
  }),
);

ownerRouter.post(
  '/reschedule-requests/:id/respond',
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
  '/financial-adjustments',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listOwnerFinancialAdjustmentsForOwner(
      req.session!.userId,
      req.session!.role,
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
