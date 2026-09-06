'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import type { AvailabilityPeriod, PublicPropertySummary } from '@mazare3/shared';
import { JORDAN_CITIES, searchHref } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { FavoriteButton } from '@/components/favorites/favorite-button';
import {
  PropertyOfferBadge,
  PropertyOfferPriceBlock,
  usePropertyOfferPresentation,
} from '@/components/marketplace/property-offer-indicators';
import { getApproxLocation, getPropertyTitle } from '@/lib/property-helpers';
import { cn } from '@/lib/utils';

function IconPool({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M3.5 10.5c1.4.9 2.7 1.35 4 1.35s2.6-.45 4-1.35c1.4.9 2.7 1.35 4 1.35s2.6-.45 4-1.35"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M3.5 14.2c1.4.9 2.7 1.35 4 1.35s2.6-.45 4-1.35c1.4.9 2.7 1.35 4 1.35s2.6-.45 4-1.35"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M3.5 17.9c1.4.9 2.7 1.35 4 1.35s2.6-.45 4-1.35c1.4.9 2.7 1.35 4 1.35s2.6-.45 4-1.35"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconWifi({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4.2 9.4a11.2 11.2 0 0 1 15.6 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M7 12.6a7.2 7.2 0 0 1 10 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M9.8 15.7a3.4 3.4 0 0 1 4.4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="18.4" r="1.15" fill="currentColor" />
    </svg>
  );
}

