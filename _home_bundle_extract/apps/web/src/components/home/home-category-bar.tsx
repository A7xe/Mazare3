'use client';

import { useTranslations } from 'next-intl';
import { Building2, Home, LayoutGrid, Leaf, MoonStar, Target, Waves } from 'lucide-react';
import { searchHref } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { id: 'all', href: '/search', icon: LayoutGrid, iconClass: 'text-white' },
  { id: 'chalet', href: searchHref('/search', { propertyType: 'chalet' }), icon: Home, iconClass: 'text-[#7457F6]' },
  { id: 'villa', href: searchHref('/search', { propertyType: 'villa' }), icon: Building2, iconClass: 'text-[#12B7D6]' },
  { id: 'farm', href: searchHref('/search', { propertyType: 'farm' }), icon: Leaf, iconClass: 'text-[#27B76F]' },
  { id: 'pool', href: searchHref('/search', { hasPool: true }), icon: Waves, iconClass: 'text-[#2F6EF6]' },
  { id: 'football', href: searchHref('/search', { amenities: ['football'] }), icon: Target, iconClass: 'text-[#1D5FE8]' },
  { id: 'overnight', href: searchHref('/search', { allowsOvernight: true }), icon: MoonStar, iconClass: 'text-[#7457F6]' },
] as const;

export function HomeCategoryBar() {
  const t = useTranslations('home');
  const tSearch = useTranslations('search');

  function label(id: (typeof CATEGORIES)[number]['id']) {
    if (id === 'all') return tSearch('filterAny');
    if (id === 'farm') return tSearch('propertyType.farm');
    if (id === 'chalet') return tSearch('propertyType.chalet');
    if (id === 'villa') return tSearch('propertyType.villa');
    if (id === 'pool') return tSearch('filterPoolYes');
    if (id === 'football') return tSearch('amenity.football');
    return t('categoryOvernight');
  }

  return (
    <nav className="mb-3 overflow-x-auto pb-1" aria-label={t('categoriesLabel')}>
      <div className="grid min-w-[730px] grid-cols-7 gap-2 lg:min-w-0">
        {CATEGORIES.map((item, index) => {
          const Icon = item.icon;
          const active = index === 0;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'inline-flex h-[48px] min-w-0 items-center justify-center gap-2 rounded-[11px] border px-3 text-[11.5px] font-semibold transition',
                active
                  ? 'border-transparent bg-[linear-gradient(135deg,#4387FF,#2F6EF6)] text-white shadow-[0_8px_20px_rgba(47,110,246,.22)]'
                  : 'border-[#E3EAF4] bg-white text-[#304562] hover:border-[#BFD2EC] hover:bg-[#FBFDFF]',
              )}
            >
              <Icon
                className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-white' : item.iconClass)}
                strokeWidth={1.8}
                aria-hidden
              />
              <span className="truncate">{label(item.id)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
