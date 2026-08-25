import { AvailabilitySlotStatus, Prisma } from '@mazare3/db';
import { SLOT_HOLDING_STATUSES } from './payment-hold.js';

export async function releaseSlotIfUnheld(
  tx: Prisma.TransactionClient,
  availabilitySlotId: string,
  exceptBookingId: string,
): Promise<boolean> {
  const holding = await tx.booking.findFirst({
    where: {
      availabilitySlotId,
      id: { not: exceptBookingId },
      status: { in: SLOT_HOLDING_STATUSES },
    },
    select: { id: true },
  });
  if (holding) return false;
  const result = await tx.availabilitySlot.updateMany({
    where: {
      id: availabilitySlotId,
      status: { not: AvailabilitySlotStatus.available },
    },
    data: { status: AvailabilitySlotStatus.available },
  });
  return result.count > 0;
}
