import {
  prisma,
  OwnerStatus,
  PartnerVerificationStatus,
  OwnerDocumentReviewStatus,
  OwnerPayoutReviewStatus,
  UserRole,
  BookingStatus,
  PropertyStatus,
  PartnerAgreementStatus,
  type PartnerEntityType,
  type UserStatus,
} from '@mazare3/db';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import {
  buildOnboardingView,
  computePartnerReadiness,
  computePartnerReadinessFromLoaded,
  type PartnerOnboardingView,
} from './partner-onboarding.service.js';
import {
  DEFAULT_PARTNER_REQUIREMENTS,
  type PartnerRequirementDef,
} from '../config/partner-requirements.config.js';
import {
  nextStatusOnAdminReviewStart,
  restoreTargetStatus,
} from '../lib/partner-verification-machine.js';
import {
  listOwnerCommercialTerms,
  mapTermsRow,
  resolveCommercialTerms,
  type CommissionSourceName,
} from './commercial-terms.service.js';
import {
  notifyOwnerApproved,
  notifyPartnerChangesRequested,
  notifyPartnerDocumentRejected,
  notifyPartnerEnteredReview,
  notifyPartnerRejected,
  notifyPartnerRestored,
  notifyPartnerSuspended,
} from './notification.service.js';
import { readPartnerDocumentFile } from './partner-documents/private-storage.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export type AdminPartnerListQuery = {
  verificationStatus?: string;
  entityType?: string;
  q?: string;
};

export type AdminPartnerListRow = {
  id: string;
  userId: string;
  displayName: string;
  businessName: string | null;
  email: string | null;
  status: OwnerStatus;
  verificationStatus: PartnerVerificationStatus;
  entityType: PartnerEntityType | null;
  legacyApproved: boolean;
  city: string | null;
  area: string | null;
  propertiesCount: number;
  bookingsCount: number;
  submittedAt: string | null;
  createdAt: string;
  readinessIncomplete: boolean;
  missingRequirementsCount: number;
  rejectionReason: string | null;
};

export type AdminPartnerDetail = PartnerOnboardingView & {
  email: string | null;
  userRole: UserRole;
  userStatus: UserStatus;
  payoutReviewStatus: OwnerPayoutReviewStatus | null;
  commercialTermsPreview: {
    source: CommissionSourceName;
    commissionPercent: number;
    commissionBps: number;
    termsId: string | null;
    payoutDelayHours: number;
  };
  publishedPropertiesCount: number;
  confirmedBookingsCount: number;
  suspensionImpact: {
    publishedProperties: number;
    openBookings: number;
  };
  audit: {
    id: string;
    action: string;
    createdAt: string;
    actorUserId: string | null;
    metadata: unknown;
  }[];
  commercialTermsList: ReturnType<typeof mapTermsRow>[];
};

export type ReviewPartnerDocumentParams = {
  ownerProfileId: string;
  documentId: string;
  actorUserId: string;
  input: { status: 'approved' | 'rejected'; reason?: string };
  req?: AuthenticatedRequest;
};

export type RequestPartnerChangesParams = {
  ownerProfileId: string;
  actorUserId: string;
  input: { reason: string; fieldKeys?: string[] };
  req?: AuthenticatedRequest;
};

export type ReviewPartnerPayoutParams = {
  ownerProfileId: string;
  actorUserId: string;
  input: { status: 'reviewed' | 'rejected'; reason?: string };
  req?: AuthenticatedRequest;
};

export type ApprovePartnerParams = {
  ownerProfileId: string;
  actorUserId: string;
  input: { usePlatformDefaultCommission?: boolean };
  req?: AuthenticatedRequest;
};

export type PartnerReasonParams = {
  ownerProfileId: string;
  actorUserId: string;
  reason: string;
  req?: AuthenticatedRequest;
};

export type RestorePartnerParams = {
  ownerProfileId: string;
  actorUserId: string;
  req?: AuthenticatedRequest;
};

export type StreamAdminPartnerDocumentParams = {
  documentId: string;
  ownerProfileId: string;
  actorUserId: string;
  req?: AuthenticatedRequest;
};

