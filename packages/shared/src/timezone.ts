import { DateTime } from 'luxon';

/** Platform civil time zone. Never use the machine local zone for booking math. */
export const DEFAULT_PLATFORM_TIME_ZONE = 'Asia/Amman';

export const TIME_HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function getPlatformTimeZone(): string {
  const raw = (process.env.PLATFORM_TIME_ZONE ?? '').trim();
  return raw || DEFAULT_PLATFORM_TIME_ZONE;
}

export function parseHhMm(value: string): { hour: number; minute: number } | null {
  const m = TIME_HHMM_RE.exec(value.trim());
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/**
 * Sunday=0 … Saturday=6 for a calendar date in the given IANA zone.
 * Uses Luxon weekday (1=Mon … 7=Sun), not `Date.getDay()` of the host.
 */
export function weekdaySundayZeroInZone(isoDate: string, zone: string): number {
  const dt = DateTime.fromISO(isoDate, { zone });
  if (!dt.isValid) {
    throw new Error(`Invalid calendar date: ${isoDate}`);
  }
  return dt.weekday === 7 ? 0 : dt.weekday;
}

export function todayDateIsoInZone(zone: string, now: Date = new Date()): string {
  return DateTime.fromJSDate(now, { zone }).toFormat('yyyy-MM-dd');
}

export function addDaysIso(isoDate: string, days: number, zone = 'utc'): string {
  const dt = DateTime.fromISO(isoDate, { zone }).plus({ days });
  if (!dt.isValid) {
    throw new Error(`Invalid calendar date: ${isoDate}`);
  }
  return dt.toFormat('yyyy-MM-dd');
}

export function eachDateIso(fromIso: string, toIso: string, zone = 'utc'): string[] {
  const out: string[] = [];
  let cur = fromIso;
  while (cur <= toIso) {
    out.push(cur);
    cur = addDaysIso(cur, 1, zone);
  }
  return out;
}

export type LocalIntervalUtc = {
  startAt: Date;
  endAt: Date;
  endsNextDay: boolean;
};

/**
 * Convert a local civil date + HH:mm range in `zone` to UTC instants.
 * Overnight rules with end <= start wrap to the following local calendar day.
 */
export function localRangeToUtc(params: {
  dateIso: string;
  startTime: string;
  endTime: string;
  overnight: boolean;
  zone: string;
}): LocalIntervalUtc {
  const start = parseHhMm(params.startTime);
  const end = parseHhMm(params.endTime);
  if (!start || !end) {
    throw new Error('Invalid local time (expected HH:mm)');
  }

  const startLocal = DateTime.fromISO(params.dateIso, { zone: params.zone }).set({
    hour: start.hour,
    minute: start.minute,
    second: 0,
    millisecond: 0,
  });
  if (!startLocal.isValid) {
    throw new Error(`Invalid start local datetime for ${params.dateIso}`);
  }

  let endLocal = DateTime.fromISO(params.dateIso, { zone: params.zone }).set({
    hour: end.hour,
    minute: end.minute,
    second: 0,
    millisecond: 0,
  });
  if (!endLocal.isValid) {
    throw new Error(`Invalid end local datetime for ${params.dateIso}`);
  }

  const wrapNextDay = params.overnight && endLocal <= startLocal;
  if (wrapNextDay) {
    endLocal = endLocal.plus({ days: 1 });
  }

  if (endLocal <= startLocal) {
    throw new Error('Non-positive duration');
  }

  return {
    startAt: startLocal.toUTC().toJSDate(),
    endAt: endLocal.toUTC().toJSDate(),
    endsNextDay: wrapNextDay,
  };
}

export function formatLocalTime(utc: Date, zone: string): string {
  return DateTime.fromJSDate(utc, { zone: 'utc' }).setZone(zone).toFormat('HH:mm');
}

export function formatLocalDateTime(utc: Date, zone: string): string {
  return DateTime.fromJSDate(utc, { zone: 'utc' }).setZone(zone).toFormat('yyyy-MM-dd HH:mm');
}

export function formatLocalDateTimeLocalized(utc: Date, zone: string, locale: string): string {
  return DateTime.fromJSDate(utc, { zone: 'utc' })
    .setZone(zone)
    .setLocale(locale)
    .toFormat("yyyy-MM-dd HH:mm");
}

export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** Subtract hours from a UTC instant without using the host time zone. */
export function subtractHoursUtc(instant: Date, hours: number): Date {
  const safeHours = Number.isFinite(hours) && hours >= 0 ? hours : 0;
  return new Date(instant.getTime() - safeHours * 60 * 60 * 1000);
}
