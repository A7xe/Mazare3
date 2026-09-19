import { prisma, PropertyStatus } from '@mazare3/db';
import { calculateBookingFinancialSnapshot, type PublicAvailabilitySlot } from '@mazare3/shared';
import { SLOT_HOLDING_STATUSES } from '../lib/payment-hold.js';
import {
  decimalToNumber,
  formatDateOnlyUtc,
  holdingOverlapsRequested,
  mapTimedFields,
  occupancyTimes,
  parseDateOnlyUtc,
  slotTimesOrNull,
} from '../lib/availability-times.js';
import {
  loadPaymentPolicyConfig,
  resolveDepositPercent,
} from '../config/payment-policy.config.js';
import { loadLivePromotionsByProperty, toPriceInput } from './promotion.service.js';
import { resolveSlotPromotion } from '@mazare3/shared';

function slotMoney(price: number, depositPercent: number | null) {
  const config = loadPaymentPolicyConfig();
  const snap = calculateBookingFinancialSnapshot({
    bookingTotalAmount: price,
    depositPercent: resolveDepositPercent(depositPercent),
    platformCommissionPercent: config.platformCommissionPercent,
    customerServiceFeePercent: config.customerServiceFeePercent,
    currency: config.currency,
  });
  return { depositAmount: snap.depositAmount, remainingAmount: snap.remainingAmount };
}

export async function listPropertyAvailability(
  slug: string,
  from: string,
  to: string,
): Promise<PublicAvailabilitySlot[] | null> {
  const property = await prisma.property.findFirst({
    where: { slug, status: PropertyStatus.published },
    select: { id: true, depositPercent: true },
  });

  if (!property) return null;

  const fromDate = parseDateOnlyUtc(from);
  const toDate = parseDateOnlyUtc(to);

  const [slots, holdings, promoMap] = await Promise.all([
    prisma.availabilitySlot.findMany({
      where: {
        propertyId: property.id,
        date: { gte: fromDate, lte: toDate },
      },
      orderBy: [{ date: 'asc' }, { period: 'asc' }],
    }),
    prisma.booking.findMany({
      where: {
        propertyId: property.id,
        status: { in: SLOT_HOLDING_STATUSES },
      },
      select: {
        availabilitySlotId: true,
        bookingStartAt: true,
        bookingEndAt: true,
        slot: { select: { startAt: true, endAt: true } },
      },
    }),
    loadLivePromotionsByProperty([property.id]),
  ]);

  const occupancy = holdings
    .map((h) => {
      const times = occupancyTimes(h);
      if (!times) return null;
      return { slotId: h.availabilitySlotId, ...times };
    })
    .filter((v): v is { slotId: string; startAt: Date; endAt: Date } => v !== null);

  return slots.map((s) => {
    const timed = mapTimedFields(s);
    const interval = slotTimesOrNull(s);
    let conflictReason: PublicAvailabilitySlot['conflictReason'] = null;
    let bookable = false;

    if (s.status === 'blocked') {
      conflictReason = 'blocked';
    } else if (s.status === 'booked') {
      conflictReason = 'booked';
    } else if (s.status === 'held') {
      conflictReason = 'held';
    } else if (s.status === 'available') {
      if (
        interval &&
        holdingOverlapsRequested(occupancy, interval, s.id)
      ) {
        conflictReason = 'overlapping_booking';
      } else {
        bookable = true;
      }
    }

    const price = decimalToNumber(s.price);
    const applied = resolveSlotPromotion(
      price,
      s.period,
      (promoMap.get(property.id) ?? []).map(toPriceInput),
    );
    const payable = applied?.finalPrice ?? price;
    const money = slotMoney(payable, property.depositPercent?.toNumber() ?? null);

    return {
      id: s.id,
      date: formatDateOnlyUtc(s.date),
      period: s.period,
      price: payable,
      currency: 'JOD',
      status: s.status,
      ...timed,
      source: s.source,
      bookable,
      conflictReason,
      depositAmount: money.depositAmount,
      remainingAmount: money.remainingAmount,
      originalPrice: applied ? applied.originalPrice : undefined,
      discountAmount: applied ? applied.discountAmount : undefined,
      promotionId: applied?.promotionId ?? null,
      promotionTitleAr: applied?.titleAr ?? null,
      promotionTitleEn: applied?.titleEn ?? null,
    };
  });
}
