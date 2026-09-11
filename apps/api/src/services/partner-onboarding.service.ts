import {
  prisma,
  OwnerStatus,
  PartnerVerificationStatus,
  OwnerDocumentReviewStatus,
  OwnerPayoutReviewStatus,
  PartnerAgreementStatus,
  type OwnerDocument,
  type OwnerProfile,
  type OwnerVerificationProfile,
  type PartnerDocumentType,
  type PartnerEntityType,
} from '@mazare3/db';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import {
  DEFAULT_PARTNER_REQUIREMENTS,
  partnerKycRequirementsForEntity,
  payoutRequirementsForEntity,
  requirementsForEntity,
  type PartnerRequirementDef,
} from '../config/partner-requirements.config.js';
import {
  assertOwnerCanEdit,
  canOwnerEditOnboarding,
  canOwnerSubmitOnboarding,
  isOperationallyApproved,
  nextStatusOnSubmit,
} from '../lib/partner-verification-machine.js';
import { encryptPartnerField, fingerprintIban, last4Of } from '../lib/partner-crypto.js';
import { isPayoutRelatedFieldKey } from '../lib/owner-payout-readiness.js';
import { assertPartnerUploadFile, loadPartnerDocumentMaxBytes, loadPartnerDocumentMaxCount } from '../lib/partner-file-magic.js';
import {
  deletePartnerDocumentFile,
  writePartnerDocumentFile,
} from './partner-documents/private-storage.js';
import {
  resolveCommercialTerms,
  pickResolvedTerms,
  type CommissionSourceName,
} from './commercial-terms.service.js';
import {
  notifyPartnerApplicationSubmitted,
  notifyPartnerChangesRequested,
} from './notification.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export type PartnerDocumentView = {
  id: string;
  documentType: PartnerDocumentType;
  requirementId: string | null;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  reviewStatus: OwnerDocumentReviewStatus;
  rejectionReason: string | null;
  uploadedAt: string;
  reviewedAt: string | null;
  superseded: boolean;
};

export type PartnerReadiness = {
  profileComplete: boolean;
  requiredDocumentsComplete: boolean;
  requiredDocumentsApproved: boolean;
  payoutProfileComplete: boolean;
  payoutProfileApproved: boolean;
  agreementAccepted: boolean;
  commercialTermsReady: boolean;
  unresolvedChanges: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  missingRequirements: string[];
};

export type PartnerPayoutView = {
  complete: boolean;
  beneficiaryNameMasked: string | null;
  bankNameMasked: string | null;
  ibanMasked: string | null;
  reviewStatus: OwnerPayoutReviewStatus | null;
  reviewReason: string | null;
  updatedAt: string | null;
};

export type PartnerAgreementView = {
  id: string;
  version: string;
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  summaryEn: string;
  contentAr: string;
  contentEn: string;
  effectiveAt: string;
  legalReviewPlaceholder: boolean;
};

export type PartnerAcceptedAgreementView = {
  agreementId: string;
  version: string;
  acceptedAt: string;
  acceptedLocale: string | null;
};

export type PartnerOnboardingView = {
  /** False when the user has never saved Partner onboarding (no DB rows). */
  started: boolean;
  ownerProfileId: string | null;
  ownerStatus: OwnerStatus | null;
  verificationStatus: PartnerVerificationStatus | null;
  entityType: PartnerEntityType | null;
  legacyApproved: boolean;
  complianceNotice: boolean;
  displayName: string;
  businessName: string | null;
  phone: string;
  city: string | null;
  area: string | null;
  bio: string | null;
  approximateFarmCount: number | null;
  legalName: string | null;
  operatingPhone: string | null;
  operatingCity: string | null;
  operatingArea: string | null;
  contactEmail: string | null;
  changeRequestReason: string | null;
  /** Unresolved partner-visible change requests (no admin identity). */
  openChangeRequests: {
    id: string;
    fieldKey: string;
    reason: string;
    createdAt: string;
  }[];
  rejectionReason: string | null;
  suspensionReason: string | null;
  submittedAt: string | null;
  documents: PartnerDocumentView[];
  payout: PartnerPayoutView;
  currentAgreement: PartnerAgreementView | null;
  acceptedAgreement: PartnerAcceptedAgreementView | null;
  commercialTerms: {
    source: CommissionSourceName;
    commissionPercent: number;
    termsId: string | null;
  };
  readiness: PartnerReadiness;
  createdAt: string | null;
  updatedAt: string | null;
};

const EMPTY_READINESS: PartnerReadiness = {
  profileComplete: false,
  requiredDocumentsComplete: false,
  requiredDocumentsApproved: false,
  payoutProfileComplete: false,
  payoutProfileApproved: false,
  agreementAccepted: false,
  commercialTermsReady: false,
  unresolvedChanges: false,
  canSubmit: false,
  canApprove: false,
  missingRequirements: ['profile'],
};

/** Placeholder phone only until Contact/Partner Details saves a real number (schema requires phone). */
export const PARTNER_PHONE_PLACEHOLDER = '00000000';

function isMeaningfulAboutYouCreate(input: PatchPartnerOnboardingInput): boolean {
  return (
    (input.displayName?.trim().length ?? 0) >= 2 &&
    (input.city?.trim().length ?? 0) >= 2 &&
    (input.area?.trim().length ?? 0) >= 2
  );
}

