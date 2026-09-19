/**
 * Phase 3C.4E.2A — Read-only multi-capture refund preflight.
 * No mutations. No secrets.
 */
import { prisma, PaymentStatus, RefundRequestStatus, RefundAllocationStatus } from '@mazare3/db';
import { jodToFils } from '@mazare3/shared';

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

export type MultiCaptureRefundPreflightReport = {
  phase: '3C.4E.2A';
  mutation: false;
  generatedAt: string;
  counts: {
    bookingsWithMultipleSuccessfulCaptures: number;
    bookingsWithRefundRequestAndMultipleCaptures: number;
    potentiallyIncompleteLegacyMultiCaptureRefunds: number;
    refundAmountExceedsSingleCaptureButWithinAggregate: number;
    duplicateProviderRefundReferenceAnomalies: number;
    refundRequestsMarkedCompleteWhileAggregateIncomplete: number;
  };
  sampleBookingIds: {
    multiCapture: string[];
    incompleteLegacy: string[];
    completeWhileIncomplete: string[];
  };
};

export async function runMultiCaptureRefundPreflightReport(): Promise<MultiCaptureRefundPreflightReport> {
  const succeededGroups = await prisma.payment.groupBy({
    by: ['bookingId'],
    where: { status: PaymentStatus.succeeded },
    _count: { _all: true },
  });
  const multiCaptureBookingIds = succeededGroups
    .filter((g) => g._count._all > 1)
    .map((g) => g.bookingId);

  const refundsOnMulti = multiCaptureBookingIds.length
    ? await prisma.refundRequest.findMany({
        where: { bookingId: { in: multiCaptureBookingIds } },
        select: {
          id: true,
          bookingId: true,
          status: true,
          requestedAmount: true,
          approvedAmount: true,
          refundedAmount: true,
          paymentId: true,
          allocations: {
            select: {
              status: true,
              allocatedAmount: true,
              refundedAmount: true,
              providerRefundRef: true,
            },
          },
        },
      })
    : [];

  const bookingsWithRrAndMulti = new Set(refundsOnMulti.map((r) => r.bookingId));

  let incompleteLegacy = 0;
  const incompleteLegacyIds: string[] = [];
  let exceedsSingle = 0;
  let completeWhileIncomplete = 0;
  const completeWhileIncompleteIds: string[] = [];

  const paymentsByBooking = multiCaptureBookingIds.length
    ? await prisma.payment.findMany({
        where: {
          bookingId: { in: multiCaptureBookingIds },
          status: PaymentStatus.succeeded,
        },
        select: { id: true, bookingId: true, amount: true },
      })
    : [];
  const capturesByBooking = new Map<string, { id: string; fils: number }[]>();
  for (const p of paymentsByBooking) {
    const list = capturesByBooking.get(p.bookingId) ?? [];
    list.push({ id: p.id, fils: jodToFils(decimalToNumber(p.amount)) });
    capturesByBooking.set(p.bookingId, list);
  }

  for (const rr of refundsOnMulti) {
    const captures = capturesByBooking.get(rr.bookingId) ?? [];
    const maxSingle = captures.reduce((m, c) => Math.max(m, c.fils), 0);
    const aggregate = captures.reduce((s, c) => s + c.fils, 0);
    const required = jodToFils(decimalToNumber(rr.approvedAmount ?? rr.requestedAmount));

    if (required > maxSingle && required <= aggregate) {
      exceedsSingle += 1;
    }

    const allocSucceeded = rr.allocations
      .filter((a) => a.status === RefundAllocationStatus.succeeded)
      .reduce(
        (s, a) => s + jodToFils(decimalToNumber(a.refundedAmount || a.allocatedAmount)),
        0,
      );

    if (rr.allocations.length === 0 && required > maxSingle) {
      // Legacy single-payment execution path on a multi-capture booking.
      if (
        rr.status === RefundRequestStatus.processed ||
        rr.status === RefundRequestStatus.approved
      ) {
        incompleteLegacy += 1;
        if (incompleteLegacyIds.length < 20) incompleteLegacyIds.push(rr.bookingId);
      } else if (rr.status === RefundRequestStatus.pending) {
        incompleteLegacy += 1;
        if (incompleteLegacyIds.length < 20) incompleteLegacyIds.push(rr.bookingId);
      }
    }

    if (rr.status === RefundRequestStatus.processed) {
      const refunded =
        rr.allocations.length > 0
          ? allocSucceeded
          : jodToFils(decimalToNumber(rr.refundedAmount || rr.approvedAmount || rr.requestedAmount));
      if (refunded + 1 < required) {
        // +1 fils tolerance
        completeWhileIncomplete += 1;
        if (completeWhileIncompleteIds.length < 20) completeWhileIncompleteIds.push(rr.bookingId);
      }
    }
  }

  const refs = await prisma.refundPaymentAllocation.findMany({
    where: { providerRefundRef: { not: null } },
    select: { providerRefundRef: true },
  });
  const refCounts = new Map<string, number>();
  for (const r of refs) {
    if (!r.providerRefundRef) continue;
    refCounts.set(r.providerRefundRef, (refCounts.get(r.providerRefundRef) ?? 0) + 1);
  }
  let duplicateRefs = 0;
  for (const n of refCounts.values()) {
    if (n > 1) duplicateRefs += 1;
  }

  return {
    phase: '3C.4E.2A',
    mutation: false,
    generatedAt: new Date().toISOString(),
    counts: {
      bookingsWithMultipleSuccessfulCaptures: multiCaptureBookingIds.length,
      bookingsWithRefundRequestAndMultipleCaptures: bookingsWithRrAndMulti.size,
      potentiallyIncompleteLegacyMultiCaptureRefunds: incompleteLegacy,
      refundAmountExceedsSingleCaptureButWithinAggregate: exceedsSingle,
      duplicateProviderRefundReferenceAnomalies: duplicateRefs,
      refundRequestsMarkedCompleteWhileAggregateIncomplete: completeWhileIncomplete,
    },
    sampleBookingIds: {
      multiCapture: multiCaptureBookingIds.slice(0, 20),
      incompleteLegacy: incompleteLegacyIds,
      completeWhileIncomplete: completeWhileIncompleteIds,
    },
  };
}
