import { AVAILABILITY_PERIODS, type AvailabilityPeriod } from './constants';
import { parseHhMm } from './timezone';

export const AVAILABILITY_SLOT_SOURCES = ['legacy', 'generated', 'manual'] as const;
export type AvailabilitySlotSource = (typeof AVAILABILITY_SLOT_SOURCES)[number];

export type AvailabilityRuleTimeError = {
  ok: false;
  code: 'INVALID_TIME' | 'NON_POSITIVE_DURATION' | 'OVERNIGHT_REQUIRED_FOR_WRAP';
  message: string;
};

export type AvailabilityRuleTimeOk = { ok: true };

export function validateAvailabilityRuleTimes(
  period: AvailabilityPeriod,
  startTime: string,
  endTime: string,
): AvailabilityRuleTimeOk | AvailabilityRuleTimeError {
  const start = parseHhMm(startTime);
  const end = parseHhMm(endTime);
  if (!start || !end) {
    return {
      ok: false,
      code: 'INVALID_TIME',
      message: 'Start and end times must be HH:mm in 24-hour format',
    };
  }

  const startMin = start.hour * 60 + start.minute;
  const endMin = end.hour * 60 + end.minute;
  const overnight = period === 'overnight';

  if (!overnight) {
    if (endMin <= startMin) {
      return {
        ok: false,
        code: 'NON_POSITIVE_DURATION',
        message: 'Non-overnight periods must end after they start on the same local day',
      };
    }
    return { ok: true };
  }

  if (endMin === startMin) {
    // 24-hour overnight wrapping to the next local day.
    return { ok: true };
  }
  if (endMin < startMin) {
    return { ok: true };
  }
  return { ok: true };
}

export function isAvailabilityPeriod(value: string): value is AvailabilityPeriod {
  return (AVAILABILITY_PERIODS as readonly string[]).includes(value);
}
