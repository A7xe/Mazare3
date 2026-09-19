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
import { throwPaymentProviderError } from './payment/payment-provider.registry.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  createRefundRequestWithAllocations,
  executeRefundRequestAllocations,
  getRefundableCapturedPayments,
} from './multi-capture-refund.service.js';

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
  refundedAmount?: { toNumber(): number } | number | null;
  reason: string;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  allocations?: Array<{
    id: string;
    paymentId: string;
    status: string;
    allocatedAmount: { toNumber(): number };
    refundedAmount: { toNumber(): number };
    providerRefundRef: string | null;
    lastError: string | null;
  }>;
}): RefundRequestSummary {
  const refundedAmount =
    row.refundedAmount != null ? decimalToNumber(row.refundedAmount) : 0;
  const requested = decimalToNumber(row.requestedAmount);
  const allocations = (row.allocations ?? []).map((a) => ({
    id: a.id,
    paymentId: a.paymentId,
    status: a.status,
    allocatedAmount: decimalToNumber(a.allocatedAmount),
    refundedAmount: decimalToNumber(a.refundedAmount),
    providerRefundRef: a.providerRefundRef,
    lastError: a.lastError,
  }));
  const remainingAmount = Math.max(0, Math.round((requested - refundedAmount) * 100) / 100);
  let aggregateLabel: RefundRequestSummary['aggregateLabel'] = 'pending';
  if (row.status === RefundRequestStatus.processed || remainingAmount <= 0.001) {
    aggregateLabel = 'refunded';
  } else if (refundedAmount > 0 && remainingAmount > 0.001) {
    aggregateLabel =
      allocations.some((a) => a.status === 'failed') ? 'action_required' : 'partially_refunded';
  } else if (allocations.some((a) => a.status === 'failed')) {
    aggregateLabel = 'action_required';
  }

  return {
    id: row.id,
    bookingId: row.bookingId,
    status: row.status,
    policyRefundAmount: decimalToNumber(row.policyRefundAmount),
    requestedAmount: requested,
    approvedAmount: row.approvedAmount != null ? decimalToNumber(row.approvedAmount) : null,
    refundedAmount,
    remainingAmount,
    aggregateLabel,
    allocations,
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
      refundRequests: { include: { allocations: true } },
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
  const { booking, funds } = await getPaidBookingForCustomer(userId, bookingId);

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

  let row;
  try {
    row = await createRefundRequestWithAllocations({
      bookingId: booking.id,
      customerId: userId,
      reason: input.reason.trim(),
      policyRefundAmount,
      requestedAmount,
      retainedAmount: policy.cancellationPenaltyAmount,
      actorUserId: userId,
      req,
      auditAction: 'refund.requested',
    });
  } catch {
    throw new AppError(400, 'INVALID_STATUS', 'No captured amount remains to refund');
  }

  void notifyRefundRequested({
    refundRequestId: row.id,
    publicCode: booking.publicCode,
  }).catch((err) => console.error('[notifications] refund.requested', err));

  const withAlloc = await prisma.refundRequest.findUniqueOrThrow({
    where: { id: row.id },
    include: { allocations: true },
  });
  return toRefundRequestSummary(withAlloc);
}

export async function listMyRefundRequests(userId: string): Promise<RefundRequestSummary[]> {
  const rows = await prisma.refundRequest.findMany({
    where: { customerId: userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { allocations: true },
  });
  return rows.map(toRefundRequestSummary);
}

export async function listAdminRefundRequests(): Promise<AdminRefundRequestRow[]> {
  const rows = await prisma.refundRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      allocations: true,
      booking: {
        include: {
          property: { select: { slug: true, titleAr: true, titleEn: true } },
          user: { select: { name: true, email: true } },
          payments: { where: { status: PaymentStatus.succeeded } },
        },
      },
      payment: { select: { customerPayableAmount: true, bookingId: true } },
    },
  });

  return rows.map((r) => {
    const summary = toRefundRequestSummary(r);
    const amountPaid = r.booking.payments.reduce(
      (s, p) => s + decimalToNumber(p.amount),
      0,
    );
    return {
      id: r.id,
      bookingId: r.bookingId,
      publicCode: r.booking.publicCode,
      customerName: r.booking.user.name,
      customerEmail: r.booking.user.email,
      propertySlug: r.booking.property.slug,
      propertyTitleAr: r.booking.property.titleAr,
      propertyTitleEn: r.booking.property.titleEn ?? r.booking.property.titleAr,
      amountPaid,
      policyRefundAmount: summary.policyRefundAmount,
      requestedAmount: summary.requestedAmount,
      approvedAmount: summary.approvedAmount,
      refundedAmount: summary.refundedAmount,
      remainingAmount: summary.remainingAmount,
      aggregateLabel: summary.aggregateLabel,
      allocations: summary.allocations,
      status: r.status,
      reason: r.reason,
      adminNote: r.adminNote,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });
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

  // Phase 3C.4E.2A — multi-capture PSP execution via allocations (not a single Payment).
  if (input.status === RefundRequestStatus.processed) {
    try {
      const exec = await executeRefundRequestAllocations({
        refundRequestId: id,
        actorUserId: adminUserId,
        req,
      });
      if (!exec.view.complete) {
        throw new AppError(
          502,
          'PAYMENT_PROVIDER_ERROR',
          exec.view.hasFailedAllocation
            ? 'Partial refund: one or more capture refunds failed — retry remaining allocations'
            : 'Refund not fully completed — retry or reconcile',
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throwPaymentProviderError(err);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Booking" WHERE id = ${row.bookingId} FOR UPDATE`);

    const current = await tx.refundRequest.findUniqueOrThrow({
      where: { id },
      include: { allocations: true },
    });

    // Do not mark processed unless aggregate allocations completed (execute path may have done so).
    const nextStatus =
      input.status === RefundRequestStatus.processed && current.status !== RefundRequestStatus.processed
        ? current.status
        : (input.status as RefundRequestStatus);

    const rr = await tx.refundRequest.update({
      where: { id },
      data: {
        status:
          input.status === RefundRequestStatus.processed
            ? current.status
            : nextStatus,
        approvedAmount:
          approvedAmount ??
          (current.status === RefundRequestStatus.processed
            ? decimalToNumber(current.requestedAmount)
            : undefined),
        adminNote: input.adminNote?.trim() ?? undefined,
      },
      include: { allocations: true },
    });

    let paymentRefundStatus = row.payment.refundStatus;
    let payoutStatus = row.payment.payoutStatus;
    let bookingCancelled = false;
    let nextPaymentState: BookingPaymentState | null = null;

    const effectiveProcessed = rr.status === RefundRequestStatus.processed;
    if (
      input.status === RefundRequestStatus.approved ||
      effectiveProcessed
    ) {
      paymentRefundStatus = effectiveProcessed
        ? RefundStatus.processed
        : RefundStatus.approved;
      payoutStatus = PayoutStatus.blocked;
      const refundedFils = jodToFils(decimalToNumber(rr.refundedAmount));
      const remainingCapturedFils = Math.max(0, funds.refundable - refundedFils);
      nextPaymentState = paymentStateAfterRefund({ remainingCapturedFils }) as BookingPaymentState;
      assertPaymentStateTransition(row.booking.paymentState, nextPaymentState);

      const slotDate = row.booking.slot.date;
      const todayUtc = new Date();
      todayUtc.setUTCHours(0, 0, 0, 0);
      // Keep remainder of original admin transaction logic below — search for booking cancel.
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
      },
    });

    // Per-capture cancellationRefundAmount comes from allocations (execute path); do not
    // overwrite every Payment with the Booking-level approved total.
    if (effectiveProcessed && rr.allocations.length > 0) {
      for (const a of rr.allocations) {
        if (a.status !== 'succeeded') continue;
        await tx.payment.update({
          where: { id: a.paymentId },
          data: {
            refundStatus: RefundStatus.processed,
            cancellationRefundAmount: decimalToNumber(a.refundedAmount || a.allocatedAmount),
          },
        });
      }
    } else if (
      (input.status === RefundRequestStatus.approved || effectiveProcessed) &&
      approvedAmount != null &&
      rr.allocations.length === 0
    ) {
      // Legacy single-payment RefundRequest without allocations.
      await tx.payment.update({
        where: { id: row.paymentId },
        data: { cancellationRefundAmount: approvedAmount },
      });
    }

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
      multiCapture: true,
      refundedAmount: decimalToNumber(updated.rr.refundedAmount),
    },
    req,
  });

  for (const p of row.booking.payments.filter((x) => x.status === PaymentStatus.succeeded)) {
    await syncPayoutStatusForPayment(p.id);
  }

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
    include: { allocations: true },
  });
  return row ? toRefundRequestSummary(row) : null;
}

