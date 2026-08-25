import type { AvailabilityPeriod, OwnerAvailabilitySlotRow } from '@mazare3/shared';
import { formatLocalTime, getPlatformTimeZone, intervalsOverlap } from '@mazare3/shared';

export function parseDateOnlyUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d));
}

export function formatDateOnlyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

export type TimedInstant = { startAt: Date; endAt: Date };

export function slotTimesOrNull(slot: {
  startAt: Date | null;
  endAt: Date | null;
}): TimedInstant | null {
  if (!slot.startAt || !slot.endAt) return null;
  return { startAt: slot.startAt, endAt: slot.endAt };
}

export function occupancyTimes(row: {
  bookingStartAt: Date | null;
  bookingEndAt: Date | null;
  slot?: { startAt: Date | null; endAt: Date | null } | null;
}): TimedInstant | null {
  if (row.bookingStartAt && row.bookingEndAt) {
    return { startAt: row.bookingStartAt, endAt: row.bookingEndAt };
  }
  if (row.slot?.startAt && row.slot.endAt) {
    return { startAt: row.slot.startAt, endAt: row.slot.endAt };
  }
  return null;
}

export function mapTimedFields(slot: {
  startAt: Date | null;
  endAt: Date | null;
  source?: string;
}): {
  startAt: string | null;
  endAt: string | null;
  startAtLocal: string | null;
  endAtLocal: string | null;
  timeZone: string;
  usesLegacyTiming: boolean;
} {
  const zone = getPlatformTimeZone();
  const timed = slotTimesOrNull(slot);
  return {
    startAt: timed ? timed.startAt.toISOString() : null,
    endAt: timed ? timed.endAt.toISOString() : null,
    startAtLocal: timed ? formatLocalTime(timed.startAt, zone) : null,
    endAtLocal: timed ? formatLocalTime(timed.endAt, zone) : null,
    timeZone: zone,
    usesLegacyTiming: !timed,
  };
}

export function holdingOverlapsRequested(
  holdings: Array<{ slotId: string; startAt: Date; endAt: Date }>,
  requested: TimedInstant,
  ignoreSlotId?: string,
): boolean {
  return holdings.some(
    (h) =>
      h.slotId !== ignoreSlotId &&
      intervalsOverlap(h.startAt, h.endAt, requested.startAt, requested.endAt),
  );
}

export function mapOwnerSlotRow(slot: {
  id: string;
  propertyId: string;
  date: Date;
  period: AvailabilityPeriod;
  price: { toNumber(): number } | number;
  status: 'available' | 'blocked' | 'booked';
  startAt: Date | null;
  endAt: Date | null;
  source: 'legacy' | 'generated' | 'manual';
  priceOverridden: boolean;
  hasActiveBooking: boolean;
}): OwnerAvailabilitySlotRow {
  const timed = mapTimedFields(slot);
  return {
    id: slot.id,
    propertyId: slot.propertyId,
    date: formatDateOnlyUtc(slot.date),
    period: slot.period,
    price: decimalToNumber(slot.price),
    currency: 'JOD',
    status: slot.status,
    hasActiveBooking: slot.hasActiveBooking,
    ...timed,
    source: slot.source,
    priceOverridden: slot.priceOverridden,
  };
}
