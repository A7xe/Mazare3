import {
  FounderApprovalStatus,
  LegalDocumentStatus,
  LegalDocumentType,
  LegalReviewStatus,
  prisma,
  type LegalDocumentVersion,
  type LegalRelease,
  type Prisma,
} from '@mazare3/db';
import {
  hashLegalContent,
  LEGAL_BOOTSTRAP_CHANGELOG,
  LEGAL_REVIEW_BANNER,
  type CreateLegalDraftReleaseInput,
  type LegalLanguage,
  type PatchLegalReleaseGovernanceInput,
  type UpdateLegalDraftReleaseInput,
} from '@mazare3/shared';
import { AppError } from '../../lib/errors.js';
import { createAuditLog } from '../audit.service.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';

export type LegalReleaseWithVersions = LegalRelease & {
  versions: LegalDocumentVersion[];
};

function mapVersion(v: LegalDocumentVersion) {
  return {
    id: v.id,
    releaseId: v.releaseId,
    documentType: v.documentType,
    version: v.version,
    language: v.language,
    title: v.title,
    content: v.content,
    contentHash: v.contentHash,
    status: v.status,
    publishedAt: v.publishedAt?.toISOString() ?? null,
    effectiveAt: v.effectiveAt?.toISOString() ?? null,
    supersededAt: v.supersededAt?.toISOString() ?? null,
    createdAt: v.createdAt.toISOString(),
    sourceRef: v.sourceRef,
  };
}

function mapRelease(r: LegalReleaseWithVersions) {
  return {
    id: r.id,
    documentType: r.documentType,
    version: r.version,
    status: r.status,
    requiresReacceptance: r.requiresReacceptance,
    materialChange: r.materialChange,
    changelog: r.changelog,
    summaryOfChanges: r.summaryOfChanges,
    effectiveAt: r.effectiveAt?.toISOString() ?? null,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    supersededAt: r.supersededAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    createdByUserId: r.createdByUserId,
    legalReviewStatus: r.legalReviewStatus,
    legalReviewedAt: r.legalReviewedAt?.toISOString() ?? null,
    legalReviewReference: r.legalReviewReference,
    legalReviewNote: r.legalReviewNote,
    founderApprovalStatus: r.founderApprovalStatus,
    founderApprovedAt: r.founderApprovedAt?.toISOString() ?? null,
    founderApprovalNote: r.founderApprovalNote,
    versions: r.versions.map(mapVersion),
  };
}

export async function assertNoConflictingActive(
  documentType: LegalDocumentType,
  language: string,
  excludeVersionId?: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  const existing = await tx.legalDocumentVersion.findFirst({
    where: {
      documentType,
      language,
      status: LegalDocumentStatus.active,
      ...(excludeVersionId ? { id: { not: excludeVersionId } } : {}),
    },
  });
  if (existing) {
    throw new AppError(
      409,
      'CONFLICTING_ACTIVE_LEGAL_VERSION',
      `An active ${documentType} version already exists for language ${language}`,
      { existingVersionId: existing.id },
    );
  }
}

export async function createDraftRelease(
  input: CreateLegalDraftReleaseInput,
  createdByUserId?: string | null,
  req?: AuthenticatedRequest,
): Promise<ReturnType<typeof mapRelease>> {
  const langs = new Set(input.versions.map((v) => v.language));
  if (langs.size !== input.versions.length) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Duplicate language in draft versions');
  }

  const release = await prisma.$transaction(async (tx) => {
    const created = await tx.legalRelease.create({
      data: {
        documentType: input.documentType as LegalDocumentType,
        version: input.version,
        status: LegalDocumentStatus.draft,
        requiresReacceptance: input.requiresReacceptance ?? false,
        materialChange: input.materialChange ?? false,
        changelog: input.changelog ?? null,
        summaryOfChanges: input.summaryOfChanges ?? null,
        effectiveAt: input.effectiveAt ? new Date(input.effectiveAt) : null,
        createdByUserId: createdByUserId ?? null,
        versions: {
          create: input.versions.map((v) => ({
            documentType: input.documentType as LegalDocumentType,
            version: input.version,
            language: v.language,
            title: v.title,
            content: v.content,
            contentHash: hashLegalContent(v.content),
            status: LegalDocumentStatus.draft,
            sourceRef: v.sourceRef ?? null,
            createdByUserId: createdByUserId ?? null,
            effectiveAt: input.effectiveAt ? new Date(input.effectiveAt) : null,
          })),
        },
      },
      include: { versions: true },
    });
    return created;
  });

  await createAuditLog({
    actorUserId: createdByUserId,
    action: 'legal.release.draft_created',
    entityType: 'legal_release',
    entityId: release.id,
    metadata: { documentType: release.documentType, version: release.version },
    req,
  });

  return mapRelease(release);
}