const SYSTEM_CANCEL_REFUND_REASON = 'Customer cancellation — policy refund';

/**
 * Phase 1 / 3C.4E.2A — idempotent Booking-level refund after paid customer cancellation.
 * Allocates across all refundable captures (newest first); never refunds more than one capture holds.
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
    include: {
      payments: true,
      refundRequests: { include: { allocations: true } },
    },
  });
  if (!booking) return null;

  const existing = booking.refundRequests.find(
    (r) =>
      r.reason === SYSTEM_CANCEL_REFUND_REASON &&
      (BLOCKING_REFUND_REQUEST_STATUSES as readonly string[]).includes(r.status),
  );
  if (existing) {
    // Retry unresolved allocations if obligation still open.
    if (existing.status === RefundRequestStatus.pending) {
      await executeRefundRequestAllocations({
        refundRequestId: existing.id,
        actorUserId: params.customerId,
        req: params.req,
      });
      const refreshed = await prisma.refundRequest.findUniqueOrThrow({
        where: { id: existing.id },
        include: { allocations: true },
      });
      return toRefundRequestSummary(refreshed);
    }
    return toRefundRequestSummary(existing);
  }

  const processed = booking.refundRequests.find(
    (r) => r.reason === SYSTEM_CANCEL_REFUND_REASON && r.status === RefundRequestStatus.processed,
  );
  if (processed) return toRefundRequestSummary(processed);

  const funds = refundableCapturedFils(booking.payments, booking.refundRequests);
  const refundableJod = filsToJod(funds.refundable);
  const policyRefundAmount = Math.min(params.customerRefund, refundableJod);
  if (policyRefundAmount <= 0) return null;

  let row;
  try {
    row = await createRefundRequestWithAllocations({
      bookingId: booking.id,
      customerId: params.customerId,
      reason: SYSTEM_CANCEL_REFUND_REASON,
      policyRefundAmount,
      requestedAmount: policyRefundAmount,
      retainedAmount: params.retainedAmount,
      actorUserId: params.customerId,
      req: params.req,
      auditAction: 'refund.system_obligation_created',
    });
  } catch {
    return null;
  }

  await executeRefundRequestAllocations({
    refundRequestId: row.id,
    actorUserId: params.customerId,
    req: params.req,
  });

  const refreshed = await prisma.refundRequest.findUniqueOrThrow({
    where: { id: row.id },
    include: { allocations: true },
  });
  return toRefundRequestSummary(refreshed);
}

/**
 * Phase 2 / 3C.4E.2A — idempotent full refund for owner-fault / force-majeure / arrival incidents.
 * Multi-capture safe.
 */
