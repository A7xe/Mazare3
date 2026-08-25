import { Sparkles } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { searchHref } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { MarketplaceSearchForm } from '@/components/marketplace/marketplace-search-form';

function CloudMark() {
  return (
    <svg
      viewBox="0 0 76 48"
      className="h-12 w-[76px] text-[#2F6EF6]/16"
      fill="none"
      aria-hidden
    >
      <path
        d="M13 35c-5 0-9-4-9-9 0-4 3-8 7-9 2-7 8-12 16-12 8 0 15 6 16 14 6 1 11 6 11 12 0 6-5 10-11 10H13Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export async function HomeSearchSidebar() {
  const t = await getTranslations('home');

  return (
    <section className="relative overflow-hidden rounded-[19px] border border-[#E1E9F4] bg-white px-4 pb-4 pt-[18px] shadow-[0_8px_30px_rgba(31,70,120,.07)]">
      <div className="pointer-events-none absolute left-3 top-10">
        <CloudMark />
      </div>

      <div className="relative text-end">
        <h1 className="text-[20px] font-extrabold leading-[1.45] text-[#0D2046]">
          {t('searchCardTitle')}
        </h1>
        <p className="mt-1 ms-auto max-w-[245px] text-[11px] font-medium leading-[1.75] text-[#8794A7]">
          {t('heroBannerSubtitle')}
        </p>
      </div>

      <div className="relative mt-4">
        <MarketplaceSearchForm variant="stacked" idPrefix="home-sidebar" />
      </div>

      <Link
        href={searchHref('/search', { featured: true })}
        className="mt-2.5 flex h-[42px] items-center justify-center gap-1.5 rounded-[11px] border border-[#E4EBF5] bg-white px-3 text-[12px] font-semibold text-[#2F6EF6] transition hover:border-[#2F6EF6]/30 hover:bg-[#F8FBFF]"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        {t('browseFeatured')}
      </Link>
    </section>
  );
}