export type PartnerRequirementRow = {
  id: string;
  documentType: PartnerDocumentType;
  required: boolean;
  optional: boolean;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  sortOrder: number;
  currentDocument: PartnerDocumentView | null;
};

export type PatchPartnerOnboardingInput = {
  displayName?: string;
  businessName?: string | null;
  phone?: string;
  city?: string;
  area?: string;
  bio?: string;
  approximateFarmCount?: number | null;
  entityType?: PartnerEntityType;
  legalName?: string;
  operatingPhone?: string;
  operatingCity?: string;
  operatingArea?: string;
  contactEmail?: string;
};

export type UploadPartnerDocumentParams = {
  userId: string;
  requirementId?: string;
  documentType?: string;
  buffer: Buffer;
  declaredMime: string;
  originalName: string;
  req?: AuthenticatedRequest;
};

export type PartnerPayoutInput = {
  iban: string;
  beneficiaryName: string;
  bankName: string;
  optionalNotes?: string;
};

type OwnerOnboardingProfile = OwnerProfile & {
  verificationProfile: OwnerVerificationProfile;
};

function mapDocument(row: OwnerDocument): PartnerDocumentView {
  return {
    id: row.id,
    documentType: row.documentType,
    requirementId: row.requirementId,
    originalFileName: row.originalFileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    reviewStatus: row.reviewStatus,
    rejectionReason: row.rejectionReason,
    uploadedAt: row.uploadedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    superseded: row.supersededById != null || row.reviewStatus === OwnerDocumentReviewStatus.superseded,
  };
}

async function loadRequirementRows(): Promise<PartnerRequirementDef[]> {
  const rows = await prisma.partnerDocumentRequirement.findMany({
    orderBy: { sortOrder: 'asc' },
  });
  if (rows.length === 0) return DEFAULT_PARTNER_REQUIREMENTS;
  return rows.map((r) => ({
    id: r.id,
    documentType: r.documentType,
    entityType: r.entityType,
    required: r.required,
    active: r.active,
    labelAr: r.labelAr,
    labelEn: r.labelEn,
    descriptionAr: r.descriptionAr,
    descriptionEn: r.descriptionEn,
    sortOrder: r.sortOrder,
  }));
}

export async function computePartnerReadiness(ownerProfileId: string): Promise<PartnerReadiness> {
  const profile = await prisma.ownerProfile.findUnique({
    where: { id: ownerProfileId },
    include: {
      verificationProfile: true,
      documents: true,
      payoutProfile: true,
      agreementAcceptances: { include: { agreement: true } },
      changeRequests: { where: { resolved: false } },
    },
  });
  if (!profile || !profile.verificationProfile) {
    return {
      profileComplete: false,
      requiredDocumentsComplete: false,
      requiredDocumentsApproved: false,
      payoutProfileComplete: false,
      payoutProfileApproved: false,
      agreementAccepted: false,
      commercialTermsReady: false,
      unresolvedChanges: false,
      canSubmit: false,
      canApprove: false,
      missingRequirements: ['profile'],
    };
  }
  const v = profile.verificationProfile;
  const missing: string[] = [];
  const profileComplete = Boolean(
    v.entityType &&
      profile.displayName.trim().length >= 2 &&
      profile.phone.trim().length >= 8 &&
      (profile.city ?? '').trim().length >= 2 &&
      (profile.area ?? '').trim().length >= 2 &&
      (profile.bio ?? '').trim().length >= 20 &&
      (v.legalName ?? profile.displayName).trim().length >= 2 &&
      (v.operatingPhone ?? profile.phone).trim().length >= 8 &&
      (v.operatingCity ?? profile.city ?? '').trim().length >= 2 &&
      (v.operatingArea ?? profile.area ?? '').trim().length >= 2,
  );
  if (!profileComplete) missing.push('profile');
  // PF-5: Partner KYC docs only — payout_proof is post-approval financial setup.
  const reqs = partnerKycRequirementsForEntity(await loadRequirementRows(), v.entityType);
  const required = reqs.filter((r) => r.required);
  const currentDocs = profile.documents.filter((d) => d.reviewStatus !== OwnerDocumentReviewStatus.superseded);
  const requiredDocumentsComplete = required.every((r) =>
    currentDocs.some((d) => d.documentType === r.documentType),
  );
  const requiredDocumentsApproved =
    required.length > 0 &&
    required.every((r) =>
      currentDocs.some(
        (d) =>
          d.documentType === r.documentType && d.reviewStatus === OwnerDocumentReviewStatus.approved,
      ),
    );
  if (!requiredDocumentsComplete) missing.push('required_documents');
  if (!requiredDocumentsApproved) missing.push('required_documents_approved');
  const payoutProfileComplete = Boolean(profile.payoutProfile);
  const payoutProfileApproved = profile.payoutProfile?.reviewStatus === OwnerPayoutReviewStatus.reviewed;
  // Informational only — do not gate Partner submit/approve (PF-5).
  const activeAgreement = await prisma.partnerAgreement.findFirst({
    where: { status: PartnerAgreementStatus.active },
    orderBy: { effectiveAt: 'desc' },
  });
  const agreementAccepted = Boolean(
    activeAgreement && profile.agreementAcceptances.some((a) => a.agreementId === activeAgreement.id),
  );
  if (!agreementAccepted) missing.push('agreement');
  const resolved = await resolveCommercialTerms({ ownerProfileId });
  const commercialTermsReady = resolved.source !== 'platform_default' || v.usePlatformDefaultCommission === true;
  if (!commercialTermsReady) missing.push('commercial_terms');
  // Legacy payout-targeted change requests must not block Partner KYC (PF-5).
  const kycChangeRequests = profile.changeRequests.filter(
    (c) => !isPayoutRelatedFieldKey(c.fieldKey),
  );
  const unresolvedChanges = kycChangeRequests.length > 0;
  // Open change-request rows are expected in changes_requested; submit resolves them.
  // Blocking canSubmit here made generic request-changes permanently un-resubmittable.
  const unresolvedBlocksSubmit =
    unresolvedChanges &&
    v.verificationStatus !== PartnerVerificationStatus.changes_requested;
  if (unresolvedBlocksSubmit) missing.push('unresolved_changes');
  const canSubmit =
    profileComplete &&
    requiredDocumentsComplete &&
    agreementAccepted &&
    !unresolvedBlocksSubmit &&
    canOwnerSubmitOnboarding(v.verificationStatus);
  const canApprove =
    profileComplete &&
    requiredDocumentsApproved &&
    agreementAccepted &&
    commercialTermsReady &&
    !unresolvedChanges &&
    (v.verificationStatus === PartnerVerificationStatus.under_review ||
      v.verificationStatus === PartnerVerificationStatus.submitted ||
      v.verificationStatus === PartnerVerificationStatus.changes_requested);
  return {
    profileComplete,
    requiredDocumentsComplete,
    requiredDocumentsApproved,
    payoutProfileComplete,
    payoutProfileApproved,
    agreementAccepted,
    commercialTermsReady,
    unresolvedChanges,
    canSubmit,
    canApprove,
    missingRequirements: missing,
  };
}

