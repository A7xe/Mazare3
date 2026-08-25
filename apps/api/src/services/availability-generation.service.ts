import {
  prisma,
  AvailabilityPeriod,
  AvailabilitySlotSource,
  AvailabilitySlotStatus,
  PropertyStatus,
} from '@mazare3/db';
import {
  getPlatformTimeZone,
  localRangeToUtc,
  todayDateIsoInZone,
  addDaysIso,
  eachDateIso,
  weekdaySundayZeroInZone,
  validateAvailabilityRuleTimes,
  type AvailabilityGenerationResult,
  type AvailabilityPeriod as Period,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { getAvailabilityHorizonDays } from '../config/availability-config.js';
import {
  decimalToNumber,
  formatDateOnlyUtc,
  parseDateOnlyUtc,
} from '../lib/availability-times.js';

export type GenerationCounts = AvailabilityGenerationResult;

function emptyCounts(
  propertyId: string,
  from: string,
  to: string,
  timeZone: string,
): GenerationCounts {
  return {
    propertyId,
    from,
    to,
    timeZone,
    created: 0,
    alreadyExisting: 0,
    skippedBooked: 0,
    skippedBlocked: 0,
    skippedManual: 0,
    invalidRules: 0,
    failed: 0,
  };
}

function slotKey(dateIso: string, period: string): string {
  return `${dateIso}|${period}`;
}

export function defaultGenerationWindow(now = new Date()): { from: string; to: string } {
  const zone = getPlatformTimeZone();
  const from = todayDateIsoInZone(zone, now);
  const horizon = getAvailabilityHorizonDays();
  const to = addDaysIso(from, horizon - 1, zone);
  return { from, to };
}

export async function generateAvailabilityForProperty(
  propertyId: string,
  range?: { from?: string; to?: string },
  now = new Date(),
): Promise<GenerationCounts> {
  const zone = getPlatformTimeZone();
  const defaults = defaultGenerationWindow(now);
  let from = range?.from ?? defaults.from;
  let to = range?.to ?? defaults.to;
  const today = todayDateIsoInZone(zone, now);
  if (from < today) from = today;
  if (to < from) {
    return emptyCounts(propertyId, from, to, zone);
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });
  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }

  const counts = emptyCounts(propertyId, from, to, zone);
  const rules = await prisma.propertyAvailabilityRule.findMany({
    where: { propertyId, enabled: true },
  });

  const validRules = [];
  for (const rule of rules) {
    const check = validateAvailabilityRuleTimes(
      rule.period as Period,
      rule.startTime,
      rule.endTime,
    );
    if (!check.ok) {
      counts.invalidRules += 1;
      continue;
    }
    validRules.push(rule);
  }

  if (validRules.length === 0) {
    return counts;
  }

  const fromDate = parseDateOnlyUtc(from);
  const toDate = parseDateOnlyUtc(to);

  const existing = await prisma.availabilitySlot.findMany({
    where: { propertyId, date: { gte: fromDate, lte: toDate } },
    select: {
      id: true,
      date: true,
      period: true,
      status: true,
      source: true,
      priceOverridden: true,
    },
  });

  const existingByKey = new Map(
    existing.map((s) => [slotKey(formatDateOnlyUtc(s.date), s.period), s]),
  );

  const toCreate: Array<{
    propertyId: string;
    date: Date;
    period: AvailabilityPeriod;
    price: number;
    status: AvailabilitySlotStatus;
    startAt: Date;
    endAt: Date;
    source: AvailabilitySlotSource;
    ruleId: string;
    priceOverridden: boolean;
  }> = [];

  for (const dateIso of eachDateIso(from, to, zone)) {
    const weekday = weekdaySundayZeroInZone(dateIso, zone);
    const date = parseDateOnlyUtc(dateIso);
    for (const rule of validRules) {
      if (rule.weekday !== weekday) continue;
      const key = slotKey(dateIso, rule.period);
      const found = existingByKey.get(key);
      if (found) {
        if (found.status === AvailabilitySlotStatus.booked) {
          counts.skippedBooked += 1;
        } else if (found.status === AvailabilitySlotStatus.blocked) {
          counts.skippedBlocked += 1;
        } else if (found.priceOverridden || found.source === AvailabilitySlotSource.manual) {
          counts.skippedManual += 1;
        } else {
          counts.alreadyExisting += 1;
        }
        continue;
      }

      try {
        const interval = localRangeToUtc({
          dateIso,
          startTime: rule.startTime,
          endTime: rule.endTime,
          overnight: rule.period === AvailabilityPeriod.overnight,
          zone,
        });
        toCreate.push({
          propertyId,
          date,
          period: rule.period,
          price: decimalToNumber(rule.price),
          status: AvailabilitySlotStatus.available,
          startAt: interval.startAt,
          endAt: interval.endAt,
          source: AvailabilitySlotSource.generated,
          ruleId: rule.id,
          priceOverridden: false,
        });
      } catch {
        counts.failed += 1;
      }
    }
  }

  const chunkSize = 80;
  for (let i = 0; i < toCreate.length; i += chunkSize) {
    const chunk = toCreate.slice(i, i + chunkSize);
    try {
      const result = await prisma.availabilitySlot.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      counts.created += result.count;
      const skippedDup = chunk.length - result.count;
      counts.alreadyExisting += skippedDup;
    } catch {
      for (const row of chunk) {
        try {
          await prisma.availabilitySlot.create({ data: row });
          counts.created += 1;
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code === 'P2002') {
            counts.alreadyExisting += 1;
          } else {
            counts.failed += 1;
          }
        }
      }
    }
  }

  return counts;
}

