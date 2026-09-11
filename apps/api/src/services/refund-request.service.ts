import {
  prisma,
  BookingPaymentState,
  BookingStatus,
  PaymentStatus,
  Prisma,
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
import {
  BLOCKING_REFUND_REQUEST_STATUSES,
  assertPaymentStateTransition,
  filsToJod,
  jodToFils,
  paymentStateAfterRefund,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { notifyRefundRequested } from './notification.service.js';
import { evaluateCancellationPolicy } from './payment-policy.service.js';
import { syncPayoutStatusForPayment } from './payment-payout.service.js';
import { refundableCapturedFils } from '../lib/booking-ledger.js';
import { releaseSlotIfUnheld } from './booking-hold.service.js';
import { getPaymentGateway, throwPaymentProviderError } from './payment/payment-provider.registry.js';
import { providerRefundIdempotencyKey } from './payment/payment-provider.interface.js';
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
      payments: true,
      refundRequests: true,
    },
  });
  if (!booking) {
    throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  }
  if (booking.status !== BookingStatus.confirmed) {
    throw new AppError(400, 'INVALID_STATUS', 'Refund requests are only for confirmed paid bookings');
  }
  if (booking.paymentState === BookingPaymentState.refunded) {
    throw new AppError(400, 'INVALID_STATUS', 'This booking is already fully refunded');
  }
  const capturedPayments = booking.payments.filter((p) => p.status === PaymentStatus.succeeded);
  if (capturedPayments.length === 0) {
    throw new AppError(400, 'INVALID_STATUS', 'No successful payment for this booking');
  }
  const funds = refundableCapturedFils(booking.payments, booking.refundRequests);
  if (funds.refundable <= 0) {
    throw new AppError(400, 'INVALID_STATUS', 'No captured amount remains to refund');
  }
  const payment = capturedPayments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]!;
  return { booking, payment, funds };
}

