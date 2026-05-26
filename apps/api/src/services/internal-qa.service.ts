import { prisma } from '@mazare3/db';
import { AppError } from '../lib/errors.js';

function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d));
}

/** QA only: move booking slot date into the past so dispute E2E/QA can run. */
export async function qaBackdateBookingSlot(bookingId: string, dateIso: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { availabilitySlotId: true },
  });
  if (!booking) {
    throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  }
  const date = parseDateOnly(dateIso);
  await prisma.availabilitySlot.update({
    where: { id: booking.availabilitySlotId },
    data: { date },
  });
  return { bookingId, date: dateIso };
}

/** QA only: set payoutAvailableAt in the past so admin can mark paid. */
export async function qaBackdatePayoutEligible(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true },
  });
  if (!payment) {
    throw new AppError(404, 'NOT_FOUND', 'Payment not found');
  }
  const past = new Date(Date.now() - 48 * 60 * 60 * 1000);
  await prisma.payment.update({
    where: { id: paymentId },
    data: { payoutAvailableAt: past },
  });
  return { paymentId, payoutAvailableAt: past.toISOString() };
}
