import { Router } from 'express';
import {
  createLegalDraftReleaseSchema,
  patchLegalReleaseGovernanceSchema,
  publishLegalReleaseSchema,
  scheduleLegalReleaseSchema,
  updateDataSubjectRequestStatusSchema,
  updateLegalDraftReleaseSchema,
  createPersonalDataBreachIncidentSchema,
  updatePersonalDataBreachIncidentSchema,
  correctBreachDiscoverySchema,
  prepareBreachCustomerNoticeSchema,
  approveBreachCustomerNoticeSchema,
  recordBreachCustomerNoticeSentSchema,
  approveBreachAuthorityPackSchema,
  recordBreachAuthoritySubmissionSchema,
} from '@mazare3/shared';
import { asyncHandler } from '../middleware/error-handler.js';
import { requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { AppError, formatZodErrors } from '../lib/errors.js';
import {
  createDraftRelease,
  updateDraft,
  publishRelease,
  scheduleRelease,
  listReleases,
  listVersions,
  getReleaseById,
  bootstrapPlaceholderReleases,
  updateReleaseGovernance,
} from '../services/legal/legal-document.service.js';
import { getAcceptanceByIdAdmin } from '../services/legal/legal-acceptance.service.js';
import {
  listDataSubjectRequestsAdmin,
  updateDataSubjectRequestStatus,
} from '../services/legal/data-subject-request.service.js';
import {
  createPersonalDataBreachIncident,
  listPersonalDataBreachIncidents,
  getPersonalDataBreachIncident,
  updatePersonalDataBreachIncident,
  correctBreachDiscoveryTime,
  prepareBreachCustomerNotice,
  approveBreachCustomerNotice,
  recordBreachCustomerNoticeSent,
  prepareBreachAuthorityPack,
  approveBreachAuthorityPack,
  recordBreachAuthoritySubmission,
  reopenPersonalDataBreachIncident,
  addRecipientNotice,
  updateRecipientNoticeState,
  listDeadlineHistory,
} from '../services/legal/personal-data-breach.service.js';
import {
  loadPrivacyBreachAuthContext,
  requirePrivacyBreachCapability,
} from '../middleware/require-privacy-breach-capability.js';
import { hasPrivacyBreachCapability } from '@mazare3/shared';
import {
  reopenPersonalDataBreachIncidentSchema,
  addBreachRecipientNoticeSchema,
  updateBreachRecipientNoticeSchema,
} from '@mazare3/shared';
import { getLegalActivationReadiness } from '../services/legal/legal-activation-readiness.service.js';
import { LegalDocumentType } from '@mazare3/db';
import { LEGAL_REVIEW_BANNER } from '@mazare3/shared';
import {
  assertBootstrapPlaceholdersAllowed,
} from '../services/legal/legal-production-guard.js';
import { getAdminLegalSnapshotSummary } from '../services/legal/booking-legal-snapshot.service.js';

export const adminLegalRouter = Router();

adminLegalRouter.use(...requireAdmin);

adminLegalRouter.get(
  '/releases',
  asyncHandler(async (req, res) => {
    const documentType =
      typeof req.query.documentType === 'string' ? req.query.documentType : undefined;
    const data = await listReleases(documentType);
    res.json({ data });
  }),
);

adminLegalRouter.get(
  '/releases/:id',
  asyncHandler(async (req, res) => {
    const data = await getReleaseById(req.params.id!);
    if (!data) throw new AppError(404, 'NOT_FOUND', 'Legal release not found');
    res.json({ data });
  }),
);

adminLegalRouter.get(
  '/versions',
  asyncHandler(async (req, res) => {
    const data = await listVersions({
      documentType:
        typeof req.query.documentType === 'string' ? req.query.documentType : undefined,
      language: typeof req.query.language === 'string' ? req.query.language : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    res.json({ data });
  }),
);

/** Admin booking legal snapshot — includes content hashes + acceptance records. */
adminLegalRouter.get(
  '/bookings/:id/snapshot',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new AppError(400, 'VALIDATION_ERROR', 'Booking id is required');
    const data = await getAdminLegalSnapshotSummary(id);
    if (!data) throw new AppError(404, 'NOT_FOUND', 'No legal snapshot for this booking');
    res.json({ data });
  }),
);

adminLegalRouter.post(
  '/releases',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createLegalDraftReleaseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await createDraftRelease(parsed.data, req.session!.userId, req);
    res.status(201).json({ data });
  }),
);

adminLegalRouter.patch(
  '/releases/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = updateLegalDraftReleaseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await updateDraft(req.params.id!, parsed.data, req.session!.userId, req);
    res.json({ data });
  }),
);

