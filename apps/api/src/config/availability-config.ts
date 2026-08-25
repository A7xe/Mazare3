/**
 * Rolling availability horizon — operational default, not a commercial booking rule.
 */
export const DEFAULT_AVAILABILITY_HORIZON_DAYS = 90;

export function getAvailabilityHorizonDays(): number {
  const n = Number(process.env.AVAILABILITY_HORIZON_DAYS);
  if (Number.isInteger(n) && n >= 1 && n <= 366) return n;
  return DEFAULT_AVAILABILITY_HORIZON_DAYS;
}
