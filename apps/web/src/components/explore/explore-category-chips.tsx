'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import {
  EXPLORE_PROPERTY_TYPE_CATEGORY_ORDER,
  activeExplorePropertyTypeCategory,
  exploreCategoryHref,
  type PropertyType,
} from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { PropertySearchParams } from '@/lib/api-properties';

function IconAll({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.95" />
      <rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.7" />
      <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.7" />
      <rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

function IconChalet({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12 3.2 3.8 10.2a1 1 0 0 0 .65 1.75H6V20a1 1 0 0 0 1 1h4.2v-4.4h1.6V21H17a1 1 0 0 0 1-1v-8.05h1.55a1 1 0 0 0 .65-1.75L12 3.2Z"
      />
    </svg>
  );
}

function IconVilla({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M4.5 20.5V9.2L12 4.2l7.5 5v11.3a.8.8 0 0 1-.8.8H5.3a.8.8 0 0 1-.8-.8Z"
      />
    </svg>
  );
}

function IconFarm({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12 3.5c-1.8 2.1-3.2 4.2-3.2 6.2a3.2 3.2 0 1 0 6.4 0c0-2-1.4-4.1-3.2-6.2Z"
      />
      <path fill="currentColor" d="M11.2 14.6h1.6V21h-1.6z" />
    </svg>
  );
}

function IconIstiraha({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M4 19V9.5L12 4l8 5.5V19a.8.8 0 0 1-.8.8H4.8A.8.8 0 0 1 4 19Z"
        opacity="0.9"
      />
      <path fill="currentColor" opacity="0.45" d="M9 19v-5h6v5H9Z" />
    </svg>
  );
}

function IconResort({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M3.5 19.5V10L12 4.5 20.5 10v9.5a.7.7 0 0 1-.7.7H4.2a.7.7 0 0 1-.7-.7Z"
      />
      <path fill="currentColor" opacity="0.4" d="M8 12h3v3H8zm5 0h3v3h-3z" />
    </svg>
  );
}

function IconPoolHouse({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="currentColor" d="M5 11.5 12 6l7 5.5V19H5v-7.5Z" opacity="0.85" />
      <path
        fill="currentColor"
        d="M4.2 16.2c1.4.8 2.7 1.2 4 1.2s2.6-.4 4-1.2c1.4.8 2.7 1.2 4 1.2.8 0 1.6-.1 2.4-.4v1.5c-.8.3-1.6.5-2.4.5-1.3 0-2.6-.4-4-1.2-1.4.8-2.7 1.2-4 1.2s-2.6-.4-4-1.2v-1.6Z"
      />
    </svg>
  );
}

const TYPE_ICONS: Record<
  PropertyType,
  { icon: (props: { className?: string }) => ReactNode; iconClass: string }
> = {
  farm: { icon: IconFarm, iconClass: 'text-[#1FAE62]' },
  chalet: { icon: IconChalet, iconClass: 'text-[#2F6EF6]' },
  villa: { icon: IconVilla, iconClass: 'text-[#0AA9C8]' },
  istiraha: { icon: IconIstiraha, iconClass: 'text-[#3B6FE8]' },
  private_resort: { icon: IconResort, iconClass: 'text-[#5B6BFF]' },
  pool_house: { icon: IconPoolHouse, iconClass: 'text-[#2F6EF6]' },
};

type Props = { filters: PropertySearchParams };

export function ExploreCategoryChips({ filters }: Props) {
  const t = useTranslations('explore');
  const params = useSearchParams();

  const propertyTypeFromUrl = params.get('propertyType');
  const activeFilters: PropertySearchParams = {
    ...filters,
    propertyType:
      propertyTypeFromUrl &&
      (EXPLORE_PROPERTY_TYPE_CATEGORY_ORDER as readonly string[]).includes(propertyTypeFromUrl)
        ? (propertyTypeFromUrl as PropertyType)
        : filters.propertyType,
  };

  const activeId = activeExplorePropertyTypeCategory(activeFilters);

  return (
    <nav className="w-full" aria-label={t('categoriesLabel')} data-testid="explore-category-chips">
      <div className="flex w-full items-center gap-2 overflow-x-auto scrollbar-soft">
        <Link
          href={exploreCategoryHref('/search', filters, null)}
          data-testid="explore-category-all"
          className={cn(
            'inline-flex h-[44px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[12px] font-medium shadow-[0_4px_14px_rgba(31,70,120,.04)] transition sm:px-3.5 sm:text-[13px]',
            activeId === 'all'
              ? 'border-transparent bg-[#2F6EF6] font-semibold text-white shadow-[0_8px_18px_rgba(47,110,246,.24)]'
              : 'border-[#E6EDF6] bg-white text-[#4E5D73] hover:border-[#C5D8FF]',
          )}
        >
          <IconAll className={cn('h-[17px] w-[17px] shrink-0', activeId === 'all' ? 'text-white' : 'text-[#2F6EF6]')} />
          {t('chip.all')}
        </Link>

        {EXPLORE_PROPERTY_TYPE_CATEGORY_ORDER.map((pt) => {
          const { icon: Icon, iconClass } = TYPE_ICONS[pt];
          const active = activeId === pt;
          return (
            <Link
              key={pt}
              href={exploreCategoryHref('/search', filters, pt)}
              data-testid={`explore-category-${pt}`}
              className={cn(
                'inline-flex h-[44px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[12px] font-medium shadow-[0_4px_14px_rgba(31,70,120,.04)] transition sm:px-3.5 sm:text-[13px]',
                active
                  ? 'border-transparent bg-[#2F6EF6] font-semibold text-white shadow-[0_8px_18px_rgba(47,110,246,.24)]'
                  : 'border-[#E6EDF6] bg-white text-[#4E5D73] hover:border-[#C5D8FF]',
              )}
            >
              <Icon className={cn('h-[17px] w-[17px] shrink-0', active ? 'text-white' : iconClass)} />
              {t(`chip.${pt}`)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
