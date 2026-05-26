import { BookingStatus } from '@mazare3/db';

/** Statuses that reserve an availability slot. */
export const SLOT_HOLDING_STATUSES: BookingStatus[] = [
  BookingStatus.pending_payment,
  BookingStatus.pending,
  BookingStatus.confirmed,
];

/** Trial payment simulate — production forbidden; dev requires PAYMENT_SIMULATE_ENABLED=true. */
export function isDevPaymentSimulateAllowed(): boolean {
  if ((process.env.NODE_ENV ?? 'development') === 'production') return false;
  return process.env.PAYMENT_SIMULATE_ENABLED === 'true';
}
