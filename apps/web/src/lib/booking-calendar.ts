/**
 * CB-1 — customer booking calendar helpers (platform TZ Asia/Amman).
 * Horizon mirrors API default AVAILABILITY_HORIZON_DAYS (90) — not exposed on public DTO.
 */
import type { AvailabilityPeriod, PublicAvailabilitySlot } from '@mazare3/shared';
import { todayIsoInPlatformZone } from '@/lib/format-platform-time';

export const BOOKING_CALENDAR_HORIZON_DAYS = 90;
export const BOOKING_CALENDAR_TIME_ZONE = 'Asia/Amman';

export type CalendarDayState =
  | 'past'
  | 'available'
  | 'partially_available'
  | 'unavailable'
  | 'empty';

export type CalendarDayModel = {
  iso: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  state: CalendarDayState;
  bookablePeriodCount: number;
  totalPeriodCount: number;
};

/** YYYY-MM-DD arithmetic in civil calendar (UTC date parts as civil day keys). */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function monthKeyFromIso(iso: string): string {
  return iso.slice(0, 7);
}

export function firstDayOfMonthIso(year: number, monthIndex0: number): string {
  const m = String(monthIndex0 + 1).padStart(2, '0');
  return `${year}-${m}-01`;
}

export function lastDayOfMonthIso(year: number, monthIndex0: number): string {
  const d = new Date(Date.UTC(year, monthIndex0 + 1, 0));
  return d.toISOString().slice(0, 10);
}

export function parseYearMonth(monthKey: string): { year: number; monthIndex0: number } {
  const [y, m] = monthKey.split('-').map(Number);
  return { year: y!, monthIndex0: (m ?? 1) - 1 };
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const { year, monthIndex0 } = parseYearMonth(monthKey);
  const d = new Date(Date.UTC(year, monthIndex0 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function currentMonthKey(timeZone = BOOKING_CALENDAR_TIME_ZONE): string {
  return monthKeyFromIso(todayIsoInPlatformZone(timeZone));
}

export function maxBookableIso(timeZone = BOOKING_CALENDAR_TIME_ZONE): string {
  return addDaysIso(todayIsoInPlatformZone(timeZone), BOOKING_CALENDAR_HORIZON_DAYS);
}

export function maxMonthKey(timeZone = BOOKING_CALENDAR_TIME_ZONE): string {
  return monthKeyFromIso(maxBookableIso(timeZone));
}

export function compareMonthKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Sunday = 0 … Saturday = 6 for civil YYYY-MM-DD (matches weekdaySundayZeroInZone). */
export function weekdaySundayZero(iso: string): number {
  return new Date(`${iso}T12:00:00.000Z`).getUTCDay();
}

export function monthRangeForFetch(
  monthKey: string,
  timeZone = BOOKING_CALENDAR_TIME_ZONE,
): { from: string; to: string } {
  const { year, monthIndex0 } = parseYearMonth(monthKey);
  const first = firstDayOfMonthIso(year, monthIndex0);
  const last = lastDayOfMonthIso(year, monthIndex0);
  const today = todayIsoInPlatformZone(timeZone);
  // Clamp start to today only — horizon limits navigation, not the month API window.
  const from = first < today ? today : first;
  const to = last < from ? from : last;
  return { from, to };
}

/**
 * Partial = at least one bookable and at least one non-bookable slot for that date.
 * Fully available = ≥1 bookable and zero non-bookable among returned slots.
 */
export function dayAvailabilityState(
  iso: string,
  slots: PublicAvailabilitySlot[],
  today: string,
): CalendarDayState {
  if (iso < today) return 'past';
  const daySlots = slots.filter((s) => s.date === iso);
  if (daySlots.length === 0) return 'unavailable';
  const bookableCount = daySlots.filter((s) => s.bookable).length;
  if (bookableCount === 0) return 'unavailable';
  if (bookableCount < daySlots.length) return 'partially_available';
  return 'available';
}

export function buildMonthGrid(
  monthKey: string,
  slots: PublicAvailabilitySlot[],
  timeZone = BOOKING_CALENDAR_TIME_ZONE,
): CalendarDayModel[] {
  const { year, monthIndex0 } = parseYearMonth(monthKey);
  const first = firstDayOfMonthIso(year, monthIndex0);
  const last = lastDayOfMonthIso(year, monthIndex0);
  const today = todayIsoInPlatformZone(timeZone);
  const startPad = weekdaySundayZero(first);
  const cells: CalendarDayModel[] = [];

  for (let i = 0; i < startPad; i++) {
    cells.push({
      iso: '',
      dayOfMonth: 0,
      inCurrentMonth: false,
      state: 'empty',
      bookablePeriodCount: 0,
      totalPeriodCount: 0,
    });
  }

  let cursor = first;
  while (cursor <= last) {
    const daySlots = slots.filter((s) => s.date === cursor);
    const bookablePeriodCount = daySlots.filter((s) => s.bookable).length;
    cells.push({
      iso: cursor,
      dayOfMonth: Number(cursor.slice(8, 10)),
      inCurrentMonth: true,
      state: dayAvailabilityState(cursor, slots, today),
      bookablePeriodCount,
      totalPeriodCount: daySlots.length,
    });
    cursor = addDaysIso(cursor, 1);
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      iso: '',
      dayOfMonth: 0,
      inCurrentMonth: false,
      state: 'empty',
      bookablePeriodCount: 0,
      totalPeriodCount: 0,
    });
  }

  return cells;
}

/** Match marketplace price/date numeral convention (Latin digits in AR + EN). */
const calendarIntlOpts = { numberingSystem: 'latn' as const, timeZone: 'UTC' };

export function formatMonthTitle(monthKey: string, locale: 'ar' | 'en'): string {
  const { year, monthIndex0 } = parseYearMonth(monthKey);
  const d = new Date(Date.UTC(year, monthIndex0, 1));
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-JO' : 'en-GB', {
    month: 'long',
    year: 'numeric',
    ...calendarIntlOpts,
  }).format(d);
}

export function formatSelectedDateLabel(iso: string, locale: 'ar' | 'en'): string {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-JO' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...calendarIntlOpts,
  }).format(d);
}

export function weekdayLabels(locale: 'ar' | 'en'): string[] {
  // Sunday-first grid
  const base = new Date(Date.UTC(2024, 0, 7)); // Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-JO' : 'en-GB', {
      weekday: 'short',
      ...calendarIntlOpts,
    }).format(d);
  });
}

export function bookableSlotsForDate(
  slots: PublicAvailabilitySlot[],
  date: string,
  allowsOvernight: boolean,
): PublicAvailabilitySlot[] {
  return slots.filter(
    (s) =>
      s.date === date &&
      s.bookable &&
      (s.period !== 'overnight' || allowsOvernight),
  );
}

export function orderPeriods(slots: PublicAvailabilitySlot[]): PublicAvailabilitySlot[] {
  const order: AvailabilityPeriod[] = ['morning', 'evening', 'full_day', 'overnight'];
  return [...slots].sort(
    (a, b) => order.indexOf(a.period) - order.indexOf(b.period),
  );
}
