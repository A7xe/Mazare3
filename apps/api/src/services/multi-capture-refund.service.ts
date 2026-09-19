/**
 * Phase 3C.4E.2A — Multi-capture refund integrity.
 *
 * Root cause (pre-fix): ensureSystemCancellationRefund / ensureSystemOwnerFaultRefund /
 * patchAdminRefundRequest selected the newest succeeded Payment and called PSP refund for the
 * FULL Booking obligation against that single capture (e.g. 200 JOD against a 60 JOD deposit).
 *
 * Rule: RefundRequest is the Booking-level obligation; RefundPaymentAllocation executes
 * per capture. Ordering: NEWEST capture first (matches prior single-payment selection).
 */

import {
  prisma,
  PaymentStatus,
  Prisma,
  RefundAllocationStatus,
  RefundRequestStatus,
  RefundStatus,
  PayoutStatus,
  type Payment,
  type RefundPaymentAllocation,
  type RefundRequest,
} from '@mazare3/db';
import { filsToJod, jodToFils } from '@mazare3/shared';
import { createAuditLog } from './audit.service.js';
import { syncPayoutStatusForPayment } from './payment-payout.service.js';
import { getPaymentGateway } from './payment/payment-provider.registry.js';
import { providerRefundIdempotencyKey } from './payment/payment-provider.interface.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

export type RefundableCapturedPayment = {
  paymentId: string;
  purpose: string;
  provider: Payment['provider'];
  providerRef: string | null;
  currency: string;
  capturedFils: number;
  alreadyRefundedFils: number;
  remainingRefundableFils: number;
  capturedAt: Date;
};

export type RefundAllocationPlanItem = {
  paymentId: string;
  allocatedFils: number;
  allocatedAmountJod: number;
};

/** Newest capture first — safest match to prior single-payment selection convention. */
export const MULTI_CAPTURE_REFUND_ALLOCATION_ORDER = 'NEWEST_CAPTURE_FIRST' as const;

/**
 * Authoritative refundable captures for a Booking.
 * Excludes failed/cancelled/expired payments. Subtracts succeeded allocation refunds
 * and legacy payment-level processed refunds without allocations.
 */
