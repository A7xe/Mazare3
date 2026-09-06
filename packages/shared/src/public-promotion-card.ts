import type { PublicPropertySummary } from './types';

export type OfferUrgencyKey = 'offerEndsToday' | 'offerEndingSoon';

export type OfferBadgeKind =
  | { kind: 'percent'; percent: number }
  | { kind: 'save'; amount: number }
  | { kind: 'fallback' };

/** Same thresholds as Homepage Offers (≤24h / ≤48h). */
export function getOfferUrgencyKey(endsAt: string | null | undefined): OfferUrgencyKey | null {
  if (!endsAt) return null;
  const endMs = new Date(endsAt).getTime();
  if (Number.isNaN(endMs)) return null;
  const remainingMs = endMs - Date.now();
  if (remainingMs < 0) return null;
  if (remainingMs <= 24 * 60 * 60 * 1000) return 'offerEndsToday';
  if (remainingMs <= 48 * 60 * 60 * 1000) return 'offerEndingSoon';
  return null;
}

export function hasTruthfulPriceAnchor(
  promo: PublicPropertySummary['activePromotionSummary'],
): boolean {
  return Boolean(
    promo?.originalFromPrice != null &&
      promo.promotionalFromPrice != null &&
      promo.savingsAmount != null &&
      promo.originalFromPrice > promo.promotionalFromPrice &&
      promo.savingsAmount > 0 &&
      Math.abs(promo.originalFromPrice - promo.promotionalFromPrice - promo.savingsAmount) < 0.02,
  );
}

/**
 * Resolve badge kind from canonical public promotion summary.
 * UI formats labels; this never invents percentages.
 */
export function resolveOfferBadgeKind(property: PublicPropertySummary): OfferBadgeKind | null {
  if (!property.hasActivePromotion) return null;

  const promo = property.activePromotionSummary;
  if (
    promo?.discountType === 'percentage' &&
    promo.discountValue != null &&
    Number.isFinite(promo.discountValue) &&
    promo.discountValue > 0
  ) {
    return { kind: 'percent', percent: Math.round(promo.discountValue) };
  }

  if (
    promo?.discountType === 'fixed_amount' &&
    promo.discountValue != null &&
    Number.isFinite(promo.discountValue) &&
    promo.discountValue > 0
  ) {
    return { kind: 'save', amount: promo.discountValue };
  }

  if (promo?.savingsAmount != null && promo.savingsAmount > 0) {
    return { kind: 'save', amount: promo.savingsAmount };
  }

  return { kind: 'fallback' };
}

export type CardOfferPricing = {
  /** Authoritative amount currently shown to the customer. */
  displayPrice: number;
  /** Pre-discount amount when truthful anchoring is available. */
  originalPrice: number | null;
  savingsAmount: number | null;
  hasAnchor: boolean;
  /** True when displayPrice already includes the promotion (exact slot or browse promo price). */
  priceAlreadyDiscounted: boolean;
};

/**
 * Resolve card pricing without double-discounting.
 *
 * Exact slot: `searchMatch.slotPrice` is already the final (post-discount) price when
 * a promotion applied; use `originalSlotPrice` / `discountAmount` for anchoring only.
 * Browse: `basePrice` is pre-discount; use `activePromotionSummary` promotional fields.
 */
export function resolveCardOfferPricing(property: PublicPropertySummary): CardOfferPricing {
  const match = property.searchMatch;
  const exact = property.pricingMode === 'exact_slot' && match?.slotPrice != null;
  const promo = property.activePromotionSummary;

  if (exact) {
    const displayPrice = match!.slotPrice!;
    const original = match!.originalSlotPrice ?? promo?.originalFromPrice ?? null;
    const savings = match!.discountAmount ?? promo?.savingsAmount ?? null;
    const hasAnchor =
      original != null &&
      savings != null &&
      original > displayPrice &&
      savings > 0 &&
      Math.abs(original - displayPrice - savings) < 0.02;

    return {
      displayPrice,
      originalPrice: hasAnchor ? original : null,
      savingsAmount: hasAnchor ? savings : null,
      hasAnchor,
      priceAlreadyDiscounted: hasAnchor,
    };
  }

  if (hasTruthfulPriceAnchor(promo)) {
    return {
      displayPrice: promo!.promotionalFromPrice!,
      originalPrice: promo!.originalFromPrice!,
      savingsAmount: promo!.savingsAmount!,
      hasAnchor: true,
      priceAlreadyDiscounted: true,
    };
  }

  return {
    displayPrice: property.basePrice,
    originalPrice: null,
    savingsAmount: null,
    hasAnchor: false,
    priceAlreadyDiscounted: false,
  };
}
