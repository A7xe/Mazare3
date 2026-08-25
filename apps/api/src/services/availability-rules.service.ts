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
  weekdaySundayZeroInZone,
  validateAvailabilityRuleTimes,
  type AvailabilityPeriod as Period,
  type AvailabilityRuleInput,
  type AdminAvailabilityHealth,
  type ApplyRuleToFutureInput,
  type PropertyAvailabilityRuleView,
} from '@mazare3/shared';
import { SLOT_HOLDING_STATUSES } from '../lib/payment-hold.js';
import { AppError } from '../lib/errors.js';
import { decimalToNumber, formatDateOnlyUtc, parseDateOnlyUtc } from '../lib/availability-times.js';
import { generateAvailabilityForProperty } from './availability-generation.service.js';
import { createAuditLog } from './audit.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

function toRuleView(rule: {
  id: string;
  propertyId: string;
  weekday: number;
  period: AvailabilityPeriod;
  enabled: boolean;
  startTime: string;
  endTime: string;
  price: { toNumber(): number } | number;
  createdAt: Date;
  updatedAt: Date;
}): PropertyAvailabilityRuleView {
  return {
    id: rule.id,
    propertyId: rule.propertyId,
    weekday: rule.weekday,
    period: rule.period,
    enabled: rule.enabled,
    startTime: rule.startTime,
    endTime: rule.endTime,
    price: decimalToNumber(rule.price),
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export async function listPropertyAvailabilityRules(
  propertyId: string,
): Promise<PropertyAvailabilityRuleView[]> {
  const rules = await prisma.propertyAvailabilityRule.findMany({
    where: { propertyId },
    orderBy: [{ weekday: 'asc' }, { period: 'asc' }],
  });
  return rules.map(toRuleView);
}

export async function putPropertyAvailabilityRules(
  propertyId: string,
  rules: AvailabilityRuleInput[],
  actorUserId: string,
  req?: AuthenticatedRequest,
): Promise<PropertyAvailabilityRuleView[]> {
  const seen = new Set<string>();
  for (const rule of rules) {
    const key = `${rule.weekday}|${rule.period}`;
    if (seen.has(key)) {
      throw new AppError(
        409,
        'DUPLICATE_AVAILABILITY_RULE',
        'Only one rule is allowed per weekday and period',
      );
    }
    seen.add(key);
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.propertyAvailabilityRule.deleteMany({ where: { propertyId } });
      if (rules.length) {
        await tx.propertyAvailabilityRule.createMany({
          data: rules.map((rule) => ({
            propertyId,
            weekday: rule.weekday,
            period: rule.period,
            enabled: rule.enabled,
            startTime: rule.startTime,
            endTime: rule.endTime,
            price: rule.price,
          })),
        });
      }
    },
    { timeout: 20_000, maxWait: 10_000 },
  );

  await createAuditLog({
    actorUserId,
    action: 'owner.availability_rules_updated',
    entityType: 'property',
    entityId: propertyId,
    metadata: { ruleCount: rules.length },
    req,
  });

  return listPropertyAvailabilityRules(propertyId);
}

export async function deletePropertyAvailabilityRule(propertyId: string, ruleId: string) {
  const rule = await prisma.propertyAvailabilityRule.findFirst({
    where: { id: ruleId, propertyId },
    select: { id: true },
  });
  if (!rule) {
    throw new AppError(404, 'NOT_FOUND', 'Availability rule not found');
  }
  await prisma.propertyAvailabilityRule.delete({ where: { id: ruleId } });
}

async function futureGeneratedTargets(rule: {
  id: string;
  propertyId: string;
  period: AvailabilityPeriod;
  weekday: number;
}) {
  const zone = getPlatformTimeZone();
  const today = parseDateOnlyUtc(todayDateIsoInZone(zone));
  return prisma.availabilitySlot.findMany({
    where: {
      propertyId: rule.propertyId,
      period: rule.period,
      source: AvailabilitySlotSource.generated,
      priceOverridden: false,
      status: AvailabilitySlotStatus.available,
      date: { gte: today },
      bookings: { none: { status: { in: SLOT_HOLDING_STATUSES } } },
    },
    select: { id: true, date: true },
  });
}

export async function previewApplyRuleToFuture(
  propertyId: string,
  ruleId: string,
): Promise<{ count: number }> {
  const rule = await prisma.propertyAvailabilityRule.findFirst({
    where: { id: ruleId, propertyId },
  });
  if (!rule) {
    throw new AppError(404, 'NOT_FOUND', 'Availability rule not found');
  }
  const targets = await futureGeneratedTargets(rule);
  const zone = getPlatformTimeZone();
  const matching = targets.filter(
    (s) => weekdaySundayZeroInZone(formatDateOnlyUtc(s.date), zone) === rule.weekday,
  );
  return { count: matching.length };
}

export async function applyRuleToFutureSlots(
  propertyId: string,
  ruleId: string,
  input: ApplyRuleToFutureInput,
  actorUserId: string,
  req?: AuthenticatedRequest,
): Promise<{ updated: number }> {
  const rule = await prisma.propertyAvailabilityRule.findFirst({
    where: { id: ruleId, propertyId },
  });
  if (!rule) {
    throw new AppError(404, 'NOT_FOUND', 'Availability rule not found');
  }
  const check = validateAvailabilityRuleTimes(
    rule.period as Period,
    rule.startTime,
    rule.endTime,
  );
  if (!check.ok) {
    throw new AppError(400, 'INVALID_AVAILABILITY_RULE', check.message);
  }

  const zone = getPlatformTimeZone();
  const targets = await futureGeneratedTargets(rule);
  const matching = targets.filter(
    (s) => weekdaySundayZeroInZone(formatDateOnlyUtc(s.date), zone) === rule.weekday,
  );

  let updated = 0;
  for (const slot of matching) {
    const dateIso = formatDateOnlyUtc(slot.date);
    const interval = localRangeToUtc({
      dateIso,
      startTime: rule.startTime,
      endTime: rule.endTime,
      overnight: rule.period === AvailabilityPeriod.overnight,
      zone,
    });
    const data: {
      startAt?: Date;
      endAt?: Date;
      price?: number;
      ruleId: string;
    } = { ruleId: rule.id };
    if (input.applyTimes !== false) {
      data.startAt = interval.startAt;
      data.endAt = interval.endAt;
    }
    if (input.applyPrice !== false) {
      data.price = decimalToNumber(rule.price);
    }
    await prisma.availabilitySlot.update({ where: { id: slot.id }, data });
    updated += 1;
  }

  await createAuditLog({
    actorUserId,
    action: 'owner.availability_rule_applied_future',
    entityType: 'property_availability_rule',
    entityId: ruleId,
    metadata: { propertyId, updated, applyPrice: input.applyPrice, applyTimes: input.applyTimes },
    req,
  });

  return { updated };
}

export async function getPropertyAvailabilityHealth(
  propertyId: string,
): Promise<AdminAvailabilityHealth> {
  const zone = getPlatformTimeZone();
  const todayIso = todayDateIsoInZone(zone);
  const today = parseDateOnlyUtc(todayIso);

  const [rules, futureAvailable] = await Promise.all([
    prisma.propertyAvailabilityRule.findMany({ where: { propertyId } }),
    prisma.availabilitySlot.findMany({
      where: {
        propertyId,
        status: AvailabilitySlotStatus.available,
        date: { gte: today },
      },
      select: { date: true },
      orderBy: { date: 'asc' },
    }),
  ]);

  let invalidRuleCount = 0;
  let enabledRuleCount = 0;
  for (const rule of rules) {
    if (!rule.enabled) continue;
    enabledRuleCount += 1;
    const check = validateAvailabilityRuleTimes(
      rule.period as Period,
      rule.startTime,
      rule.endTime,
    );
    if (!check.ok) invalidRuleCount += 1;
  }

  const dates = futureAvailable.map((s) => formatDateOnlyUtc(s.date));
  const hasWeeklyRules = rules.length > 0;
  const usesLegacyFallback = !hasWeeklyRules && futureAvailable.length > 0;
  let warning: string | null = null;
  if (!hasWeeklyRules) {
    warning = usesLegacyFallback
      ? 'legacy_fallback_no_schedule'
      : 'no_weekly_rules';
  } else if (futureAvailable.length === 0) {
    warning = 'no_future_bookable_slots';
  } else if (invalidRuleCount > 0) {
    warning = 'invalid_rules';
  }

  return {
    hasWeeklyRules,
    enabledRuleCount,
    invalidRuleCount,
    futureBookableCount: futureAvailable.length,
    earliestAvailableDate: dates[0] ?? null,
    latestAvailableDate: dates.length ? dates[dates.length - 1]! : null,
    usesLegacyFallback,
    warning,
  };
}

/**
 * First-time publish: require valid enabled rules, generate, and at least one future bookable slot.
 * Previously published/unpublished properties keep the legacy fallback.
 */
export async function assertAndGenerateForPublish(
  propertyId: string,
  currentStatus: PropertyStatus,
): Promise<void> {
  const wasPublished =
    currentStatus === PropertyStatus.published || currentStatus === PropertyStatus.unpublished;
  const rules = await prisma.propertyAvailabilityRule.findMany({
    where: { propertyId, enabled: true },
  });
  const validEnabled = rules.filter(
    (r) => validateAvailabilityRuleTimes(r.period as Period, r.startTime, r.endTime).ok,
  );

  if (validEnabled.length > 0) {
    await generateAvailabilityForProperty(propertyId);
  }

  const health = await getPropertyAvailabilityHealth(propertyId);
  if (wasPublished) {
    return;
  }

  if (validEnabled.length === 0) {
    throw new AppError(
      400,
      'AVAILABILITY_SCHEDULE_REQUIRED',
      'Publish requires at least one valid enabled weekly availability rule',
    );
  }
  if (health.futureBookableCount < 1) {
    throw new AppError(
      400,
      'AVAILABILITY_SLOTS_REQUIRED',
      'Publish requires at least one future bookable slot after generation',
    );
  }
}
