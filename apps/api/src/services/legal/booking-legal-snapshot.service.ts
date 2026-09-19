import { LegalDocumentStatus, LegalDocumentType, prisma, type Prisma } from '@mazare3/db';
import { buildFinancialPolicySnapshot } from '@mazare3/shared';
import { AppError } from '../../lib/errors.js';
import { getActiveVersion } from './legal-document.service.js';

export type BookingLegalVersionIds = {
  termsVersionId?: string | null;
  cancellationPolicyVersionId?: string | null;
  bookingTermsVersionId?: string | null;
  privacyNoticeVersionId?: string | null;
};

type VersionMeta = {
  id: string;
  documentType: string;
  version: string;
  language: string;
  title: string;
  status: string;
  publishedAt: string | null;
  effectiveAt: string | null;
  contentHash?: string;
};

/**
 * Create immutable legal+financial snapshot for a booking at creation time.
 * Financial numbers come from SSOT (marketplace-financial-policy); legal IDs from
 * server-resolved ACTIVE versions (Phase 3C.4E.4A) — never DRAFT fallback.
 */
export async function createSnapshotForBooking(
  bookingId: string,
  opts?: {
    versionIds?: BookingLegalVersionIds;
    locale?: 'ar' | 'en';
    commissionPercent?: number;
    depositPercent?: number;
    tx?: Prisma.TransactionClient;
    /** When true, all contractual version FKs must be present. */
    requireComplete?: boolean;
    /** Local/dev when ACTIVE corpus missing — allow null version FKs without fabricating DRAFT. */
    allowIncompleteCorpus?: boolean;
  },
) {
  const db = opts?.tx ?? prisma;
  const existing = await db.bookingLegalSnapshot.findUnique({ where: { bookingId } });
  if (existing) {
    return existing;
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      platformCommissionPercent: true,
      depositPercent: true,
    },
  });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');

  const locale = opts?.locale ?? 'ar';
  const financial = buildFinancialPolicySnapshot({
    commissionPercent: Number(
      opts?.commissionPercent ?? booking.platformCommissionPercent,
    ),
  });

  async function resolveVersionId(
    provided: string | null | undefined,
    documentType: LegalDocumentType,
    required: boolean,
  ): Promise<string | null> {
    if (provided) {
      const v = await db.legalDocumentVersion.findUnique({ where: { id: provided } });
      if (!v) {
        throw new AppError(400, 'LEGAL_VERSION_NOT_FOUND', `Unknown legal version`);
      }
      if (v.documentType !== documentType) {
        throw new AppError(400, 'LEGAL_VERSION_TYPE_MISMATCH', 'Legal version type mismatch');
      }
      if (v.status !== LegalDocumentStatus.active && v.status !== LegalDocumentStatus.superseded) {
        throw new AppError(
          400,
          'LEGAL_VERSION_NOT_ACCEPTABLE',
          'Only active or superseded published versions can govern a Booking',
        );
      }
      // For NEW Booking commitment snapshots, prefer ACTIVE; superseded only if explicitly provided
      // after material reacceptance of still-valid prior — create path supplies ACTIVE only.
      if (opts?.requireComplete && v.status !== LegalDocumentStatus.active) {
        throw new AppError(
          400,
          'LEGAL_VERSION_NOT_ACCEPTABLE',
          'Booking legal snapshot requires an active document version',
        );
      }
      return v.id;
    }
    if (opts?.allowIncompleteCorpus && !required) {
      return null;
    }
    if (opts?.allowIncompleteCorpus && required) {
      return null;
    }
    // Legacy soft path: try ACTIVE only — never invent DRAFT.
    const active = await getActiveVersion(documentType, locale);
    if (active) return active.id;
    if (required || opts?.requireComplete) {
      throw new AppError(
        503,
        'CUSTOMER_BOOKING_LEGAL_TERMS_UNAVAILABLE',
        'Booking cannot be completed right now. Please try again later.',
      );
    }
    return null;
  }

  const requireComplete = opts?.requireComplete === true;
  const termsVersionId = await resolveVersionId(
    opts?.versionIds?.termsVersionId,
    LegalDocumentType.terms_and_conditions,
    requireComplete,
  );
  const cancellationPolicyVersionId = await resolveVersionId(
    opts?.versionIds?.cancellationPolicyVersionId,
    LegalDocumentType.cancellation_refund_policy,
    requireComplete,
  );
  const bookingTermsVersionId = await resolveVersionId(
    opts?.versionIds?.bookingTermsVersionId,
    LegalDocumentType.booking_terms,
    requireComplete,
  );
  const privacyNoticeVersionId = await resolveVersionId(
    opts?.versionIds?.privacyNoticeVersionId,
    LegalDocumentType.privacy_policy,
    false,
  );

  if (
    requireComplete &&
    (!termsVersionId || !cancellationPolicyVersionId || !bookingTermsVersionId)
  ) {
    throw new AppError(
      503,
      'CUSTOMER_BOOKING_LEGAL_TERMS_UNAVAILABLE',
      'Booking cannot be completed right now. Please try again later.',
    );
  }

  return db.bookingLegalSnapshot.create({
    data: {
      bookingId,
      financialPolicyKey: financial.key,
      financialPolicyHash: financial.hash,
      termsVersionId,
      cancellationPolicyVersionId,
      bookingTermsVersionId,
      privacyNoticeVersionId,
      commissionPercent: Number(
        opts?.commissionPercent ?? booking.platformCommissionPercent,
      ),
      depositPercent: Number(opts?.depositPercent ?? booking.depositPercent),
      cancellationRulesJson: financial.cancellationRules,
      balanceDueHoursBeforeStart: financial.balanceDueHoursBeforeStart,
      fullPaymentWithinHours: financial.fullPaymentWithinHours,
    },
  });
}

