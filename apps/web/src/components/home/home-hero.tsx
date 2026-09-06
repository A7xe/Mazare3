'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ChevronLeft, Star } from 'lucide-react';
import type { PublicPropertySummary } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const HERO_BANNER_SRC = '/home/hero-banner.png';

type HeroSlide = {
  id: string;
  src: string;
  alt: string;
};

export function HomeHero({ slides }: { slides: PublicPropertySummary[] }) {
  const t = useTranslations('home');
  const [index, setIndex] = useState(0);

  const gallery: HeroSlide[] = [
    { id: 'brand', src: HERO_BANNER_SRC, alt: t('heroBannerTitle') },
    ...slides
      .filter((slide) => Boolean(slide.imageUrl))
      .slice(0, 5)
      .map((slide) => ({
        id: slide.id,
        src: slide.imageUrl as string,
        alt: slide.titleAr || slide.titleEn || t('heroBannerTitle'),
      })),
  ];

  const safeIndex = gallery.length ? Math.min(index, gallery.length - 1) : 0;

  return (
    <section className="relative h-[296px] overflow-hidden rounded-[18px] border border-[#DDE7F3] bg-[#0D2046] shadow-[0_8px_28px_rgba(30,64,110,.10)] max-[720px]:h-[360px]">
      {gallery.map((slide, slideIndex) => (
        <div
          key={slide.id}
          className={cn(
            'absolute inset-0 transition-opacity duration-500 ease-out',
            slideIndex === safeIndex ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden={slideIndex !== safeIndex}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            priority={slideIndex === 0}
            className="object-cover object-center"
            sizes="(max-width: 1050px) 100vw, 900px"
          />
        </div>
      ))}

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(270deg,rgba(8,28,60,.28)_0%,rgba(8,28,60,.08)_42%,rgba(8,28,60,0)_72%)]" />

      <div className="absolute right-[38px] top-4 z-10 max-[720px]:right-6 max-[720px]:top-3.5">
        <span className="inline-flex h-[32px] items-center gap-1.5 rounded-full bg-[#5B9BFF]/88 px-3.5 text-[12px] font-semibold text-white shadow-[0_4px_14px_rgba(8,28,60,.18)] backdrop-blur-sm">
          <Star className="h-3.5 w-3.5 fill-white text-white" aria-hidden />
          {t('heroBannerBadge')}
        </span>
      </div>

      <div className="absolute right-[38px] top-1/2 z-10 max-w-[500px] -translate-y-[58%] text-right text-white max-[720px]:inset-x-6 max-[720px]:right-auto max-[720px]:-translate-y-[52%]">
        <h2 className="text-[34px] font-heading leading-[1.35] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.22)] max-[720px]:text-[29px]">
          {t('heroBannerTitle')}
        </h2>
        <p className="ms-auto mt-2 max-w-[470px] text-[15px] font-medium leading-[1.7] text-white/92 drop-shadow-[0_1px_6px_rgba(0,0,0,.25)] max-[720px]:text-[14px]">
          {t('heroBannerSubtitle')}
        </p>
      </div>

      <div className="absolute right-[38px] bottom-12 z-10 flex flex-wrap items-center justify-end gap-3 max-[720px]:inset-x-6 max-[720px]:right-auto max-[720px]:bottom-14 max-[720px]:justify-end">
        <Link
          href="/search"
          className="inline-flex h-[46px] min-w-[144px] items-center justify-center gap-2 rounded-[12px] bg-white px-5 text-[13px] font-semibold text-[#2F6EF6] shadow-[0_6px_18px_rgba(0,0,0,.12)] transition hover:-translate-y-0.5"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {t('exploreNow')}
        </Link>
      </div>

      {gallery.length > 1 ? (
        <div className="absolute bottom-3.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
          {gallery.map((slide, slideIndex) => (
            <button
              key={slide.id}
              type="button"
              aria-label={slide.alt}
              aria-current={slideIndex === safeIndex}
              onClick={() => setIndex(slideIndex)}
              className={cn(
                'rounded-full transition-all duration-300',
                slideIndex === safeIndex
                  ? 'h-2 w-5 bg-white shadow-[0_2px_8px_rgba(0,0,0,.25)]'
                  : 'h-2 w-2 bg-white/55 hover:bg-white/80',
              )}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