function ownerIsBookable(status: OwnerStatus): boolean {
  return status === OwnerStatus.approved;
}

export async function listAdminPartners(query: AdminPartnerListQuery): Promise<AdminPartnerListRow[]> {
  const [profiles, requirements, activeAgreement, propertyCounts] = await Promise.all([
    prisma.ownerProfile.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true } },
        verificationProfile: true,
        documents: true,
        payoutProfile: true,
        agreementAcceptances: true,
        changeRequests: { where: { resolved: false } },
        commercialTerms: true,
        _count: { select: { properties: true } },
      },
    }),
    prisma.partnerDocumentRequirement.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.partnerAgreement.findFirst({
      where: { status: PartnerAgreementStatus.active },
      orderBy: { effectiveAt: 'desc' },
    }),
    prisma.property.findMany({
      select: { ownerId: true, _count: { select: { bookings: true } } },
    }),
  ]);

  const bookingByOwner = new Map<string, number>();
  for (const p of propertyCounts) {
    bookingByOwner.set(p.ownerId, (bookingByOwner.get(p.ownerId) ?? 0) + p._count.bookings);
  }

  const reqDefs = (requirements.length
    ? requirements
    : DEFAULT_PARTNER_REQUIREMENTS) as PartnerRequirementDef[];

  const rows: AdminPartnerListRow[] = [];
  for (const p of profiles) {
    if (query.verificationStatus && p.verificationProfile?.verificationStatus !== query.verificationStatus) {
      continue;
    }
    if (query.entityType && p.verificationProfile?.entityType !== query.entityType) continue;
    if (query.q) {
      const q = query.q.toLowerCase();
      const hay = `${p.displayName} ${p.businessName ?? ''} ${p.user.email ?? ''}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    const readiness = p.verificationProfile
      ? await computePartnerReadinessFromLoaded({
          profile: { ...p, verificationProfile: p.verificationProfile },
          requirements: reqDefs,
          activeAgreementId: activeAgreement?.id ?? null,
        })
      : {
          canApprove: false,
          missingRequirements: ['profile'] as string[],
        };
    const verificationStatus = p.verificationProfile?.verificationStatus ?? PartnerVerificationStatus.draft;
    rows.push({
      id: p.id,
      userId: p.userId,
      displayName: p.displayName,
      businessName: p.businessName,
      email: p.user.email,
      status: p.status,
      verificationStatus,
      entityType: p.verificationProfile?.entityType ?? null,
      legacyApproved: verificationStatus === PartnerVerificationStatus.legacy_approved,
      city: p.city,
      area: p.area,
      propertiesCount: p._count.properties,
      bookingsCount: bookingByOwner.get(p.id) ?? 0,
      submittedAt: p.verificationProfile?.submittedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      readinessIncomplete: !readiness.canApprove && verificationStatus !== PartnerVerificationStatus.legacy_approved,
      missingRequirementsCount: readiness.missingRequirements.length,
      rejectionReason: p.rejectionReason,
    });
  }
  return rows;
}

async function markUnderReview(ownerProfileId: string, ownerUserId: string): Promise<void> {
  const v = await prisma.ownerVerificationProfile.findUnique({
    where: { ownerProfileId },
  });
  if (!v) return;
  const next = nextStatusOnAdminReviewStart(v.verificationStatus);
  if (next === v.verificationStatus) return;
  await prisma.ownerVerificationProfile.update({
    where: { ownerProfileId },
    data: { verificationStatus: next, reviewedAt: new Date() },
  });
  void notifyPartnerEnteredReview({ ownerUserId, ownerProfileId }).catch((err: unknown) =>
    console.error('[notifications] partner.under_review', err),
  );
}

export async function getAdminPartnerDetail(ownerProfileId: string): Promise<AdminPartnerDetail> {
  const profile = await prisma.ownerProfile.findUnique({
    where: { id: ownerProfileId },
    include: {
      user: { select: { email: true, role: true, status: true } },
      verificationProfile: true,
      payoutProfile: true,
    },
  });
  if (!profile) throw new AppError(404, 'NOT_FOUND', 'Partner not found');
  const onboarding = await buildOnboardingView(ownerProfileId);
  const preview = await resolveCommercialTerms({ ownerProfileId });
  const publishedPropertiesCount = await prisma.property.count({
    where: { ownerId: ownerProfileId, status: PropertyStatus.published },
  });
  const confirmedBookingsCount = await prisma.booking.count({
    where: {
      property: { ownerId: ownerProfileId },
      status: { in: [BookingStatus.confirmed, BookingStatus.pending_payment] },
    },
  });
  const openBookings = await prisma.booking.count({
    where: {
      property: { ownerId: ownerProfileId },
      status: { in: [BookingStatus.confirmed, BookingStatus.pending_payment] },
      cancelledAt: null,
    },
  });
  const auditRows = await prisma.auditLog.findMany({
    where: { entityId: ownerProfileId },
    orderBy: { createdAt: 'desc' },
    take: 80,
  });
  const terms = await listOwnerCommercialTerms(ownerProfileId);
  return {
    ...onboarding,
    email: profile.user.email,
    userRole: profile.user.role,
    userStatus: profile.user.status,
    payoutReviewStatus: profile.payoutProfile?.reviewStatus ?? null,
    commercialTermsPreview: {
      source: preview.source,
      commissionPercent: preview.commissionPercent,
      commissionBps: preview.commissionBps,
      termsId: preview.termsId,
      payoutDelayHours: preview.payoutDelayHours,
    },
    publishedPropertiesCount,
    confirmedBookingsCount,
    suspensionImpact: {
      publishedProperties: publishedPropertiesCount,
      openBookings,
    },
    audit: auditRows.map((a) => ({
      id: a.id,
      action: a.action,
      createdAt: a.createdAt.toISOString(),
      actorUserId: a.actorUserId,
      metadata: a.metadata ?? null,
    })),
    commercialTermsList: terms.map(mapTermsRow),
  };
}

export async function reviewPartnerDocument(params: ReviewPartnerDocumentParams): Promise<AdminPartnerDetail> {
  const profile = await prisma.ownerProfile.findUnique({
    where: { id: params.ownerProfileId },
    select: {
      userId: true,
      verificationProfile: { select: { verificationStatus: true } },
    },
  });
  if (!profile) throw new AppError(404, 'NOT_FOUND', 'Partner not found');
  const doc = await prisma.ownerDocument.findFirst({
    where: { id: params.documentId, ownerProfileId: params.ownerProfileId },
  });
  if (!doc) throw new AppError(404, 'NOT_FOUND', 'Document not found');
  const rejectReason = (params.input.reason ?? '').trim();
  if (params.input.status === 'rejected' && !rejectReason) {
    throw new AppError(400, 'REASON_REQUIRED', 'A reason is required to reject a document');
  }
  await markUnderReview(params.ownerProfileId, profile.userId);
  const nextStatus =
    params.input.status === 'approved'
      ? OwnerDocumentReviewStatus.approved
      : OwnerDocumentReviewStatus.rejected;
  await prisma.ownerDocument.update({
    where: { id: doc.id },
    data: {
      reviewStatus: nextStatus,
      rejectionReason: params.input.status === 'rejected' ? rejectReason : null,
      reviewedByUserId: params.actorUserId,
      reviewedAt: new Date(),
    },
  });
  if (params.input.status === 'rejected') {
    const isPayoutProof = doc.documentType === 'payout_proof';
    const approvedPartner =
      profile.verificationProfile?.verificationStatus === PartnerVerificationStatus.approved ||
      profile.verificationProfile?.verificationStatus === PartnerVerificationStatus.legacy_approved;
    // PF-5: payout proof corrections stay in financial review — do not demote Partner KYC.
    if (!(approvedPartner && isPayoutProof)) {
      await prisma.ownerVerificationProfile.update({
        where: { ownerProfileId: params.ownerProfileId },
        data: {
          changeRequestReason: rejectReason,
          verificationStatus: PartnerVerificationStatus.changes_requested,
          changeRequestAt: new Date(),
        },
      });
      await prisma.ownerOnboardingChangeRequest.create({
        data: {
          ownerProfileId: params.ownerProfileId,
          fieldKey: `document:${doc.documentType}`,
          reason: rejectReason,
          createdByUserId: params.actorUserId,
        },
      });
    }
    void notifyPartnerDocumentRejected({
      ownerUserId: profile.userId,
      ownerProfileId: params.ownerProfileId,
      reason: rejectReason,
    }).catch((err: unknown) => console.error('[notifications] partner.document_rejected', err));
  }
  await createAuditLog({
    actorUserId: params.actorUserId,
    action:
      params.input.status === 'approved' ? 'admin.partner_document_approved' : 'admin.partner_document_rejected',
    entityType: 'owner_document',
    entityId: doc.id,
    metadata: { ownerProfileId: params.ownerProfileId, documentType: doc.documentType },
    req: params.req,
  });
  return getAdminPartnerDetail(params.ownerProfileId);
}

export async function requestPartnerChanges(params: RequestPartnerChangesParams): Promise<AdminPartnerDetail> {
  const reason = params.input.reason.trim();
  if (reason.length < 8) {
    throw new AppError(400, 'REASON_REQUIRED', 'A reason is required to request changes');
  }
  const profile = await prisma.ownerProfile.findUnique({
    where: { id: params.ownerProfileId },
    include: { verificationProfile: true },
  });
  if (!profile?.verificationProfile) throw new AppError(404, 'NOT_FOUND', 'Partner not found');
  await prisma.$transaction(async (tx) => {
    await tx.ownerVerificationProfile.update({
      where: { ownerProfileId: params.ownerProfileId },
      data: {
        verificationStatus: PartnerVerificationStatus.changes_requested,
        changeRequestReason: reason,
        changeRequestAt: new Date(),
        reviewedAt: new Date(),
      },
    });
    const keys = params.input.fieldKeys?.length ? params.input.fieldKeys : ['application'];
    for (const fieldKey of keys) {
      await tx.ownerOnboardingChangeRequest.create({
        data: {
          ownerProfileId: params.ownerProfileId,
          fieldKey,
          reason,
          createdByUserId: params.actorUserId,
        },
      });
    }
  });
  await createAuditLog({
    actorUserId: params.actorUserId,
    action: 'admin.partner_changes_requested',
    entityType: 'owner_profile',
    entityId: params.ownerProfileId,
    metadata: { reason },
    req: params.req,
  });
  void notifyPartnerChangesRequested({
    ownerUserId: profile.userId,
    ownerProfileId: params.ownerProfileId,
    reason,
  }).catch((err: unknown) => console.error('[notifications] partner.changes_requested', err));
  return getAdminPartnerDetail(params.ownerProfileId);
}

export async function reviewPartnerPayout(params: ReviewPartnerPayoutParams): Promise<AdminPartnerDetail> {
  if (params.input.status === 'rejected' && !(params.input.reason ?? '').trim()) {
    throw new AppError(400, 'REASON_REQUIRED', 'A reason is required to reject payout details');
  }
  const payout = await prisma.ownerPayoutProfile.findUnique({
    where: { ownerProfileId: params.ownerProfileId },
  });
  if (!payout) throw new AppError(404, 'NOT_FOUND', 'Payout profile not found');
  await prisma.ownerPayoutProfile.update({
    where: { id: payout.id },
    data: {
      reviewStatus:
        params.input.status === 'reviewed'
          ? OwnerPayoutReviewStatus.reviewed
          : OwnerPayoutReviewStatus.rejected,
      reviewReason: params.input.reason?.trim() || null,
      reviewedByUserId: params.actorUserId,
      reviewedAt: new Date(),
    },
  });
  await createAuditLog({
    actorUserId: params.actorUserId,
    action: 'admin.partner_payout_reviewed',
    entityType: 'owner_payout_profile',
    entityId: payout.id,
    metadata: { ownerProfileId: params.ownerProfileId, status: params.input.status },
    req: params.req,
  });
  return getAdminPartnerDetail(params.ownerProfileId);
}

export async function approvePartner(params: ApprovePartnerParams): Promise<AdminPartnerDetail> {
  const profile = await prisma.ownerProfile.findUnique({
    where: { id: params.ownerProfileId },
    include: { verificationProfile: true, user: { select: { id: true, role: true } } },
  });
  if (!profile?.verificationProfile) throw new AppError(404, 'NOT_FOUND', 'Partner not found');
  if (params.input.usePlatformDefaultCommission) {
    await prisma.ownerVerificationProfile.update({
      where: { ownerProfileId: params.ownerProfileId },
      data: { usePlatformDefaultCommission: true },
    });
  }
  const readiness = await computePartnerReadiness(params.ownerProfileId);
  if (!readiness.canApprove) {
    throw new AppError(400, 'APPROVAL_GATES_FAILED', 'Partner is not ready for approval', {
      readiness,
    });
  }
  await prisma.$transaction(async (tx) => {
    await tx.ownerVerificationProfile.update({
      where: { ownerProfileId: params.ownerProfileId },
      data: {
        verificationStatus: PartnerVerificationStatus.approved,
        approvedAt: new Date(),
        approvedByUserId: params.actorUserId,
        rejectionReason: null,
        changeRequestReason: null,
      },
    });
    await tx.ownerProfile.update({
      where: { id: params.ownerProfileId },
      data: { status: OwnerStatus.approved, rejectionReason: null },
    });
    await tx.user.update({
      where: { id: profile.userId },
      data: { role: UserRole.owner },
    });
  });
  await createAuditLog({
    actorUserId: params.actorUserId,
    action: 'admin.owner_approved',
    entityType: 'owner_profile',
    entityId: params.ownerProfileId,
    req: params.req,
  });
  void notifyOwnerApproved({
    ownerUserId: profile.userId,
    ownerProfileId: params.ownerProfileId,
  }).catch((err: unknown) => console.error('[notifications] admin.owner_approved', err));
  return getAdminPartnerDetail(params.ownerProfileId);
}

export async function rejectPartner(params: PartnerReasonParams): Promise<AdminPartnerDetail> {
  const reason = reasonOrThrow(params.reason);
  const profile = await prisma.ownerProfile.findUnique({
    where: { id: params.ownerProfileId },
    include: { user: true },
  });
  if (!profile) throw new AppError(404, 'NOT_FOUND', 'Partner not found');
  await prisma.$transaction(async (tx) => {
    await tx.ownerVerificationProfile.update({
      where: { ownerProfileId: params.ownerProfileId },
      data: {
        verificationStatus: PartnerVerificationStatus.rejected,
        rejectedAt: new Date(),
        rejectedByUserId: params.actorUserId,
        rejectionReason: reason,
      },
    });
    await tx.ownerProfile.update({
      where: { id: params.ownerProfileId },
      data: { status: OwnerStatus.rejected, rejectionReason: reason },
    });
    if (profile.user.role === UserRole.owner) {
      await tx.user.update({
        where: { id: profile.userId },
        data: { role: UserRole.customer },
      });
    }
  });
  await createAuditLog({
    actorUserId: params.actorUserId,
    action: 'admin.owner_rejected',
    entityType: 'owner_profile',
    entityId: params.ownerProfileId,
    metadata: { reason },
    req: params.req,
  });
  void notifyPartnerRejected({
    ownerUserId: profile.userId,
    ownerProfileId: params.ownerProfileId,
    reason,
  }).catch((err: unknown) => console.error('[notifications] partner.rejected', err));
  return getAdminPartnerDetail(params.ownerProfileId);
}

export async function suspendPartner(params: PartnerReasonParams): Promise<AdminPartnerDetail> {
  const reason = reasonOrThrow(params.reason);
  const profile = await prisma.ownerProfile.findUnique({
    where: { id: params.ownerProfileId },
    include: { verificationProfile: true, user: true },
  });
  if (!profile?.verificationProfile) throw new AppError(404, 'NOT_FOUND', 'Partner not found');
  const currentVerification = profile.verificationProfile;
  if (!ownerIsBookable(profile.status) && profile.status !== OwnerStatus.approved) {
    if (profile.status === OwnerStatus.suspended) {
      throw new AppError(409, 'ALREADY_SUSPENDED', 'Partner is already suspended');
    }
  }
  await prisma.$transaction(async (tx) => {
    await tx.ownerVerificationProfile.update({
      where: { ownerProfileId: params.ownerProfileId },
      data: {
        previousVerificationStatus: currentVerification.verificationStatus,
        verificationStatus: PartnerVerificationStatus.suspended,
        suspendedAt: new Date(),
        suspendedByUserId: params.actorUserId,
        suspensionReason: reason,
      },
    });
    await tx.ownerProfile.update({
      where: { id: params.ownerProfileId },
      data: { status: OwnerStatus.suspended, rejectionReason: reason },
    });
  });
  await createAuditLog({
    actorUserId: params.actorUserId,
    action: 'admin.owner_suspended',
    entityType: 'owner_profile',
    entityId: params.ownerProfileId,
    metadata: { reason, propertiesUnchanged: true, bookingsUnchanged: true },
    req: params.req,
  });
  void notifyPartnerSuspended({
    ownerUserId: profile.userId,
    ownerProfileId: params.ownerProfileId,
    reason,
  }).catch((err: unknown) => console.error('[notifications] partner.suspended', err));
  return getAdminPartnerDetail(params.ownerProfileId);
}

export async function restorePartner(params: RestorePartnerParams): Promise<AdminPartnerDetail> {
  const profile = await prisma.ownerProfile.findUnique({
    where: { id: params.ownerProfileId },
    include: { verificationProfile: true },
  });
  if (!profile?.verificationProfile) throw new AppError(404, 'NOT_FOUND', 'Partner not found');
  if (profile.status !== OwnerStatus.suspended) {
    throw new AppError(409, 'NOT_SUSPENDED', 'Partner is not suspended');
  }
  const restoredStatus = restoreTargetStatus(profile.verificationProfile.previousVerificationStatus);
  await prisma.$transaction(async (tx) => {
    await tx.ownerVerificationProfile.update({
      where: { ownerProfileId: params.ownerProfileId },
      data: {
        verificationStatus: restoredStatus,
        restoredAt: new Date(),
        suspensionReason: null,
      },
    });
    await tx.ownerProfile.update({
      where: { id: params.ownerProfileId },
      data: { status: OwnerStatus.approved, rejectionReason: null },
    });
    await tx.user.update({
      where: { id: profile.userId },
      data: { role: UserRole.owner },
    });
  });
  await createAuditLog({
    actorUserId: params.actorUserId,
    action: 'admin.owner_restored',
    entityType: 'owner_profile',
    entityId: params.ownerProfileId,
    metadata: { verificationStatus: restoredStatus, didNotAutoPublish: true },
    req: params.req,
  });
  void notifyPartnerRestored({
    ownerUserId: profile.userId,
    ownerProfileId: params.ownerProfileId,
  }).catch((err: unknown) => console.error('[notifications] partner.restored', err));
  return getAdminPartnerDetail(params.ownerProfileId);
}

export async function streamAdminPartnerDocument(params: StreamAdminPartnerDocumentParams): Promise<{
  buffer: Buffer;
  mimeType: string;
  originalFileName: string;
}> {
  const doc = await prisma.ownerDocument.findFirst({
    where: { id: params.documentId, ownerProfileId: params.ownerProfileId },
  });
  if (!doc) throw new AppError(404, 'NOT_FOUND', 'Document not found');
  const buffer = await readPartnerDocumentFile(doc.storageKey);
  await createAuditLog({
    actorUserId: params.actorUserId,
    action: 'admin.partner_document_viewed',
    entityType: 'owner_document',
    entityId: doc.id,
    metadata: { ownerProfileId: params.ownerProfileId },
    req: params.req,
  });
  return { buffer, mimeType: doc.mimeType, originalFileName: doc.originalFileName };
}

function reasonOrThrow(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length < 8) {
    throw new AppError(400, 'REASON_REQUIRED', 'A reason is required');
  }
  return trimmed;
}
