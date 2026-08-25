'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { searchHref } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

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
      <path fill="#fff" opacity="0.35" d="M10.2 12.2h3.6v3.2h-3.6z" />
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
      <path fill="#fff" opacity="0.28" d="M8 12.2h2.4v2.2H8zm5.6 0H16v2.2h-2.4zM8 16h2.4v2.2H8zm5.6 0H16v2.2h-2.4z" />
      <path fill="currentColor" opacity="0.55" d="M11.1 4.8h1.8V3.4h-1.8z" />
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
      <path fill="currentColor" opacity="0.55" d="M7.2 11.2c-1.3 1.5-2.3 3-2.3 4.4a2.3 2.3 0 1 0 4.6 0c0-1.4-1-2.9-2.3-4.4Z" />
      <path fill="currentColor" opacity="0.55" d="M16.8 11.2c-1.3 1.5-2.3 3-2.3 4.4a2.3 2.3 0 1 0 4.6 0c0-1.4-1-2.9-2.3-4.4Z" />
      <path fill="currentColor" d="M11.2 14.6h1.6V21h-1.6z" />
      <path fill="currentColor" opacity="0.35" d="M8.2 20.2h7.6V21H8.2z" />
    </svg>
  );
}

function IconPool({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <ellipse cx="12" cy="9.2" rx="7.2" ry="3.4" fill="currentColor" opacity="0.35" />
      <path
        fill="currentColor"
        d="M4.2 13.2c1.5.9 2.9 1.4 4.3 1.4s2.8-.5 4.3-1.4c1.5.9 2.9 1.4 4.3 1.4.9 0 1.8-.2 2.7-.5v1.7c-.9.4-1.8.6-2.7.6-1.4 0-2.8-.5-4.3-1.4-1.5.9-2.9 1.4-4.3 1.4s-2.8-.5-4.3-1.4v-1.8Z"
      />
      <path
        fill="currentColor"
        opacity="0.75"
        d="M4.2 17c1.5.9 2.9 1.4 4.3 1.4s2.8-.5 4.3-1.4c1.5.9 2.9 1.4 4.3 1.4.9 0 1.8-.2 2.7-.5v1.7c-.9.4-1.8.6-2.7.6-1.4 0-2.8-.5-4.3-1.4-1.5.9-2.9 1.4-4.3 1.4s-2.8-.5-4.3-1.4V17Z"
      />
    </svg>
  );
}

function IconFootball({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.2" fill="currentColor" opacity="0.18" />
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        fill="currentColor"
        d="M12 8.2 14.4 9.9l-.9 2.8H10.5l-.9-2.8L12 8.2Zm0-4.4 1.1 3.3-2.2.1L12 3.8Zm5.7 4.1-2.7 2-1.1-2.5 2.2-1.6 1.6 2.1ZM6.3 7.9l1.6-2.1 2.2 1.6-1.1 2.5-2.7-2Zm8.8 7.4-1.1 2.5-2.2-1.6.9-2.7 2.4 1.8ZM8.9 15.3l.9 2.7-2.2 1.6-1.1-2.5 2.4-1.8Zm7.8-1.7.3 3.4-2.8-1.2 1.1-2.6 1.4.4ZM7.3 13.6l1.1 2.6-2.8 1.2.3-3.4 1.4-.4Z"
      />
    </svg>
  );
}

function IconOvernight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M14.8 4.2a7.8 7.8 0 1 0 5 13.2A8.2 8.2 0 1 1 14.8 4.2Z"
      />
      <path fill="currentColor" opacity="0.85" d="m17.8 5.2.55 1.35 1.4.2-1.1.95.35 1.4-1.2-.75-1.2.75.35-1.4-1.1-.95 1.4-.2z" />
    </svg>
  );
}

const CATEGORIES: Array<{
  id: 'all' | 'chalet' | 'villa' | 'farm' | 'pool' | 'football' | 'overnight';
  href: string;
  icon: (props: { className?: string }) => ReactNode;
  iconClass: string;
}> = [
  { id: 'all', href: '/search', icon: IconAll, iconClass: 'text-white' },
  { id: 'chalet', href: searchHref('/search', { propertyType: 'chalet' }), icon: IconChalet, iconClass: 'text-[#6B4FE8]' },
  { id: 'villa', href: searchHref('/search', { propertyType: 'villa' }), icon: IconVilla, iconClass: 'text-[#0AA9C8]' },
  { id: 'farm', href: searchHref('/search', { propertyType: 'farm' }), icon: IconFarm, iconClass: 'text-[#1FAE62]' },
  { id: 'pool', href: searchHref('/search', { hasPool: true }), icon: IconPool, iconClass: 'text-[#2F6EF6]' },
  { id: 'football', href: searchHref('/search', { amenities: ['football'] }), icon: IconFootball, iconClass: 'text-[#1D5FE8]' },
  { id: 'overnight', href: searchHref('/search', { allowsOvernight: true }), icon: IconOvernight, iconClass: 'text-[#6B4FE8]' },
];

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
      <div className="grid min-w-[760px] grid-cols-[0.7fr_1fr_1fr_1.55fr_1.05fr_0.9fr_0.88fr] gap-2 lg:min-w-0">
        {CATEGORIES.map((item, index) => {
          const Icon = item.icon;
          const active = index === 0;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'inline-flex h-[52px] min-w-0 items-center justify-center gap-2 rounded-[12px] border px-2.5 text-[13px] font-medium whitespace-nowrap transition',
                active
                  ? 'border-transparent bg-[linear-gradient(135deg,#4387FF,#2F6EF6)] font-semibold text-white shadow-[0_8px_20px_rgba(47,110,246,.22)]'
                  : 'border-[#E3EAF4] bg-white text-[#53637A] hover:border-[#BFD2EC] hover:bg-[#FBFDFF]',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  active ? 'bg-white/18' : 'bg-[#F2F7FF]',
                )}
              >
                <Icon className={cn('h-[17px] w-[17px]', active ? 'text-white' : item.iconClass)} />
              </span>
              <span className="min-w-0">{label(item.id)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
