'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AvailabilityPeriod, HomeBookAgainItem } from '@mazare3/shared';
import { useAuthSession } from '@/components/auth/auth-session';
import { fetchHomePersonalization } from '@/lib/api-home-personalization';
import { ExplorePropertyCard } from './explore-property-card';
import { cn } from '@/lib/utils';

type ExploreBookAgainRailProps = {
  searchIntent?: {
    date?: string;
    period?: AvailabilityPeriod;
    guests?: number;
  };
};

/**
 * Browse-mode personalized Book Again rail.
 * Authenticated customers only; reuses `/me/home-personalization` (no-store).
 */
export function ExploreBookAgainRail({ searchIntent }: ExploreBookAgainRailProps) {
  const t = useTranslations('explore');
  const { user, ready: authReady } = useAuthSession();
  const [items, setItems] = useState<HomeBookAgainItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!authReady || user?.role !== 'customer') {
      setItems(null);
      return;
    }
    void (async () => {
      try {
        const personal = await fetchHomePersonalization();
        if (cancelled) return;
        const bookAgain = personal?.bookAgain ?? [];
        setItems(bookAgain.length ? bookAgain : null);
      } catch {
        if (!cancelled) setItems(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  if (!items?.length) return null;

  return (
    <section data-testid="explore-book-again-rail" aria-label={t('bookAgainTitle')}>
      <div className="mb-3">
        <h2 className="text-[18px] font-bold text-[#0D2046] sm:text-[20px]">{t('bookAgainTitle')}</h2>
        <p className="mt-1 text-[12px] font-medium text-[#53637A]">{t('bookAgainSubtitle')}</p>
      </div>

      <div
        className={cn(
          '-mx-1 flex gap-3 overflow-x-auto px-1 pb-1',
          'snap-x snap-mandatory scroll-smooth',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {items.map((item) => (
          <div
            key={item.property.id}
            className="w-[230px] shrink-0 snap-start sm:w-[248px]"
            data-testid={`explore-book-again-card-${item.property.slug}`}
          >
            <ExplorePropertyCard
              property={item.property}
              compact
              searchIntent={searchIntent}
              historyCue={t('bookAgainCue')}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