export async function updateDraft(
  releaseId: string,
  input: UpdateLegalDraftReleaseInput,
  actorUserId?: string | null,
  req?: AuthenticatedRequest,
): Promise<ReturnType<typeof mapRelease>> {
  const existing = await prisma.legalRelease.findUnique({
    where: { id: releaseId },
    include: { versions: true },
  });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Legal release not found');
  if (existing.status !== LegalDocumentStatus.draft) {
    throw new AppError(400, 'NOT_DRAFT', 'Only draft releases can be updated');
  }

  const release = await prisma.$transaction(async (tx) => {
    if (input.versions) {
      const langs = new Set(input.versions.map((v) => v.language));
      if (langs.size !== input.versions.length) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Duplicate language in draft versions');
      }
      await tx.legalDocumentVersion.deleteMany({ where: { releaseId } });
      await tx.legalDocumentVersion.createMany({
        data: input.versions.map((v) => ({
          releaseId,
          documentType: existing.documentType,
          version: existing.version,
          language: v.language,
          title: v.title,
          content: v.content,
          contentHash: hashLegalContent(v.content),
          status: LegalDocumentStatus.draft,
          sourceRef: v.sourceRef ?? null,
          createdByUserId: actorUserId ?? null,
          effectiveAt: input.effectiveAt
            ? new Date(input.effectiveAt)
            : existing.effectiveAt,
        })),
      });
    }

    return tx.legalRelease.update({
      where: { id: releaseId },
      data: {
        requiresReacceptance: input.requiresReacceptance,
        materialChange: input.materialChange,
        changelog: input.changelog === undefined ? undefined : input.changelog,
        summaryOfChanges:
          input.summaryOfChanges === undefined ? undefined : input.summaryOfChanges,
        effectiveAt:
          input.effectiveAt === undefined
            ? undefined
            : input.effectiveAt
              ? new Date(input.effectiveAt)
              : null,
      },
      include: { versions: true },
    });
  });

  await createAuditLog({
    actorUserId,
    action: 'legal.release.draft_updated',
    entityType: 'legal_release',
    entityId: releaseId,
    req,
  });

  return mapRelease(release);
}

/**
 * Publish: OLD active → SUPERSEDED, NEW → ACTIVE.
 * Cannot update content of active/superseded (enforced by updateDraft gate).
 */
/**
 * Publish a draft/scheduled release to ACTIVE (local/admin path).
 *
 * Phase 3C.2 note — future Production activation path MUST additionally require:
 *   legalReviewStatus ∈ { approved, approved_with_changes }
 *   AND founderApprovalStatus === approved
 * before activating counsel-reviewed corpus in Production.
 * This phase does NOT enforce that gate yet and does NOT activate Production.
 */
