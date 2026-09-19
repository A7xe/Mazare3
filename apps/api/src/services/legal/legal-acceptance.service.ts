import {
  LegalAcceptanceContext,
  LegalAcceptanceEvidenceSource,
  LegalDocumentStatus,
  LegalDocumentType,
  prisma,
  type LegalAcceptance,
  type Prisma,
} from '@mazare3/db';
import type {
  LegalAcceptanceStatusCode,
  RecordLegalAcceptanceInput,
} from '@mazare3/shared';
import { AppError } from '../../lib/errors.js';
import { createAuditLog } from '../audit.service.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';

function mapAcceptance(row: LegalAcceptance) {
  return {
    id: row.id,
    userId: row.userId,
    documentVersionId: row.documentVersionId,
    releaseId: row.releaseId,
    documentType: row.documentType,
    documentVersion: row.documentVersion,
    documentHash: row.documentHash,
    language: row.language,
    acceptedAt: row.acceptedAt.toISOString(),
    acceptanceContext: row.acceptanceContext,
    relatedBookingId: row.relatedBookingId,
    relatedOwnerProfileId: row.relatedOwnerProfileId,
    sourceSurface: row.sourceSurface,
    explicitAction: row.explicitAction,
    evidenceSource: row.evidenceSource,
    withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
  };
}

/**
 * Record explicit acceptance only.
 * Never auto-grants. Never fabricates historical acceptances.
 * evidenceSource defaults to user_explicit_acceptance — admin forge via generic UI is forbidden.
 *
 * Phase 3C.4E.4A.1 — optional `tx` binds the write to a caller transaction
 * (Booking create atomicity).
 */
export async function recordAcceptance(
  userId: string,
  input: RecordLegalAcceptanceInput,
  opts?: {
    evidenceSource?: LegalAcceptanceEvidenceSource;
    explicitAction?: boolean;
    metadata?: Record<string, unknown>;
    req?: AuthenticatedRequest;
    /** When set, version lookup + acceptance create use this client. */
    tx?: Prisma.TransactionClient;
  },
) {
  const db = opts?.tx ?? prisma;
  const evidenceSource =
    opts?.evidenceSource ?? LegalAcceptanceEvidenceSource.user_explicit_acceptance;

  if (
    evidenceSource === LegalAcceptanceEvidenceSource.user_explicit_acceptance &&
    opts?.explicitAction === false
  ) {
    throw new AppError(
      400,
      'EXPLICIT_ACTION_REQUIRED',
      'user_explicit_acceptance requires explicitAction=true',
    );
  }

  const version = await db.legalDocumentVersion.findUnique({
    where: { id: input.documentVersionId },
    include: { release: true },
  });
  if (!version) {
    throw new AppError(404, 'LEGAL_VERSION_NOT_FOUND', 'Legal document version not found');
  }
  if (
    version.status !== LegalDocumentStatus.active &&
    version.status !== LegalDocumentStatus.superseded
  ) {
    throw new AppError(
      400,
      'LEGAL_VERSION_NOT_ACCEPTABLE',
      'Only active or superseded published versions can be accepted',
    );
  }

  // Idempotent when Booking-context evidence already exists for this pair.
  if (input.relatedBookingId) {
    const existing = await db.legalAcceptance.findFirst({
      where: {
        userId,
        documentVersionId: version.id,
        relatedBookingId: input.relatedBookingId,
        withdrawnAt: null,
      },
      orderBy: { acceptedAt: 'desc' },
    });
    if (existing) {
      return mapAcceptance(existing);
    }
  }

  const acceptedAt = new Date();
  const created = await db.legalAcceptance.create({
    data: {
      userId,
      documentVersionId: version.id,
      releaseId: version.releaseId,
      documentType: version.documentType,
      documentVersion: version.version,
      documentHash: version.contentHash,
      language: version.language,
      acceptedAt,
      acceptanceContext: input.context as LegalAcceptanceContext,
      relatedBookingId: input.relatedBookingId ?? null,
      relatedOwnerProfileId: input.relatedOwnerProfileId ?? null,
      sourceSurface: input.sourceSurface ?? null,
      explicitAction: opts?.explicitAction ?? true,
      evidenceSource,
      metadata: opts?.metadata ? (opts.metadata as object) : undefined,
    },
  });

  // Audit outside optional Booking TX so audit flakiness cannot orphan legal evidence
  // or block commit; Booking.created audit still records the commitment.
  if (!opts?.tx) {
    await createAuditLog({
      actorUserId: userId,
      action: 'legal.acceptance.recorded',
      entityType: 'legal_acceptance',
      entityId: created.id,
      metadata: {
        documentType: created.documentType,
        documentVersionId: created.documentVersionId,
        context: created.acceptanceContext,
        evidenceSource: created.evidenceSource,
        relatedBookingId: created.relatedBookingId,
      },
      req: opts?.req,
    });
  }

  return mapAcceptance(created);
}

