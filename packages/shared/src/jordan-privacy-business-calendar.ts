/**
 * Phase 3C.4B.1.1 — Jordan privacy business calendar for DSR SLA.
 *
 * Working week: Sunday–Thursday (Asia/Amman).
 * Official non-working holidays: configurable list only — do NOT invent dates.
 * When the holiday list is empty, deadlines remain provisional and must be flagged
 * as holiday-calendar verification required.
 */

import { DEFAULT_PLATFORM_TIME_ZONE } from './timezone.js';

/** Jordan Ministry guidance: handle DSRs within 15 working days from the day after receipt. */
export const DSR_RESPONSE_WORKING_DAYS = 15 as const;

/** Warning threshold before dueAt (calendar days) for admin DUE_SOON. */
export const DSR_DUE_SOON_CALENDAR_DAYS = 3 as const;

/**
 * Official / non-working holiday dates (YYYY-MM-DD in Asia/Amman).
 * Empty by default — founder/ops must supply verified dates; do not invent.
 */
export const JORDAN_PRIVACY_OFFICIAL_NON_WORKING_DATES: readonly string[] = [
  // Intentionally empty — populate only with verified official non-working dates.
];

export type DsrDeadlineComputation = {
  dueAt: Date;
  dueYmdAmman: string;
  workingDaysCounted: number;
  /** False when no official holiday list is configured (or list empty). */
  holidayCalendarVerified: boolean;
  holidayCalendarStatus:
    | 'HOLIDAY_CALENDAR_CONFIGURED'
    | 'HOLIDAY_CALENDAR_VERIFICATION_REQUIRED';
  notesEn: string;
};

export type DsrDeadlineUrgency = 'ok' | 'DUE_SOON' | 'OVERDUE' | 'closed';

function ammanYmd(date: Date, timeZone = DEFAULT_PLATFORM_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addCalendarDaysAmman(isoDateYmd: string, days: number): string {
  const [y, m, d] = isoDateYmd.split('-').map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d! + days));
  const yyyy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function weekdayShortAmman(ymd: string, timeZone = DEFAULT_PLATFORM_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(new Date(`${ymd}T12:00:00+03:00`));
}

/** Fri/Sat are weekend; official holidays from configured list are also non-working. */
export function isJordanPrivacyWorkingDay(
  ymd: string,
  officialNonWorkingDates: readonly string[] = JORDAN_PRIVACY_OFFICIAL_NON_WORKING_DATES,
): boolean {
  const weekday = weekdayShortAmman(ymd);
  if (weekday === 'Fri' || weekday === 'Sat') return false;
  if (officialNonWorkingDates.includes(ymd)) return false;
  // Sun–Thu unless holiday
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'].includes(weekday);
}

/**
 * Compute DSR deadline metadata: 15 working days from the day after receipt (Asia/Amman),
 * excluding Fri/Sat and any configured official non-working dates.
 */
export function computeDsrDeadlineFromReceivedAt(
  receivedAt: Date,
  opts?: {
    workingDays?: number;
    officialNonWorkingDates?: readonly string[];
  },
): DsrDeadlineComputation {
  const workingDays = opts?.workingDays ?? DSR_RESPONSE_WORKING_DAYS;
  const holidays = opts?.officialNonWorkingDates ?? JORDAN_PRIVACY_OFFICIAL_NON_WORKING_DATES;
  const holidayCalendarVerified = holidays.length > 0;
  let cursorYmd = addCalendarDaysAmman(ammanYmd(receivedAt), 1);
  let counted = 0;
  for (let i = 0; i < 400 && counted < workingDays; i++) {
    if (isJordanPrivacyWorkingDay(cursorYmd, holidays)) {
      counted += 1;
      if (counted >= workingDays) break;
    }
    cursorYmd = addCalendarDaysAmman(cursorYmd, 1);
  }
  const dueAt = new Date(`${cursorYmd}T23:59:59.999+03:00`);
  return {
    dueAt,
    dueYmdAmman: cursorYmd,
    workingDaysCounted: counted,
    holidayCalendarVerified,
    holidayCalendarStatus: holidayCalendarVerified
      ? 'HOLIDAY_CALENDAR_CONFIGURED'
      : 'HOLIDAY_CALENDAR_VERIFICATION_REQUIRED',
    notesEn: holidayCalendarVerified
      ? 'Deadline excludes Fri/Sat and configured official non-working dates.'
      : 'Provisional deadline excludes Fri/Sat only. Official holiday calendar not configured — HOLIDAY_CALENDAR_VERIFICATION_REQUIRED.',
  };
}

/** Absolute due Instant (end of due YMD Asia/Amman). Prefer computeDsrDeadlineFromReceivedAt for audit flags. */
export function computeDsrDueAtFromReceivedAt(
  receivedAt: Date,
  workingDaysOrOpts?: number | {
    workingDays?: number;
    officialNonWorkingDates?: readonly string[];
  },
): Date {
  const opts =
    typeof workingDaysOrOpts === 'number'
      ? { workingDays: workingDaysOrOpts }
      : workingDaysOrOpts;
  return computeDsrDeadlineFromReceivedAt(receivedAt, opts).dueAt;
}

export function isDsrOpenStatus(status: string): boolean {
  return status === 'requested' || status === 'under_review';
}

export function isDsrOverdue(params: {
  status: string;
  dueAt: Date | string | null | undefined;
  now?: Date;
}): boolean {
  if (!params.dueAt || !isDsrOpenStatus(params.status)) return false;
  const due = typeof params.dueAt === 'string' ? new Date(params.dueAt) : params.dueAt;
  return due.getTime() < (params.now ?? new Date()).getTime();
}

export function classifyDsrDeadlineUrgency(params: {
  status: string;
  dueAt: Date | string | null | undefined;
  now?: Date;
  dueSoonCalendarDays?: number;
}): DsrDeadlineUrgency {
  if (!isDsrOpenStatus(params.status)) return 'closed';
  if (!params.dueAt) return 'ok';
  const now = params.now ?? new Date();
  const due = typeof params.dueAt === 'string' ? new Date(params.dueAt) : params.dueAt;
  if (due.getTime() < now.getTime()) return 'OVERDUE';
  const soonDays = params.dueSoonCalendarDays ?? DSR_DUE_SOON_CALENDAR_DAYS;
  const ms = soonDays * 86400000;
  if (due.getTime() - now.getTime() <= ms) return 'DUE_SOON';
  return 'ok';
}