export async function ensureSystemOwnerFaultRefund(params: {
  bookingId: string;
  customerId: string;
  refundAmount: number;
  reasonLabel: string;
  req?: AuthenticatedRequest;
}): Promise<RefundRequestSummary | null> {
  if (params.refundAmount <= 0) return null;

  const booking = await prisma.booking.findFirst({
    where: { id: params.bookingId, userId: params.customerId },
    include: {
      payments: true,
      refundRequests: { include: { allocations: true } },
    },
  });
  if (!booking) return null;

  const existing = booking.refundRequests.find(
    (r) =>
      r.reason === params.reasonLabel &&
      (BLOCKING_REFUND_REQUEST_STATUSES as readonly string[]).includes(r.status),
  );
  if (existing) {
    if (existing.status === RefundRequestStatus.pending) {
      await executeRefundRequestAllocations({
        refundRequestId: existing.id,
        actorUserId: params.customerId,
        req: params.req,
      });
      const refreshed = await prisma.refundRequest.findUniqueOrThrow({
        where: { id: existing.id },
        include: { allocations: true },
      });
      return toRefundRequestSummary(refreshed);
    }
    return toRefundRequestSummary(existing);
  }

  const processed = booking.refundRequests.find(
    (r) => r.reason === params.reasonLabel && r.status === RefundRequestStatus.processed,
  );
  if (processed) return toRefundRequestSummary(processed);

  const funds = refundableCapturedFils(booking.payments, booking.refundRequests);
  const refundableJod = filsToJod(funds.refundable);
  const policyRefundAmount = Math.min(params.refundAmount, refundableJod);
  if (policyRefundAmount <= 0) return null;

  let row;
  try {
    row = await createRefundRequestWithAllocations({
      bookingId: booking.id,
      customerId: params.customerId,
      reason: params.reasonLabel,
      policyRefundAmount,
      requestedAmount: policyRefundAmount,
      retainedAmount: 0,
      actorUserId: params.customerId,
      req: params.req,
      auditAction: 'refund.owner_fault_obligation_created',
    });
  } catch {
    return null;
  }

  // Owner-fault: zero economics on captures involved (Booking snapshot remains authoritative).
  const captures = await getRefundableCapturedPayments(booking.id);
  for (const c of captures) {
    await prisma.payment.update({
      where: { id: c.paymentId },
      data: {
        ownerNetPayoutAmount: 0,
        platformCommissionAmount: 0,
        ownerGrossAmount: 0,
      },
    });
  }

  await executeRefundRequestAllocations({
    refundRequestId: row.id,
    actorUserId: params.customerId,
    req: params.req,
  });

  const refreshed = await prisma.refundRequest.findUniqueOrThrow({
    where: { id: row.id },
    include: { allocations: true },
  });
  return toRefundRequestSummary(refreshed);
}
