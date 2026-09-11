import {
  prisma,
  BookingStatus,
  OwnerPayoutRecordStatus,
  OwnerSettlementStatus,
  OwnerStatus,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  RefundStatus,
} from '@mazare3/db';
import type {
  CreateOwnerSettlementInput,
  MarkOwnerSettlementPaidInput,
  OwnerSettlementCycleInfo,
  OwnerSettlementGenerateResult,
  OwnerSettlementPreview,
  OwnerSettlementSummary,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { getBookingOperationsBlocks } from '../lib/operations-blocking.js';
import { classifyPayoutEligibility } from '../lib/payout-eligibility.js';
import { assertOwnerHasReviewedPayoutDestination } from '../lib/owner-payout-readiness.js';
import { computePayoutAvailableAt } from './payment-policy.service.js';
import { notifySettlementPaid, notifySettlementReady } from './notification.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { resolveOwnerScope } from './owner-access.js';
import type { UserRole } from '@mazare3/db';
import { getSettlementCycleDays } from '../config/settlement-cycle-config.js';
import { getDueSettlementPeriod } from '../lib/settlement-cycle.js';
import { isInternalQaRoutesEnabled } from '../lib/qa-mode.js';

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatDateOnly(date: Date): string {
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0) {
    return date.toISOString().slice(0, 10);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseThrough(through: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(through)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'through must be YYYY-MM-DD');
  }
  const d = new Date(`${through}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid through date');
  }
  return d;
}

const paymentInclude = {
  booking: {
    select: {
      status: true,
      paymentState: true,
      bookingStartAt: true,
      publicCode: true,
      property: { select: { ownerId: true, slug: true } },
      slot: { select: { date: true } },
    },
  },
  payoutRecord: true,
} as const;

type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

async function reservedPaymentIds(ownerId: string, exceptSettlementId?: string): Promise<Set<string>> {
  const rows = await prisma.ownerSettlementItem.findMany({
    where: {
      releasedAt: null,
      settlement: {
        ownerId,
        status: { in: [OwnerSettlementStatus.draft, OwnerSettlementStatus.ready, OwnerSettlementStatus.paid] },
        ...(exceptSettlementId ? { id: { not: exceptSettlementId } } : {}),
      },
    },
    select: { paymentId: true },
  });
  return new Set(rows.map((r) => r.paymentId));
}

function snapshotAmounts(p: PaymentRow) {
  return {
    bookingTotalAmount: decimalToNumber(p.bookingTotalAmount),
    platformCommissionAmount: decimalToNumber(p.platformCommissionAmount),
    ownerNetPayoutAmount: decimalToNumber(p.ownerNetPayoutAmount),
    refundAdjustmentAmount: p.cancellationRefundAmount != null ? decimalToNumber(p.cancellationRefundAmount) : 0,
  };
}

async function loadOwnerPayments(ownerId: string, through: Date, from?: Date) {
  const slotFilter = { date: { lte: through, ...(from ? { gte: from } : {}) } };
  return prisma.payment.findMany({
    where: {
      status: PaymentStatus.succeeded,
      booking: {
        property: { ownerId },
        slot: slotFilter,
      },
      OR: [
        // Normal completed bookings: balance / full only
        {
          purpose: { not: 'deposit' },
          booking: { status: { not: BookingStatus.cancelled } },
        },
        // Phase 1: cancelled bookings with retained owner compensation (incl. deposit-only)
        {
          booking: { status: BookingStatus.cancelled },
          cancellationPenaltyAmount: { gt: 0 },
          ownerNetPayoutAmount: { gt: 0 },
          refundStatus: { in: [RefundStatus.none, RefundStatus.processed, RefundStatus.rejected] },
        },
      ],
    },
    include: paymentInclude,
  });
}

function classifyRow(
  p: PaymentRow,
  block: { blocked: boolean; reason: string | null },
  reserved: boolean,
  through: Date,
) {
  const slotDate = p.booking.slot.date;
  const retained =
    p.cancellationPenaltyAmount != null ? decimalToNumber(p.cancellationPenaltyAmount) : 0;
  const ownerNet = decimalToNumber(p.ownerNetPayoutAmount);
  const isCancellationRetention =
    p.booking.status === BookingStatus.cancelled && retained > 0 && ownerNet > 0;

  if (!isCancellationRetention && slotDate > through) {
    return {
      eligible: false as const,
      reason: 'visit_not_passed',
      payoutStatus: PayoutStatus.pending,
    };
  }
  return classifyPayoutEligibility({
    purpose: p.purpose,
    paymentStatus: p.status,
    bookingStatus: p.booking.status,
    paymentState: p.booking.paymentState,
    refundStatus: p.refundStatus,
    slotDate,
    bookingStartAt: p.booking.bookingStartAt ?? null,
    payoutAvailableAt: p.payoutAvailableAt ?? computePayoutAvailableAt(slotDate),
    ownerPayoutRecordStatus: p.payoutRecord?.status ?? null,
    ownerNetPayoutAmount: ownerNet,
    cancellationPenaltyAmount: retained > 0 ? retained : null,
    operationsBlock: block,
    reservedInOtherSettlement: reserved,
  });
}

export async function previewOwnerSettlement(
  ownerId: string,
  throughRaw: string,
  fromRaw?: string,
): Promise<OwnerSettlementPreview> {
  const through = parseThrough(throughRaw);
  const from = fromRaw ? parseThrough(fromRaw) : undefined;
  const owner = await prisma.ownerProfile.findUnique({ where: { id: ownerId }, select: { id: true } });
  if (!owner) throw new AppError(404, 'NOT_FOUND', 'Partner not found');

  const payments = await loadOwnerPayments(ownerId, through, from);
  const blocks = await getBookingOperationsBlocks(payments.map((p) => p.bookingId));
  const reserved = await reservedPaymentIds(ownerId);

  const eligible = [];
  const excluded = [];
  for (const p of payments) {
    const verdict = classifyRow(
      p,
      blocks.get(p.bookingId) ?? { blocked: false, reason: null },
      reserved.has(p.id),
      through,
    );
    const snaps = snapshotAmounts(p);
    if (verdict.eligible) {
      eligible.push({
        paymentId: p.id,
        bookingId: p.bookingId,
        publicCode: p.booking.publicCode,
        bookingDate: formatDateOnly(p.booking.slot.date),
        currency: p.currency,
        ...snaps,
      });
    } else if (verdict.reason && verdict.reason !== 'deposit_payment') {
      excluded.push({
        paymentId: p.id,
        bookingId: p.bookingId,
        publicCode: p.booking.publicCode,
        reason: verdict.reason,
      });
    }
  }

  const grossBookingAmount = roundMoney(eligible.reduce((s, i) => s + i.bookingTotalAmount, 0));
  const platformCommissionTotal = roundMoney(eligible.reduce((s, i) => s + i.platformCommissionAmount, 0));
  const refundAdjustmentTotal = roundMoney(eligible.reduce((s, i) => s + i.refundAdjustmentAmount, 0));
  const ownerNetAmount = roundMoney(eligible.reduce((s, i) => s + i.ownerNetPayoutAmount, 0));
  const dates = eligible.map((i) => i.bookingDate).sort();

  return {
    ownerId,
    through: throughRaw,
    periodStart: fromRaw ?? dates[0] ?? null,
    periodEnd: throughRaw,
    eligibleCount: eligible.length,
    excludedCount: excluded.length,
    grossBookingAmount,
    platformCommissionTotal,
    refundAdjustmentTotal,
    ownerNetAmount,
    currency: eligible[0]?.currency ?? 'JOD',
    items: eligible,
    excluded,
  };
}

function mapSettlement(
  row: {
    id: string;
    ownerId: string;
    periodStart: Date;
    periodEnd: Date;
    status: OwnerSettlementStatus;
    itemCount: number;
    grossBookingAmount: Prisma.Decimal | number;
    platformCommissionTotal: Prisma.Decimal | number;
    refundAdjustmentTotal: Prisma.Decimal | number;
    ownerNetAmount: Prisma.Decimal | number;
    currency: string;
    createdAt: Date;
    finalizedAt: Date | null;
    paidAt: Date | null;
    paymentReference: string | null;
    adminNote: string | null;
    items?: Array<{
      id: string;
      payoutId: string;
      paymentId: string;
      bookingId: string;
      publicCode: string;
      bookingDate: Date;
      bookingTotalAmount: Prisma.Decimal | number;
      platformCommissionAmount: Prisma.Decimal | number;
      ownerNetPayoutAmount: Prisma.Decimal | number;
      payoutAmount: Prisma.Decimal | number;
      refundAdjustmentAmount: Prisma.Decimal | number;
    }>;
  },
  includeAdminNote: boolean,
): OwnerSettlementSummary {
  return {
    id: row.id,
    ownerId: row.ownerId,
    periodStart: formatDateOnly(row.periodStart),
    periodEnd: formatDateOnly(row.periodEnd),
    status: row.status,
    itemCount: row.itemCount,
    grossBookingAmount: decimalToNumber(row.grossBookingAmount),
    platformCommissionTotal: decimalToNumber(row.platformCommissionTotal),
    refundAdjustmentTotal: decimalToNumber(row.refundAdjustmentTotal),
    ownerNetAmount: decimalToNumber(row.ownerNetAmount),
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
    finalizedAt: row.finalizedAt?.toISOString() ?? null,
    paidAt: row.paidAt?.toISOString() ?? null,
    paymentReference: row.paymentReference,
    adminNote: includeAdminNote ? row.adminNote : undefined,
    items: row.items?.map((i) => ({
      id: i.id,
      payoutId: i.payoutId,
      paymentId: i.paymentId,
      bookingId: i.bookingId,
      publicCode: i.publicCode,
      bookingDate: formatDateOnly(i.bookingDate),
      bookingTotalAmount: decimalToNumber(i.bookingTotalAmount),
      platformCommissionAmount: decimalToNumber(i.platformCommissionAmount),
      ownerNetPayoutAmount: decimalToNumber(i.ownerNetPayoutAmount),
      payoutAmount: decimalToNumber(i.payoutAmount),
      refundAdjustmentAmount: decimalToNumber(i.refundAdjustmentAmount),
    })),
  };
}

export async function createOwnerSettlement(
  adminUserId: string | null,
  ownerId: string,
  input: CreateOwnerSettlementInput,
  req?: AuthenticatedRequest,
  cycleWindow?: { periodStart: string; periodEnd: string },
): Promise<OwnerSettlementSummary> {
  const throughRaw = cycleWindow?.periodEnd ?? input.through;
  const preview = await previewOwnerSettlement(ownerId, throughRaw, cycleWindow?.periodStart);
  if (preview.eligibleCount === 0) {
    throw new AppError(400, 'NO_ELIGIBLE_PAYOUTS', 'No eligible payouts for this cutoff');
  }

  if (cycleWindow) {
    const existing = await prisma.ownerSettlement.findFirst({
      where: {
        ownerId,
        periodStart: parseThrough(cycleWindow.periodStart),
        periodEnd: parseThrough(cycleWindow.periodEnd),
        status: { in: [OwnerSettlementStatus.draft, OwnerSettlementStatus.ready, OwnerSettlementStatus.paid] },
      },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(409, 'SETTLEMENT_PERIOD_EXISTS', 'A settlement already exists for this cycle');
    }
  }

  const through = parseThrough(throughRaw);
  const periodStart = parseThrough(preview.periodStart ?? throughRaw);

  const payments = await prisma.payment.findMany({
    where: { id: { in: preview.items.map((i) => i.paymentId) } },
    include: paymentInclude,
  });
  const blocks = await getBookingOperationsBlocks(payments.map((p) => p.bookingId));
  const reserved = await reservedPaymentIds(ownerId);

  const eligiblePayments: PaymentRow[] = [];
  for (const p of payments) {
    const verdict = classifyRow(
      p,
      blocks.get(p.bookingId) ?? { blocked: false, reason: null },
      reserved.has(p.id),
      through,
    );
    if (!verdict.eligible) {
      throw new AppError(409, 'PAYOUT_NOT_ELIGIBLE', 'An item is no longer eligible for settlement');
    }
    eligiblePayments.push(p);
  }

  const payoutIds = new Map<string, string>();
  for (const p of eligiblePayments) {
    const snaps = snapshotAmounts(p);
    if (p.payoutRecord) {
      if (p.payoutRecord.status !== OwnerPayoutRecordStatus.paid) {
        await prisma.ownerPayout.update({
          where: { id: p.payoutRecord.id },
          data: { status: OwnerPayoutRecordStatus.eligible, amount: snaps.ownerNetPayoutAmount },
        });
      }
      payoutIds.set(p.id, p.payoutRecord.id);
    } else {
      const createdPayout = await prisma.ownerPayout.create({
        data: {
          ownerId,
          paymentId: p.id,
          bookingId: p.bookingId,
          amount: snaps.ownerNetPayoutAmount,
          currency: p.currency,
          status: OwnerPayoutRecordStatus.eligible,
          periodFrom: p.booking.slot.date,
          periodTo: p.booking.slot.date,
        },
      });
      payoutIds.set(p.id, createdPayout.id);
    }
  }

  let settlement;
  try {
    settlement = await prisma.$transaction(
      async (tx) => {
        const created = await tx.ownerSettlement.create({
          data: {
            ownerId,
            periodStart,
            periodEnd: through,
            status: OwnerSettlementStatus.draft,
            itemCount: eligiblePayments.length,
            grossBookingAmount: preview.grossBookingAmount,
            platformCommissionTotal: preview.platformCommissionTotal,
            refundAdjustmentTotal: preview.refundAdjustmentTotal,
            ownerNetAmount: preview.ownerNetAmount,
            currency: 'JOD',
            adminNote: input.adminNote?.trim() || null,
          },
        });

        await tx.ownerSettlementItem.createMany({
          data: eligiblePayments.map((p) => {
            const snaps = snapshotAmounts(p);
            return {
              settlementId: created.id,
              payoutId: payoutIds.get(p.id)!,
              paymentId: p.id,
              bookingId: p.bookingId,
              publicCode: p.booking.publicCode,
              bookingDate: p.booking.slot.date,
              bookingTotalAmount: snaps.bookingTotalAmount,
              platformCommissionAmount: snaps.platformCommissionAmount,
              ownerNetPayoutAmount: snaps.ownerNetPayoutAmount,
              payoutAmount: snaps.ownerNetPayoutAmount,
              refundAdjustmentAmount: snaps.refundAdjustmentAmount,
            };
          }),
        });

        return tx.ownerSettlement.findUniqueOrThrow({
          where: { id: created.id },
          include: { items: true },
        });
      },
      { timeout: 20000 },
    );
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      throw new AppError(409, 'SETTLEMENT_PERIOD_EXISTS', 'A settlement already exists for this cycle');
    }
    throw err;
  }

  await createAuditLog({
    actorUserId: adminUserId,
    action: cycleWindow ? 'settlement.cycle_generated' : 'settlement.created',
    entityType: 'owner_settlement',
    entityId: settlement.id,
    metadata: { ownerId, through: throughRaw, itemCount: settlement.itemCount },
    req,
  });

  return mapSettlement(settlement, true);
}

async function loadSettlement(id: string) {
  const row = await prisma.ownerSettlement.findUnique({
    where: { id },
    include: { items: true, owner: { select: { userId: true } } },
  });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Settlement not found');
  return row;
}

async function revalidateSettlementItems(settlementId: string, ownerId: string, through: Date) {
  const items = await prisma.ownerSettlementItem.findMany({
    where: { settlementId, releasedAt: null },
  });
  const payments = await prisma.payment.findMany({
    where: { id: { in: items.map((i) => i.paymentId) } },
    include: paymentInclude,
  });
  const byId = new Map(payments.map((p) => [p.id, p]));
  const blocks = await getBookingOperationsBlocks(payments.map((p) => p.bookingId));
  const reserved = await reservedPaymentIds(ownerId, settlementId);

  for (const item of items) {
    const p = byId.get(item.paymentId);
    if (!p) throw new AppError(409, 'PAYOUT_NOT_ELIGIBLE', 'Settlement item payment is missing');
    const verdict = classifyRow(
      p,
      blocks.get(p.bookingId) ?? { blocked: false, reason: null },
      reserved.has(p.id),
      through,
    );
    if (!verdict.eligible) {
      throw new AppError(
        409,
        verdict.reason === 'dispute_blocked' ? 'PAYOUT_BLOCKED' : 'PAYOUT_NOT_ELIGIBLE',
        `Settlement item ${item.publicCode} is blocked (${verdict.reason})`,
      );
    }
    const snaps = snapshotAmounts(p);
    if (
      roundMoney(decimalToNumber(item.bookingTotalAmount)) !== roundMoney(snaps.bookingTotalAmount) ||
      roundMoney(decimalToNumber(item.platformCommissionAmount)) !== roundMoney(snaps.platformCommissionAmount) ||
      roundMoney(decimalToNumber(item.ownerNetPayoutAmount)) !== roundMoney(snaps.ownerNetPayoutAmount)
    ) {
      throw new AppError(409, 'SETTLEMENT_TOTALS_CHANGED', 'Stored settlement snapshots no longer match payout records');
    }
  }
}

export async function finalizeOwnerSettlement(
  adminUserId: string,
  settlementId: string,
  req?: AuthenticatedRequest,
): Promise<OwnerSettlementSummary> {
  const row = await loadSettlement(settlementId);
  if (row.status !== OwnerSettlementStatus.draft) {
    throw new AppError(409, 'INVALID_STATUS', 'Only draft settlements can be finalized');
  }
  await revalidateSettlementItems(row.id, row.ownerId, row.periodEnd);

  const updated = await prisma.ownerSettlement.update({
    where: { id: row.id, status: OwnerSettlementStatus.draft },
    data: { status: OwnerSettlementStatus.ready, finalizedAt: new Date() },
    include: { items: true },
  });
  if (updated.status !== OwnerSettlementStatus.ready) {
    throw new AppError(409, 'INVALID_STATUS', 'Settlement could not be finalized');
  }

  await createAuditLog({
    actorUserId: adminUserId,
    action: 'settlement.finalized',
    entityType: 'owner_settlement',
    entityId: row.id,
    req,
  });

  await notifySettlementReady({
    ownerUserId: row.owner.userId,
    settlementId: row.id,
    ownerNetAmount: decimalToNumber(row.ownerNetAmount),
    currency: row.currency,
    periodEnd: formatDateOnly(row.periodEnd),
  });

  return mapSettlement(updated, true);
}

export async function markOwnerSettlementPaid(
  adminUserId: string,
  settlementId: string,
  input: MarkOwnerSettlementPaidInput,
  req?: AuthenticatedRequest,
): Promise<OwnerSettlementSummary> {
  const row = await loadSettlement(settlementId);
  if (row.status === OwnerSettlementStatus.paid) {
    throw new AppError(409, 'SETTLEMENT_ALREADY_PAID', 'Settlement is already marked paid');
  }
  if (row.status !== OwnerSettlementStatus.ready) {
    throw new AppError(409, 'INVALID_STATUS', 'Only ready settlements can be marked paid');
  }

  await assertOwnerHasReviewedPayoutDestination(row.ownerId);

  await revalidateSettlementItems(row.id, row.ownerId, row.periodEnd);
  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  const reference = input.paymentReference.trim();

  const updated = await prisma.$transaction(
    async (tx) => {
      const moved = await tx.ownerSettlement.updateMany({
        where: { id: row.id, status: OwnerSettlementStatus.ready },
        data: {
          status: OwnerSettlementStatus.paid,
          paidAt,
          paymentReference: reference,
          adminNote: input.adminNote?.trim() || row.adminNote,
        },
      });
      if (moved.count !== 1) {
        throw new AppError(409, 'SETTLEMENT_ALREADY_PAID', 'Settlement is already marked paid');
      }

      const activeItems = row.items.filter((i) => !i.releasedAt);
      const payoutIds = activeItems.map((i) => i.payoutId);
      const paymentIds = activeItems.map((i) => i.paymentId);
      if (payoutIds.length) {
        await tx.ownerPayout.updateMany({
          where: { id: { in: payoutIds } },
          data: {
            status: OwnerPayoutRecordStatus.paid,
            paidAt,
            manualReference: reference,
            adminNote: input.adminNote?.trim() ?? null,
          },
        });
        await tx.payment.updateMany({
          where: { id: { in: paymentIds } },
          data: { payoutStatus: PayoutStatus.paid },
        });
      }

      return tx.ownerSettlement.findUniqueOrThrow({
        where: { id: row.id },
        include: { items: true },
      });
    },
    { timeout: 20000 },
  );

  await createAuditLog({
    actorUserId: adminUserId,
    action: 'settlement.marked_paid',
    entityType: 'owner_settlement',
    entityId: row.id,
    metadata: { paymentReference: reference, itemCount: row.itemCount },
    req,
  });

  await notifySettlementPaid({
    ownerUserId: row.owner.userId,
    settlementId: row.id,
    ownerNetAmount: decimalToNumber(row.ownerNetAmount),
    currency: row.currency,
    paymentReference: reference,
  });

  return mapSettlement(updated, true);
}

export async function cancelOwnerSettlement(
  adminUserId: string,
  settlementId: string,
  req?: AuthenticatedRequest,
): Promise<OwnerSettlementSummary> {
  const row = await loadSettlement(settlementId);
  if (row.status === OwnerSettlementStatus.paid) {
    throw new AppError(409, 'SETTLEMENT_PAID', 'Paid settlements cannot be cancelled');
  }
  if (row.status === OwnerSettlementStatus.cancelled) {
    throw new AppError(409, 'INVALID_STATUS', 'Settlement is already cancelled');
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.ownerSettlementItem.updateMany({
      where: { settlementId: row.id, releasedAt: null },
      data: { releasedAt: new Date() },
    });
    return tx.ownerSettlement.update({
      where: { id: row.id },
      data: { status: OwnerSettlementStatus.cancelled },
      include: { items: true },
    });
  });

  await createAuditLog({
    actorUserId: adminUserId,
    action: 'settlement.cancelled',
    entityType: 'owner_settlement',
    entityId: row.id,
    req,
  });

  return mapSettlement(updated, true);
}

export async function getOwnerSettlement(
  settlementId: string,
  includeAdminNote: boolean,
): Promise<OwnerSettlementSummary> {
  const row = await loadSettlement(settlementId);
  return mapSettlement(row, includeAdminNote);
}

export async function listOwnerSettlementsForAdmin(ownerId: string): Promise<OwnerSettlementSummary[]> {
  const owner = await prisma.ownerProfile.findUnique({ where: { id: ownerId }, select: { id: true } });
  if (!owner) throw new AppError(404, 'NOT_FOUND', 'Partner not found');
  const rows = await prisma.ownerSettlement.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });
  return rows.map((r) => mapSettlement(r, true));
}

export async function getOwnerSettlementCycleInfo(
  ownerId: string,
  asOfRaw?: string,
): Promise<OwnerSettlementCycleInfo> {
  const owner = await prisma.ownerProfile.findUnique({ where: { id: ownerId }, select: { id: true } });
  if (!owner) throw new AppError(404, 'NOT_FOUND', 'Partner not found');
  const asOf = asOfRaw ?? formatDateOnly(new Date());
  const due = getDueSettlementPeriod(asOf);
  const last = await prisma.ownerSettlement.findFirst({
    where: { ownerId, status: { not: OwnerSettlementStatus.cancelled } },
    orderBy: { periodEnd: 'desc' },
  });
  const draft = due
    ? await prisma.ownerSettlement.findFirst({
        where: {
          ownerId,
          periodStart: parseThrough(due.periodStart),
          periodEnd: parseThrough(due.periodEnd),
          status: OwnerSettlementStatus.draft,
        },
        select: { id: true },
      })
    : null;
  return {
    cycleDays: getSettlementCycleDays(),
    duePeriodStart: due?.periodStart ?? null,
    duePeriodEnd: due?.periodEnd ?? null,
    nextExpectedPeriodEnd: due?.nextExpectedPeriodEnd ?? null,
    lastGeneratedPeriodStart: last ? formatDateOnly(last.periodStart) : null,
    lastGeneratedPeriodEnd: last ? formatDateOnly(last.periodEnd) : null,
    draftExistsForCurrentCycle: Boolean(draft),
  };
}

export async function generateDueOwnerSettlements(input?: {
  asOf?: string;
  cycleDays?: number;
  ownerId?: string;
}): Promise<OwnerSettlementGenerateResult> {
  const cycleDays =
    isInternalQaRoutesEnabled() &&
    Number.isInteger(input?.cycleDays) &&
    (input!.cycleDays as number) >= 1 &&
    (input!.cycleDays as number) <= 365
      ? (input!.cycleDays as number)
      : getSettlementCycleDays();
  const asOf = input?.asOf && /^\d{4}-\d{2}-\d{2}$/.test(input.asOf)
    ? input.asOf
    : formatDateOnly(new Date());
  const due = getDueSettlementPeriod(asOf, cycleDays);
  if (!due) {
    return {
      cycleDays,
      asOf,
      periodStart: null,
      periodEnd: null,
      ownersChecked: 0,
      settlementsCreated: 0,
      itemsAttached: 0,
      skippedOwners: 0,
      failures: 0,
    };
  }

  const owners = await prisma.ownerProfile.findMany({
    where: {
      status: OwnerStatus.approved,
      ...(input?.ownerId ? { id: input.ownerId } : {}),
    },
    select: { id: true },
  });

  let settlementsCreated = 0;
  let itemsAttached = 0;
  let skippedOwners = 0;
  let failures = 0;

  for (const owner of owners) {
    try {
      const created = await createOwnerSettlement(
        null,
        owner.id,
        { through: due.periodEnd },
        undefined,
        { periodStart: due.periodStart, periodEnd: due.periodEnd },
      );
      settlementsCreated += 1;
      itemsAttached += created.itemCount;
    } catch (err) {
      const code = err instanceof AppError ? err.code : '';
      if (code === 'NO_ELIGIBLE_PAYOUTS' || code === 'SETTLEMENT_PERIOD_EXISTS') {
        skippedOwners += 1;
      } else {
        failures += 1;
        console.error('[settlement-cycle] generate failed', owner.id, err);
      }
    }
  }

  return {
    cycleDays,
    asOf,
    periodStart: due.periodStart,
    periodEnd: due.periodEnd,
    ownersChecked: owners.length,
    settlementsCreated,
    itemsAttached,
    skippedOwners,
    failures,
  };
}

export async function listOwnerSettlementsForOwner(
  userId: string,
  role: string,
): Promise<OwnerSettlementSummary[]> {
  const scope = await resolveOwnerScope(userId, role as UserRole);
  if (!scope.ownerProfileId) {
    throw new AppError(400, 'OWNER_SCOPE_REQUIRED', 'Owner settlements are scoped to a partner account');
  }
  const rows = await prisma.ownerSettlement.findMany({
    where: { ownerId: scope.ownerProfileId },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });
  return rows.map((r) => mapSettlement(r, false));
}

export async function getOwnerSettlementForOwner(
  userId: string,
  role: string,
  settlementId: string,
): Promise<OwnerSettlementSummary> {
  const scope = await resolveOwnerScope(userId, role as UserRole);
  const row = await loadSettlement(settlementId);
  if (!scope.isAdmin && row.ownerId !== scope.ownerProfileId) {
    throw new AppError(404, 'NOT_FOUND', 'Settlement not found');
  }
  return mapSettlement(row, false);
}
