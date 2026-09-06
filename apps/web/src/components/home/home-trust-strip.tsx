import {
  CalendarSearch,
  ChevronLeft,
  ChevronRight,
  Compass,
  Home,
  Percent,
} from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { searchHref } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { AddFarmHref } from '@/lib/add-farm-entry';
import { ADD_FARM_PARTNER_HREF } from '@/lib/add-farm-entry';

type ActionVariant = 'pill' | 'circle';

type ActionItem = {
  key: string;
  title: string;
  desc: string;
  href: string;
  variant: ActionVariant;
  icon: typeof Home;
};

export async function HomeTrustStrip({
  addFarmHref = ADD_FARM_PARTNER_HREF,
  addFarmLabel,
}: {
  addFarmHref?: AddFarmHref;
  addFarmLabel?: string;
} = {}) {
  const t = await getTranslations('home');
  const locale = await getLocale();
  const isRtl = locale === 'ar';
  const Chevron = isRtl ? ChevronLeft : ChevronRight;

  const items: ActionItem[] = [
    {
      key: 'book',
      title: t('actionBookTitle'),
      desc: t('actionBookDesc'),
      href: searchHref('/search', {}),
      variant: 'pill',
      icon: CalendarSearch,
    },
    {
      key: 'list',
      title: addFarmLabel ?? t('actionListTitle'),
      desc: t('actionListDesc'),
      href: addFarmHref,
      variant: 'pill',
      icon: Home,
    },
    {
      key: 'explore',
      title: t('actionExploreTitle'),
      desc: t('actionExploreDesc'),
      href: searchHref('/search', { sort: 'recommended' }),
      variant: 'circle',
      icon: Compass,
    },
    {
      key: 'offers',
      title: t('actionOffersTitle'),
      desc: t('actionOffersDesc'),
      href: searchHref('/search', { featured: true }),
      variant: 'circle',
      icon: Percent,
    },
  ];

  return (
    <section className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;

        if (item.variant === 'pill') {
          return (
            <Link
              key={item.key}
              href={item.href}
              data-testid={`home-action-${item.key}`}
              className="group flex min-h-[84px] items-stretch gap-3 rounded-[16px] border border-[#C5D8FF] bg-white px-3.5 py-2.5 shadow-[0_8px_22px_rgba(31,70,120,.06)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(31,70,120,.1)]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center self-center rounded-[12px] bg-[#EEF4FF]">
                <Icon className="h-6 w-6 text-[#2F6EF6]" strokeWidth={1.75} aria-hidden />
              </span>

              <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5 text-start">
                <div className="min-w-0">
                  <h2 className="truncate text-[14px] font-bold leading-tight text-[#2F6EF6]">
                    {item.title}
                  </h2>
                  <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-snug text-[#8A96A8]">
                    {item.desc}
                  </p>
                </div>

                <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-[#2F6EF6] px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_6px_14px_rgba(47,110,246,.32)] transition group-hover:bg-[#1D5FE8]">
                  {t('actionStartNow')}
                  <Chevron className="h-3.5 w-3.5" aria-hidden />
                </span>
              </div>
            </Link>
          );
        }

        return (
          <Link
            key={item.key}
            href={item.href}
            data-testid={`home-action-${item.key}`}
            className={cn(
              'group flex min-h-[68px] items-center gap-3 rounded-[16px] border border-transparent bg-white px-3 py-2 shadow-[0_6px_18px_rgba(31,70,120,.06)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(31,70,120,.1)]',
            )}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EAF2FF]">
              <Icon className="h-5 w-5 text-[#2F6EF6]" strokeWidth={1.8} aria-hidden />
            </span>

            <div className="min-w-0 flex-1 text-start">
              <h2 className="truncate text-[13px] font-bold text-[#0D2046]">{item.title}</h2>
              <p className="mt-0.5 line-clamp-2 text-[9.5px] font-medium leading-snug text-[#8794A7]">
                {item.desc}
              </p>
            </div>

            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E0E8F3] bg-white text-[#2F6EF6] shadow-[0_4px_12px_rgba(31,70,120,.08)] transition group-hover:border-[#2F6EF6]/35">
              <Chevron className="h-3.5 w-3.5" aria-hidden />
            </span>
          </Link>
        );
      })}
    </section>
  );
}
