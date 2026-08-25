import { Sparkles } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { searchHref } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { MarketplaceSearchForm } from '@/components/marketplace/marketplace-search-form';

function CloudMark() {
  return (
    <svg
      viewBox="0 0 76 48"
      className="h-9 w-[56px] text-[#7EB6FF]/45"
      fill="none"
      aria-hidden
    >
      <path
        d="M13 35c-5 0-9-4-9-9 0-4 3-8 7-9 2-7 8-12 16-12 8 0 15 6 16 14 6 1 11 6 11 12 0 6-5 10-11 10H13Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export async function HomeSearchSidebar() {
  const t = await getTranslations('home');

  return (
    <section className="relative overflow-hidden rounded-[22px] border border-[#E0E8F3] bg-[linear-gradient(165deg,rgba(236,245,255,.92)_0%,rgba(255,255,255,.78)_48%,rgba(232,243,255,.88)_100%)] px-3.5 pb-3.5 pt-3.5 shadow-[0_8px_14px_-8px_rgba(47,90,150,.18)] backdrop-blur-[18px]">
      <div className="pointer-events-none absolute left-2 top-3 opacity-80">
        <CloudMark />
      </div>

      <div className="relative text-start">
        <h1 className="text-[18px] font-bold leading-snug text-[#0D2046]">
          {t('searchCardTitle')}
        </h1>
        <p className="mt-1 max-w-[250px] text-[11px] font-medium leading-relaxed text-[#53637A]">
          {t('searchCardSubtitle')}
        </p>
      </div>

      <div className="relative mt-3">
        <MarketplaceSearchForm variant="stacked" idPrefix="home-sidebar" />
      </div>

      <Link
        href={searchHref('/search', { featured: true })}
        className="mt-2 flex h-[40px] items-center justify-center gap-1.5 rounded-[12px] border border-[#D7E6FA] bg-white/90 px-3 text-[12px] font-semibold text-[#2F6EF6] shadow-[0_3px_10px_rgba(47,110,246,.05)] transition hover:border-[#2F6EF6]/35 hover:bg-white"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        {t('browseFeatured')}
      </Link>
    </section>
  );
}
