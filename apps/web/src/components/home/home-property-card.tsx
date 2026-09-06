'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { MapPin, Star } from 'lucide-react';
import type { PublicPropertySummary } from '@mazare3/shared';
import { JORDAN_CITIES, searchHref } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { FavoriteButton } from '@/components/favorites/favorite-button';
import { formatPrice, getApproxLocation, getPropertyTitle } from '@/lib/property-helpers';
import { cn } from '@/lib/utils';
import { TYPE_BADGE_CLASS } from './home-visual';
import {
  getOfferUrgencyKey,
  offerBadgeClass,
  offerCardChromeClass,
  resolveCardOfferPricing,
  resolveOfferBadge,
} from './offer-presentation';
import { PropertyOfferBadge } from '@/components/marketplace/property-offer-indicators';

type HomeCardVariant = 'feature' | 'offer' | 'rated';

/** `compact` = Homepage sidebar stack; `standard` = Explore/carousel vertical card. */
type OfferDensity = 'compact' | 'standard';

interface HomePropertyCardProps {
  property: PublicPropertySummary;
  variant?: HomeCardVariant;
  /** Only applies when variant is `offer`. Default keeps Homepage compact layout. */
  offerDensity?: OfferDensity;
}

export function HomePropertyCard({
  property,
  variant = 'feature',
  offerDensity = 'compact',
}: HomePropertyCardProps) {
  const locale = useLocale() as 'ar' | 'en';
  const t = useTranslations('common');
  const tSearch = useTranslations('search');
  const tHome = useTranslations('home');

  const title = getPropertyTitle(property, locale);
  const location = getApproxLocation(property);
  const href = searchHref(`/properties/${property.slug}`, {});
  const typeClass = TYPE_BADGE_CLASS[property.type] ?? 'bg-[#2F6EF6] text-white';
  const cityMeta = JORDAN_CITIES.find((city) => city.key === property.city);
  const cityLabel = cityMeta ? (locale === 'ar' ? cityMeta.labelAr : cityMeta.labelEn) : property.city;
  const shortLocation =
    location && location !== cityLabel && !location.includes(cityLabel)
      ? `${cityLabel} - ${location}`
      : cityLabel;

  const promo = property.activePromotionSummary;
  const badgeResolution = resolveOfferBadge(property, locale);
  const offerBadgeLabel = (() => {
    if (!badgeResolution) return null;
    if (badgeResolution.kind === 'percent') {
      return tHome('offerDiscountPercent', { percent: badgeResolution.percent });
    }
    if (badgeResolution.kind === 'save') {
      return tHome('offerSaveAmount', { amount: badgeResolution.amountLabel });
    }
    return tSearch('offerAvailable');
  })();

  const urgencyKey = getOfferUrgencyKey(promo?.endsAt);
  const cardPricing = resolveCardOfferPricing(property);
  const hasPriceAnchor = cardPricing.hasAnchor;
  const displayPrice = cardPricing.displayPrice;
  const originalPrice = cardPricing.originalPrice;
  const savingsAmount = cardPricing.savingsAmount;

  const placementBadges = (
    <>
      {property.isSponsored ? (
        <Badge variant="muted" data-testid="placement-badge-sponsored">
          {t('sponsored')}
        </Badge>
      ) : null}

      {offerBadgeLabel ? <PropertyOfferBadge label={offerBadgeLabel} className="text-[10px]" /> : null}
    </>
  );

  const rating =
    property.reviewCount > 0 ? (
      <div
        className="flex items-center gap-1 text-[11px] text-[#0D2046]"
        data-testid="property-card-rating"
      >
        <Star className="h-3.5 w-3.5 fill-[#F5B301] text-[#F5B301]" aria-hidden />
        <span className="font-semibold tabular-nums text-[#0D2046]">{property.rating.toFixed(1)}</span>
        <span className="tabular-nums text-[#8794A7]">({property.reviewCount})</span>
      </div>
    ) : null;

  const featureRating = (
    <div
      className="flex items-center gap-1 text-[11px] text-[#8794A7]"
      data-testid="property-card-rating"
    >
      <Star
        className={cn(
          'h-3.5 w-3.5',
          property.reviewCount > 0 ? 'fill-[#F5B301] text-[#F5B301]' : 'text-[#D5DEEA]',
        )}
        aria-hidden
      />
      <span className="font-semibold tabular-nums text-[#0D2046]">
        {property.reviewCount > 0 ? property.rating.toFixed(1) : '—'}
      </span>
      {property.reviewCount > 0 ? (
        <span className="tabular-nums text-[#8794A7]">({property.reviewCount})</span>
      ) : null}
    </div>
  );

  const offerPriceBlock = (opts: { priceClass: string; metaClass: string; urgencyClass: string }) => (
    <div data-testid="browse-from-price">
      {hasPriceAnchor && originalPrice != null ? (
        <span className="sr-only">
          {formatPrice(originalPrice, property.currency, locale)}
          {' → '}
          {formatPrice(displayPrice, property.currency, locale)}
        </span>
      ) : null}
      <div className="flex flex-wrap items-baseline gap-1.5" aria-hidden={hasPriceAnchor}>
        {originalPrice != null ? (
          <span
            className="text-[10px] font-medium tabular-nums text-[#8794A7] line-through decoration-[#8794A7]/80"
            data-testid="price-original"
          >
            {formatPrice(originalPrice, property.currency, locale)}
          </span>
        ) : null}
        <span className={opts.priceClass} data-testid="price-final">
          {formatPrice(displayPrice, property.currency, locale)}
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className={opts.metaClass}>/{t('perDay')}</span>
        {savingsAmount != null ? (
          <span className="text-[9px] font-semibold text-[#B45309]" data-testid="offer-savings">
            {tHome('offerSaveAmount', {
              amount: formatPrice(savingsAmount, property.currency, locale),
            })}
          </span>
        ) : null}
      </div>
      {urgencyKey ? (
        <p className={opts.urgencyClass} data-testid="offer-urgency">
          {tHome(urgencyKey)}
        </p>
      ) : null}
    </div>
  );

  if (variant === 'rated') {
    return (
      <article
        data-testid="property-card"
        className="relative overflow-hidden rounded-[12px] border border-[#E6EDF6] bg-white"
      >
        <div className="absolute end-2 top-2 z-20 origin-top-right scale-[.88]">
          <FavoriteButton propertyId={property.id} variant="overlay" />
        </div>

        <Link
          href={href}
          data-testid={`property-card-${property.slug}`}
          className="flex min-h-[86px] items-center gap-2.5 p-2"
        >
          <div className="relative h-[74px] w-[116px] shrink-0 overflow-hidden rounded-[9px] bg-[#EEF5FF]">
            {property.imageUrl ? (
              <Image src={property.imageUrl} alt={title} fill className="object-cover" sizes="116px" />
            ) : null}
          </div>

          <div className="min-w-0 flex-1 pe-8">
            <h3 className="line-clamp-1 text-[12px] font-semibold text-[#0D2046]">{title}</h3>
            <p className="mt-1 line-clamp-1 text-[9px] text-[#8794A7]">{cityLabel}</p>
            <div className="mt-1">{rating}</div>
          </div>
        </Link>
      </article>
    );
  }

  if (variant === 'offer' && offerDensity === 'standard') {
    return (
      <article
        data-testid="property-card"
        className={cn('group relative overflow-hidden rounded-[20px]', offerCardChromeClass)}
      >
        <div className="absolute left-3 top-3 z-20">
          <FavoriteButton propertyId={property.id} variant="overlay" />
        </div>

        <Link href={href} data-testid={`property-card-${property.slug}`} className="block">
          <div className="relative h-[160px] overflow-hidden bg-[#EEF5FF]">
            {property.imageUrl ? (
              <Image
                src={property.imageUrl}
                alt={title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                sizes="(max-width: 760px) 100vw, 320px"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-center text-[12px] font-semibold text-[#0D2046]">
                {title}
              </div>
            )}

            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/25 to-transparent"
            />

            {offerBadgeLabel ? (
              <span
                data-testid="offer-badge"
                className={cn('absolute right-3 top-3 z-10', offerBadgeClass, 'text-[10px]')}
              >
                {offerBadgeLabel}
              </span>
            ) : null}

            <span
              className={cn(
                'absolute bottom-3 right-3 rounded-full px-3 py-1 text-[10px] font-semibold text-white/95 shadow-sm',
                typeClass,
                'opacity-90',
              )}
            >
              {tSearch(`propertyType.${property.type}`)}
            </span>
          </div>

          <div className="flex min-h-[88px] items-stretch justify-between gap-3 px-3.5 pb-3.5 pt-3">
            <div className="flex min-w-0 flex-1 flex-col text-start">
              <h3 className="line-clamp-1 text-[14px] font-semibold text-[#0D2046]">{title}</h3>

              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-[#8794A7]">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#8794A7]" aria-hidden />
                <span className="line-clamp-1">{shortLocation}</span>
              </p>

              <div className="mt-auto pt-2">{featureRating}</div>
            </div>

            <div className="flex shrink-0 flex-col justify-end text-start">
              {offerPriceBlock({
                priceClass: 'text-[17px] font-bold leading-none tabular-nums text-[#0D2046]',
                metaClass: 'text-[10px] font-medium text-[#8794A7]',
                urgencyClass: 'mt-0.5 text-[9px] font-semibold text-[#92400E]',
              })}
            </div>
          </div>
        </Link>
      </article>
    );
  }

  if (variant === 'offer') {
    return (
      <article
        data-testid="property-card"
        className={cn('relative overflow-hidden rounded-[12px]', offerCardChromeClass)}
      >
        <Link
          href={href}
          data-testid={`property-card-${property.slug}`}
          className="grid min-h-[92px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        >
          <div className="relative flex min-h-[92px] min-w-0 flex-col px-2.5 pb-1.5 pt-2 text-start">
            <div className="min-w-0">
              <h3 className="line-clamp-1 text-[12px] font-semibold text-[#0D2046]">{title}</h3>

              <p className="mt-0.5 flex items-center gap-1 text-[9.5px] font-medium text-[#8794A7]">
                <MapPin className="h-2.5 w-2.5 shrink-0 text-[#8794A7]" aria-hidden />
                <span className="line-clamp-1">{shortLocation}</span>
              </p>

              <div
                className="mt-1 flex items-center gap-1 text-[9.5px] font-medium text-[#8794A7]"
                data-testid="property-card-rating"
              >
                <Star
                  className={cn(
                    'h-2.5 w-2.5',
                    property.reviewCount > 0 ? 'fill-[#F5B301] text-[#F5B301]' : 'text-[#D5DEEA]',
                  )}
                  aria-hidden
                />
                {property.reviewCount > 0 ? (
                  <>
                    <span className="font-semibold tabular-nums text-[#53637A]">
                      {property.rating.toFixed(1)}
                    </span>
                    <span className="tabular-nums">({property.reviewCount})</span>
                  </>
                ) : (
                  <span className="tabular-nums text-[#A3B0C3]">—</span>
                )}
              </div>
            </div>

            <div className="mt-auto">
              {offerPriceBlock({
                priceClass: 'text-[14px] font-bold leading-none tabular-nums text-[#0D2046]',
                metaClass: 'text-[9px] font-medium text-[#8794A7]',
                urgencyClass: 'mt-0.5 text-[8.5px] font-semibold text-[#92400E]',
              })}
            </div>
          </div>

          <div className="relative min-h-[92px] overflow-hidden bg-[#EEF5FF]">
            {property.imageUrl ? (
              <Image src={property.imageUrl} alt={title} fill className="object-cover" sizes="160px" />
            ) : null}

            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/25 to-transparent"
            />

            {offerBadgeLabel ? (
              <span data-testid="offer-badge" className={cn('absolute left-1.5 top-1.5 z-[1]', offerBadgeClass)}>
                {offerBadgeLabel}
              </span>
            ) : null}
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article
      data-testid="property-card"
      className="group relative overflow-hidden rounded-[20px] border border-[#E0E8F3] bg-white transition duration-200"
    >
      <div className="absolute left-3 top-3 z-20">
        <FavoriteButton propertyId={property.id} variant="overlay" />
      </div>

      <Link href={href} data-testid={`property-card-${property.slug}`} className="block">
        <div className="relative h-[160px] overflow-hidden bg-[#EEF5FF]">
          {property.imageUrl ? (
            <Image
              src={property.imageUrl}
              alt={title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              sizes="(max-width: 760px) 100vw, 320px"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-center text-[12px] font-semibold text-[#0D2046]">
              {title}
            </div>
          )}

          <div className="absolute right-3 top-3 z-10 flex max-w-[55%] flex-wrap justify-end gap-1">
            {placementBadges}
          </div>

          <span
            className={cn(
              'absolute bottom-3 right-3 rounded-full px-3 py-1 text-[10px] font-semibold text-white shadow-sm',
              typeClass,
            )}
          >
            {tSearch(`propertyType.${property.type}`)}
          </span>
        </div>

        <div className="flex min-h-[88px] items-stretch justify-between gap-3 px-3.5 pb-3.5 pt-3">
          <div className="flex min-w-0 flex-1 flex-col text-start">
            <h3 className="line-clamp-1 text-[14px] font-semibold text-[#0D2046]">{title}</h3>

            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-[#8794A7]">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#8794A7]" aria-hidden />
              <span className="line-clamp-1">{shortLocation}</span>
            </p>

            <div className="mt-auto pt-2">{featureRating}</div>
          </div>

          <div className="flex shrink-0 flex-col justify-end text-start">
            {offerPriceBlock({
              priceClass: 'text-[17px] font-bold leading-none tabular-nums text-[#0D2046]',
              metaClass: 'text-[10px] font-medium text-[#8794A7]',
              urgencyClass: 'mt-0.5 text-[9px] font-semibold text-[#92400E]',
            })}
          </div>
        </div>
      </Link>
    </article>
  );
}