export async function createRefundRequest(
  userId: string,
  bookingId: string,
  input: CreateRefundRequestInput,
  req?: AuthenticatedRequest,
): Promise<RefundRequestSummary> {
  const { booking, payment, funds } = await getPaidBookingForCustomer(userId, bookingId);

  const existing = await prisma.refundRequest.findFirst({
    where: {
      bookingId,
      status: { in: [...BLOCKING_REFUND_REQUEST_STATUSES] as RefundRequestStatus[] },
    },
  });
  if (existing) {
    throw new AppError(409, 'REFUND_REQUEST_EXISTS', 'A refund request is already pending review');
  }

  const capturedJod = filsToJod(funds.captured);
  const refundableJod = filsToJod(funds.refundable);
  const merchantValue = decimalToNumber(booking.merchantBookingValue ?? booking.totalAmount);
  const commissionPercent = decimalToNumber(booking.platformCommissionPercent);
  const policy = evaluateCancellationPolicy(
    merchantValue,
    capturedJod,
    booking.bookingStartAt,
    booking.slot.date,
    commissionPercent,
  );
  const policyRefundAmount = Math.min(policy.refundableAmount, refundableJod);
  const requestedAmount =
    input.requestedAmount != null
      ? input.requestedAmount
      : policyRefundAmount;

  if (input.requestedAmount != null && jodToFils(input.requestedAmount) > funds.refundable) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Requested amount cannot exceed amount paid');
  }
  if (requestedAmount <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Requested amount must be greater than zero');
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
      capturedAmount: capturedJod,
      refundableAmount: refundableJod,
      tier: policy.tier,
    },
    req,
  });

  void notifyRefundRequested({
    refundRequestId: row.id,
    publicCode: booking.publicCode,
  }).catch((err) => console.error('[notifications] refund.requested', err));

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
      payment: { select: { customerPayableAmount: true, bookingId: true } },
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
          slot: { select: { date: true } },
          payments: true,
          refundRequests: true,
        },
      },
      payment: true,
    },
  });
  if (!row) {
    throw new AppError(404, 'NOT_FOUND', 'Refund request not found');
  }

  const funds = refundableCapturedFils(
    row.booking.payments,
    row.booking.refundRequests.filter((r) => r.id !== id),
  );

  let approvedAmount =
    input.approvedAmount ??
    (input.status === RefundRequestStatus.approved || input.status === RefundRequestStatus.processed
      ? decimalToNumber(row.requestedAmount)
      : row.approvedAmount != null
        ? decimalToNumber(row.approvedAmount)
        : null);

  if (
    (input.status === RefundRequestStatus.approved ||
      input.status === RefundRequestStatus.processed) &&
    approvedAmount != null
  ) {
    const maxJod = filsToJod(funds.refundable);
    if (approvedAmount > maxJod + 0.001) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Approved amount cannot exceed captured funds');
    }
    approvedAmount = Math.min(approvedAmount, maxJod);
  }

  // Route PSP refund through the gateway when marking processed — limits/state machine stay local.
  let providerRefund: {
    providerRef: string;
    status: string;
    providerStatus?: string | null;
    profileMode?: string | null;
  } | null = null;
  if (input.status === RefundRequestStatus.processed) {
    try {
      const gateway = getPaymentGateway(row.payment.provider);
      const refundAmount = approvedAmount ?? decimalToNumber(row.requestedAmount);
      const result = await gateway.refundPayment({
        paymentId: row.paymentId,
        providerRef: row.payment.providerRef,
        amount: refundAmount,
        currency: row.payment.currency,
        refundRequestId: id,
        idempotencyKey: providerRefundIdempotencyKey(id),
      });
      providerRefund = {
        providerRef: result.providerRef,
        status: result.status,
        providerStatus: result.providerStatus ?? null,
        profileMode: result.profileMode ?? null,
      };
      if (result.status === 'failed') {
        throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'Payment provider refund was not accepted');
      }
    } catch (err) {
      throwPaymentProviderError(err);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Booking" WHERE id = ${row.bookingId} FOR UPDATE`);

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
    let bookingCancelled = false;
    let nextPaymentState: BookingPaymentState | null = null;

    if (input.status === RefundRequestStatus.approved || input.status === RefundRequestStatus.processed) {
      paymentRefundStatus =
        input.status === RefundRequestStatus.processed
          ? RefundStatus.processed
          : RefundStatus.approved;
      payoutStatus = PayoutStatus.blocked;
      const remainingCapturedFils = Math.max(
        0,
        funds.refundable - jodToFils(approvedAmount ?? 0),
      );
      nextPaymentState = paymentStateAfterRefund({ remainingCapturedFils }) as BookingPaymentState;
      assertPaymentStateTransition(row.booking.paymentState, nextPaymentState);

      const slotDate = row.booking.slot.date;
      const todayUtc = new Date();
      todayUtc.setUTCHours(0, 0, 0, 0);
      const isFuture =
        Date.UTC(slotDate.getUTCFullYear(), slotDate.getUTCMonth(), slotDate.getUTCDate()) >
        todayUtc.getTime();

      await tx.booking.update({
        where: { id: row.bookingId },
        data: {
          paymentState: nextPaymentState,
          ...(nextPaymentState === BookingPaymentState.refunded && isFuture
            ? { status: BookingStatus.cancelled, cancelledAt: new Date() }
            : {}),
        },
      });
      if (nextPaymentState === BookingPaymentState.refunded && isFuture) {
        bookingCancelled = true;
        await releaseSlotIfUnheld(tx, row.booking.availabilitySlotId, row.bookingId);
      }
    } else if (input.status === RefundRequestStatus.rejected) {
      paymentRefundStatus = RefundStatus.rejected;
    } else if (input.status === RefundRequestStatus.cancelled) {
      paymentRefundStatus = RefundStatus.none;
    }

    await tx.payment.updateMany({
      where: { bookingId: row.bookingId, status: PaymentStatus.succeeded },
      data: {
        refundStatus: paymentRefundStatus,
        payoutStatus,
        cancellationRefundAmount:
          approvedAmount ?? decimalToNumber(row.policyRefundAmount),
      },
    });

    return { rr, nextPaymentState, bookingCancelled };
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
    metadata: {
      status: input.status,
      approvedAmount,
      paymentState: updated.nextPaymentState,
      bookingCancelled: updated.bookingCancelled,
      capturedFils: funds.captured,
      refundableFils: funds.refundable,
      providerRefundRef: providerRefund?.providerRef ?? null,
      providerRefundStatus: providerRefund?.status ?? null,
      providerStatus: providerRefund?.providerStatus ?? null,
      ...(providerRefund?.profileMode
        ? { paytabsProfileMode: providerRefund.profileMode }
        : {}),
    },
    req,
  });

  await syncPayoutStatusForPayment(row.paymentId);

  const list = await listAdminRefundRequests();
  const found = list.find((r) => r.id === updated.rr.id);
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

