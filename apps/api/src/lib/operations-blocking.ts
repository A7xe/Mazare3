import {
  prisma,
  RefundRequestStatus,
  DisputeStatus,
} from '@mazare3/db';
import {
  BLOCKING_DISPUTE_STATUSES,
  BLOCKING_REFUND_REQUEST_STATUSES,
} from '@mazare3/shared';

export async function getBookingOperationsBlock(bookingId: string): Promise<{
  blocked: boolean;
  reason: string | null;
}> {
  const [refund, dispute] = await Promise.all([
    prisma.refundRequest.findFirst({
      where: {
        bookingId,
        status: { in: [...BLOCKING_REFUND_REQUEST_STATUSES] as RefundRequestStatus[] },
      },
      select: { id: true, status: true },
    }),
    prisma.dispute.findFirst({
      where: {
        bookingId,
        status: { in: [...BLOCKING_DISPUTE_STATUSES] as DisputeStatus[] },
      },
      select: { id: true, status: true },
    }),
  ]);

  if (refund) {
    return {
      blocked: true,
      reason: `refund_request_${refund.status}`,
    };
  }
  if (dispute) {
    return {
      blocked: true,
      reason: `dispute_${dispute.status}`,
    };
  }
  return { blocked: false, reason: null };
}