adminLegalRouter.post(
  '/releases/publish',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = publishLegalReleaseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await publishRelease(
      parsed.data.releaseId,
      parsed.data.effectiveAt,
      req.session!.userId,
      req,
    );
    res.json({ data });
  }),
);

adminLegalRouter.post(
  '/releases/schedule',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = scheduleLegalReleaseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await scheduleRelease(
      parsed.data.releaseId,
      parsed.data.effectiveAt,
      req.session!.userId,
      req,
    );
    res.json({ data });
  }),
);

adminLegalRouter.get(
  '/acceptances/:id',
  asyncHandler(async (req, res) => {
    const data = await getAcceptanceByIdAdmin(req.params.id!);
    res.json({ data });
  }),
);

adminLegalRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const { prisma } = await import('@mazare3/db');
    const { getPriorConsentAdminReadiness } = await import(
      '../services/legal/data-processing-consent.service.js'
    );
    const [releases, acceptances, consents, dsr, priorConsent] = await Promise.all([
      prisma.legalRelease.groupBy({ by: ['status'], _count: true }),
      prisma.legalAcceptance.count(),
      prisma.privacyConsent.groupBy({ by: ['status'], _count: true }),
      prisma.dataSubjectRequest.groupBy({ by: ['status'], _count: true }),
      getPriorConsentAdminReadiness(),
    ]);
    res.json({
      data: {
        releasesByStatus: releases,
        acceptanceCount: acceptances,
        consentsByStatus: consents,
        dataSubjectRequestsByStatus: dsr,
        priorConsentReadiness: priorConsent,
        note: 'Never forge user_explicit_acceptance or Data Subject Prior Consent via admin UI',
      },
    });
  }),
);

/**
 * Phase 3C.2 — technical activation-readiness preview.
 * Never claims legal compliance. Does not activate Production.
 */
adminLegalRouter.get(
  '/activation-readiness',
  asyncHandler(async (_req, res) => {
    const data = await getLegalActivationReadiness();
    res.json({ data });
  }),
);

/**
 * Phase 3C.2 — patch counsel/founder governance (reason required, audited).
 * Production activation that requires approved statuses is deferred — do not activate here.
 */
adminLegalRouter.patch(
  '/releases/:id/governance',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = patchLegalReleaseGovernanceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await updateReleaseGovernance(
      req.params.id!,
      parsed.data,
      req.session!.userId,
      req,
    );
    res.json({ data });
  }),
);

adminLegalRouter.get(
  '/data-subject-requests',
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const overdueOnly =
      req.query.overdue === '1' ||
      req.query.overdue === 'true' ||
      req.query.overdueOnly === '1' ||
      req.query.overdueOnly === 'true';
    const data = await listDataSubjectRequestsAdmin({ status, overdueOnly });
    res.json({ data });
  }),
);

adminLegalRouter.patch(
  '/data-subject-requests/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = updateDataSubjectRequestStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await updateDataSubjectRequestStatus(
      req.params.id!,
      parsed.data,
      req.session!.userId,
      req,
    );
    res.json({ data });
  }),
);

/**
 * Phase 3C.4B.1.3 — Personal data breach readiness.
 * Ordinary admin is NOT enough — privacy_breach_* capability or superAdmin required.
 * Customer/Owner cannot pass requireAdmin on this router.
 */
adminLegalRouter.get(
  '/breach-incidents',
  requirePrivacyBreachCapability('privacy_breach_view'),
  asyncHandler(async (req, res) => {
    const data = await listPersonalDataBreachIncidents({
      workflowStatus:
        typeof req.query.workflowStatus === 'string' ? req.query.workflowStatus : undefined,
      incidentKind: typeof req.query.incidentKind === 'string' ? req.query.incidentKind : undefined,
    });
    res.json({ data });
  }),
);

adminLegalRouter.get(
  '/breach-incidents/:id',
  requirePrivacyBreachCapability('privacy_breach_view'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getPersonalDataBreachIncident(
      req.params.id!,
      req.session!.userId,
      req,
    );
    res.json({ data });
  }),
);

adminLegalRouter.get(
  '/breach-incidents/:id/deadline-history',
  requirePrivacyBreachCapability('privacy_breach_view'),
  asyncHandler(async (req, res) => {
    const data = await listDeadlineHistory(req.params.id!);
    res.json({ data });
  }),
);

adminLegalRouter.post(
  '/breach-incidents',
  requirePrivacyBreachCapability('privacy_breach_manage'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createPersonalDataBreachIncidentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await createPersonalDataBreachIncident(
      parsed.data,
      req.session!.userId,
      req,
    );
    res.status(201).json({ data });
  }),
);

