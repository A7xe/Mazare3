import {
  prisma,
  PartnerCommercialTermsStatus,
  type PartnerCommercialTerms,
} from '@mazare3/db';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { loadPaymentPolicyConfig } from '../config/payment-policy.config.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export type CommissionSourceName = 'property_terms' | 'owner_terms' | 'platform_default';

export type ResolvedCommercialTerms = {
  source: CommissionSourceName;
  commissionBps: number;
  commissionPercent: number;
  termsId: string | null;
  version: number | null;
  payoutDelayHours: number;
};

function bpsToPercent(bps: number): number {
  return Math.round((bps / 100) * 100) / 100;
}

function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

function rangesOverlap(
  aFrom: Date,
  aTo: Date | null,
  bFrom: Date,
  bTo: Date | null,
): boolean {
  const aEnd = aTo ?? new Date('9999-12-31T23:59:59.000Z');
  const bEnd = bTo ?? new Date('9999-12-31T23:59:59.000Z');
  return aFrom < bEnd && bFrom < aEnd;
}

export function mapTermsRow(row: PartnerCommercialTerms) {
  return {
    id: row.id,
    ownerProfileId: row.ownerProfileId,
    propertyId: row.propertyId,
    commissionBps: row.commissionBps,
    commissionPercent: bpsToPercent(row.commissionBps),
    payoutDelayHours: row.payoutDelayHours,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    status: row.status,
    version: row.version,
    internalNote: row.internalNote,
    createdAt: row.createdAt.toISOString(),
    activatedAt: row.activatedAt?.toISOString() ?? null,
  };
}

