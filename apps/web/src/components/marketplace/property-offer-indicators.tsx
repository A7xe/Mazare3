'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { PublicPropertySummary } from '@mazare3/shared';
import {
  getOfferUrgencyKey,
  offerBadgeClass,
  resolveCardOfferPricing,
  resolveOfferBadge,
} from '@/components/home/offer-presentation';
import { formatPrice } from '@/lib/property-helpers';
import { cn } from '@/lib/utils';

export function usePropertyOfferPresentation(property: PublicPropertySummary) {
  const locale = useLocale() as 'ar' | 'en';
  const tHome = useTranslations('home');
  const tSearch = useTranslations('search');

  const badgeResolution = resolveOfferBadge(property, locale);
  const badgeLabel = (() => {
    if (!badgeResolution) return null;
    if (badgeResolution.kind === 'percent') {
      return tHome('offerDiscountPercent', { percent: badgeResolution.percent });
    }
    if (badgeResolution.kind === 'save') {
      return tHome('offerSaveAmount', { amount: badgeResolution.amountLabel });
    }
    return tSearch('offerAvailable');
  })();

  const pricing = resolveCardOfferPricing(property);
  const urgencyKey = property.hasActivePromotion
    ? getOfferUrgencyKey(property.activePromotionSummary?.endsAt)
    : null;

  const savingsLabel =
    pricing.hasAnchor && pricing.savingsAmount != null
      ? tHome('offerSaveAmount', {
          amount: formatPrice(pricing.savingsAmount, property.currency, locale),
        })
      : null;

  const urgencyLabel = urgencyKey ? tHome(urgencyKey) : null;

  return { badgeLabel, pricing, savingsLabel, urgencyLabel, locale };
}

/** Amber deal badge — same language as dedicated Offers cards. */
export function PropertyOfferBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span data-testid="offer-badge" className={cn(offerBadgeClass, className)}>
      {label}
    </span>
  );
}

/** Lightweight price block for normal (non-Offers) marketplace cards. */
export function PropertyOfferPriceBlock({
  property,
  compact = false,
  showUrgency = false,
  priceClassName,
  metaClassName,
}: {
  property: PublicPropertySummary;
  compact?: boolean;
  showUrgency?: boolean;
  priceClassName?: string;
  metaClassName?: string;
}) {
  const t = useTranslations('common');
  const { pricing, savingsLabel, urgencyLabel, locale } = usePropertyOfferPresentation(property);

  return (
    <div data-testid={property.pricingMode === 'exact_slot' ? 'exact-slot-price' : 'browse-from-price'}>
      {pricing.hasAnchor && pricing.originalPrice != null ? (
        <span className="sr-only">
          {formatPrice(pricing.originalPrice, property.currency, locale)}
          {' → '}
          {formatPrice(pricing.displayPrice, property.currency, locale)}
        </span>
      ) : null}
      <div className="flex flex-wrap items-baseline gap-1.5" aria-hidden={pricing.hasAnchor}>
        {pricing.originalPrice != null ? (
          <span
            className={cn(
              'font-medium tabular-nums text-[#8794A7] line-through decoration-[#8794A7]/80',
              compact ? 'text-[10px]' : 'text-[11px]',
            )}
            data-testid="price-original"
          >
            {formatPrice(pricing.originalPrice, property.currency, locale)}
          </span>
        ) : null}
        <span
          className={cn(
            'font-bold leading-none tabular-nums text-[#0D2046]',
            compact ? 'text-[14px]' : 'text-[15px]',
            priceClassName,
          )}
          data-testid="price-final"
        >
          {formatPrice(pricing.displayPrice, property.currency, locale)}
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className={cn('font-medium text-[#8A96A8]', compact ? 'text-[10px]' : 'text-[11px]', metaClassName)}>
          / {t('perDay')}
        </span>
        {savingsLabel && !compact ? (
          <span className="text-[10px] font-semibold text-[#B45309]" data-testid="offer-savings">
            {savingsLabel}
          </span>
        ) : null}
      </div>
      {showUrgency && urgencyLabel && !compact ? (
        <p className="mt-0.5 text-[9px] font-semibold text-[#92400E]" data-testid="offer-urgency">
          {urgencyLabel}
        </p>
      ) : null}
    </div>
  );
}
