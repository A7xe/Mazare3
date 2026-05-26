import {
  prisma,
  BookingStatus,
  PaymentStatus,
  PayoutStatus,
  OwnerPayoutRecordStatus,
} from '@mazare3/db';
import type { AdminPayoutRow, MarkAdminPayoutPaidInput, OwnerPayoutSummaryRow } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { getBookingOperationsBlock } from '../lib/operations-blocking.js';
import {
  computePayoutAvailableAt,
  resolvePayoutStatus,
} from './payment-policy.service.js';
import { syncPayoutStatusForPayment } from './payment-payout.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import type { UserRole } from '@mazare3/db';
import { resolveOwnerScope, type OwnerScope } from './owner-access.js';

function propertyWhere(scope: OwnerScope) {
  return scope.isAdmin ? {} : { ownerId: scope.ownerProfileId! };
}

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function blockedReasonLabel(reason: string | null): string | null {
  if (!reason) return null;
  if (reason.startsWith('refund_request_')) return 'refund_pending';
  if (reason.startsWith('dispute_')) return 'dispute_open';
  return reason;
}

export async function listAdminPayouts(): Promise<AdminPayoutRow[]> {
  const payments = await prisma.payment.findMany({
    where: { status: PaymentStatus.succeeded },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      booking: {
        include: {
          property: {
            select: {
              slug: true,
              titleAr: true,
              titleEn: true,
              owner: { select: { id: true, displayName: true, user: { select: { email: true } } } },
            },
          },
          slot: { select: { date: true } },
        },
      },
      payoutRecord: true,
    },
  });

  const rows: AdminPayoutRow[] = [];
  for (const p of payments) {
    if (p.booking.status === BookingStatus.cancelled) continue;

    const block = await getBookingOperationsBlock(p.bookingId);
    const payoutAvailableAt =
      p.payoutAvailableAt ?? computePayoutAvailableAt(p.booking.slot.date);
    let payoutStatus = resolvePayoutStatus({
      paymentSucceeded: true,
      bookingCancelled: false,
      refundStatus: p.refundStatus,
      payoutAvailableAt,
    });
    if (block.blocked) {
      payoutStatus = PayoutStatus.blocked;
    }
    if (p.payoutRecord?.status === OwnerPayoutRecordStatus.paid) {
      payoutStatus = PayoutStatus.paid;
    }

    rows.push({
      paymentId: p.id,
      bookingId: p.bookingId,
      publicCode: p.booking.publicCode,
      ownerId: p.booking.property.owner.id,
      ownerDisplayName: p.booking.property.owner.displayName,
      ownerEmail: p.booking.property.owner.user.email,
      propertySlug: p.booking.property.slug,
      propertyTitleAr: p.booking.property.titleAr,
      propertyTitleEn: p.booking.property.titleEn ?? p.booking.property.titleAr,
      bookingDate: formatDateOnly(p.booking.slot.date),
      amount: decimalToNumber(p.ownerNetPayoutAmount),
      currency: p.currency,
      payoutStatus,
      payoutAvailableAt: payoutAvailableAt.toISOString(),
      blocked: block.blocked,
      blockedReason: blockedReasonLabel(block.reason),
      payoutRecordId: p.payoutRecord?.id ?? null,
      payoutRecordStatus: p.payoutRecord?.status ?? null,
      paidAt: p.payoutRecord?.paidAt?.toISOString() ?? null,
      manualReference: p.payoutRecord?.manualReference ?? null,
    });
  }
  return rows;
}

