import { BookingStatus } from '@mazare3/db';
import { isAppEnvProduction } from '../config/app-env.js';
import { AppError } from './errors.js';

/**
 * Phase 3C.4E.3 — Booking statuses that reserve an AvailabilitySlot.
 * Must match PostgreSQL partial unique index
 * `Booking_one_holding_per_availability_slot` and shared SLOT_HOLDING_BOOKING_STATUSES.
 */
export const SLOT_HOLDING_STATUSES: BookingStatus[] = [
  BookingStatus.pending_owner_approval,
  BookingStatus.pending_payment,
  BookingStatus.pending,
  BookingStatus.confirmed,
];

/** Alias — authoritative inventory-holding set for slot exclusivity. */
export const BOOKING_INVENTORY_HOLDING_STATUSES = SLOT_HOLDING_STATUSES;

export const SLOT_HOLDING_STATUS_SQL = `'pending_owner_approval', 'pending_payment', 'pending', 'confirmed'`;

export const BOOKING_SLOT_UNAVAILABLE_CODE = 'BOOKING_SLOT_UNAVAILABLE' as const;

const SLOT_CONFLICT_CODES = new Set(['BOOKING_SLOT_UNAVAILABLE', 'SLOT_UNAVAILABLE']);

export function isSlotConflictErrorCode(code: string | undefined | null): boolean {
  return code != null && SLOT_CONFLICT_CODES.has(code);
}

/** Customer-safe conflict — never leak constraint names or competing Booking ids. */
export function bookingSlotUnavailableError(message?: string): AppError {
  return new AppError(
    409,
    BOOKING_SLOT_UNAVAILABLE_CODE,
    message ?? 'This time is no longer available. Please choose another time.',
  );
}

/** Detect Prisma unique violation on the holding-slot partial unique index. */
export function isBookingSlotUniqueViolation(err: unknown): boolean {
  const e = err as {
    code?: string;
    meta?: { target?: string | string[]; field_name?: string };
    message?: string;
  };
  if (e?.code !== 'P2002') return false;
  const target = e.meta?.target;
  const targetStr = Array.isArray(target) ? target.join(',') : String(target ?? '');
  const msg = String(e.message ?? '');
  return (
    targetStr.includes('availabilitySlotId') ||
    targetStr.includes('Booking_one_holding_per_availability_slot') ||
    msg.includes('Booking_one_holding_per_availability_slot') ||
    msg.includes('availabilitySlotId')
  );
}

/** Trial payment simulate — forbidden on APP_ENV=production; requires PAYMENT_SIMULATE_ENABLED=true. */
export function isDevPaymentSimulateAllowed(): boolean {
  if (isAppEnvProduction()) return false;
  return process.env.PAYMENT_SIMULATE_ENABLED === 'true';
}
