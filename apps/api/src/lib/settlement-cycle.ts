import {
  getSettlementCycleDays,
  getSettlementCycleEpoch,
} from '../config/settlement-cycle-config.js';

export function addUtcDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffUtcDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}

export type DueSettlementPeriod = {
  periodStart: string;
  periodEnd: string;
  nextExpectedPeriodEnd: string;
  cycleIndex: number;
  cycleDays: number;
  epoch: string;
};

export function getDueSettlementPeriod(
  asOf: string,
  cycleDays = getSettlementCycleDays(),
  epoch = getSettlementCycleEpoch(),
): DueSettlementPeriod | null {
  const days = diffUtcDays(epoch, asOf);
  const lastEndedIndex = Math.floor((days - (cycleDays - 1)) / cycleDays);
  if (lastEndedIndex < 0) return null;
  const periodStart = addUtcDays(epoch, lastEndedIndex * cycleDays);
  const periodEnd = addUtcDays(periodStart, cycleDays - 1);
  return {
    periodStart,
    periodEnd,
    nextExpectedPeriodEnd: addUtcDays(periodEnd, cycleDays),
    cycleIndex: lastEndedIndex,
    cycleDays,
    epoch,
  };
}