export async function computePartnerReadinessFromLoaded(params: {
  profile: {
    id: string;
    displayName: string;
    phone: string;
    city: string | null;
    area: string | null;
    bio: string | null;
    verificationProfile: OwnerVerificationProfile;
    documents: OwnerDocument[];
    payoutProfile: { reviewStatus: OwnerPayoutReviewStatus } | null;
    agreementAcceptances: { agreementId: string }[];
    changeRequests: { id: string; fieldKey: string }[];
    commercialTerms: import('@mazare3/db').PartnerCommercialTerms[];
  };
  requirements: PartnerRequirementDef[];
  activeAgreementId: string | null;
}): Promise<PartnerReadiness> {
  const { profile } = params;
  const v = profile.verificationProfile;
  const missing: string[] = [];
  const profileComplete = Boolean(
    v.entityType &&
      profile.displayName.trim().length >= 2 &&
      profile.phone.trim().length >= 8 &&
      (profile.city ?? '').trim().length >= 2 &&
      (profile.area ?? '').trim().length >= 2 &&
      (profile.bio ?? '').trim().length >= 20 &&
      (v.legalName ?? profile.displayName).trim().length >= 2 &&
      (v.operatingPhone ?? profile.phone).trim().length >= 8 &&
      (v.operatingCity ?? profile.city ?? '').trim().length >= 2 &&
      (v.operatingArea ?? profile.area ?? '').trim().length >= 2,
  );
  if (!profileComplete) missing.push('profile');
  const reqs = partnerKycRequirementsForEntity(params.requirements, v.entityType);
  const required = reqs.filter((r) => r.required);
  const currentDocs = profile.documents.filter((d) => d.reviewStatus !== OwnerDocumentReviewStatus.superseded);
  const requiredDocumentsComplete = required.every((r) =>
    currentDocs.some((d) => d.documentType === r.documentType),
  );
  const requiredDocumentsApproved =
    required.length > 0 &&
    required.every((r) =>
      currentDocs.some(
        (d) => d.documentType === r.documentType && d.reviewStatus === OwnerDocumentReviewStatus.approved,
      ),
    );
  if (!requiredDocumentsComplete) missing.push('required_documents');
  if (!requiredDocumentsApproved) missing.push('required_documents_approved');
  const payoutProfileComplete = Boolean(profile.payoutProfile);
  const payoutProfileApproved = profile.payoutProfile?.reviewStatus === OwnerPayoutReviewStatus.reviewed;
  const agreementAccepted = Boolean(
    params.activeAgreementId && profile.agreementAcceptances.some((a) => a.agreementId === params.activeAgreementId),
  );
  if (!agreementAccepted) missing.push('agreement');
  const resolved = pickResolvedTerms(profile.commercialTerms, null);
  const commercialTermsReady = resolved.source !== 'platform_default' || v.usePlatformDefaultCommission === true;
  if (!commercialTermsReady) missing.push('commercial_terms');
  const kycChangeRequests = profile.changeRequests.filter(
    (c) => !isPayoutRelatedFieldKey(c.fieldKey),
  );
  const unresolvedChanges = kycChangeRequests.length > 0;
  const unresolvedBlocksSubmit =
    unresolvedChanges &&
    v.verificationStatus !== PartnerVerificationStatus.changes_requested;
  if (unresolvedBlocksSubmit) missing.push('unresolved_changes');
  const canSubmit =
    profileComplete &&
    requiredDocumentsComplete &&
    agreementAccepted &&
    !unresolvedBlocksSubmit &&
    canOwnerSubmitOnboarding(v.verificationStatus);
  const canApprove =
    profileComplete &&
    requiredDocumentsApproved &&
    agreementAccepted &&
    commercialTermsReady &&
    !unresolvedChanges &&
    (v.verificationStatus === PartnerVerificationStatus.under_review ||
      v.verificationStatus === PartnerVerificationStatus.submitted ||
      v.verificationStatus === PartnerVerificationStatus.changes_requested);
  return {
    profileComplete,
    requiredDocumentsComplete,
    requiredDocumentsApproved,
    payoutProfileComplete,
    payoutProfileApproved,
    agreementAccepted,
    commercialTermsReady,
    unresolvedChanges,
    canSubmit,
    canApprove,
    missingRequirements: missing,
  };
}