adminLegalRouter.patch(
  '/breach-incidents/:id',
  requirePrivacyBreachCapability('privacy_breach_manage'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = updatePersonalDataBreachIncidentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await updatePersonalDataBreachIncident(
      req.params.id!,
      parsed.data,
      req.session!.userId,
      req,
    );
    res.json({ data });
  }),
);

adminLegalRouter.post(
  '/breach-incidents/:id/reopen',
  requirePrivacyBreachCapability('privacy_breach_manage'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = reopenPersonalDataBreachIncidentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await reopenPersonalDataBreachIncident(
      req.params.id!,
      parsed.data,
      req.session!.userId,
      req,
    );
    res.json({ data });
  }),
);

adminLegalRouter.post(
  '/breach-incidents/:id/correct-discovery',
  requirePrivacyBreachCapability('privacy_breach_manage'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = correctBreachDiscoverySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const ctx = await loadPrivacyBreachAuthContext(req.session!.userId);
    const canElevate = hasPrivacyBreachCapability(
      ctx.capabilities,
      'privacy_breach_discovery_correct_later',
      { superAdmin: ctx.superAdmin },
    );
    if (parsed.data.elevatedLaterCorrection && !canElevate) {
      throw new AppError(
        403,
        'NEED_ELEVATED_DISCOVERY_CORRECTION',
        'Later discovery correction requires privacy_breach_discovery_correct_later or superAdmin',
      );
    }
    const data = await correctBreachDiscoveryTime(
      req.params.id!,
      parsed.data,
      req.session!.userId,
      req,
      { elevated: canElevate },
    );
    res.json({ data });
  }),
);

adminLegalRouter.post(
  '/breach-incidents/:id/recipients',
  requirePrivacyBreachCapability('privacy_breach_manage'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = addBreachRecipientNoticeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await addRecipientNotice(
      req.params.id!,
      parsed.data,
      req.session!.userId,
      req,
    );
    res.status(201).json({ data });
  }),
);

adminLegalRouter.patch(
  '/breach-incidents/:id/recipients/:recipientId',
  requirePrivacyBreachCapability('privacy_breach_notification_approve'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = updateBreachRecipientNoticeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await updateRecipientNoticeState(
      req.params.id!,
      req.params.recipientId!,
      parsed.data,
      req.session!.userId,
      req,
    );
    res.json({ data });
  }),
);

adminLegalRouter.post(
  '/breach-incidents/:id/data-subject-notice/prepare',
  requirePrivacyBreachCapability('privacy_breach_manage'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = prepareBreachCustomerNoticeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await prepareBreachCustomerNotice(
      req.params.id!,
      parsed.data,
      req.session!.userId,
      req,
    );
    res.json({ data });
  }),
);

adminLegalRouter.post(
  '/breach-incidents/:id/customer-notice/prepare',
  requirePrivacyBreachCapability('privacy_breach_manage'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = prepareBreachCustomerNoticeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await prepareBreachCustomerNotice(
      req.params.id!,
      parsed.data,
      req.session!.userId,
      req,
    );
    res.json({ data });
  }),
);

adminLegalRouter.post(
  '/breach-incidents/:id/data-subject-notice/approve',
  requirePrivacyBreachCapability('privacy_breach_notification_approve'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = approveBreachCustomerNoticeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await approveBreachCustomerNotice(
      req.params.id!,
      parsed.data,
      req.session!.userId,
      req,
    );
    res.json({ data });
  }),
);

adminLegalRouter.post(
  '/breach-incidents/:id/customer-notice/approve',
  requirePrivacyBreachCapability('privacy_breach_notification_approve'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = approveBreachCustomerNoticeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await approveBreachCustomerNotice(
      req.params.id!,
      parsed.data,
      req.session!.userId,
      req,
    );
    res.json({ data });
  }),
);

adminLegalRouter.post(
  '/breach-incidents/:id/data-subject-notice/record-sent',
  requirePrivacyBreachCapability('privacy_breach_notification_approve'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = recordBreachCustomerNoticeSentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await recordBreachCustomerNoticeSent(
      req.params.id!,
      parsed.data,
      req.session!.userId,
      req,
    );
    res.json({ data });
  }),
);

adminLegalRouter.post(
  '/breach-incidents/:id/customer-notice/record-sent',
  requirePrivacyBreachCapability('privacy_breach_notification_approve'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = recordBreachCustomerNoticeSentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await recordBreachCustomerNoticeSent(
      req.params.id!,
      parsed.data,
      req.session!.userId,
      req,
    );
    res.json({ data });
  }),
);

