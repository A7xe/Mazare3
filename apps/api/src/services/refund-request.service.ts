import {
  prisma,
  BookingStatus,
  PaymentStatus,
  RefundRequestStatus,
  RefundStatus,
  PayoutStatus,
} from '@mazare3/db';
import type {
  CreateRefundRequestInput,
  PatchAdminRefundRequestInput,
  RefundRequestSummary,
  AdminRefundRequestRow,
} from '@mazare3/shared';
import { BLOCKING_REFUND_REQUEST_STATUSES } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { evaluateCancellationPolicy } from './payment-policy.service.js';
import { syncPayoutStatusForPayment } from './payment-payout.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toRefundRequestSummary(row: {
  id: string;
  bookingId: string;
  status: RefundRequestStatus;
  policyRefundAmount: { toNumber(): number };
  requestedAmount: { toNumber(): number };
  approvedAmount: { toNumber(): number } | null;
  reason: string;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}): RefundRequestSummary {
  return {
    id: row.id,
    bookingId: row.bookingId,
    status: row.status,
    policyRefundAmount: decimalToNumber(row.policyRefundAmount),
    requestedAmount: decimalToNumber(row.requestedAmount),
    approvedAmount: row.approvedAmount != null ? decimalToNumber(row.approvedAmount) : null,
    reason: row.reason,
    adminNote: row.adminNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getPaidBookingForCustomer(userId: string, bookingId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: {
      slot: { select: { date: true } },
      payments: {
        where: { status: PaymentStatus.succeeded },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!booking) {
    throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  }
  if (booking.status !== BookingStatus.confirmed) {
    throw new AppError(400, 'INVALID_STATUS', 'Refund requests are only for confirmed paid bookings');
  }
  const payment = booking.payments[0];
  if (!payment) {
    throw new AppError(400, 'INVALID_STATUS', 'No successful payment for this booking');
  }
  return { booking, payment };
}

export async function createRefundRequest(
  userId: string,
  bookingId: string,
  input: CreateRefundRequestInput,
  req?: AuthenticatedRequest,
): Promise<RefundRequestSummary> {
  const { booking, payment } = await getPaidBookingForCustomer(userId, bookingId);

  const existing = await prisma.refundRequest.findFirst({
    where: {
      bookingId,
      status: { in: [...BLOCKING_REFUND_REQUEST_STATUSES] as RefundRequestStatus[] },
    },
  });
  if (existing) {
    throw new AppError(409, 'REFUND_REQUEST_EXISTS', 'A refund request is already pending review');
  }

  const payable = decimalToNumber(payment.customerPayableAmount);
  const policy = evaluateCancellationPolicy(payable, booking.slot.date);
  const policyRefundAmount = policy.refundableAmount;
  const requestedAmount =
    input.requestedAmount != null
      ? Math.min(input.requestedAmount, payable)
      : policyRefundAmount;

  if (requestedAmount > payable) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Requested amount cannot exceed amount paid');
  }

  const row = await prisma.refundRequest.create({
    data: {
      bookingId: booking.id,
      paymentId: payment.id,
      customerId: userId,
      reason: input.reason.trim(),
      policyRefundAmount,
      requestedAmount,
      status: RefundRequestStatus.pending,
    },
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      payoutStatus: PayoutStatus.blocked,
      refundStatus: RefundStatus.pending,
      cancellationRefundAmount: policyRefundAmount,
      cancellationPenaltyAmount: policy.cancellationPenaltyAmount,
    },
  });
  await syncPayoutStatusForPayment(payment.id);

  await createAuditLog({
    actorUserId: userId,
    action: 'refund.requested',
    entityType: 'refund_request',
    entityId: row.id,
    metadata: {
      bookingId,
      publicCode: booking.publicCode,
      policyRefundAmount,
      requestedAmount,
      tier: policy.tier,
    },
    req,
  });

  return toRefundRequestSummary(row);
}

export async function listMyRefundRequests(userId: string): Promise<RefundRequestSummary[]> {
  const rows = await prisma.refundRequest.findMany({
    where: { customerId: userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map(toRefundRequestSummary);
}

export async function listAdminRefundRequests(): Promise<AdminRefundRequestRow[]> {
  const rows = await prisma.refundRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      booking: {
        include: {
          property: { select: { slug: true, titleAr: true, titleEn: true } },
          user: { select: { name: true, email: true } },
        },
      },
      payment: { select: { customerPayableAmount: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    bookingId: r.bookingId,
    publicCode: r.booking.publicCode,
    customerName: r.booking.user.name,
    customerEmail: r.booking.user.email,
    propertySlug: r.booking.property.slug,
    propertyTitleAr: r.booking.property.titleAr,
    propertyTitleEn: r.booking.property.titleEn ?? r.booking.property.titleAr,
    amountPaid: decimalToNumber(r.payment.customerPayableAmount),
    policyRefundAmount: decimalToNumber(r.policyRefundAmount),
    requestedAmount: decimalToNumber(r.requestedAmount),
    approvedAmount: r.approvedAmount != null ? decimalToNumber(r.approvedAmount) : null,
    status: r.status,
    reason: r.reason,
    adminNote: r.adminNote,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function patchAdminRefundRequest(
  adminUserId: string,
  id: string,
  input: PatchAdminRefundRequestInput,
  req?: AuthenticatedRequest,
): Promise<AdminRefundRequestRow> {
  const row = await prisma.refundRequest.findUnique({
    where: { id },
    include: {
      booking: {
        include: {
          property: { select: { slug: true, titleAr: true, titleEn: true } },
          user: { select: { name: true, email: true } },
        },
      },
      payment: true,
    },
  });
  if (!row) {
    throw new AppError(404, 'NOT_FOUND', 'Refund request not found');
  }

  const approvedAmount =
    input.approvedAmount ??
    (input.status === RefundRequestStatus.approved || input.status === RefundRequestStatus.processed
      ? decimalToNumber(row.requestedAmount)
      : row.approvedAmount != null
        ? decimalToNumber(row.approvedAmount)
        : null);

  const updated = await prisma.$transaction(async (tx) => {
    const rr = await tx.refundRequest.update({
      where: { id },
      data: {
        status: input.status as RefundRequestStatus,
        approvedAmount: approvedAmount ?? undefined,
        adminNote: input.adminNote?.trim() ?? undefined,
      },
    });

    let paymentRefundStatus = row.payment.refundStatus;
    let payoutStatus = row.payment.payoutStatus;

    if (input.status === RefundRequestStatus.approved) {
      paymentRefundStatus = RefundStatus.approved;
      payoutStatus = PayoutStatus.blocked;
    } else if (input.status === RefundRequestStatus.rejected) {
      paymentRefundStatus = RefundStatus.rejected;
    } else if (input.status === RefundRequestStatus.processed) {
      paymentRefundStatus = RefundStatus.processed;
      payoutStatus = PayoutStatus.blocked;
    } else if (input.status === RefundRequestStatus.cancelled) {
      paymentRefundStatus = RefundStatus.none;
    }

    await tx.payment.update({
      where: { id: row.paymentId },
      data: {
        refundStatus: paymentRefundStatus,
        payoutStatus,
        cancellationRefundAmount:
          approvedAmount ?? decimalToNumber(row.policyRefundAmount),
      },
    });

    return rr;
  });

  const actionMap: Record<string, string> = {
    [RefundRequestStatus.approved]: 'refund.approved',
    [RefundRequestStatus.rejected]: 'refund.rejected',
    [RefundRequestStatus.processed]: 'refund.processed_manual',
    [RefundRequestStatus.cancelled]: 'refund.rejected',
  };
  const action = actionMap[input.status] ?? 'refund.status_updated';
  await createAuditLog({
    actorUserId: adminUserId,
    action,
    entityType: 'refund_request',
    entityId: id,
    metadata: { status: input.status, approvedAmount },
    req,
  });

  await syncPayoutStatusForPayment(row.paymentId);

  const list = await listAdminRefundRequests();
  const found = list.find((r) => r.id === updated.id);
  if (!found) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load updated refund request');
  }
  return found;
}

export async function getActiveRefundRequestForBooking(
  bookingId: string,
  customerId: string,
): Promise<RefundRequestSummary | null> {
  const row = await prisma.refundRequest.findFirst({
    where: {
      bookingId,
      customerId,
      status: { in: [...BLOCKING_REFUND_REQUEST_STATUSES, RefundRequestStatus.processed] as RefundRequestStatus[] },
    },
    orderBy: { createdAt: 'desc' },
  });
  return row ? toRefundRequestSummary(row) : null;
}
