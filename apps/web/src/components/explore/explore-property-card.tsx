'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import type { PublicPropertySummary } from '@mazare3/shared';
import { JORDAN_CITIES, searchHref } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { FavoriteButton } from '@/components/favorites/favorite-button';
import { formatPrice, getApproxLocation, getPropertyTitle } from '@/lib/property-helpers';
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
};

export function ExplorePropertyCard({ property, compact = false }: ExplorePropertyCardProps) {
  const locale = useLocale() as 'ar' | 'en';
  const t = useTranslations('common');
  const title = getPropertyTitle(property, locale);
  const location = getApproxLocation(property);
  const cityMeta = JORDAN_CITIES.find((c) => c.key === property.city);
  const cityLabel = cityMeta ? (locale === 'ar' ? cityMeta.labelAr : cityMeta.labelEn) : property.city;
  const areaLabel = property.area?.trim();
  const match = property.searchMatch;
  const href = searchHref(`/properties/${property.slug}`, {
    date: match?.matchedDate ?? undefined,
    period: match?.matchedPeriod ?? undefined,
  });
  const amenities = AMENITY_ORDER.filter((item) => item.present(property));
  const exactSlot =
    property.pricingMode === 'exact_slot' && match?.slotPrice != null ? match.slotPrice : null;
  const displayPrice = exactSlot ?? property.basePrice;

  const locationLine = [cityLabel, areaLabel || (location && location !== cityLabel ? location : null)]
    .filter(Boolean)
    .join(' • ');

  return (
    <article
      data-testid={`explore-card-${property.slug}`}
      className={cn(
        'group relative overflow-hidden rounded-[18px] border border-[#E8EEF6] bg-white shadow-[0_6px_20px_rgba(31,70,120,.05)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(31,70,120,.09)]',
        compact ? 'w-[230px] shrink-0 sm:w-auto sm:min-w-0 sm:max-w-none' : 'h-full',
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
        </div>

        <div className={cn('space-y-2 text-start', compact ? 'p-3' : 'px-3.5 pb-3.5 pt-3')}>
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                'min-w-0 flex-1 line-clamp-1 font-bold leading-snug text-[#0D2046]',
                compact ? 'text-[13px]' : 'text-[15px]',
              )}
            >
              {title}
            </h3>
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

            <p className="shrink-0 text-end leading-none">
              <span className={cn('font-bold tabular-nums text-[#0D2046]', compact ? 'text-[14px]' : 'text-[15px]')}>
                {formatPrice(displayPrice, property.currency, locale)}
              </span>
              <span className="ms-1 text-[11px] font-medium text-[#8A96A8]">/ {t('perDay')}</span>
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}
