import {
  LegalAcceptanceEvidenceSource,
  PartnerAgreementStatus,
  PartnerCommercialTermsStatus,
  prisma,
  type CommercialTermsAcceptance,
} from '@mazare3/db';
import type { RecordCommercialTermsAcceptanceInput } from '@mazare3/shared';
import { AppError } from '../../lib/errors.js';
import { createAuditLog } from '../audit.service.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { mapTermsRow, resolveCommercialTerms } from '../commercial-terms.service.js';

function mapAck(row: CommercialTermsAcceptance) {
  return {
    id: row.id,
    ownerProfileId: row.ownerProfileId,
    commercialTermsId: row.commercialTermsId,
    acceptedAt: row.acceptedAt.toISOString(),
    acceptedByUserId: row.acceptedByUserId,
    evidenceSource: row.evidenceSource,
    documentHash: row.documentHash,
    adminIssuerUserId: row.adminIssuerUserId,
  };
}

/**
 * Record owner commercial-terms acknowledgement.
 * Do not auto-backfill historical accepts.
 */
export async function recordOwnerAck(
  ownerProfileId: string,
  acceptedByUserId: string,
  input: RecordCommercialTermsAcceptanceInput,
  opts?: {
    evidenceSource?: LegalAcceptanceEvidenceSource;
    adminIssuerUserId?: string | null;
    metadata?: Record<string, unknown>;
    req?: AuthenticatedRequest;
  },
) {
  const terms = await prisma.partnerCommercialTerms.findUnique({
    where: { id: input.commercialTermsId },
  });
  if (!terms) {
    throw new AppError(404, 'NOT_FOUND', 'Commercial terms not found');
  }
  if (terms.ownerProfileId !== ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Commercial terms do not belong to this owner');
  }

  const evidenceSource =
    opts?.evidenceSource ?? LegalAcceptanceEvidenceSource.user_explicit_acceptance;

  try {
    const created = await prisma.commercialTermsAcceptance.create({
      data: {
        ownerProfileId,
        commercialTermsId: input.commercialTermsId,
        acceptedByUserId,
        evidenceSource,
        documentHash: input.documentHash ?? null,
        adminIssuerUserId: opts?.adminIssuerUserId ?? null,
        metadata: opts?.metadata
          ? ({ ...(opts.metadata), sourceSurface: input.sourceSurface } as object)
          : input.sourceSurface
            ? { sourceSurface: input.sourceSurface }
            : undefined,
      },
    });

    await createAuditLog({
      actorUserId: acceptedByUserId,
      action: 'legal.commercial_terms.accepted',
      entityType: 'commercial_terms_acceptance',
      entityId: created.id,
      metadata: {
        commercialTermsId: created.commercialTermsId,
        ownerProfileId,
        evidenceSource,
      },
      req: opts?.req,
    });

    return mapAck(created);
  } catch (err: unknown) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: string }).code)
        : '';
    if (code === 'P2002') {
      throw new AppError(
        409,
        'ALREADY_ACCEPTED',
        'Commercial terms already acknowledged for this owner',
      );
    }
    throw err;
  }
}

export async function listOwnerCommercialTermsAcceptances(ownerProfileId: string) {
  const rows = await prisma.commercialTermsAcceptance.findMany({
    where: { ownerProfileId },
    orderBy: { acceptedAt: 'desc' },
  });
  return rows.map(mapAck);
}

export type CommissionArrangementLabel = 'standard_18' | 'verified_15' | 'custom';

/**
 * Owner-facing commercial evidence summary (agreement + commission arrangement).
 * Does not invent rates — uses resolved PartnerCommercialTerms / platform defaults.
 */
export async function getOwnerLegalCommercialSummary(ownerProfileId: string) {
  const profile = await prisma.ownerProfile.findUnique({
    where: { id: ownerProfileId },
    include: {
      verificationProfile: { select: { verificationStatus: true } },
      agreementAcceptances: {
        include: { agreement: true },
        orderBy: { acceptedAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!profile) {
    throw new AppError(404, 'NOT_FOUND', 'Owner profile not found');
  }

  const activeAgreement = await prisma.partnerAgreement.findFirst({
    where: { status: PartnerAgreementStatus.active },
    orderBy: { effectiveAt: 'desc' },
  });
  const lastAccepted = profile.agreementAcceptances[0] ?? null;

  const verifiedProperty = await prisma.property.findFirst({
    where: {
      ownerId: ownerProfileId,
      verificationStatus: 'platform_verified',
    },
    select: { id: true },
  });

  const resolved = await resolveCommercialTerms({
    ownerProfileId,
    verificationStatus: verifiedProperty ? 'platform_verified' : null,
  });

  let arrangement: CommissionArrangementLabel = 'custom';
  if (resolved.source === 'platform_default') {
    arrangement = verifiedProperty ? 'verified_15' : 'standard_18';
  }

  let activeTermsRow: ReturnType<typeof mapTermsRow> | null = null;
  let customTermsAcceptanceMissing = false;
  let latestCustomAcceptance: ReturnType<typeof mapAck> | null = null;

  if (resolved.termsId) {
    const terms = await prisma.partnerCommercialTerms.findUnique({
      where: { id: resolved.termsId },
    });
    if (terms) {
      activeTermsRow = mapTermsRow(terms);
      const ack = await prisma.commercialTermsAcceptance.findFirst({
        where: { ownerProfileId, commercialTermsId: terms.id },
        orderBy: { acceptedAt: 'desc' },
      });
      if (ack) {
        latestCustomAcceptance = mapAck(ack);
      } else {
        customTermsAcceptanceMissing = true;
      }
    }
  }

  // Also flag draft/scheduled custom terms awaiting ack (readiness).
  const pendingCustom = await prisma.partnerCommercialTerms.findMany({
    where: {
      ownerProfileId,
      status: {
        in: [
          PartnerCommercialTermsStatus.draft,
          PartnerCommercialTermsStatus.scheduled,
          PartnerCommercialTermsStatus.active,
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  for (const row of pendingCustom) {
    const ack = await prisma.commercialTermsAcceptance.findFirst({
      where: { ownerProfileId, commercialTermsId: row.id },
    });
    if (
      !ack &&
      (row.status === PartnerCommercialTermsStatus.draft ||
        row.status === PartnerCommercialTermsStatus.scheduled)
    ) {
      customTermsAcceptanceMissing = true;
      break;
    }
  }

  return {
    ownerAgreement: activeAgreement
      ? {
          id: activeAgreement.id,
          version: activeAgreement.version,
          effectiveAt: activeAgreement.effectiveAt.toISOString(),
          acceptedAt: lastAccepted?.acceptedAt.toISOString() ?? null,
          acceptedVersion: lastAccepted?.agreement.version ?? null,
        }
      : null,
    commission: {
      arrangement,
      source: resolved.source,
      commissionPercent: resolved.commissionPercent,
      termsId: resolved.termsId,
      version: resolved.version,
      effectiveFrom: activeTermsRow?.effectiveFrom ?? null,
      effectiveTo: activeTermsRow?.effectiveTo ?? null,
      status: activeTermsRow?.status ?? null,
    },
    customTermsAcceptanceMissing,
    latestCustomAcceptance,
  };
}
