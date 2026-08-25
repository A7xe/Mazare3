'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { MapPin, Star } from 'lucide-react';
import type { PublicPropertySummary } from '@mazare3/shared';
import { searchHref } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { PriceDisplay } from '@/components/marketplace/price-display';
import { FavoriteButton } from '@/components/favorites/favorite-button';
import { getApproxLocation, getPropertyTitle } from '@/lib/property-helpers';
import { cn } from '@/lib/utils';
import { TYPE_BADGE_CLASS } from './home-visual';

type HomeCardVariant = 'feature' | 'offer' | 'rated';

interface HomePropertyCardProps {
  property: PublicPropertySummary;
  variant?: HomeCardVariant;
}

export function HomePropertyCard({ property, variant = 'feature' }: HomePropertyCardProps) {
  const locale = useLocale() as 'ar' | 'en';
  const t = useTranslations('common');
  const tSearch = useTranslations('search');

  const title = getPropertyTitle(property, locale);
  const location = getApproxLocation(property);
  const href = searchHref(`/properties/${property.slug}`, {});
  const typeClass = TYPE_BADGE_CLASS[property.type] ?? 'bg-[#2F6EF6] text-white';

  const placementBadges = (
    <>
      {property.isSponsored ? (
        <Badge variant="muted" data-testid="placement-badge-sponsored">
          {t('sponsored')}
        </Badge>
      ) : property.isFeatured ? (
        <Badge variant="highlight" data-testid="placement-badge-featured">
          {t('featured')}
        </Badge>
      ) : null}

      {property.hasActivePromotion ? (
        <Badge variant="highlight" data-testid="offer-badge">
          {tSearch('offerAvailable')}
        </Badge>
      ) : null}
    </>
  );

  const rating =
    property.reviewCount > 0 ? (
      <div
        className="flex items-center gap-1 text-[10px] text-[#0D2046]"
        data-testid="property-card-rating"
      >
        <Star className="h-3 w-3 fill-[#F5B301] text-[#F5B301]" aria-hidden />
        <span className="font-semibold">{property.rating.toFixed(1)}</span>
        <span className="text-[#8794A7]">({property.reviewCount})</span>
      </div>
    ) : null;

  const price = (
    <PriceDisplay
      amount={property.basePrice}
      currency={property.currency}
      locale={locale}
      fromLabel={t('from')}
      perDayLabel={t('perDay')}
    />
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
            <h3 className="line-clamp-1 text-[12px] font-bold text-[#0D2046]">{title}</h3>
            <p className="mt-1 line-clamp-1 text-[9px] text-[#8794A7]">
              {property.city} · {location}
            </p>
            <div className="mt-1">{rating}</div>
          </div>
        </Link>
      </article>
    );
  }

  if (variant === 'offer') {
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
          className="grid min-h-[110px] grid-cols-[44%_minmax(0,1fr)]"
        >
          <div className="relative min-h-[110px] overflow-hidden bg-[#EEF5FF]">
            {property.imageUrl ? (
              <Image src={property.imageUrl} alt={title} fill className="object-cover" sizes="135px" />
            ) : null}

            <div className="absolute start-1.5 top-1.5 flex max-w-[85%] flex-wrap gap-1">
              {placementBadges}
            </div>
          </div>

          <div className="min-w-0 px-2.5 py-2 pe-8">
            <h3 className="line-clamp-1 text-[11.5px] font-bold text-[#0D2046]">{title}</h3>

            <p className="mt-1 flex items-center gap-1 text-[9px] text-[#8794A7]">
              <MapPin className="h-3 w-3 shrink-0 text-[#2F6EF6]" />
              <span className="line-clamp-1">
                {property.city} · {location}
              </span>
            </p>

            <div className="mt-1">{rating}</div>

            <div className="mt-1 origin-start scale-[.82]">{price}</div>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article
      data-testid="property-card"
      className="group relative overflow-hidden rounded-[14px] border border-[#E3EAF4] bg-white shadow-[0_5px_18px_rgba(31,67,115,.055)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_9px_26px_rgba(31,67,115,.09)]"
    >
      <div className="absolute start-2.5 top-2.5 z-20 origin-top-left scale-[.88]">
        <FavoriteButton propertyId={property.id} variant="overlay" />
      </div>

      <Link href={href} data-testid={`property-card-${property.slug}`} className="block">
        <div className="relative h-[122px] overflow-hidden bg-[#EEF5FF]">
          {property.imageUrl ? (
            <Image
              src={property.imageUrl}
              alt={title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.025]"
              sizes="(max-width: 760px) 100vw, 290px"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-center text-[11px] font-semibold text-[#0D2046]">
              {title}
            </div>
          )}

          <div className="absolute end-2 top-2 z-10 flex max-w-[65%] flex-wrap justify-end gap-1">
            {placementBadges}
          </div>

          <span
            className={cn(
              'absolute bottom-2 end-2 rounded-full px-2.5 py-1 text-[9px] font-semibold shadow-sm',
              typeClass,
            )}
          >
            {tSearch(`propertyType.${property.type}`)}
          </span>
        </div>

        <div className="px-3 py-2.5">
          <h3 className="line-clamp-1 text-[12.5px] font-bold text-[#0D2046]">{title}</h3>

          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-1 text-[9px] text-[#8794A7]">
              <MapPin className="h-3 w-3 shrink-0 text-[#2F6EF6]" />
              <span className="line-clamp-1">
                {property.city} · {location}
              </span>
            </p>
            {rating}
          </div>

          <div className="mt-1.5 origin-start scale-[.88]">{price}</div>
        </div>
      </Link>
    </article>
  );
}
