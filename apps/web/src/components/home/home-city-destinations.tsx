'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useCircularCarousel } from '@/components/home/use-circular-carousel';

export type HomeCityDestination = {
  key: string;
  label: string;
  tagline: string;
  count: number;
  countLabel: string;
  imageUrl: string;
  fallbackImageUrl: string;
  href: string;
};

type HomeCityDestinationsProps = {
  title: string;
  subtitle: string;
  seeAllLabel: string;
  seeAllHref: string;
  cities: HomeCityDestination[];
  contentDir?: 'rtl' | 'ltr';
};

function visibleCardsForWidth(width: number): number {
  if (width >= 1024) return 4;
  if (width >= 768) return 2;
  return 1;
}

function CityDestinationCard({
  city,
  contentDir,
  cardStyle,
}: {
  city: HomeCityDestination;
  contentDir: 'rtl' | 'ltr';
  cardStyle: CSSProperties;
}) {
  const [imageSrc, setImageSrc] = useState(city.imageUrl);

  useEffect(() => {
    setImageSrc(city.imageUrl);
  }, [city.imageUrl]);

  return (
    <Link
      href={city.href}
      dir={contentDir}
      data-testid={`city-destination-${city.key}`}
      className="group relative h-[188px] shrink-0 overflow-hidden rounded-[16px] bg-[#EEF5FF] sm:h-[200px] lg:h-[204px]"
      style={cardStyle}
    >
      <Image
        src={imageSrc}
        alt=""
        aria-hidden
        fill
        className="object-cover transition duration-500 group-hover:scale-[1.04]"
        sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 25vw"
        onError={() => {
          if (imageSrc !== city.fallbackImageUrl) {
            setImageSrc(city.fallbackImageUrl);
          }
        }}
      />

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,28,60,.5)_0%,rgba(8,28,60,.08)_38%,rgba(8,28,60,.65)_100%)]" />

      <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#2F6EF6] shadow-sm">
        {city.countLabel}
      </span>

      <span className="absolute right-3 top-3 max-w-[58%] text-end text-[16px] font-bold leading-snug text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.28)] lg:text-[17px]">
        {city.label}
      </span>

      <p className="absolute inset-x-3 bottom-3 text-start text-[11px] font-medium leading-relaxed text-white/94 drop-shadow-[0_1px_6px_rgba(0,0,0,.28)] sm:text-[12px]">
        {city.tagline}
      </p>
    </Link>
  );
}

export function HomeCityDestinations({
  title,
  subtitle,
  seeAllLabel,
  seeAllHref,
  cities,
  contentDir = 'rtl',
}: HomeCityDestinationsProps) {
  const {
    viewportRef,
    trackStyle,
    cardStyle,
    handleTransitionEnd,
    canNavigate,
    goNext,
    goPrev,
  } = useCircularCarousel(cities.length, visibleCardsForWidth, {
    align: contentDir === 'rtl' ? 'end' : 'start',
  });

  const prevLabel = contentDir === 'rtl' ? 'المدن السابقة' : 'Previous cities';
  const nextLabel = contentDir === 'rtl' ? 'المدن التالية' : 'Next cities';

  if (!cities.length) return null;

  const track = [0, 1, 2].flatMap((copy) =>
    cities.map((city) => ({ city, copy, key: `${copy}-${city.key}` })),
  );

  return (
    <section
      className="rounded-[20px] border border-[#E0E8F3] bg-white px-4 py-4 shadow-[0_6px_24px_rgba(35,72,120,.04)] sm:px-5 sm:py-5"
      data-testid="home-city-destinations"
    >
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-bold leading-tight text-[#0D2046]">{title}</h2>
          <p className="mt-1 text-[12px] font-medium leading-relaxed text-[#53637A]">{subtitle}</p>
        </div>

        <Link
          href={seeAllHref}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-[10px] border border-[#E0E8F3] bg-white px-3.5 text-[12px] font-semibold text-[#2F6EF6] transition hover:border-[#2F6EF6]/30 hover:bg-[#F8FBFF]"
        >
          {seeAllLabel}
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <div className="relative w-full">
        {canNavigate ? (
          <>
            <button
              type="button"
              aria-label={prevLabel}
              onClick={goPrev}
              className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#E0E8F3] bg-white text-[#2F6EF6] shadow-[0_4px_14px_rgba(31,67,115,.12)] transition hover:bg-[#F8FBFF] sm:left-3"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>

            <button
              type="button"
              aria-label={nextLabel}
              onClick={goNext}
              className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#E0E8F3] bg-white text-[#2F6EF6] shadow-[0_4px_14px_rgba(31,67,115,.12)] transition hover:bg-[#F8FBFF] sm:right-3"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        ) : null}

        <div ref={viewportRef} className="w-full overflow-hidden" dir="ltr">
          <div style={trackStyle} onTransitionEnd={handleTransitionEnd}>
            {track.map(({ city, key }) => (
              <CityDestinationCard
                key={key}
                city={city}
                contentDir={contentDir}
                cardStyle={cardStyle}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