export async function publishRelease(
  releaseId: string,
  effectiveAt?: string | null,
  actorUserId?: string | null,
  req?: AuthenticatedRequest,
): Promise<ReturnType<typeof mapRelease>> {
  const release = await prisma.legalRelease.findUnique({
    where: { id: releaseId },
    include: { versions: true },
  });
  if (!release) throw new AppError(404, 'NOT_FOUND', 'Legal release not found');
  if (
    release.status !== LegalDocumentStatus.draft &&
    release.status !== LegalDocumentStatus.scheduled
  ) {
    throw new AppError(400, 'NOT_PUBLISHABLE', 'Only draft or scheduled releases can be published');
  }
  if (release.versions.length === 0) {
    throw new AppError(400, 'NO_VERSIONS', 'Release has no language versions');
  }

  const now = new Date();
  const eff = effectiveAt ? new Date(effectiveAt) : release.effectiveAt ?? now;

  const published = await prisma.$transaction(async (tx) => {
    const priorActive = await tx.legalRelease.findMany({
      where: {
        documentType: release.documentType,
        status: LegalDocumentStatus.active,
        id: { not: releaseId },
      },
      include: { versions: true },
    });

    for (const prior of priorActive) {
      await tx.legalRelease.update({
        where: { id: prior.id },
        data: { status: LegalDocumentStatus.superseded, supersededAt: now },
      });
      await tx.legalDocumentVersion.updateMany({
        where: { releaseId: prior.id, status: LegalDocumentStatus.active },
        data: { status: LegalDocumentStatus.superseded, supersededAt: now },
      });
    }

    for (const v of release.versions) {
      await assertNoConflictingActive(release.documentType, v.language, v.id, tx);
    }

    await tx.legalDocumentVersion.updateMany({
      where: { releaseId },
      data: {
        status: LegalDocumentStatus.active,
        publishedAt: now,
        effectiveAt: eff,
        supersededAt: null,
      },
    });

    return tx.legalRelease.update({
      where: { id: releaseId },
      data: {
        status: LegalDocumentStatus.active,
        publishedAt: now,
        effectiveAt: eff,
        supersededAt: null,
      },
      include: { versions: true },
    });
  });

  await createAuditLog({
    actorUserId,
    action: 'legal.release.published',
    entityType: 'legal_release',
    entityId: releaseId,
    metadata: {
      documentType: published.documentType,
      version: published.version,
      versionIds: published.versions.map((v) => v.id),
    },
    req,
  });

  return mapRelease(published);
}

export async function scheduleRelease(
  releaseId: string,
  effectiveAt: string,
  actorUserId?: string | null,
  req?: AuthenticatedRequest,
): Promise<ReturnType<typeof mapRelease>> {
  const release = await prisma.legalRelease.findUnique({
    where: { id: releaseId },
    include: { versions: true },
  });
  if (!release) throw new AppError(404, 'NOT_FOUND', 'Legal release not found');
  if (release.status !== LegalDocumentStatus.draft) {
    throw new AppError(400, 'NOT_DRAFT', 'Only draft releases can be scheduled');
  }

  const eff = new Date(effectiveAt);
  const updated = await prisma.$transaction(async (tx) => {
    await tx.legalDocumentVersion.updateMany({
      where: { releaseId },
      data: { status: LegalDocumentStatus.scheduled, effectiveAt: eff },
    });
    return tx.legalRelease.update({
      where: { id: releaseId },
      data: { status: LegalDocumentStatus.scheduled, effectiveAt: eff },
      include: { versions: true },
    });
  });

  await createAuditLog({
    actorUserId,
    action: 'legal.release.scheduled',
    entityType: 'legal_release',
    entityId: releaseId,
    metadata: { effectiveAt: eff.toISOString() },
    req,
  });

  return mapRelease(updated);
}

export async function getActiveVersion(
  documentType: LegalDocumentType | string,
  language: LegalLanguage,
) {
  const version = await prisma.legalDocumentVersion.findFirst({
    where: {
      documentType: documentType as LegalDocumentType,
      language,
      status: LegalDocumentStatus.active,
    },
    orderBy: { publishedAt: 'desc' },
  });
  return version ? mapVersion(version) : null;
}

export async function getVersionById(versionId: string) {
  const version = await prisma.legalDocumentVersion.findUnique({ where: { id: versionId } });
  return version ? mapVersion(version) : null;
}

export async function listVersions(params: {
  documentType?: string;
  language?: string;
  status?: string;
}) {
  const versions = await prisma.legalDocumentVersion.findMany({
    where: {
      ...(params.documentType
        ? { documentType: params.documentType as LegalDocumentType }
        : {}),
      ...(params.language ? { language: params.language } : {}),
      ...(params.status ? { status: params.status as LegalDocumentStatus } : {}),
    },
    orderBy: [{ documentType: 'asc' }, { version: 'desc' }, { language: 'asc' }],
  });
  return versions.map(mapVersion);
}

export async function listReleases(documentType?: string) {
  const releases = await prisma.legalRelease.findMany({
    where: documentType
      ? { documentType: documentType as LegalDocumentType }
      : undefined,
    include: { versions: true },
    orderBy: [{ documentType: 'asc' }, { createdAt: 'desc' }],
  });
  return releases.map(mapRelease);
}