/**
 * Mutation-only create/ensure. Never call from GET/read handlers.
 * Concurrent first creates are safe via unique userId + retry.
 */
export async function ensureOwnerOnboarding(userId: string): Promise<OwnerOnboardingProfile> {
  const existing = await prisma.ownerProfile.findUnique({
    where: { userId },
    include: { verificationProfile: true },
  });
  if (existing?.verificationProfile) {
    return existing as OwnerOnboardingProfile;
  }
  if (existing && !existing.verificationProfile) {
    await prisma.ownerVerificationProfile.create({
      data: {
        ownerProfileId: existing.id,
        verificationStatus:
          existing.status === OwnerStatus.approved
            ? PartnerVerificationStatus.legacy_approved
            : existing.status === OwnerStatus.suspended
              ? PartnerVerificationStatus.suspended
              : existing.status === OwnerStatus.rejected
                ? PartnerVerificationStatus.rejected
                : PartnerVerificationStatus.draft,
        usePlatformDefaultCommission: existing.status === OwnerStatus.approved,
      },
    });
  } else {
    try {
      await prisma.ownerProfile.create({
        data: {
          userId,
          displayName: 'شريك جديد',
          phone: PARTNER_PHONE_PLACEHOLDER,
          status: OwnerStatus.pending,
          verificationProfile: {
            create: { verificationStatus: PartnerVerificationStatus.draft },
          },
        },
      });
    } catch (err) {
      // Unique userId race — another concurrent create won.
      const raced = await prisma.ownerProfile.findUnique({
        where: { userId },
        include: { verificationProfile: true },
      });
      if (!raced) throw err;
    }
  }
  const ready = await prisma.ownerProfile.findUniqueOrThrow({
    where: { userId },
    include: { verificationProfile: true },
  });
  if (!ready.verificationProfile) {
    throw new AppError(404, 'NOT_FOUND', 'Onboarding profile not found');
  }
  return ready as OwnerOnboardingProfile;
}

/** Read-only lookup — never creates rows. */
export async function findOwnerOnboarding(userId: string): Promise<OwnerOnboardingProfile | null> {
  const profile = await prisma.ownerProfile.findUnique({
    where: { userId },
    include: { verificationProfile: true },
  });
  if (!profile?.verificationProfile) return null;
  return profile as OwnerOnboardingProfile;
}

export async function emptyPartnerOnboardingView(): Promise<PartnerOnboardingView> {
  const currentAgreement = await prisma.partnerAgreement.findFirst({
    where: { status: PartnerAgreementStatus.active },
    orderBy: { effectiveAt: 'desc' },
  });
  return {
    started: false,
    ownerProfileId: null,
    ownerStatus: null,
    verificationStatus: null,
    entityType: null,
    legacyApproved: false,
    complianceNotice: false,
    displayName: '',
    businessName: null,
    phone: '',
    city: null,
    area: null,
    bio: null,
    approximateFarmCount: null,
    legalName: null,
    operatingPhone: null,
    operatingCity: null,
    operatingArea: null,
    contactEmail: null,
    changeRequestReason: null,
    openChangeRequests: [],
    rejectionReason: null,
    suspensionReason: null,
    submittedAt: null,
    documents: [],
    payout: {
      complete: false,
      beneficiaryNameMasked: null,
      bankNameMasked: null,
      ibanMasked: null,
      reviewStatus: null,
      reviewReason: null,
      updatedAt: null,
    },
    currentAgreement: currentAgreement
      ? {
          id: currentAgreement.id,
          version: currentAgreement.version,
          titleAr: currentAgreement.titleAr,
          titleEn: currentAgreement.titleEn,
          summaryAr: currentAgreement.summaryAr,
          summaryEn: currentAgreement.summaryEn,
          contentAr: currentAgreement.contentAr,
          contentEn: currentAgreement.contentEn,
          effectiveAt: currentAgreement.effectiveAt.toISOString(),
          legalReviewPlaceholder: true,
        }
      : null,
    acceptedAgreement: null,
    commercialTerms: {
      source: 'platform_default',
      commissionPercent: 18,
      termsId: null,
    },
    readiness: { ...EMPTY_READINESS },
    createdAt: null,
    updatedAt: null,
  };
}

/** GET-safe: never creates OwnerProfile / verification rows. */
export async function getPartnerOnboarding(userId: string): Promise<PartnerOnboardingView> {
  const profile = await findOwnerOnboarding(userId);
  if (!profile) return emptyPartnerOnboardingView();
  return buildOnboardingView(profile.id);
}