export async function markAdminPayoutPaid(
  adminUserId: string,
  paymentId: string,
  input: MarkAdminPayoutPaidInput,
  req?: AuthenticatedRequest,
): Promise<AdminPayoutRow> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      booking: {
        include: {
          property: { select: { ownerId: true } },
          slot: { select: { date: true } },
        },
      },
      payoutRecord: true,
    },
  });

  if (!payment || payment.status !== PaymentStatus.succeeded) {
    throw new AppError(404, 'NOT_FOUND', 'Payment not found');
  }
  if (payment.booking.status !== BookingStatus.confirmed) {
    throw new AppError(400, 'INVALID_STATUS', 'Payout is only for confirmed bookings');
  }
  if (payment.payoutRecord?.status === OwnerPayoutRecordStatus.paid) {
    throw new AppError(400, 'ALREADY_PAID', 'Payout already marked as paid');
  }

  const block = await getBookingOperationsBlock(payment.bookingId);
  if (block.blocked) {
    await createAuditLog({
      actorUserId: adminUserId,
      action: 'payout.blocked',
      entityType: 'payment',
      entityId: paymentId,
      metadata: { reason: block.reason },
      req,
    });
    throw new AppError(
      409,
      'PAYOUT_BLOCKED',
      'Payout is blocked while a refund request or dispute is open',
    );
  }

  const payoutAvailableAt =
    payment.payoutAvailableAt ?? computePayoutAvailableAt(payment.booking.slot.date);
  if (new Date() < payoutAvailableAt) {
    throw new AppError(400, 'PAYOUT_NOT_ELIGIBLE', 'Owner payout is not yet eligible');
  }

  const slotDate = payment.booking.slot.date;
  const periodFrom = slotDate;
  const periodTo = slotDate;
  const amount = decimalToNumber(payment.ownerNetPayoutAmount);

  await prisma.$transaction(async (tx) => {
    if (payment.payoutRecord) {
      await tx.ownerPayout.update({
        where: { id: payment.payoutRecord.id },
        data: {
          status: OwnerPayoutRecordStatus.paid,
          paidAt: new Date(),
          manualReference: input.manualReference.trim(),
          adminNote: input.adminNote?.trim() ?? null,
        },
      });
    } else {
      await tx.ownerPayout.create({
        data: {
          ownerId: payment.booking.property.ownerId,
          paymentId: payment.id,
          bookingId: payment.bookingId,
          amount,
          currency: payment.currency,
          status: OwnerPayoutRecordStatus.paid,
          periodFrom,
          periodTo,
          paidAt: new Date(),
          manualReference: input.manualReference.trim(),
          adminNote: input.adminNote?.trim() ?? null,
        },
      });
    }
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        payoutStatus: PayoutStatus.paid,
        payoutAvailableAt,
      },
    });
  });

  await createAuditLog({
    actorUserId: adminUserId,
    action: 'payout.marked_paid',
    entityType: 'payment',
    entityId: paymentId,
    metadata: {
      manualReference: input.manualReference,
      amount,
      bookingId: payment.bookingId,
    },
    req,
  });

  const list = await listAdminPayouts();
  const found = list.find((r) => r.paymentId === paymentId);
  if (!found) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load payout row');
  }
  return found;
}

export async function listOwnerPayouts(
  userId: string,
  role: string,
): Promise<OwnerPayoutSummaryRow[]> {
  const scope = await resolveOwnerScope(userId, role as UserRole);
  const payments = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.succeeded,
      booking: {
        status: BookingStatus.confirmed,
        property: propertyWhere(scope),
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      booking: {
        include: {
          property: { select: { slug: true, titleAr: true, titleEn: true } },
          slot: { select: { date: true } },
        },
      },
      payoutRecord: true,
    },
  });

  const rows: OwnerPayoutSummaryRow[] = [];
  for (const p of payments) {
    const block = await getBookingOperationsBlock(p.bookingId);
    const payoutAvailableAt =
      p.payoutAvailableAt ?? computePayoutAvailableAt(p.booking.slot.date);
    let payoutStatus = resolvePayoutStatus({
      paymentSucceeded: true,
      bookingCancelled: false,
      refundStatus: p.refundStatus,
      payoutAvailableAt,
    });
    if (block.blocked) payoutStatus = PayoutStatus.blocked;
    if (p.payoutRecord?.status === OwnerPayoutRecordStatus.paid) {
      payoutStatus = PayoutStatus.paid;
    }

    rows.push({
      paymentId: p.id,
      bookingId: p.bookingId,
      publicCode: p.booking.publicCode,
      propertySlug: p.booking.property.slug,
      propertyTitleAr: p.booking.property.titleAr,
      propertyTitleEn: p.booking.property.titleEn ?? p.booking.property.titleAr,
      date: formatDateOnly(p.booking.slot.date),
      ownerNetPayoutAmount: decimalToNumber(p.ownerNetPayoutAmount),
      currency: p.currency,
      payoutStatus,
      payoutAvailableAt: payoutAvailableAt.toISOString(),
      blocked: block.blocked,
      blockedReason: blockedReasonLabel(block.reason),
      paidAt: p.payoutRecord?.paidAt?.toISOString() ?? null,
    });
  }
  return rows;
}