const SYSTEM_CANCEL_REFUND_REASON = 'Customer cancellation — policy refund';

/**
 * Phase 1 — idempotent refund obligation after a paid customer cancellation.
 * Does not require booking.status === confirmed. Attempts PSP refund when safe.
 */
export async function ensureSystemCancellationRefund(params: {
  bookingId: string;
  customerId: string;
  customerRefund: number;
  retainedAmount: number;
  tier?: string;
  req?: AuthenticatedRequest;
}): Promise<RefundRequestSummary | null> {
  if (params.customerRefund <= 0) return null;

  const booking = await prisma.booking.findFirst({
    where: { id: params.bookingId, userId: params.customerId },
    include: { payments: true, refundRequests: true },
  });
  if (!booking) return null;

  const existing = booking.refundRequests.find(
    (r) =>
      r.reason === SYSTEM_CANCEL_REFUND_REASON &&
      (BLOCKING_REFUND_REQUEST_STATUSES as readonly string[]).includes(r.status),
  );
  if (existing) return toRefundRequestSummary(existing);

  const processed = booking.refundRequests.find(
    (r) => r.reason === SYSTEM_CANCEL_REFUND_REASON && r.status === RefundRequestStatus.processed,
  );
  if (processed) return toRefundRequestSummary(processed);

  const funds = refundableCapturedFils(booking.payments, booking.refundRequests);
  const refundableJod = filsToJod(funds.refundable);
  const policyRefundAmount = Math.min(params.customerRefund, refundableJod);
  if (policyRefundAmount <= 0) return null;

  const capturedPayments = booking.payments.filter((p) => p.status === PaymentStatus.succeeded);
  const payment = capturedPayments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!payment) return null;

  const row = await prisma.refundRequest.create({
    data: {
      bookingId: booking.id,
      paymentId: payment.id,
      customerId: params.customerId,
      reason: SYSTEM_CANCEL_REFUND_REASON,
      policyRefundAmount,
      requestedAmount: policyRefundAmount,
      status: RefundRequestStatus.pending,
    },
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      payoutStatus: PayoutStatus.blocked,
      refundStatus: RefundStatus.pending,
      cancellationRefundAmount: policyRefundAmount,
      cancellationPenaltyAmount: params.retainedAmount,
    },
  });
  await syncPayoutStatusForPayment(payment.id);

  await createAuditLog({
    actorUserId: params.customerId,
    action: 'refund.system_obligation_created',
    entityType: 'refund_request',
    entityId: row.id,
    metadata: {
      bookingId: params.bookingId,
      publicCode: booking.publicCode,
      policyRefundAmount,
      retainedAmount: params.retainedAmount,
      tier: params.tier ?? null,
    },
    req: params.req,
  });

  try {
    const gateway = getPaymentGateway(payment.provider);
    const result = await gateway.refundPayment({
      paymentId: payment.id,
      providerRef: payment.providerRef,
      amount: policyRefundAmount,
      currency: payment.currency,
      refundRequestId: row.id,
      idempotencyKey: providerRefundIdempotencyKey(row.id),
    });
    if (result.status === 'succeeded') {
      await prisma.refundRequest.update({
        where: { id: row.id },
        data: {
          status: RefundRequestStatus.processed,
          approvedAmount: policyRefundAmount,
          adminNote: 'Auto-processed on customer cancellation',
        },
      });
      await prisma.payment.update({
        where: { id: payment.id },
        data: { refundStatus: RefundStatus.processed },
      });
      await syncPayoutStatusForPayment(payment.id);
    } else if (result.status === 'failed') {
      await prisma.refundRequest.update({
        where: { id: row.id },
        data: {
          adminNote: `PSP refund failed (${result.providerStatus ?? result.status}) — admin retry required`,
        },
      });
    }
  } catch (err) {
    await prisma.refundRequest.update({
      where: { id: row.id },
      data: {
        adminNote: `PSP refund attempt failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      },
    });
  }

  const refreshed = await prisma.refundRequest.findUniqueOrThrow({ where: { id: row.id } });
  return toRefundRequestSummary(refreshed);
}