function IconPlayground({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 5.5v13" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 12h4.2M16.3 12H20.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconParking({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M9.2 16.5V7.5h3.2c2.05 0 3.35 1.15 3.35 2.9 0 1.75-1.3 2.9-3.35 2.9H11v3.2H9.2Zm1.8-4.55h1.25c.95 0 1.55-.5 1.55-1.25s-.6-1.25-1.55-1.25H11v2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

type AmenityId = 'pool' | 'wifi' | 'football' | 'parking';

/** Distinct amenity icon colors — presentation only. */
const AMENITY_ICON_COLOR: Record<AmenityId, string> = {
  pool: 'text-[#18B7C9]',
  wifi: 'text-[#2F6EF6]',
  football: 'text-[#22A06B]',
  parking: 'text-[#F59E0B]',
};

const AMENITY_ORDER: Array<{
  id: AmenityId;
  icon: (props: { className?: string }) => ReactNode;
  present: (property: PublicPropertySummary) => boolean;
}> = [
  {
    id: 'pool',
    icon: IconPool,
    present: (p) =>
      p.hasPool ||
      p.hasIndoorPool ||
      p.hasHeatedPool ||
      p.amenityKeys?.includes('pool') ||
      p.amenityKeys?.includes('indoor_pool') ||
      p.amenityKeys?.includes('heated_pool') ||
      p.amenityKeys?.includes('kids_pool'),
  },
  {
    id: 'wifi',
    icon: IconWifi,
    present: (p) => Boolean(p.amenityKeys?.includes('wifi')),
  },
  {
    id: 'football',
    icon: IconPlayground,
    present: (p) => p.hasFootballField || Boolean(p.amenityKeys?.includes('football')),
  },
  {
    id: 'parking',
    icon: IconParking,
    present: (p) => Boolean(p.amenityKeys?.includes('parking')),
  },
];

type ExplorePropertyCardProps = {
  property: PublicPropertySummary;
  compact?: boolean;
  /** Preserve current Explore booking intent on detail links. */
  searchIntent?: {
    date?: string;
    period?: AvailabilityPeriod;
    guests?: number;
  };
  /** Optional subtle personalization cue (e.g. Book Again). */
  historyCue?: string;
};

export function ExplorePropertyCard({
  property,
  compact = false,
  searchIntent,
  historyCue,
}: ExplorePropertyCardProps) {
  const locale = useLocale() as 'ar' | 'en';
  const tCommon = useTranslations('common');
  const title = getPropertyTitle(property, locale);
  const location = getApproxLocation(property);
  const cityMeta = JORDAN_CITIES.find((c) => c.key === property.city);
  const cityLabel = cityMeta ? (locale === 'ar' ? cityMeta.labelAr : cityMeta.labelEn) : property.city;
  const areaLabel = property.area?.trim();
  const match = property.searchMatch;
  const href = searchHref(`/properties/${property.slug}`, {
    date: searchIntent?.date ?? match?.matchedDate ?? undefined,
    period: searchIntent?.period ?? match?.matchedPeriod ?? undefined,
    guests: searchIntent?.guests,
  });
  const amenities = AMENITY_ORDER.filter((item) => item.present(property));
  const { badgeLabel } = usePropertyOfferPresentation(property);
  const isSponsored = Boolean(property.isSponsored);

  const locationLine = [cityLabel, areaLabel || (location && location !== cityLabel ? location : null)]
    .filter(Boolean)
    .join(' • ');

  return (
    <article
      data-testid={`explore-card-${property.slug}`}
      data-sponsored={isSponsored ? 'true' : undefined}
      className={cn(
        'group relative overflow-hidden rounded-[18px] border border-[#E8EEF6] bg-white shadow-[0_6px_20px_rgba(31,70,120,.05)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(31,70,120,.09)]',
        compact ? 'w-[230px] shrink-0 sm:w-auto sm:min-w-0 sm:max-w-none' : 'h-full',
        isSponsored && 'ring-1 ring-[#2F6EF6]/20',
      )}
    >
      <div className="absolute end-3 top-3 z-20">
        <FavoriteButton propertyId={property.id} variant="overlay" />
      </div>

      <Link href={href} className="block h-full">
        <div className={cn('relative overflow-hidden bg-[#EEF5FF]', compact ? 'h-[148px]' : 'h-[176px]')}>
          {property.imageUrl ? (
            <Image
              src={property.imageUrl}
              alt={title}
              fill
              className="object-cover transition duration-300 group-hover:scale-[1.03]"
              sizes={compact ? '260px' : '(max-width: 768px) 100vw, 360px'}
            />
          ) : null}

          {isSponsored || badgeLabel ? (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/20 to-transparent"
              />
              <div className="absolute start-3 top-3 z-10 flex max-w-[70%] flex-col items-start gap-1">
                {isSponsored ? (
                  <span
                    data-testid="placement-badge-sponsored"
                    className={cn(
                      'inline-flex max-w-full items-center truncate rounded-full bg-[#2F6EF6] px-2 py-0.5 font-semibold text-white shadow-sm',
                      compact ? 'text-[8.5px]' : 'text-[10px]',
                    )}
                  >
                    {tCommon('sponsored')}
                  </span>
                ) : null}
                {badgeLabel ? (
                  <PropertyOfferBadge
                    label={badgeLabel}
                    className={cn(
                      'max-w-full truncate',
                      compact ? 'text-[8.5px]' : 'text-[10px]',
                    )}
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        <div className={cn('space-y-2 text-start', compact ? 'p-3' : 'px-3.5 pb-3.5 pt-3')}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3
                className={cn(
                  'line-clamp-1 font-bold leading-snug text-[#0D2046]',
                  compact ? 'text-[13px]' : 'text-[15px]',
                )}
              >
                {title}
              </h3>
              {historyCue ? (
                <p
                  className="mt-0.5 text-[10px] font-medium text-[#64748B]"
                  data-testid="book-again-cue"
                >
                  {historyCue}
                </p>
              ) : null}
            </div>
            {property.reviewCount > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F3F5F8] px-2 py-0.5 text-[12px] font-semibold text-[#0D2046]">
                {property.rating.toFixed(1)}
                <Star className="h-3 w-3 fill-[#F5B301] text-[#F5B301]" aria-hidden />
              </span>
            ) : null}
          </div>

          <p className="line-clamp-1 text-[12px] font-medium text-[#8A96A8]">{locationLine}</p>

          <div className="flex items-end justify-between gap-3 pt-0.5">
            {amenities.length > 0 ? (
              <div className="flex items-center gap-2.5" aria-hidden>
                {amenities.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Icon
                      key={item.id}
                      className={cn('h-[15px] w-[15px]', AMENITY_ICON_COLOR[item.id])}
                    />
                  );
                })}
              </div>
            ) : (
              <span />
            )}

            <div className="shrink-0 text-end">
              <PropertyOfferPriceBlock
                property={property}
                compact={compact}
                showUrgency={!compact}
                priceClassName={compact ? 'text-[14px]' : 'text-[15px]'}
              />
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