export async function getRefundableCapturedPayments(
  bookingId: string,
): Promise<RefundableCapturedPayment[]> {
  const payments = await prisma.payment.findMany({
    where: { bookingId, status: PaymentStatus.succeeded },
    include: {
      refundAllocations: {
        where: { status: RefundAllocationStatus.succeeded },
        select: { refundedAmount: true, allocatedAmount: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Legacy RefundRequests without allocations (pre-3C.4E.2A), keyed by paymentId.
  const legacyRequests = await prisma.refundRequest.findMany({
    where: {
      bookingId,
      status: { in: [RefundRequestStatus.processed, RefundRequestStatus.approved] },
      allocations: { none: {} },
    },
    select: {
      paymentId: true,
      approvedAmount: true,
      requestedAmount: true,
    },
  });
  const legacyByPayment = new Map<string, number>();
  for (const rr of legacyRequests) {
    const fils = jodToFils(
      decimalToNumber(rr.approvedAmount ?? rr.requestedAmount),
    );
    legacyByPayment.set(rr.paymentId, (legacyByPayment.get(rr.paymentId) ?? 0) + fils);
  }

  const rows: RefundableCapturedPayment[] = [];
  for (const p of payments) {
    const capturedFils = jodToFils(decimalToNumber(p.amount));
    let alreadyRefundedFils = 0;
    for (const a of p.refundAllocations) {
      alreadyRefundedFils += jodToFils(decimalToNumber(a.refundedAmount ?? a.allocatedAmount));
    }
    if (p.refundAllocations.length === 0) {
      const legacy = legacyByPayment.get(p.id) ?? 0;
      alreadyRefundedFils = Math.max(alreadyRefundedFils, Math.min(capturedFils, legacy));
      if (p.refundStatus === RefundStatus.processed) {
        const fromCancel =
          p.cancellationRefundAmount != null
            ? jodToFils(decimalToNumber(p.cancellationRefundAmount))
            : capturedFils;
        alreadyRefundedFils = Math.max(
          alreadyRefundedFils,
          Math.min(capturedFils, fromCancel),
        );
      }
    }

    alreadyRefundedFils = Math.min(capturedFils, alreadyRefundedFils);
    const remainingRefundableFils = Math.max(0, capturedFils - alreadyRefundedFils);
    if (remainingRefundableFils <= 0) continue;

    rows.push({
      paymentId: p.id,
      purpose: p.purpose,
      provider: p.provider,
      providerRef: p.providerRef,
      currency: p.currency,
      capturedFils,
      alreadyRefundedFils,
      remainingRefundableFils,
      capturedAt: p.succeededAt ?? p.createdAt,
    });
  }

  rows.sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
  return rows;
}

/** Deterministic allocation: newest first; never exceed remaining refundable per capture. */
export function allocateRefundAcrossCaptures(params: {
  requestedFils: number;
  captures: RefundableCapturedPayment[];
}): RefundAllocationPlanItem[] {
  let remaining = Math.max(0, Math.floor(params.requestedFils));
  const plan: RefundAllocationPlanItem[] = [];
  const ordered = [...params.captures].sort(
    (a, b) => b.capturedAt.getTime() - a.capturedAt.getTime(),
  );
  for (const c of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, c.remainingRefundableFils);
    if (take <= 0) continue;
    plan.push({
      paymentId: c.paymentId,
      allocatedFils: take,
      allocatedAmountJod: filsToJod(take),
    });
    remaining -= take;
  }
  return plan;
}

export function sumAllocationFils(plan: RefundAllocationPlanItem[]): number {
  return plan.reduce((s, p) => s + p.allocatedFils, 0);
}

export type AggregateRefundView = {
  requiredFils: number;
  refundedFils: number;
  remainingFils: number;
  complete: boolean;
  partiallyRefunded: boolean;
  hasFailedAllocation: boolean;
  customerLabel: 'pending' | 'partially_refunded' | 'refunded' | 'action_required';
};

export function computeAggregateRefundView(params: {
  requestedFils: number;
  allocations: Array<{ status: string; refundedAmount: number; allocatedAmount: number }>;
}): AggregateRefundView {
  const requiredFils = Math.max(0, params.requestedFils);
  let refundedFils = 0;
  let hasFailed = false;
  let hasPending = false;
  for (const a of params.allocations) {
    if (a.status === RefundAllocationStatus.succeeded || a.status === 'succeeded') {
      refundedFils += jodToFils(a.refundedAmount || a.allocatedAmount);
    } else if (a.status === RefundAllocationStatus.failed || a.status === 'failed') {
      hasFailed = true;
    } else if (a.status === RefundAllocationStatus.pending || a.status === 'pending') {
      hasPending = true;
    }
  }
  const remainingFils = Math.max(0, requiredFils - refundedFils);
  const complete = remainingFils <= 0 && requiredFils > 0;
  const partiallyRefunded = refundedFils > 0 && !complete;
  let customerLabel: AggregateRefundView['customerLabel'] = 'pending';
  if (complete) customerLabel = 'refunded';
  else if (partiallyRefunded && hasFailed) customerLabel = 'action_required';
  else if (partiallyRefunded) customerLabel = 'partially_refunded';
  else if (hasFailed && !hasPending) customerLabel = 'action_required';
  return {
    requiredFils,
    refundedFils,
    remainingFils,
    complete,
    partiallyRefunded,
    hasFailedAllocation: hasFailed,
    customerLabel,
  };
}

async function ensureAllocationsForRequest(params: {
  refundRequestId: string;
  requestedJod: number;
  bookingId: string;
}): Promise<RefundPaymentAllocation[]> {
  const existing = await prisma.refundPaymentAllocation.findMany({
    where: { refundRequestId: params.refundRequestId },
  });
  if (existing.length > 0) return existing;

  const captures = await getRefundableCapturedPayments(params.bookingId);
  const plan = allocateRefundAcrossCaptures({
    requestedFils: jodToFils(params.requestedJod),
    captures,
  });
  if (plan.length === 0) return [];

  const created: RefundPaymentAllocation[] = [];
  for (const item of plan) {
    const row = await prisma.refundPaymentAllocation.create({
      data: {
        refundRequestId: params.refundRequestId,
        paymentId: item.paymentId,
        allocatedAmount: item.allocatedAmountJod,
        refundedAmount: 0,
        status: RefundAllocationStatus.pending,
        idempotencyKey: providerRefundIdempotencyKey(params.refundRequestId, item.paymentId),
      },
    });
    created.push(row);
  }
  await createAuditLog({
    action: 'refund.allocations_created',
    entityType: 'refund_request',
    entityId: params.refundRequestId,
    metadata: {
      bookingId: params.bookingId,
      allocationCount: created.length,
      order: MULTI_CAPTURE_REFUND_ALLOCATION_ORDER,
      amountsJod: created.map((c) => decimalToNumber(c.allocatedAmount)),
    },
  });
  return created;
}

async function refreshRefundRequestAggregate(refundRequestId: string): Promise<RefundRequest> {
  const row = await prisma.refundRequest.findUniqueOrThrow({
    where: { id: refundRequestId },
    include: { allocations: true },
  });
  const view = computeAggregateRefundView({
    requestedFils: jodToFils(decimalToNumber(row.requestedAmount)),
    allocations: row.allocations.map((a) => ({
      status: a.status,
      refundedAmount: decimalToNumber(a.refundedAmount),
      allocatedAmount: decimalToNumber(a.allocatedAmount),
    })),
  });
  const refundedAmount = filsToJod(view.refundedFils);
  let status = row.status;
  let adminNote = row.adminNote;
  if (view.complete) {
    status = RefundRequestStatus.processed;
  } else if (view.partiallyRefunded || view.hasFailedAllocation) {
    status = RefundRequestStatus.pending;
    adminNote =
      view.hasFailedAllocation
        ? `PARTIAL_REFUND_ACTION_REQUIRED: refunded ${refundedAmount} of ${decimalToNumber(row.requestedAmount)} JOD; retry failed allocation(s)`
        : `PARTIAL_REFUND_IN_PROGRESS: refunded ${refundedAmount} of ${decimalToNumber(row.requestedAmount)} JOD`;
  }

  return prisma.refundRequest.update({
    where: { id: refundRequestId },
    data: {
      refundedAmount,
      approvedAmount: view.complete ? decimalToNumber(row.requestedAmount) : row.approvedAmount,
      status,
      adminNote,
    },
  });
}

/**
 * Execute pending/failed allocations for a RefundRequest. Idempotent per allocation.
 * Does not re-refund succeeded allocations. Does not invent money never captured.
 */
export async function executeRefundRequestAllocations(params: {
  refundRequestId: string;
  actorUserId?: string | null;
  req?: AuthenticatedRequest;
}): Promise<{
  refundRequest: RefundRequest;
  view: AggregateRefundView;
  allocationResults: Array<{ allocationId: string; status: string; error?: string }>;
}> {
  const rr = await prisma.refundRequest.findUniqueOrThrow({
    where: { id: params.refundRequestId },
    include: { booking: true },
  });

  await ensureAllocationsForRequest({
    refundRequestId: rr.id,
    requestedJod: decimalToNumber(rr.requestedAmount),
    bookingId: rr.bookingId,
  });

  const allocations = await prisma.refundPaymentAllocation.findMany({
    where: { refundRequestId: rr.id },
    include: { payment: true },
    orderBy: { createdAt: 'asc' },
  });

  // Process newest payment first among pending/failed.
  const ordered = [...allocations].sort(
    (a, b) => b.payment.createdAt.getTime() - a.payment.createdAt.getTime(),
  );

  const allocationResults: Array<{ allocationId: string; status: string; error?: string }> = [];

  for (const alloc of ordered) {
    if (alloc.status === RefundAllocationStatus.succeeded) {
      allocationResults.push({ allocationId: alloc.id, status: 'succeeded' });
      continue;
    }
    if (alloc.status === RefundAllocationStatus.cancelled) {
      allocationResults.push({ allocationId: alloc.id, status: 'cancelled' });
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "RefundPaymentAllocation" WHERE id = ${alloc.id} FOR UPDATE`,
      );
    });

    const locked = await prisma.refundPaymentAllocation.findUniqueOrThrow({
      where: { id: alloc.id },
      include: { payment: true },
    });
    if (locked.status === RefundAllocationStatus.succeeded) {
      allocationResults.push({ allocationId: locked.id, status: 'succeeded' });
      continue;
    }

    const amount = decimalToNumber(locked.allocatedAmount);
    if (amount <= 0) {
      await prisma.refundPaymentAllocation.update({
        where: { id: locked.id },
        data: { status: RefundAllocationStatus.cancelled, lastError: 'zero_allocation' },
      });
      allocationResults.push({ allocationId: locked.id, status: 'cancelled' });
      continue;
    }

    await prisma.refundPaymentAllocation.update({
      where: { id: locked.id },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });

    await createAuditLog({
      actorUserId: params.actorUserId ?? undefined,
      action: 'refund.allocation_attempt',
      entityType: 'refund_payment_allocation',
      entityId: locked.id,
      metadata: {
        refundRequestId: rr.id,
        paymentId: locked.paymentId,
        amount,
        attempt: locked.attemptCount + 1,
      },
      req: params.req,
    });

    try {
      if (!locked.payment.providerRef) {
        throw new Error('MISSING_PROVIDER_REF');
      }
      const gateway = getPaymentGateway(locked.payment.provider);
      const result = await gateway.refundPayment({
        paymentId: locked.paymentId,
        providerRef: locked.payment.providerRef,
        amount,
        currency: locked.payment.currency,
        refundRequestId: rr.id,
        idempotencyKey: locked.idempotencyKey,
      });

      if (result.status === 'succeeded') {
        await prisma.refundPaymentAllocation.update({
          where: { id: locked.id },
          data: {
            status: RefundAllocationStatus.succeeded,
            refundedAmount: amount,
            providerRefundRef: result.providerRef,
            succeededAt: new Date(),
            lastError: null,
          },
        });
        const priorRefunded = await prisma.refundPaymentAllocation.aggregate({
          where: {
            paymentId: locked.paymentId,
            status: RefundAllocationStatus.succeeded,
            id: { not: locked.id },
          },
          _sum: { refundedAmount: true },
        });
        const priorJod = priorRefunded._sum.refundedAmount
          ? decimalToNumber(priorRefunded._sum.refundedAmount)
          : 0;
        await prisma.payment.update({
          where: { id: locked.paymentId },
          data: {
            payoutStatus: PayoutStatus.blocked,
            refundStatus: RefundStatus.processed,
            cancellationRefundAmount: priorJod + amount,
          },
        });
        await syncPayoutStatusForPayment(locked.paymentId);
        await createAuditLog({
          actorUserId: params.actorUserId ?? undefined,
          action: 'refund.allocation_succeeded',
          entityType: 'refund_payment_allocation',
          entityId: locked.id,
          metadata: {
            refundRequestId: rr.id,
            paymentId: locked.paymentId,
            amount,
            providerRefundRef: result.providerRef,
          },
          req: params.req,
        });
        allocationResults.push({ allocationId: locked.id, status: 'succeeded' });
      } else if (result.status === 'pending') {
        await prisma.refundPaymentAllocation.update({
          where: { id: locked.id },
          data: {
            status: RefundAllocationStatus.pending,
            providerRefundRef: result.providerRef,
            lastError: 'provider_pending_reconcile_before_retry',
          },
        });
        allocationResults.push({
          allocationId: locked.id,
          status: 'pending',
          error: 'provider_pending',
        });
      } else {
        await prisma.refundPaymentAllocation.update({
          where: { id: locked.id },
          data: {
            status: RefundAllocationStatus.failed,
            lastError: result.providerStatus ?? result.status,
            providerRefundRef: result.providerRef,
          },
        });
        await createAuditLog({
          actorUserId: params.actorUserId ?? undefined,
          action: 'refund.allocation_failed',
          entityType: 'refund_payment_allocation',
          entityId: locked.id,
          metadata: {
            refundRequestId: rr.id,
            paymentId: locked.paymentId,
            amount,
            providerStatus: result.providerStatus ?? result.status,
          },
          req: params.req,
        });
        allocationResults.push({
          allocationId: locked.id,
          status: 'failed',
          error: result.providerStatus ?? result.status,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error';
      const alreadyRefunded =
        /already.?refunded|refund.?already|duplicate.?refund|PREVIOUSLY_REFUNDED/i.test(message);
      if (alreadyRefunded) {
        // Provider truth: obligation already satisfied for this capture — do not issue another refund.
        await prisma.refundPaymentAllocation.update({
          where: { id: locked.id },
          data: {
            status: RefundAllocationStatus.succeeded,
            refundedAmount: amount,
            succeededAt: new Date(),
            lastError: null,
            providerRefundRef: locked.providerRefundRef ?? `reconciled_${locked.id.slice(0, 8)}`,
          },
        });
        await createAuditLog({
          actorUserId: params.actorUserId ?? undefined,
          action: 'refund.allocation_reconciled',
          entityType: 'refund_payment_allocation',
          entityId: locked.id,
          metadata: {
            refundRequestId: rr.id,
            paymentId: locked.paymentId,
            amount,
            reason: 'provider_already_refunded',
          },
          req: params.req,
        });
        allocationResults.push({ allocationId: locked.id, status: 'succeeded' });
        continue;
      }
      await prisma.refundPaymentAllocation.update({
        where: { id: locked.id },
        data: {
          status: RefundAllocationStatus.failed,
          lastError: message.slice(0, 500),
        },
      });
      await createAuditLog({
        actorUserId: params.actorUserId ?? undefined,
        action: 'refund.allocation_failed',
        entityType: 'refund_payment_allocation',
        entityId: locked.id,
        metadata: { refundRequestId: rr.id, paymentId: locked.paymentId, error: message },
        req: params.req,
      });
      allocationResults.push({ allocationId: locked.id, status: 'failed', error: message });
    }
  }

  const updated = await refreshRefundRequestAggregate(rr.id);
  const allocs = await prisma.refundPaymentAllocation.findMany({ where: { refundRequestId: rr.id } });
  const view = computeAggregateRefundView({
    requestedFils: jodToFils(decimalToNumber(updated.requestedAmount)),
    allocations: allocs.map((a) => ({
      status: a.status,
      refundedAmount: decimalToNumber(a.refundedAmount),
      allocatedAmount: decimalToNumber(a.allocatedAmount),
    })),
  });

  if (view.complete) {
    await createAuditLog({
      actorUserId: params.actorUserId ?? undefined,
      action: 'refund.request_completed',
      entityType: 'refund_request',
      entityId: rr.id,
      metadata: {
        bookingId: rr.bookingId,
        refundedAmount: decimalToNumber(updated.refundedAmount),
        requestedAmount: decimalToNumber(updated.requestedAmount),
      },
      req: params.req,
    });
  }

  return { refundRequest: updated, view, allocationResults };
}

/** Create Booking-level RefundRequest + allocation rows (no PSP call). */
export async function createRefundRequestWithAllocations(params: {
  bookingId: string;
  customerId: string;
  reason: string;
  policyRefundAmount: number;
  requestedAmount: number;
  retainedAmount?: number;
  actorUserId?: string | null;
  req?: AuthenticatedRequest;
  auditAction?: string;
}): Promise<RefundRequest> {
  const captures = await getRefundableCapturedPayments(params.bookingId);
  if (captures.length === 0) {
    throw new Error('NO_REFUNDABLE_CAPTURES');
  }
  const requestedFils = jodToFils(params.requestedAmount);
  const plan = allocateRefundAcrossCaptures({
    requestedFils,
    captures,
  });
  const plannedFils = sumAllocationFils(plan);
  if (plannedFils <= 0) {
    throw new Error('NO_REFUNDABLE_CAPTURES');
  }
  // Cap obligation to what can actually be allocated across captures.
  const effectiveRequested = filsToJod(plannedFils);
  const anchorPaymentId = plan[0]!.paymentId;

  const row = await prisma.refundRequest.create({
    data: {
      bookingId: params.bookingId,
      paymentId: anchorPaymentId,
      customerId: params.customerId,
      reason: params.reason,
      policyRefundAmount: params.policyRefundAmount,
      requestedAmount: effectiveRequested,
      status: RefundRequestStatus.pending,
      refundedAmount: 0,
    },
  });

  for (const item of plan) {
    await prisma.refundPaymentAllocation.create({
      data: {
        refundRequestId: row.id,
        paymentId: item.paymentId,
        allocatedAmount: item.allocatedAmountJod,
        status: RefundAllocationStatus.pending,
        idempotencyKey: providerRefundIdempotencyKey(row.id, item.paymentId),
      },
    });
    await prisma.payment.update({
      where: { id: item.paymentId },
      data: {
        payoutStatus: PayoutStatus.blocked,
        refundStatus: RefundStatus.pending,
        cancellationRefundAmount: item.allocatedAmountJod,
        ...(params.retainedAmount != null && item.paymentId === anchorPaymentId
          ? { cancellationPenaltyAmount: params.retainedAmount }
          : {}),
      },
    });
    await syncPayoutStatusForPayment(item.paymentId);
  }

  await createAuditLog({
    actorUserId: params.actorUserId ?? params.customerId,
    action: params.auditAction ?? 'refund.system_obligation_created',
    entityType: 'refund_request',
    entityId: row.id,
    metadata: {
      bookingId: params.bookingId,
      requestedAmount: effectiveRequested,
      allocationCount: plan.length,
      order: MULTI_CAPTURE_REFUND_ALLOCATION_ORDER,
      paymentIds: plan.map((p) => p.paymentId),
    },
    req: params.req,
  });

  return row;
}

/**
 * Map a provider refund webhook/callback onto the matching allocation for a Payment.
 * Does NOT mark the Booking RefundRequest complete unless aggregate obligation is satisfied.
 */
export async function applyProviderRefundEventToAllocations(params: {
  paymentId: string;
  succeeded: boolean;
  providerRefundRef?: string | null;
  providerEventId?: string | null;
}): Promise<{ updatedAllocationIds: string[]; requestCompleted: boolean }> {
  const pending = await prisma.refundPaymentAllocation.findMany({
    where: {
      paymentId: params.paymentId,
      status: {
        in: [RefundAllocationStatus.pending, RefundAllocationStatus.failed],
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  if (pending.length === 0) {
    return { updatedAllocationIds: [], requestCompleted: false };
  }

  const updatedAllocationIds: string[] = [];
  const requestIds = new Set<string>();

  for (const alloc of pending) {
    if (params.succeeded) {
      await prisma.refundPaymentAllocation.update({
        where: { id: alloc.id },
        data: {
          status: RefundAllocationStatus.succeeded,
          refundedAmount: decimalToNumber(alloc.allocatedAmount),
          providerRefundRef: params.providerRefundRef ?? alloc.providerRefundRef,
          succeededAt: new Date(),
          lastError: null,
        },
      });
      updatedAllocationIds.push(alloc.id);
      requestIds.add(alloc.refundRequestId);
      await createAuditLog({
        action: 'refund.allocation_webhook_succeeded',
        entityType: 'refund_payment_allocation',
        entityId: alloc.id,
        metadata: {
          paymentId: params.paymentId,
          providerEventId: params.providerEventId ?? null,
          providerRefundRef: params.providerRefundRef ?? null,
        },
      });
      // Only apply webhook success to the oldest pending allocation for this payment
      // (one provider event ↔ one allocation).
      break;
    } else {
      await prisma.refundPaymentAllocation.update({
        where: { id: alloc.id },
        data: {
          status: RefundAllocationStatus.failed,
          lastError: 'provider_webhook_refund_failed',
          providerRefundRef: params.providerRefundRef ?? alloc.providerRefundRef,
        },
      });
      updatedAllocationIds.push(alloc.id);
      requestIds.add(alloc.refundRequestId);
      break;
    }
  }

  let requestCompleted = false;
  for (const rrId of requestIds) {
    const updated = await refreshRefundRequestAggregate(rrId);
    if (updated.status === RefundRequestStatus.processed) requestCompleted = true;
  }
  return { updatedAllocationIds, requestCompleted };
}

/**
 * Phase 3C.4E.2C — scheduled refund reconciliation.
 *
 * Safe automated path: pending allocations that previously returned provider_pending
 * (or never left pending with low attempt count). Does NOT auto-retry permanent failures
 * (status=failed) — those remain manual/action_required. Idempotent: succeeded allocations
 * are never re-refunded.
 */
export async function reconcilePendingRefundAllocations(options?: {
  batchSize?: number;
  maxSafeAttempts?: number;
}): Promise<{
  processedRequests: number;
  allocationsSucceeded: number;
  allocationsPending: number;
  allocationsFailed: number;
  skippedManual: number;
}> {
  const batchSize = options?.batchSize ?? 25;
  const maxSafeAttempts = options?.maxSafeAttempts ?? 8;

  const skippedManual = await prisma.refundPaymentAllocation.count({
    where: { status: RefundAllocationStatus.failed },
  });

  const pending = await prisma.refundPaymentAllocation.findMany({
    where: {
      status: RefundAllocationStatus.pending,
      attemptCount: { lt: maxSafeAttempts },
    },
    select: { refundRequestId: true },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });

  const requestIds = [...new Set(pending.map((p) => p.refundRequestId))];
  let allocationsSucceeded = 0;
  let allocationsPending = 0;
  let allocationsFailed = 0;

  for (const refundRequestId of requestIds) {
    try {
      const result = await executeRefundRequestAllocations({
        refundRequestId,
        actorUserId: null,
      });
      for (const r of result.allocationResults) {
        if (r.status === 'succeeded') allocationsSucceeded += 1;
        else if (r.status === 'pending') allocationsPending += 1;
        else if (r.status === 'failed') allocationsFailed += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[reconcile-pending-refunds] request=${refundRequestId}`, msg);
      allocationsFailed += 1;
    }
  }

  return {
    processedRequests: requestIds.length,
    allocationsSucceeded,
    allocationsPending,
    allocationsFailed,
    skippedManual,
  };
}
