'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { HomeBookAgainItem, HomePersonalizationResponse, PublicPropertySummary } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { HomePropertyCard } from '@/components/home/home-property-card';
import { DiscoveryRail } from '@/components/marketplace/discovery-rail';
import { useAuthSession } from '@/components/auth/auth-session';
import { fetchHomePersonalization } from '@/lib/api-home-personalization';

function BookAgainRail({ items }: { items: HomeBookAgainItem[] }) {
  const t = useTranslations('home');
  if (!items.length) return null;

  return (
    <section className="py-6" data-testid="discovery-rail-bookAgain">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold text-[#0D2046] sm:text-[20px]">{t('railBookAgain')}</h2>
          <p className="mt-1 text-[12px] font-medium text-[#53637A]">{t('railBookAgainHint')}</p>
        </div>
        <Link
          href="/account/bookings"
          className="shrink-0 text-[12px] font-semibold text-[#2F6EF6] hover:text-[#1D5FE8]"
        >
          {t('railBookAgainSeeAll')}
        </Link>
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {items.map((item) => (
          <div
            key={item.bookingId}
            className="w-[78%] max-w-sm shrink-0 snap-start space-y-2 sm:w-[280px]"
            data-testid={`book-again-card-${item.property.slug}`}
          >
            <HomePropertyCard property={item.property} variant="feature" />
            <Button asChild size="sm" className="w-full shadow-soft" data-testid={`book-again-cta-${item.bookingId}`}>
              <Link
                href={`/properties/${item.property.slug}?rebook=${item.bookingId}&guests=${item.guestsCount}`}
              >
                {t('bookAgainCta')}
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PersonalizedHomeRails() {
  const t = useTranslations('home');
  const tSearch = useTranslations('search');
  const { user, ready: authReady } = useAuthSession();
  const [data, setData] = useState<HomePersonalizationResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!authReady || user?.role !== 'customer') {
      setData(null);
      return;
    }
    void (async () => {
      try {
        const personal = await fetchHomePersonalization();
        if (!cancelled) setData(personal);
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  if (!data) return null;

  const favorites: PublicPropertySummary[] = data.favorites ?? [];

  return (
    <>
      <BookAgainRail items={data.bookAgain ?? []} />
      <DiscoveryRail
        title={t('railYourFavorites')}
        subtitle={t('railYourFavoritesHint')}
        seeAllHref="/account/favorites"
        seeAllLabel={tSearch('seeAll')}
        properties={favorites}
        sectionId="yourFavorites"
      />
    </>
  );
}