export async function resolveCommercialTerms(params: {
  ownerProfileId: string;
  propertyId?: string | null;
  verificationStatus?: string | null;
  at?: Date;
}): Promise<ResolvedCommercialTerms> {
  const at = params.at ?? new Date();
  const config = loadPaymentPolicyConfig();

  const active = await prisma.partnerCommercialTerms.findMany({
    where: {
      ownerProfileId: params.ownerProfileId,
      status: {
        in: [PartnerCommercialTermsStatus.active, PartnerCommercialTermsStatus.scheduled],
      },
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  return pickResolvedTerms(
    active,
    params.propertyId ?? null,
    config,
    at,
    params.verificationStatus ?? null,
  );
}

function resolvePlatformDefaultCommission(
  verificationStatus: string | null,
  config = loadPaymentPolicyConfig(),
): number {
  return verificationStatus === 'platform_verified'
    ? config.platformVerifiedCommissionPercent
    : config.platformCommissionPercent;
}

export function pickResolvedTerms(
  rows: PartnerCommercialTerms[],
  propertyId: string | null,
  config = loadPaymentPolicyConfig(),
  at = new Date(),
  verificationStatus: string | null = null,
): ResolvedCommercialTerms {
  const platformPercent = resolvePlatformDefaultCommission(verificationStatus, config);
  const defaultBps = percentToBps(platformPercent);
  const live = rows.filter(
    (t) =>
      t.status === PartnerCommercialTermsStatus.active &&
      t.effectiveFrom <= at &&
      (t.effectiveTo == null || t.effectiveTo > at),
  );

  if (propertyId) {
    const propertyTerm = live.find((t) => t.propertyId === propertyId);
    if (propertyTerm) {
      return {
        source: 'property_terms',
        commissionBps: propertyTerm.commissionBps,
        commissionPercent: bpsToPercent(propertyTerm.commissionBps),
        termsId: propertyTerm.id,
        version: propertyTerm.version,
        payoutDelayHours: propertyTerm.payoutDelayHours ?? config.ownerPayoutDelayHours,
      };
    }
  }

  const ownerTerm = live.find((t) => t.propertyId == null);
  if (ownerTerm) {
    return {
      source: 'owner_terms',
      commissionBps: ownerTerm.commissionBps,
      commissionPercent: bpsToPercent(ownerTerm.commissionBps),
      termsId: ownerTerm.id,
      version: ownerTerm.version,
      payoutDelayHours: ownerTerm.payoutDelayHours ?? config.ownerPayoutDelayHours,
    };
  }

  return {
    source: 'platform_default',
    commissionBps: defaultBps,
    commissionPercent: platformPercent,
    termsId: null,
    version: null,
    payoutDelayHours: config.ownerPayoutDelayHours,
  };
}

export async function listOwnerCommercialTerms(ownerProfileId: string) {
  return prisma.partnerCommercialTerms.findMany({
    where: { ownerProfileId },
    orderBy: { createdAt: 'desc' },
  });
}

async function assertNoOverlap(params: {
  ownerProfileId: string;
  propertyId: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  excludeId?: string;
}) {
  const existing = await prisma.partnerCommercialTerms.findMany({
    where: {
      ownerProfileId: params.ownerProfileId,
      propertyId: params.propertyId,
      id: params.excludeId ? { not: params.excludeId } : undefined,
      status: {
        in: [PartnerCommercialTermsStatus.active, PartnerCommercialTermsStatus.scheduled],
      },
    },
  });
  for (const row of existing) {
    if (!rangesOverlap(params.effectiveFrom, params.effectiveTo, row.effectiveFrom, row.effectiveTo)) {
      continue;
    }
    const succession =
      params.effectiveFrom > new Date() &&
      params.effectiveFrom >= row.effectiveFrom &&
      row.status === PartnerCommercialTermsStatus.active;
    if (succession) continue;
    throw new AppError(
      409,
      'COMMERCIAL_TERMS_OVERLAP',
      'Active or scheduled commercial terms overlap for this scope',
    );
  }
}

export async function createCommercialTerms(params: {
  actorUserId: string;
  ownerProfileId: string;
  input: {
    propertyId?: string | null;
    commissionPercent?: number;
    commissionBps?: number;
    payoutDelayHours?: number | null;
    effectiveFrom: string;
    effectiveTo?: string | null;
    internalNote?: string | null;
  };
  req?: AuthenticatedRequest;
}) {
  const bps =
    params.input.commissionBps ??
    (params.input.commissionPercent != null ? percentToBps(params.input.commissionPercent) : null);
  if (bps == null || !Number.isInteger(bps) || bps < 0 || bps > 10000) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Commission must be 0–100% (0–10000 bps)');
  }
  const effectiveFrom = new Date(params.input.effectiveFrom);
  const effectiveTo = params.input.effectiveTo ? new Date(params.input.effectiveTo) : null;
  if (Number.isNaN(effectiveFrom.getTime())) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid effectiveFrom');
  }
  if (effectiveTo && effectiveTo <= effectiveFrom) {
    throw new AppError(400, 'VALIDATION_ERROR', 'effectiveTo must be after effectiveFrom');
  }

  const last = await prisma.partnerCommercialTerms.findFirst({
    where: { ownerProfileId: params.ownerProfileId, propertyId: params.input.propertyId ?? null },
    orderBy: { version: 'desc' },
  });

  const created = await prisma.partnerCommercialTerms.create({
    data: {
      ownerProfileId: params.ownerProfileId,
      propertyId: params.input.propertyId ?? null,
      commissionBps: bps,
      payoutDelayHours: params.input.payoutDelayHours ?? null,
      effectiveFrom,
      effectiveTo,
      status: PartnerCommercialTermsStatus.draft,
      version: (last?.version ?? 0) + 1,
      internalNote: params.input.internalNote?.trim() || null,
      createdByUserId: params.actorUserId,
    },
  });

  await createAuditLog({
    actorUserId: params.actorUserId,
    action: 'admin.commercial_terms_created',
    entityType: 'partner_commercial_terms',
    entityId: created.id,
    metadata: { ownerProfileId: params.ownerProfileId, commissionBps: bps },
    req: params.req,
  });

  return mapTermsRow(created);
}

export async function activateCommercialTerms(params: {
  actorUserId: string;
  ownerProfileId: string;
  termsId: string;
  req?: AuthenticatedRequest;
}) {
  const row = await prisma.partnerCommercialTerms.findFirst({
    where: { id: params.termsId, ownerProfileId: params.ownerProfileId },
  });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Commercial terms not found');
  if (
    row.status !== PartnerCommercialTermsStatus.draft &&
    row.status !== PartnerCommercialTermsStatus.scheduled
  ) {
    throw new AppError(409, 'CANNOT_ACTIVATE', 'Only draft or scheduled terms can be activated');
  }

  const now = new Date();
  const becomesActive = row.effectiveFrom <= now;
  const nextStatus = becomesActive
    ? PartnerCommercialTermsStatus.active
    : PartnerCommercialTermsStatus.scheduled;

  await assertNoOverlap({
    ownerProfileId: row.ownerProfileId,
    propertyId: row.propertyId,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    excludeId: row.id,
  });

  await prisma.$transaction(async (tx) => {
    if (becomesActive) {
      await tx.partnerCommercialTerms.updateMany({
        where: {
          ownerProfileId: row.ownerProfileId,
          propertyId: row.propertyId,
          status: PartnerCommercialTermsStatus.active,
          id: { not: row.id },
        },
        data: {
          status: PartnerCommercialTermsStatus.superseded,
          effectiveTo: row.effectiveFrom,
        },
      });
    }
    await tx.partnerCommercialTerms.update({
      where: { id: row.id },
      data: {
        status: nextStatus,
        activatedAt: now,
        activatedByUserId: params.actorUserId,
      },
    });
  });

  await createAuditLog({
    actorUserId: params.actorUserId,
    action: 'admin.commercial_terms_activated',
    entityType: 'partner_commercial_terms',
    entityId: row.id,
    metadata: { status: nextStatus, ownerProfileId: params.ownerProfileId },
    req: params.req,
  });

  const updated = await prisma.partnerCommercialTerms.findUniqueOrThrow({ where: { id: row.id } });
  return mapTermsRow(updated);
}

export { bpsToPercent, percentToBps };
