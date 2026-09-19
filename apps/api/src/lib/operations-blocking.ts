import {
  prisma,
  RefundRequestStatus,
  DisputeStatus,
  BookingIncidentStatus,
} from '@mazare3/db';
import {
  BLOCKING_DISPUTE_STATUSES,
  BLOCKING_REFUND_REQUEST_STATUSES,
} from '@mazare3/shared';

export async function getBookingOperationsBlocks(
  bookingIds: string[],
): Promise<Map<string, { blocked: boolean; reason: string | null }>> {
  const unique = [...new Set(bookingIds.filter(Boolean))];
  const result = new Map<string, { blocked: boolean; reason: string | null }>();
  for (const id of unique) result.set(id, { blocked: false, reason: null });
  if (unique.length === 0) return result;

  const [refunds, disputes, incidents] = await Promise.all([
    prisma.refundRequest.findMany({
      where: {
        bookingId: { in: unique },
        status: {
          in: [
            ...BLOCKING_REFUND_REQUEST_STATUSES,
            RefundRequestStatus.processed,
          ] as RefundRequestStatus[],
        },
      },
      select: { bookingId: true, status: true },
    }),
    prisma.dispute.findMany({
      where: {
        bookingId: { in: unique },
        status: { in: [...BLOCKING_DISPUTE_STATUSES] as DisputeStatus[] },
      },
      select: { bookingId: true, status: true },
    }),
    prisma.bookingIncident.findMany({
      where: {
        bookingId: { in: unique },
        status: {
          in: [
            BookingIncidentStatus.open,
            BookingIncidentStatus.under_review,
          ],
        },
      },
      select: { bookingId: true, status: true, type: true },
    }),
  ]);

  for (const refund of refunds) {
    const current = result.get(refund.bookingId);
    if (current && !current.blocked) {
      result.set(refund.bookingId, {
        blocked: true,
        reason: `refund_request_${refund.status}`,
      });
    }
  }
  for (const dispute of disputes) {
    const current = result.get(dispute.bookingId);
    if (current && !current.blocked) {
      result.set(dispute.bookingId, {
        blocked: true,
        reason: `dispute_${dispute.status}`,
      });
    }
  }
  for (const incident of incidents) {
    const current = result.get(incident.bookingId);
    if (current && !current.blocked) {
      result.set(incident.bookingId, {
        blocked: true,
        reason: `incident_${incident.type}_${incident.status}`,
      });
    }
  }
  return result;
}

export async function getBookingOperationsBlock(bookingId: string): Promise<{
  blocked: boolean;
  reason: string | null;
}> {
  const map = await getBookingOperationsBlocks([bookingId]);
  return map.get(bookingId) ?? { blocked: false, reason: null };
}
