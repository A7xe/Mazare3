/**
 * Partner settlement batch cadence. Independent of OWNER_PAYOUT_DELAY_HOURS.
 */
export const DEFAULT_SETTLEMENT_CYCLE_DAYS = 21;
export const DEFAULT_SETTLEMENT_CYCLE_EPOCH = '2026-01-01';

export function getSettlementCycleDays(): number {
  const n = Number(process.env.SETTLEMENT_CYCLE_DAYS);
  if (Number.isInteger(n) && n >= 1 && n <= 365) return n;
  return DEFAULT_SETTLEMENT_CYCLE_DAYS;
}

export function getSettlementCycleEpoch(): string {
  const raw = (process.env.SETTLEMENT_CYCLE_EPOCH ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return DEFAULT_SETTLEMENT_CYCLE_EPOCH;
}