export async function getSnapshotForBooking(bookingId: string) {
  return prisma.bookingLegalSnapshot.findUnique({ where: { bookingId } });
}

async function loadVersionMeta(
  versionId: string | null | undefined,
  includeHash: boolean,
): Promise<VersionMeta | null> {
  if (!versionId) return null;
  const v = await prisma.legalDocumentVersion.findUnique({ where: { id: versionId } });
  if (!v) return null;
  return {
    id: v.id,
    documentType: v.documentType,
    version: v.version,
    language: v.language,
    title: v.title,
    status: v.status,
    publishedAt: v.publishedAt?.toISOString() ?? null,
    effectiveAt: v.effectiveAt?.toISOString() ?? null,
    ...(includeHash ? { contentHash: v.contentHash } : {}),
  };
}

async function loadBookingAcceptances(bookingId: string, includeHash: boolean) {
  const rows = await prisma.legalAcceptance.findMany({
    where: { relatedBookingId: bookingId },
    orderBy: { acceptedAt: 'asc' },
    include: {
      legalDocumentVersion: {
        select: {
          id: true,
          documentType: true,
          version: true,
          language: true,
          title: true,
          contentHash: true,
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    documentVersionId: row.documentVersionId,
    documentType: row.documentType,
    documentVersion: row.documentVersion,
    language: row.language,
    acceptedAt: row.acceptedAt.toISOString(),
    acceptanceContext: row.acceptanceContext,
    sourceSurface: row.sourceSurface,
    evidenceSource: row.evidenceSource,
    ...(includeHash
      ? {
          documentHash: row.documentHash,
          versionContentHash: row.legalDocumentVersion?.contentHash ?? null,
        }
      : {}),
    title: row.legalDocumentVersion?.title ?? null,
  }));
}

/** Compact customer-safe evidence for PublicBookingSummary (no hashes). */
export async function toPublicLegalEvidence(bookingId: string) {
  const snapshot = await getSnapshotForBooking(bookingId);
  if (!snapshot) return null;

  const [bookingTerms, cancellation, terms, acceptances] = await Promise.all([
    loadVersionMeta(snapshot.bookingTermsVersionId, false),
    loadVersionMeta(snapshot.cancellationPolicyVersionId, false),
    loadVersionMeta(snapshot.termsVersionId, false),
    loadBookingAcceptances(bookingId, false),
  ]);

  const acceptedAt =
    acceptances.length > 0 ? acceptances[acceptances.length - 1]!.acceptedAt : null;

  return {
    bookingTermsVersion: bookingTerms?.version ?? null,
    cancellationPolicyVersion: cancellation?.version ?? null,
    termsVersion: terms?.version ?? null,
    financialPolicyKey: snapshot.financialPolicyKey,
    acceptedAt,
  };
}

/**
 * Customer-safe booking legal snapshot — titles/versions/languages/dates only.
 * Never includes content hashes.
 */
export async function getCustomerLegalSnapshotSummary(bookingId: string) {
  const snapshot = await getSnapshotForBooking(bookingId);
  if (!snapshot) return null;

  const versionIds = [
    snapshot.termsVersionId,
    snapshot.cancellationPolicyVersionId,
    snapshot.bookingTermsVersionId,
    snapshot.privacyNoticeVersionId,
  ];
  const documents = (
    await Promise.all(versionIds.map((id) => loadVersionMeta(id, false)))
  ).filter((d): d is VersionMeta => d != null);

  const acceptances = await loadBookingAcceptances(bookingId, false);
  const acceptedAt =
    acceptances.length > 0 ? acceptances[acceptances.length - 1]!.acceptedAt : null;

  return {
    bookingId,
    financialPolicyKey: snapshot.financialPolicyKey,
    createdAt: snapshot.createdAt.toISOString(),
    acceptedAt,
    documents: documents.map((d) => ({
      documentType: d.documentType,
      versionId: d.id,
      version: d.version,
      title: d.title,
      language: d.language,
      status: d.status,
      publishedAt: d.publishedAt,
      effectiveAt: d.effectiveAt,
    })),
    evidence: {
      bookingTermsVersion:
        documents.find((d) => d.documentType === LegalDocumentType.booking_terms)?.version ??
        null,
      cancellationPolicyVersion:
        documents.find(
          (d) => d.documentType === LegalDocumentType.cancellation_refund_policy,
        )?.version ?? null,
      termsVersion:
        documents.find((d) => d.documentType === LegalDocumentType.terms_and_conditions)
          ?.version ?? null,
      financialPolicyKey: snapshot.financialPolicyKey,
      acceptedAt,
    },
  };
}

/** Admin snapshot — includes hashes + acceptance evidence records. */
export async function getAdminLegalSnapshotSummary(bookingId: string) {
  const snapshot = await getSnapshotForBooking(bookingId);
  if (!snapshot) return null;

  const versionIds = [
    snapshot.termsVersionId,
    snapshot.cancellationPolicyVersionId,
    snapshot.bookingTermsVersionId,
    snapshot.privacyNoticeVersionId,
  ];
  const documents = (
    await Promise.all(versionIds.map((id) => loadVersionMeta(id, true)))
  ).filter((d): d is VersionMeta & { contentHash: string } => d != null);

  const acceptances = await loadBookingAcceptances(bookingId, true);

  return {
    bookingId,
    financialPolicyKey: snapshot.financialPolicyKey,
    financialPolicyHash: snapshot.financialPolicyHash,
    commissionPercent: Number(snapshot.commissionPercent),
    depositPercent: Number(snapshot.depositPercent),
    balanceDueHoursBeforeStart: snapshot.balanceDueHoursBeforeStart,
    fullPaymentWithinHours: snapshot.fullPaymentWithinHours,
    cancellationRulesJson: snapshot.cancellationRulesJson,
    createdAt: snapshot.createdAt.toISOString(),
    versionIds: {
      termsVersionId: snapshot.termsVersionId,
      cancellationPolicyVersionId: snapshot.cancellationPolicyVersionId,
      bookingTermsVersionId: snapshot.bookingTermsVersionId,
      privacyNoticeVersionId: snapshot.privacyNoticeVersionId,
    },
    documents: documents.map((d) => ({
      documentType: d.documentType,
      versionId: d.id,
      version: d.version,
      title: d.title,
      language: d.language,
      status: d.status,
      publishedAt: d.publishedAt,
      effectiveAt: d.effectiveAt,
      contentHash: d.contentHash,
    })),
    acceptances,
  };
}