export async function buildOnboardingView(ownerProfileId: string): Promise<PartnerOnboardingView> {
  const profile = await prisma.ownerProfile.findUnique({
    where: { id: ownerProfileId },
    include: {
      verificationProfile: true,
      documents: { orderBy: { uploadedAt: 'desc' } },
      payoutProfile: true,
      agreementAcceptances: { include: { agreement: true }, orderBy: { acceptedAt: 'desc' } },
      changeRequests: {
        where: { resolved: false },
        orderBy: { createdAt: 'desc' },
        select: { id: true, fieldKey: true, reason: true, createdAt: true },
      },
    },
  });
  if (!profile?.verificationProfile) {
    throw new AppError(404, 'NOT_FOUND', 'Onboarding profile not found');
  }
  const v = profile.verificationProfile;
  const readiness = await computePartnerReadiness(ownerProfileId);
  const currentAgreement = await prisma.partnerAgreement.findFirst({
    where: { status: PartnerAgreementStatus.active },
    orderBy: { effectiveAt: 'desc' },
  });
  const lastAccepted = profile.agreementAcceptances[0];
  const resolved = await resolveCommercialTerms({ ownerProfileId });
  const currentDocs = profile.documents.filter((d) => d.reviewStatus !== OwnerDocumentReviewStatus.superseded);
  return {
    started: true,
    ownerProfileId: profile.id,
    ownerStatus: profile.status,
    verificationStatus: v.verificationStatus,
    entityType: v.entityType,
    legacyApproved: v.verificationStatus === PartnerVerificationStatus.legacy_approved,
    complianceNotice: v.verificationStatus === PartnerVerificationStatus.legacy_approved,
    displayName: profile.displayName,
    businessName: profile.businessName,
    phone: profile.phone,
    city: profile.city,
    area: profile.area,
    bio: profile.bio,
    approximateFarmCount: profile.approximateFarmCount,
    legalName: v.legalName,
    operatingPhone: v.operatingPhone,
    operatingCity: v.operatingCity,
    operatingArea: v.operatingArea,
    contactEmail: v.contactEmail,
    changeRequestReason: v.changeRequestReason,
    openChangeRequests: profile.changeRequests.map((c) => ({
      id: c.id,
      fieldKey: c.fieldKey,
      reason: c.reason,
      createdAt: c.createdAt.toISOString(),
    })),
    rejectionReason: v.rejectionReason ?? profile.rejectionReason,
    suspensionReason: v.suspensionReason,
    submittedAt: v.submittedAt?.toISOString() ?? null,
    documents: currentDocs.map(mapDocument),
    payout: profile.payoutProfile
      ? {
          complete: true,
          beneficiaryNameMasked: '••••',
          bankNameMasked: '••••',
          ibanMasked: `••••${profile.payoutProfile.ibanLast4}`,
          reviewStatus: profile.payoutProfile.reviewStatus,
          reviewReason: profile.payoutProfile.reviewReason,
          updatedAt: profile.payoutProfile.updatedAt.toISOString(),
        }
      : {
          complete: false,
          beneficiaryNameMasked: null,
          bankNameMasked: null,
          ibanMasked: null,
          reviewStatus: null,
          reviewReason: null,
          updatedAt: null,
        },
    currentAgreement: currentAgreement
      ? {
          id: currentAgreement.id,
          version: currentAgreement.version,
          titleAr: currentAgreement.titleAr,
          titleEn: currentAgreement.titleEn,
          summaryAr: currentAgreement.summaryAr,
          summaryEn: currentAgreement.summaryEn,
          contentAr: currentAgreement.contentAr,
          contentEn: currentAgreement.contentEn,
          effectiveAt: currentAgreement.effectiveAt.toISOString(),
          legalReviewPlaceholder: true,
        }
      : null,
    acceptedAgreement: lastAccepted
      ? {
          agreementId: lastAccepted.agreementId,
          version: lastAccepted.agreement.version,
          acceptedAt: lastAccepted.acceptedAt.toISOString(),
          acceptedLocale: lastAccepted.acceptedLocale,
        }
      : null,
    commercialTerms: {
      source: resolved.source,
      commissionPercent: resolved.commissionPercent,
      termsId: resolved.termsId,
    },
    readiness,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export async function patchPartnerOnboardingProfile(
  userId: string,
  input: PatchPartnerOnboardingInput,
  req?: AuthenticatedRequest,
): Promise<PartnerOnboardingView> {
  let profile = await findOwnerOnboarding(userId);

  if (!profile) {
    if (!isMeaningfulAboutYouCreate(input)) {
      throw new AppError(
        400,
        'ONBOARDING_NOT_STARTED',
        'Save partner name and location to start your application',
      );
    }
    const displayName = input.displayName!.trim();
    const city = input.city!.trim();
    const area = input.area!.trim();
    const phone =
      input.phone?.trim() && input.phone.trim().length >= 8
        ? input.phone.trim()
        : PARTNER_PHONE_PLACEHOLDER;
    try {
      profile = (await prisma.ownerProfile.create({
        data: {
          userId,
          displayName,
          phone,
          city,
          area,
          bio: input.bio?.trim() || null,
          businessName: input.businessName?.trim() || null,
          approximateFarmCount: input.approximateFarmCount ?? null,
          status: OwnerStatus.pending,
          verificationProfile: {
            create: {
              verificationStatus: PartnerVerificationStatus.draft,
              ...(input.entityType != null ? { entityType: input.entityType } : {}),
              ...(input.legalName != null ? { legalName: input.legalName.trim() } : {}),
              ...(input.operatingPhone != null
                ? { operatingPhone: input.operatingPhone.trim() }
                : {}),
              ...(input.operatingCity != null ? { operatingCity: input.operatingCity.trim() } : {}),
              ...(input.operatingArea != null ? { operatingArea: input.operatingArea.trim() } : {}),
              ...(input.contactEmail != null ? { contactEmail: input.contactEmail.trim() } : {}),
            },
          },
        },
        include: { verificationProfile: true },
      })) as OwnerOnboardingProfile;
    } catch {
      // Concurrent first-save race — winner already created; continue with update path.
      profile = await findOwnerOnboarding(userId);
      if (!profile) {
        throw new AppError(500, 'ONBOARDING_CREATE_FAILED', 'Could not start partner application');
      }
    }
  }

  const status = profile.verificationProfile.verificationStatus;
  assertOwnerCanEdit(status);
  await prisma.$transaction(async (tx) => {
    await tx.ownerProfile.update({
      where: { id: profile!.id },
      data: {
        ...(input.displayName != null ? { displayName: input.displayName.trim() } : {}),
        ...(input.businessName !== undefined
          ? { businessName: input.businessName?.trim() || null }
          : {}),
        ...(input.phone != null ? { phone: input.phone.trim() } : {}),
        ...(input.city != null ? { city: input.city.trim() } : {}),
        ...(input.area != null ? { area: input.area.trim() } : {}),
        ...(input.bio != null ? { bio: input.bio.trim() } : {}),
        ...(input.approximateFarmCount !== undefined
          ? { approximateFarmCount: input.approximateFarmCount }
          : {}),
      },
    });
    await tx.ownerVerificationProfile.update({
      where: { ownerProfileId: profile!.id },
      data: {
        ...(input.entityType != null ? { entityType: input.entityType } : {}),
        ...(input.legalName != null ? { legalName: input.legalName.trim() } : {}),
        ...(input.operatingPhone != null ? { operatingPhone: input.operatingPhone.trim() } : {}),
        ...(input.operatingCity != null ? { operatingCity: input.operatingCity.trim() } : {}),
        ...(input.operatingArea != null ? { operatingArea: input.operatingArea.trim() } : {}),
        ...(input.contactEmail != null ? { contactEmail: input.contactEmail.trim() } : {}),
      },
    });
  });
  await createAuditLog({
    actorUserId: userId,
    action: 'owner.onboarding_profile_saved',
    entityType: 'owner_profile',
    entityId: profile.id,
    req,
  });
  return buildOnboardingView(profile.id);
}

/** GET-safe requirements — no draft creation. Partner KYC only (excludes payout_proof). */
export async function getPartnerRequirements(userId: string): Promise<PartnerRequirementRow[]> {
  const profile = await findOwnerOnboarding(userId);
  const entityType = profile?.verificationProfile?.entityType ?? null;
  const reqs = partnerKycRequirementsForEntity(await loadRequirementRows(), entityType);
  const docs = profile
    ? await prisma.ownerDocument.findMany({
        where: {
          ownerProfileId: profile.id,
          reviewStatus: { not: OwnerDocumentReviewStatus.superseded },
        },
        orderBy: { uploadedAt: 'desc' },
      })
    : [];
  return reqs.map((r) => {
    const current = docs.find((d) => d.documentType === r.documentType) ?? null;
    return {
      id: r.id,
      documentType: r.documentType,
      required: r.required,
      optional: !r.required,
      labelAr: r.labelAr,
      labelEn: r.labelEn,
      descriptionAr: r.descriptionAr,
      descriptionEn: r.descriptionEn,
      sortOrder: r.sortOrder,
      currentDocument: current ? mapDocument(current) : null,
    };
  });
}

/** Post-approval payout document requirements (payout_proof). */
export async function getOwnerPayoutRequirements(userId: string): Promise<PartnerRequirementRow[]> {
  const profile = await findOwnerOnboarding(userId);
  if (!profile?.verificationProfile) {
    throw new AppError(404, 'NOT_FOUND', 'Owner profile not found');
  }
  if (!isOperationallyApproved(profile.verificationProfile.verificationStatus)) {
    throw new AppError(403, 'FORBIDDEN', 'Payout setup is available after Partner approval');
  }
  const reqs = payoutRequirementsForEntity(
    await loadRequirementRows(),
    profile.verificationProfile.entityType,
  );
  const docs = await prisma.ownerDocument.findMany({
    where: {
      ownerProfileId: profile.id,
      reviewStatus: { not: OwnerDocumentReviewStatus.superseded },
    },
    orderBy: { uploadedAt: 'desc' },
  });
  return reqs.map((r) => {
    const current = docs.find((d) => d.documentType === r.documentType) ?? null;
    return {
      id: r.id,
      documentType: r.documentType,
      required: r.required,
      optional: !r.required,
      labelAr: r.labelAr,
      labelEn: r.labelEn,
      descriptionAr: r.descriptionAr,
      descriptionEn: r.descriptionEn,
      sortOrder: r.sortOrder,
      currentDocument: current ? mapDocument(current) : null,
    };
  });
}

export async function uploadPartnerDocument(
  params: UploadPartnerDocumentParams,
): Promise<PartnerDocumentView> {
  const profile = await ensureOwnerOnboarding(params.userId);
  const status = profile.verificationProfile.verificationStatus;
  const allReqs = await loadRequirementRows();
  // KYC + payout pools — payout_proof remains uploadable after Partner approval.
  const reqs = requirementsForEntity(allReqs, profile.verificationProfile.entityType);
  let requirement = params.requirementId ? reqs.find((r) => r.id === params.requirementId) : undefined;
  if (!requirement && params.documentType) {
    requirement = reqs.find((r) => r.documentType === params.documentType);
  }
  if (!requirement) {
    throw new AppError(400, 'UNKNOWN_REQUIREMENT', 'Unknown or inapplicable document requirement');
  }
  const isPayoutProof = requirement.documentType === 'payout_proof';
  if (isOperationallyApproved(status)) {
    if (!isPayoutProof) {
      throw new AppError(
        409,
        'ONBOARDING_READ_ONLY',
        'Partner KYC documents are locked after approval',
      );
    }
  } else {
    assertOwnerCanEdit(status);
  }
  const buffer = Buffer.isBuffer(params.buffer) ? params.buffer : Buffer.from(params.buffer);
  const checked = assertPartnerUploadFile({
    buffer,
    declaredMime: params.declaredMime,
    originalName: params.originalName,
    maxBytes: loadPartnerDocumentMaxBytes(),
  });
  const currentCount = await prisma.ownerDocument.count({
    where: {
      ownerProfileId: profile.id,
      reviewStatus: { not: OwnerDocumentReviewStatus.superseded },
    },
  });
  if (currentCount >= loadPartnerDocumentMaxCount()) {
    throw new AppError(400, 'TOO_MANY_DOCUMENTS', 'Document limit reached for this application');
  }
  const storageKey = await writePartnerDocumentFile({
    ownerProfileId: profile.id,
    mime: checked.mime,
    buffer,
  });
  try {
    const previous = await prisma.ownerDocument.findMany({
      where: {
        ownerProfileId: profile.id,
        documentType: requirement.documentType,
        reviewStatus: { not: OwnerDocumentReviewStatus.superseded },
      },
    });
    const created = await prisma.ownerDocument.create({
      data: {
        ownerProfileId: profile.id,
        requirementId: requirement.id,
        documentType: requirement.documentType,
        originalFileName: checked.safeName,
        storageKey,
        mimeType: checked.mime,
        sizeBytes: buffer.length,
        reviewStatus: OwnerDocumentReviewStatus.uploaded,
      },
    });
    try {
      for (const prev of previous) {
        await prisma.ownerDocument.update({
          where: { id: prev.id },
          data: {
            reviewStatus: OwnerDocumentReviewStatus.superseded,
            supersededById: created.id,
          },
        });
      }
      await prisma.ownerOnboardingChangeRequest.updateMany({
        where: {
          ownerProfileId: profile.id,
          resolved: false,
          fieldKey: { in: [`document:${requirement.documentType}`, `document:${prevDocField(previous)}`] },
        },
        data: { resolved: true, resolvedAt: new Date() },
      });
    } catch (afterCreateErr) {
      await prisma.ownerDocument.delete({ where: { id: created.id } }).catch(() => undefined);
      throw afterCreateErr;
    }
    await createAuditLog({
      actorUserId: params.userId,
      action: 'owner.document_uploaded',
      entityType: 'owner_document',
      entityId: created.id,
      metadata: { documentType: created.documentType, sizeBytes: created.sizeBytes },
      req: params.req,
    });
    return mapDocument(created);
  } catch (err) {
    await deletePartnerDocumentFile(storageKey).catch(() => undefined);
    throw err;
  }
}

function prevDocField(previous: Array<{ id: string }>): string {
  return previous[0]?.id ?? '';
}

export async function deletePartnerDocument(
  userId: string,
  documentId: string,
  req?: AuthenticatedRequest,
): Promise<void> {
  const profile = await ensureOwnerOnboarding(userId);
  assertOwnerCanEdit(profile.verificationProfile.verificationStatus);
  const doc = await prisma.ownerDocument.findFirst({
    where: { id: documentId, ownerProfileId: profile.id },
  });
  if (!doc) throw new AppError(404, 'NOT_FOUND', 'Document not found');
  if (doc.reviewStatus === OwnerDocumentReviewStatus.approved) {
    throw new AppError(409, 'DOCUMENT_LOCKED', 'Approved documents cannot be deleted');
  }
  await prisma.ownerDocument.delete({ where: { id: doc.id } });
  await deletePartnerDocumentFile(doc.storageKey);
  await createAuditLog({
    actorUserId: userId,
    action: 'owner.document_deleted',
    entityType: 'owner_document',
    entityId: documentId,
    req,
  });
}

export async function submitPartnerOnboarding(
  userId: string,
  req?: AuthenticatedRequest,
): Promise<PartnerOnboardingView> {
  const profile = await ensureOwnerOnboarding(userId);
  const readiness = await computePartnerReadiness(profile.id);
  if (!readiness.canSubmit) {
    throw new AppError(400, 'ONBOARDING_INCOMPLETE', 'Complete required steps before submitting', {
      readiness,
    });
  }
  const next = nextStatusOnSubmit(profile.verificationProfile.verificationStatus);
  await prisma.$transaction(async (tx) => {
    await tx.ownerVerificationProfile.update({
      where: { ownerProfileId: profile.id },
      data: {
        verificationStatus: next,
        submittedAt: new Date(),
        changeRequestReason: null,
      },
    });
    await tx.ownerProfile.update({
      where: { id: profile.id },
      data: { status: OwnerStatus.pending, rejectionReason: null },
    });
    await tx.ownerOnboardingChangeRequest.updateMany({
      where: { ownerProfileId: profile.id, resolved: false },
      data: { resolved: true, resolvedAt: new Date() },
    });
  });
  await createAuditLog({
    actorUserId: userId,
    action: 'owner.application_submitted',
    entityType: 'owner_profile',
    entityId: profile.id,
    metadata: { verificationStatus: next },
    req,
  });
  const updated = await prisma.ownerProfile.findUniqueOrThrow({
    where: { id: profile.id },
    select: { displayName: true },
  });
  void notifyPartnerApplicationSubmitted({
    ownerProfileId: profile.id,
    displayName: updated.displayName,
  }).catch((err: unknown) => console.error('[notifications] partner.application_submitted', err));
  return buildOnboardingView(profile.id);
}

export async function putPartnerPayoutProfile(
  userId: string,
  input: PartnerPayoutInput,
  req?: AuthenticatedRequest,
): Promise<PartnerOnboardingView> {
  const profile = await ensureOwnerOnboarding(userId);
  const status = profile.verificationProfile.verificationStatus;
  if (!canOwnerEditOnboarding(status) && !isOperationallyApproved(status)) {
    assertOwnerCanEdit(status);
  }
  const iban = input.iban.replace(/\s+/g, '').toUpperCase();
  const beneficiaryNameCipher = encryptPartnerField(input.beneficiaryName.trim());
  const bankNameCipher = encryptPartnerField(input.bankName.trim());
  const ibanCipher = encryptPartnerField(iban);
  const optionalNotesCipher = input.optionalNotes?.trim()
    ? encryptPartnerField(input.optionalNotes.trim())
    : null;
  await prisma.ownerPayoutProfile.upsert({
    where: { ownerProfileId: profile.id },
    create: {
      ownerProfileId: profile.id,
      beneficiaryNameCipher,
      bankNameCipher,
      ibanCipher,
      ibanLast4: last4Of(iban),
      ibanFingerprint: fingerprintIban(iban),
      optionalNotesCipher,
      reviewStatus: OwnerPayoutReviewStatus.pending,
    },
    update: {
      beneficiaryNameCipher,
      bankNameCipher,
      ibanCipher,
      ibanLast4: last4Of(iban),
      ibanFingerprint: fingerprintIban(iban),
      optionalNotesCipher,
      reviewStatus: OwnerPayoutReviewStatus.pending,
      reviewReason: null,
      reviewedAt: null,
      reviewedByUserId: null,
    },
  });
  await createAuditLog({
    actorUserId: userId,
    action: 'owner.payout_profile_saved',
    entityType: 'owner_payout_profile',
    entityId: profile.id,
    metadata: { ibanLast4: last4Of(iban) },
    req,
  });
  return buildOnboardingView(profile.id);
}

export async function getPartnerAgreement(userId: string): Promise<{
  current: PartnerAgreementView | null;
  accepted: PartnerAcceptedAgreementView | null;
}> {
  const view = await getPartnerOnboarding(userId);
  return {
    current: view.currentAgreement,
    accepted: view.acceptedAgreement,
  };
}

export async function acceptPartnerAgreement(
  userId: string,
  agreementId: string,
  acceptedLocale: string | null | undefined,
  req?: AuthenticatedRequest,
): Promise<{ current: PartnerAgreementView | null; accepted: PartnerAcceptedAgreementView | null }> {
  const profile = await ensureOwnerOnboarding(userId);
  const agreement = await prisma.partnerAgreement.findUnique({ where: { id: agreementId } });
  if (!agreement || agreement.status !== PartnerAgreementStatus.active) {
    throw new AppError(400, 'AGREEMENT_NOT_ACTIVE', 'That agreement version is not active');
  }
  await prisma.partnerAgreementAcceptance.upsert({
    where: {
      ownerProfileId_agreementId: { ownerProfileId: profile.id, agreementId },
    },
    create: {
      ownerProfileId: profile.id,
      agreementId,
      userId,
      acceptedLocale: acceptedLocale ?? null,
    },
    update: {
      acceptedAt: new Date(),
      acceptedLocale: acceptedLocale ?? null,
    },
  });
  await createAuditLog({
    actorUserId: userId,
    action: 'owner.partner_agreement_accepted',
    entityType: 'partner_agreement',
    entityId: agreementId,
    metadata: { version: agreement.version, ownerProfileId: profile.id },
    req,
  });
  return getPartnerAgreement(userId);
}

export async function getOwnerAccessibleDocument(
  userId: string,
  documentId: string,
): Promise<OwnerDocument> {
  const profile = await prisma.ownerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, 'NOT_FOUND', 'Document not found');
  const doc = await prisma.ownerDocument.findFirst({
    where: { id: documentId, ownerProfileId: profile.id },
  });
  if (!doc) throw new AppError(404, 'NOT_FOUND', 'Document not found');
  return doc;
}

export { notifyPartnerChangesRequested };
