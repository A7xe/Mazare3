'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ChevronLeft, Play, Star } from 'lucide-react';
import type { PublicPropertySummary } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';

export function HomeHero({ slides }: { slides: PublicPropertySummary[] }) {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const [index, setIndex] = useState(0);

  const safeIndex = slides.length ? Math.min(index, slides.length - 1) : 0;
  const slide = slides[safeIndex];

  return (
    <section className="relative h-[296px] overflow-hidden rounded-[18px] border border-[#DDE7F3] bg-[#0D2046] shadow-[0_8px_28px_rgba(30,64,110,.10)] max-[720px]:h-[360px]">
      {slide?.imageUrl ? (
        <Image
          src={slide.imageUrl}
          alt={slide.titleAr}
          fill
          priority
          className="object-cover"
          sizes="(max-width: 1050px) 100vw, 900px"
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#174F9D,#0D2046_55%,#0D8296)]" />
      )}

      <div className="absolute inset-0 bg-[linear-gradient(270deg,rgba(8,28,60,.82)_0%,rgba(8,28,60,.58)_34%,rgba(8,28,60,.16)_67%,rgba(8,28,60,0)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(3,18,40,.22),transparent_47%)]" />

      {slide?.isSponsored ? (
        <span className="absolute end-4 top-4 z-10 inline-flex h-[32px] items-center gap-1.5 rounded-[12px] bg-[#4A8DFF]/90 px-3 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
          <Star className="h-3.5 w-3.5" aria-hidden />
          {tCommon('sponsored')}
        </span>
      ) : slide?.isFeatured ? (
        <span className="absolute end-4 top-4 z-10 inline-flex h-[32px] items-center gap-1.5 rounded-[12px] bg-[#4A8DFF]/90 px-3 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
          <Star className="h-3.5 w-3.5" aria-hidden />
          {tCommon('featured')}
        </span>
      ) : null}

      <div className="absolute end-[38px] top-[72px] z-10 max-w-[500px] text-end text-white max-[720px]:inset-x-6 max-[720px]:top-[78px]">
        <h2 className="text-[31px] font-extrabold leading-[1.35] drop-shadow-[0_2px_8px_rgba(0,0,0,.18)] max-[720px]:text-[28px]">
          {t('heroBannerTitle')}
        </h2>
        <p className="mt-2 max-w-[470px] text-[14px] font-medium leading-[1.75] text-white/90 max-[720px]:text-[13px]">
          {t('heroBannerSubtitle')}
        </p>

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Link
            href="/search"
            className="inline-flex h-[46px] min-w-[144px] items-center justify-center gap-2 rounded-[12px] bg-white px-5 text-[13px] font-bold text-[#2F6EF6] shadow-[0_6px_18px_rgba(0,0,0,.12)] transition hover:-translate-y-0.5"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {t('exploreNow')}
          </Link>

          <a
            href="#how-mazare3"
            className="inline-flex h-[46px] min-w-[132px] items-center justify-center gap-2 rounded-[12px] bg-white/94 px-4 text-[13px] font-semibold text-[#243654] shadow-[0_6px_18px_rgba(0,0,0,.10)] transition hover:-translate-y-0.5"
          >
            <Play className="h-4 w-4 text-[#79A8FF]" aria-hidden />
            {t('howItWorksCta')}
          </a>
        </div>
      </div>

      {slides.length > 1 ? (
        <div className="absolute bottom-3.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
          {slides.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.titleAr}
              onClick={() => setIndex(itemIndex)}
              className={
                itemIndex === safeIndex
                  ? 'h-2 w-4 rounded-full bg-white transition-all'
                  : 'h-2 w-2 rounded-full bg-white/55 transition-all hover:bg-white/80'
              }
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