export async function previewAvailabilityGeneration(
  propertyId: string,
  range?: { from?: string; to?: string },
  now = new Date(),
): Promise<GenerationCounts> {
  const zone = getPlatformTimeZone();
  const defaults = defaultGenerationWindow(now);
  let from = range?.from ?? defaults.from;
  let to = range?.to ?? defaults.to;
  const today = todayDateIsoInZone(zone, now);
  if (from < today) from = today;
  if (to < from) return emptyCounts(propertyId, from, to, zone);

  const counts = emptyCounts(propertyId, from, to, zone);
  const rules = await prisma.propertyAvailabilityRule.findMany({
    where: { propertyId, enabled: true },
  });
  const validRules = [];
  for (const rule of rules) {
    const check = validateAvailabilityRuleTimes(
      rule.period as Period,
      rule.startTime,
      rule.endTime,
    );
    if (!check.ok) {
      counts.invalidRules += 1;
      continue;
    }
    validRules.push(rule);
  }

  const existing = await prisma.availabilitySlot.findMany({
    where: {
      propertyId,
      date: { gte: parseDateOnlyUtc(from), lte: parseDateOnlyUtc(to) },
    },
    select: { date: true, period: true, status: true, source: true, priceOverridden: true },
  });
  const existingByKey = new Map(
    existing.map((s) => [slotKey(formatDateOnlyUtc(s.date), s.period), s]),
  );

  for (const dateIso of eachDateIso(from, to, zone)) {
    const weekday = weekdaySundayZeroInZone(dateIso, zone);
    for (const rule of validRules) {
      if (rule.weekday !== weekday) continue;
      const found = existingByKey.get(slotKey(dateIso, rule.period));
      if (found) {
        if (found.status === AvailabilitySlotStatus.booked) counts.skippedBooked += 1;
        else if (found.status === AvailabilitySlotStatus.blocked) counts.skippedBlocked += 1;
        else if (found.priceOverridden || found.source === AvailabilitySlotSource.manual) {
          counts.skippedManual += 1;
        } else counts.alreadyExisting += 1;
        continue;
      }
      try {
        localRangeToUtc({
          dateIso,
          startTime: rule.startTime,
          endTime: rule.endTime,
          overnight: rule.period === AvailabilityPeriod.overnight,
          zone,
        });
        counts.created += 1;
      } catch {
        counts.failed += 1;
      }
    }
  }

  return counts;
}

export async function generateAvailabilityForPublishedWithRules(): Promise<{
  properties: number;
  created: number;
}> {
  const published = await prisma.property.findMany({
    where: {
      status: PropertyStatus.published,
      availabilityRules: { some: { enabled: true } },
    },
    select: { id: true },
  });
  let created = 0;
  for (const p of published) {
    const result = await generateAvailabilityForProperty(p.id);
    created += result.created;
  }
  return { properties: published.length, created };
}
