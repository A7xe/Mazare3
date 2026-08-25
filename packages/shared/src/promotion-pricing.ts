import { filsToJod, jodToFils, percentOfFils } from './money';
import type { AvailabilityPeriod } from './constants';

export type PromotionDiscountType = 'percentage' | 'fixed_amount';
export type PromotionStatus = 'draft' | 'active' | 'paused' | 'expired';

export type PromotionPriceInput = {
  id: string;
  discountType: PromotionDiscountType;
  discountValue: number;
  period?: AvailabilityPeriod | null;
  startsAt: Date | string;
  endsAt: Date | string;
  status: PromotionStatus | string;
  titleAr?: string;
  titleEn?: string;
};

export type ResolvedPromotionPrice = {
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  promotionId: string;
  titleAr?: string;
  titleEn?: string;
  discountType: PromotionDiscountType;
  discountValue: number;
};

export function computePromotionDiscount(
  slotPrice: number,
  discountType: PromotionDiscountType,
  discountValue: number,
): { originalPrice: number; discountAmount: number; finalPrice: number } | null {
  const originalFils = jodToFils(slotPrice);
  if (originalFils <= 0) return null;
  if (!Number.isFinite(discountValue) || discountValue <= 0) return null;

  let discountFils = 0;
  if (discountType === 'percentage') {
    if (discountValue > 100) return null;
    discountFils = percentOfFils(originalFils, discountValue);
  } else if (discountType === 'fixed_amount') {
    discountFils = jodToFils(discountValue);
    if (discountFils >= originalFils) return null;
  } else {
    return null;
  }

  if (discountFils <= 0 || discountFils >= originalFils) return null;
  return {
    originalPrice: filsToJod(originalFils),
    discountAmount: filsToJod(discountFils),
    finalPrice: filsToJod(originalFils - discountFils),
  };
}

export function isPromotionLive(promo: PromotionPriceInput, now: Date = new Date()): boolean {
  if (promo.status !== 'active') return false;
  const start = new Date(promo.startsAt);
  const end = new Date(promo.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return now >= start && now <= end;
}

export function promotionMatchesPeriod(
  promo: PromotionPriceInput,
  period: AvailabilityPeriod,
): boolean {
  return promo.period == null || promo.period === period;
}

export function resolveSlotPromotion(
  slotPrice: number,
  period: AvailabilityPeriod,
  promotions: PromotionPriceInput[],
  now: Date = new Date(),
): ResolvedPromotionPrice | null {
  let best: ResolvedPromotionPrice | null = null;
  for (const promo of promotions) {
    if (!isPromotionLive(promo, now)) continue;
    if (!promotionMatchesPeriod(promo, period)) continue;
    const computed = computePromotionDiscount(slotPrice, promo.discountType, promo.discountValue);
    if (!computed) continue;
    if (!best || computed.discountAmount > best.discountAmount) {
      best = {
        ...computed,
        promotionId: promo.id,
        titleAr: promo.titleAr,
        titleEn: promo.titleEn,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
      };
    }
  }
  return best;
}
