import { getPlatformTimeZone, todayDateIsoInZone } from './timezone';

export type BookAgainVisitInput = {
  bookingEndAt: Date | string | null;
  slotEndAt: Date | string | null;
  slotDate: Date | string;
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Past-stay determination for Book Again (platform calendar + interval end).
 * Mirrors review visit-ended rules without inventing a completed status.
 */
export function bookAgainVisitHasEnded(
  params: BookAgainVisitInput,
  now: Date = new Date(),
): boolean {
  const today = todayDateIsoInZone(getPlatformTimeZone());
  const slotIso = toDate(params.slotDate).toISOString().slice(0, 10);
  if (slotIso < today) return true;
  if (params.bookingEndAt && toDate(params.bookingEndAt).getTime() <= now.getTime()) return true;
  if (params.slotEndAt && toDate(params.slotEndAt).getTime() <= now.getTime()) return true;
  return false;
}

export function bookAgainVisitSortMs(params: BookAgainVisitInput): number {
  if (params.bookingEndAt) return toDate(params.bookingEndAt).getTime();
  if (params.slotEndAt) return toDate(params.slotEndAt).getTime();
  return toDate(params.slotDate).getTime();
}

export const BOOK_AGAIN_EXCLUDED_STATUSES = [
  'pending',
  'pending_owner_approval',
  'pending_payment',
  'cancelled',
  'expired',
] as const;

export const BOOK_AGAIN_REQUIRED_STATUS = 'confirmed' as const;

/**
 * Truthful Book Again history gate (status + refund + past visit + public property).
 * Does not invent a completed booking status.
 */
export function isBookAgainHistoryEligible(input: {
  status: string;
  paymentState: string;
  bookingEndAt: Date | string | null;
  slotDate: Date | string;
  slotEndAt: Date | string | null;
  propertyStatus: string;
  ownerStatus: string;
  now?: Date;
}): boolean {
  if (input.status !== BOOK_AGAIN_REQUIRED_STATUS) return false;
  if (input.paymentState === 'refunded') return false;
  if (input.propertyStatus !== 'published') return false;
  if (input.ownerStatus !== 'approved') return false;
  return bookAgainVisitHasEnded(
    {
      bookingEndAt: input.bookingEndAt,
      slotEndAt: input.slotEndAt,
      slotDate: input.slotDate,
    },
    input.now,
  );
}

/** Deduplicate properties keeping first occurrence (caller must pre-sort by latest visit). */
export function dedupeBookAgainByPropertyId<T extends { propertyId: string }>(
  rows: T[],
  limit: number,
): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.propertyId)) continue;
    seen.add(row.propertyId);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

export const BOOK_AGAIN_RAIL_LIMIT = 6;