adminLegalRouter.post(
  '/breach-incidents/:id/authority-pack/prepare',
  requirePrivacyBreachCapability('privacy_breach_manage'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await prepareBreachAuthorityPack(req.params.id!, req.session!.userId, req);
    res.json({ data });
  }),
);

adminLegalRouter.post(
  '/breach-incidents/:id/authority-pack/approve',
  requirePrivacyBreachCapability('privacy_breach_authority_record'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = approveBreachAuthorityPackSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await approveBreachAuthorityPack(
      req.params.id!,
      parsed.data,
      req.session!.userId,
      req,
    );
    res.json({ data });
  }),
);

adminLegalRouter.post(
  '/breach-incidents/:id/authority-pack/record-submission',
  requirePrivacyBreachCapability('privacy_breach_authority_record'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = recordBreachAuthoritySubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await recordBreachAuthoritySubmission(
      req.params.id!,
      parsed.data,
      req.session!.userId,
      req,
    );
    res.json({ data });
  }),
);

/**
 * Bootstrap ACTIVE placeholder releases from inline content.
 * Does NOT create any user acceptances.
 */
adminLegalRouter.post(
  '/bootstrap-placeholders',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    assertBootstrapPlaceholdersAllowed();

    const placeholder = (title: string, lang: 'ar' | 'en') =>
      `${LEGAL_REVIEW_BANNER}\n\n# ${title}\n\nPhase 3B architecture bootstrap placeholder (${lang}). Pending Phase 3C final legal rewrite. Source: apps/web/src/content/legal/*.ts static pages.`;

    const data = await bootstrapPlaceholderReleases(
      [
        {
          documentType: LegalDocumentType.terms_and_conditions,
          versions: [
            {
              language: 'en',
              title: 'Terms & Conditions',
              content: placeholder('Terms & Conditions', 'en'),
              sourceRef: 'apps/web/src/content/legal/terms.ts',
            },
            {
              language: 'ar',
              title: 'الشروط والأحكام',
              content: placeholder('الشروط والأحكام', 'ar'),
              sourceRef: 'apps/web/src/content/legal/terms.ts',
            },
          ],
        },
        {
          documentType: LegalDocumentType.privacy_policy,
          versions: [
            {
              language: 'en',
              title: 'Privacy Policy',
              content: placeholder('Privacy Policy', 'en'),
              sourceRef: 'apps/web/src/content/legal/privacy.ts',
            },
            {
              language: 'ar',
              title: 'سياسة الخصوصية',
              content: placeholder('سياسة الخصوصية', 'ar'),
              sourceRef: 'apps/web/src/content/legal/privacy.ts',
            },
          ],
        },
        {
          documentType: LegalDocumentType.cancellation_refund_policy,
          versions: [
            {
              language: 'en',
              title: 'Cancellation & Refund Policy',
              content: placeholder('Cancellation & Refund Policy', 'en'),
              sourceRef: 'apps/web/src/content/legal/cancellation.ts',
            },
            {
              language: 'ar',
              title: 'سياسة الإلغاء والاسترداد',
              content: placeholder('سياسة الإلغاء والاسترداد', 'ar'),
              sourceRef: 'apps/web/src/content/legal/cancellation.ts',
            },
          ],
        },
        {
          documentType: LegalDocumentType.booking_terms,
          versions: [
            {
              language: 'en',
              title: 'Booking & Payment Policy',
              content: placeholder('Booking & Payment Policy', 'en'),
              sourceRef: 'apps/web/src/content/legal/booking-payment.ts',
            },
            {
              language: 'ar',
              title: 'سياسة الحجز والدفع',
              content: placeholder('سياسة الحجز والدفع', 'ar'),
              sourceRef: 'apps/web/src/content/legal/booking-payment.ts',
            },
          ],
        },
        {
          documentType: LegalDocumentType.owner_agreement,
          versions: [
            {
              language: 'en',
              title: 'Owner / Partner Agreement',
              content: placeholder('Owner / Partner Agreement', 'en'),
              sourceRef: 'PartnerAgreement (existing) + Phase 3C rewrite',
            },
            {
              language: 'ar',
              title: 'اتفاقية الشريك',
              content: placeholder('اتفاقية الشريك', 'ar'),
              sourceRef: 'PartnerAgreement (existing) + Phase 3C rewrite',
            },
          ],
        },
      ],
      req.session!.userId,
    );
    res.status(201).json({
      data,
      note: 'No user acceptances were created. REQUIRES JORDANIAN LEGAL REVIEW.',
    });
  }),
);