export async function getLatestAcceptance(
  userId: string,
  documentType: LegalDocumentType | string,
) {
  return prisma.legalAcceptance.findFirst({
    where: {
      userId,
      documentType: documentType as LegalDocumentType,
      withdrawnAt: null,
    },
    orderBy: { acceptedAt: 'desc' },
  });
}

/**
 * Compute acceptance status for a document type — never fabricates history.
 * - accepted: latest acceptance matches current active release (or same release)
 * - missing: no acceptance on record
 * - superseded_still_valid: accepted a prior release that does not require reacceptance
 * - reacceptance_required: active release requiresReacceptance / materialChange and user on older
 */
export async function getAcceptanceStatus(
  userId: string,
  documentType: LegalDocumentType | string,
): Promise<{
  status: LegalAcceptanceStatusCode;
  activeReleaseId: string | null;
  activeVersionIds: string[];
  latestAcceptance: ReturnType<typeof mapAcceptance> | null;
}> {
  const activeVersions = await prisma.legalDocumentVersion.findMany({
    where: {
      documentType: documentType as LegalDocumentType,
      status: LegalDocumentStatus.active,
    },
    include: { release: true },
  });

  const activeRelease = activeVersions[0]?.release ?? null;
  const latest = await getLatestAcceptance(userId, documentType);

  if (!latest) {
    return {
      status: 'missing',
      activeReleaseId: activeRelease?.id ?? null,
      activeVersionIds: activeVersions.map((v) => v.id),
      latestAcceptance: null,
    };
  }

  if (!activeRelease) {
    return {
      status: 'accepted',
      activeReleaseId: null,
      activeVersionIds: [],
      latestAcceptance: mapAcceptance(latest),
    };
  }

  if (latest.releaseId === activeRelease.id) {
    return {
      status: 'accepted',
      activeReleaseId: activeRelease.id,
      activeVersionIds: activeVersions.map((v) => v.id),
      latestAcceptance: mapAcceptance(latest),
    };
  }

  if (activeRelease.requiresReacceptance || activeRelease.materialChange) {
    return {
      status: 'reacceptance_required',
      activeReleaseId: activeRelease.id,
      activeVersionIds: activeVersions.map((v) => v.id),
      latestAcceptance: mapAcceptance(latest),
    };
  }

  return {
    status: 'superseded_still_valid',
    activeReleaseId: activeRelease.id,
    activeVersionIds: activeVersions.map((v) => v.id),
    latestAcceptance: mapAcceptance(latest),
  };
}

export async function getAcceptanceByIdAdmin(acceptanceId: string) {
  const row = await prisma.legalAcceptance.findUnique({
    where: { id: acceptanceId },
    include: {
      legalDocumentVersion: true,
      release: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Acceptance not found');
  return {
    ...mapAcceptance(row),
    user: row.user,
    version: {
      id: row.legalDocumentVersion.id,
      title: row.legalDocumentVersion.title,
      language: row.legalDocumentVersion.language,
      status: row.legalDocumentVersion.status,
    },
    release: {
      id: row.release.id,
      version: row.release.version,
      requiresReacceptance: row.release.requiresReacceptance,
    },
  };
}
