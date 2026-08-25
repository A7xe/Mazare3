import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { MarketplaceDiscoveryResponse, PublicPropertySummary } from '@mazare3/shared';
import { searchHref } from '@mazare3/shared';
import { HomeSearchSidebar } from '@/components/home/home-search-sidebar';
import { HomeHero } from '@/components/home/home-hero';
import { HomeCategoryBar } from '@/components/home/home-category-bar';
import { HomeTrustStrip } from '@/components/home/home-trust-strip';
import { HomeWhySection } from '@/components/home/home-why';
import { DiscoveryRail } from '@/components/marketplace/discovery-rail';
import { PersonalizedHomeRails } from '@/components/marketplace/personalized-home-rails';
import { fetchDiscovery } from '@/lib/api-properties';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

function sectionOf(discovery: MarketplaceDiscoveryResponse | null, id: string) {
  return discovery?.sections.find((section) => section.id === id)?.properties ?? [];
}

const HERO_TYPE_PRIORITY: Record<string, number> = {
  private_resort: 0,
  pool_house: 1,
  chalet: 2,
  villa: 3,
  istiraha: 4,
  farm: 5,
};

const HERO_SECTION_PRIORITY: Record<string, number> = {
  featured: 0,
  sponsored: 1,
  offers: 2,
  topRated: 3,
  recentlyAdded: 4,
};

function heroSlides(discovery: MarketplaceDiscoveryResponse | null): PublicPropertySummary[] {
  const candidates: Array<{ property: PublicPropertySummary; sectionId: string }> = [];
  const seenIds = new Set<string>();
  const seenImages = new Set<string>();

  for (const section of discovery?.sections ?? []) {
    for (const property of section.properties) {
      if (!property.imageUrl) continue;
      if (seenIds.has(property.id) || seenImages.has(property.imageUrl)) continue;
      seenIds.add(property.id);
      seenImages.add(property.imageUrl);
      candidates.push({ property, sectionId: section.id });
    }
  }

  return candidates
    .sort((a, b) => {
      const typeA = HERO_TYPE_PRIORITY[a.property.type] ?? 99;
      const typeB = HERO_TYPE_PRIORITY[b.property.type] ?? 99;
      if (typeA !== typeB) return typeA - typeB;

      const sectionA = HERO_SECTION_PRIORITY[a.sectionId] ?? 99;
      const sectionB = HERO_SECTION_PRIORITY[b.sectionId] ?? 99;
      if (sectionA !== sectionB) return sectionA - sectionB;

      const ratingA = a.property.reviewCount > 0 ? a.property.rating : 0;
      const ratingB = b.property.reviewCount > 0 ? b.property.rating : 0;
      return ratingB - ratingA;
    })
    .slice(0, 5)
    .map(({ property }) => property);
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('home');
  const tSearch = await getTranslations('search');

  let discovery: MarketplaceDiscoveryResponse | null = null;
  try {
    discovery = await fetchDiscovery();
  } catch {
    discovery = null;
  }

  const featured = sectionOf(discovery, 'featured');
  const offers = sectionOf(discovery, 'offers');
  const topRated = sectionOf(discovery, 'topRated');
  const sponsored = sectionOf(discovery, 'sponsored');
  const recentlyAdded = sectionOf(discovery, 'recentlyAdded');
  const contentDir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F8FAFC] pb-[122px] text-[#0D2046]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-[-55px] h-[250px] w-[260px] rounded-[42%] bg-[#EEF5FF]/80 blur-[1px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 top-[410px] h-[250px] w-[210px] rounded-[46%] bg-[#EDF4FF]/70"
      />

      <div className="relative mx-auto w-full max-w-[1280px] px-4 pt-5 sm:px-6 lg:px-8 lg:pt-6">
        <div
          dir="ltr"
          className="grid items-start gap-5 lg:grid-cols-[310px_minmax(0,1fr)] xl:gap-7"
        >
          <aside dir={contentDir} className="space-y-4 lg:col-start-1 lg:row-start-1">
            <HomeSearchSidebar />

            <DiscoveryRail
              title={t('railOffers')}
              subtitle={t('railOffersHint')}
              seeAllHref={searchHref('/search', { sort: 'recommended' })}
              seeAllLabel={tSearch('seeAll')}
              properties={offers}
              sectionId="offers"
              layout="stack"
            />

            <DiscoveryRail
              title={t('railTopRated')}
              subtitle={t('railTopRatedHint')}
              seeAllHref={searchHref('/search', { sort: 'recommended' })}
              seeAllLabel={tSearch('seeAll')}
              properties={topRated}
              sectionId="topRated"
              layout="list"
            />
          </aside>

          <main dir={contentDir} className="min-w-0 lg:col-start-2 lg:row-start-1">
            <HomeCategoryBar />
            <HomeHero slides={heroSlides(discovery)} />
            <HomeTrustStrip />

            <div className="mt-4">
              <DiscoveryRail
                title={t('railFeatured')}
                subtitle={t('railFeaturedHint')}
                seeAllHref={searchHref('/search', { featured: true })}
                seeAllLabel={tSearch('seeAll')}
                properties={featured}
                sectionId="featured"
                layout="grid"
              />
            </div>

            <HomeWhySection />
          </main>
        </div>

        <div dir={contentDir} className="mt-7">
          <PersonalizedHomeRails />

          <DiscoveryRail
            title={t('railSponsored')}
            subtitle={t('railSponsoredHint')}
            seeAllHref={searchHref('/search', { sort: 'recommended' })}
            seeAllLabel={tSearch('seeAll')}
            properties={sponsored}
            sectionId="sponsored"
          />

          <DiscoveryRail
            title={t('railNewest')}
            subtitle={t('railNewestHint')}
            seeAllHref={searchHref('/search', { sort: 'newest' })}
            seeAllLabel={tSearch('seeAll')}
            properties={recentlyAdded}
            sectionId="recentlyAdded"
          />
        </div>
      </div>
    </div>
  );
}