export async function getReleaseById(releaseId: string) {
  const release = await prisma.legalRelease.findUnique({
    where: { id: releaseId },
    include: { versions: true },
  });
  return release ? mapRelease(release) : null;
}

/** Bootstrap ACTIVE placeholders — never creates user acceptances. */
export async function bootstrapPlaceholderReleases(
  docs: Array<{
    documentType: LegalDocumentType;
    version?: string;
    versions: Array<{ language: LegalLanguage; title: string; content: string; sourceRef?: string }>;
  }>,
  actorUserId?: string | null,
): Promise<ReturnType<typeof mapRelease>[]> {
  const appEnv = (process.env.APP_ENV ?? '').trim().toLowerCase();
  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  if (appEnv === 'production' || nodeEnv === 'production') {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Bootstrap placeholder legal releases are forbidden in production',
    );
  }

  const results: ReturnType<typeof mapRelease>[] = [];
  for (const doc of docs) {
    const existingActive = await prisma.legalRelease.findFirst({
      where: { documentType: doc.documentType, status: LegalDocumentStatus.active },
    });
    if (existingActive) continue;

    const version = doc.version ?? '1.0.0-placeholder';
    const withBanner = doc.versions.map((v) => ({
      ...v,
      content: v.content.includes(LEGAL_REVIEW_BANNER)
        ? v.content
        : `${LEGAL_REVIEW_BANNER}\n\n${v.content}`,
    }));

    const draft = await createDraftRelease(
      {
        documentType: doc.documentType,
        version,
        requiresReacceptance: false,
        materialChange: false,
        changelog: LEGAL_BOOTSTRAP_CHANGELOG,
        summaryOfChanges: LEGAL_BOOTSTRAP_CHANGELOG,
        versions: withBanner,
      },
      actorUserId,
    );
    results.push(await publishRelease(draft.id, null, actorUserId));
  }
  return results;
}

/**
 * Patch counsel/founder governance on a release. Requires reason; audited.
 * Does not activate Production. Future Production activation must require
 * legalReviewStatus approved|approved_with_changes and founderApprovalStatus approved.
 */
export async function updateReleaseGovernance(
  releaseId: string,
  input: PatchLegalReleaseGovernanceInput,
  actorUserId?: string | null,
  req?: AuthenticatedRequest,
): Promise<ReturnType<typeof mapRelease>> {
  const existing = await prisma.legalRelease.findUnique({
    where: { id: releaseId },
    include: { versions: true },
  });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Legal release not found');

  const now = new Date();
  const data: Prisma.LegalReleaseUpdateInput = {};

  if (input.legalReviewStatus !== undefined) {
    data.legalReviewStatus = input.legalReviewStatus as LegalReviewStatus;
    if (
      input.legalReviewStatus === 'approved' ||
      input.legalReviewStatus === 'approved_with_changes' ||
      input.legalReviewStatus === 'rejected'
    ) {
      data.legalReviewedAt = now;
    }
  }
  if (input.legalReviewReference !== undefined) {
    data.legalReviewReference = input.legalReviewReference;
  }
  if (input.legalReviewNote !== undefined) {
    data.legalReviewNote = input.legalReviewNote;
  }
  if (input.founderApprovalStatus !== undefined) {
    data.founderApprovalStatus = input.founderApprovalStatus as FounderApprovalStatus;
    if (
      input.founderApprovalStatus === 'approved' ||
      input.founderApprovalStatus === 'rejected'
    ) {
      data.founderApprovedAt = now;
    }
  }
  if (input.founderApprovalNote !== undefined) {
    data.founderApprovalNote = input.founderApprovalNote;
  }

  const updated = await prisma.legalRelease.update({
    where: { id: releaseId },
    data,
    include: { versions: true },
  });

  await createAuditLog({
    actorUserId,
    action: 'legal.release.governance_updated',
    entityType: 'legal_release',
    entityId: releaseId,
    metadata: {
      reason: input.reason,
      before: {
        legalReviewStatus: existing.legalReviewStatus,
        founderApprovalStatus: existing.founderApprovalStatus,
      },
      after: {
        legalReviewStatus: updated.legalReviewStatus,
        founderApprovalStatus: updated.founderApprovalStatus,
        legalReviewReference: updated.legalReviewReference,
      },
      documentType: updated.documentType,
      version: updated.version,
    },
    req,
  });

  return mapRelease(updated);
}
