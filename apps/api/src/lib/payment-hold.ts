import { BookingStatus } from '@mazare3/db';
import { isAppEnvProduction } from '../config/app-env.js';

/** Statuses that reserve an availability slot. */
export const SLOT_HOLDING_STATUSES: BookingStatus[] = [
  BookingStatus.pending_owner_approval,
  BookingStatus.pending_payment,
  BookingStatus.pending,
  BookingStatus.confirmed,
];

export const SLOT_HOLDING_STATUS_SQL = `'pending_owner_approval', 'pending_payment', 'pending', 'confirmed'`;

/** Trial payment simulate — forbidden on APP_ENV=production; requires PAYMENT_SIMULATE_ENABLED=true. */
export function isDevPaymentSimulateAllowed(): boolean {
  if (isAppEnvProduction()) return false;
  return process.env.PAYMENT_SIMULATE_ENABLED === 'true';
}
