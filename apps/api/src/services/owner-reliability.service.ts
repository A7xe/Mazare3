import {
  prisma,
  OwnerFinancialAdjustmentStatus,
  OwnerFinancialAdjustmentType,
  OwnerReliabilityCategory,
  type Prisma,
  type UserRole,
} from '@mazare3/db';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { resolveOwnerScope } from './owner-access.js';

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

export async function recordOwnerReliabilityIncident(params: {
  ownerProfileId: string;
  bookingId?: string;
  category: OwnerReliabilityCategory;
  reason: string;
  penaltyAmount?: number;
  tx?: Prisma.TransactionClient;
}) {
  const db = params.tx ?? prisma;
  return db.ownerReliabilityIncident.create({
    data: {
      ownerProfileId: params.ownerProfileId,
      bookingId: params.bookingId ?? null,
      category: params.category,
      reason: params.reason,
      penaltyAmount: params.penaltyAmount ?? null,
    },
  });
}

export async function createOwnerPenaltyAdjustment(params: {
  ownerProfileId: string;
  bookingId: string;
  amount: number;
  type: OwnerFinancialAdjustmentType;
  reason: string;
  tx?: Prisma.TransactionClient;
}) {
  if (params.amount <= 0) return null;
  const db = params.tx ?? prisma;
  return db.ownerFinancialAdjustment.create({
    data: {
      ownerProfileId: params.ownerProfileId,
      bookingId: params.bookingId,
      type: params.type,
      status: OwnerFinancialAdjustmentStatus.pending,
      amount: params.amount,
      reason: params.reason,
    },
  });
}

export async function listPendingAdjustmentsForOwner(ownerProfileId: string) {
  return prisma.ownerFinancialAdjustment.findMany({
    where: {
      ownerProfileId,
      status: OwnerFinancialAdjustmentStatus.pending,
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function sumPendingAdjustmentsForOwner(ownerProfileId: string): Promise<number> {
  const rows = await listPendingAdjustmentsForOwner(ownerProfileId);
  return rows.reduce((s, r) => s + decimalToNumber(r.amount), 0);
}

export async function applyPendingAdjustmentsToSettlement(params: {
  ownerProfileId: string;
  settlementId: string;
  maxDeductible: number;
  tx: Prisma.TransactionClient;
}): Promise<number> {
  const pending = await params.tx.ownerFinancialAdjustment.findMany({
    where: {
      ownerProfileId: params.ownerProfileId,
      status: OwnerFinancialAdjustmentStatus.pending,
    },
    orderBy: { createdAt: 'asc' },
  });

  let remaining = params.maxDeductible;
  let totalApplied = 0;
  const now = new Date();

  for (const adj of pending) {
    if (remaining <= 0) break;
    const amt = decimalToNumber(adj.amount);
    if (amt <= 0) continue;
    const applied = Math.min(amt, remaining);
    if (applied < amt) break;

    await params.tx.ownerFinancialAdjustment.update({
      where: { id: adj.id },
      data: {
        status: OwnerFinancialAdjustmentStatus.applied,
        settlementId: params.settlementId,
        appliedAt: now,
      },
    });
    totalApplied += applied;
    remaining -= applied;
  }

  return totalApplied;
}

export async function waiveOwnerPenaltyAdjustment(params: {
  adjustmentId: string;
  adminUserId: string;
  reason: string;
  req?: AuthenticatedRequest;
}) {
  const row = await prisma.ownerFinancialAdjustment.findUnique({ where: { id: params.adjustmentId } });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Adjustment not found');
  if (row.status !== OwnerFinancialAdjustmentStatus.pending) {
    throw new AppError(400, 'INVALID_STATUS', 'Only pending adjustments can be waived');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const adj = await tx.ownerFinancialAdjustment.update({
      where: { id: params.adjustmentId },
      data: {
        status: OwnerFinancialAdjustmentStatus.waived,
        waivedAt: new Date(),
        waivedByUserId: params.adminUserId,
        adminNote: params.reason,
      },
    });
    if (row.bookingId) {
      await tx.ownerReliabilityIncident.updateMany({
        where: { bookingId: row.bookingId, waived: false },
        data: {
          waived: true,
          waivedReason: params.reason,
          waivedAt: new Date(),
          waivedByUserId: params.adminUserId,
          category: OwnerReliabilityCategory.waived,
        },
      });
    }
    return adj;
  });

  await createAuditLog({
    actorUserId: params.adminUserId,
    action: 'owner_penalty.waived',
    entityType: 'owner_financial_adjustment',
    entityId: params.adjustmentId,
    metadata: { reason: params.reason, bookingId: row.bookingId },
    req: params.req,
  });

  return updated;
}

export async function hasOpenReliabilityBlock(bookingId: string): Promise<boolean> {
  const incident = await prisma.bookingIncident.findFirst({
    where: {
      bookingId,
      status: { in: ['open', 'under_review'] },
    },
  });
  return !!incident;
}

/** Owner-facing read-only financial adjustments (no adminNote). */
export async function listOwnerFinancialAdjustmentsForOwner(
  userId: string,
  role: UserRole,
): Promise<
  Array<{
    id: string;
    bookingId: string;
    bookingPublicCode: string | null;
    type: OwnerFinancialAdjustmentType;
    status: OwnerFinancialAdjustmentStatus;
    amount: number;
    currency: string;
    reason: string;
    createdAt: string;
    appliedAt: string | null;
    waivedAt: string | null;
    settlementId: string | null;
  }>
> {
  const scope = await resolveOwnerScope(userId, role);
  if (!scope.ownerProfileId) {
    throw new AppError(400, 'OWNER_SCOPE_REQUIRED', 'Adjustments are scoped to a partner account');
  }
  const rows = await prisma.ownerFinancialAdjustment.findMany({
    where: { ownerProfileId: scope.ownerProfileId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      booking: { select: { publicCode: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    bookingId: r.bookingId,
    bookingPublicCode: r.booking.publicCode,
    type: r.type,
    status: r.status,
    amount: decimalToNumber(r.amount),
    currency: r.currency,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
    appliedAt: r.appliedAt?.toISOString() ?? null,
    waivedAt: r.waivedAt?.toISOString() ?? null,
    settlementId: r.settlementId,
  }));
}
