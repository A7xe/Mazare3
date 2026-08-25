'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PublicPropertySummary } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { HomePropertyCard } from '@/components/home/home-property-card';
import { useCircularCarousel } from '@/components/home/use-circular-carousel';

type HomePropertyCarouselProps = {
  title: string;
  subtitle?: string;
  seeAllHref: string;
  seeAllLabel: string;
  properties: PublicPropertySummary[];
  sectionId?: string;
  contentDir?: 'rtl' | 'ltr';
};

function visibleCardsForWidth(width: number): number {
  // Measure against carousel viewport width (page padding makes it < window).
  // At lg+ (~1024px track) show 5 cards; do not require 1280.
  if (width >= 1024) return 5;
  if (width >= 768) return 2;
  return 1;
}

export function HomePropertyCarousel({
  title,
  subtitle,
  seeAllHref,
  seeAllLabel,
  properties,
  sectionId,
  contentDir = 'rtl',
}: HomePropertyCarouselProps) {
  const {
    viewportRef,
    trackStyle,
    cardStyle,
    handleTransitionEnd,
    canNavigate,
    goNext,
    goPrev,
  } = useCircularCarousel(properties.length, visibleCardsForWidth);

  const prevLabel = contentDir === 'rtl' ? 'السابق' : 'Previous';
  const nextLabel = contentDir === 'rtl' ? 'التالي' : 'Next';

  if (!properties.length) return null;

  const track = [0, 1, 2].flatMap((copy) =>
    properties.map((property) => ({
      property,
      key: `${copy}-${property.id}`,
    })),
  );

  return (
    <section
      className="rounded-[20px] border border-[#E0E8F3] bg-white px-4 pb-5 pt-4 sm:px-5 sm:pb-6 sm:pt-5"
      data-testid={sectionId ? `discovery-rail-${sectionId}` : 'discovery-rail'}
    >
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-bold leading-tight text-[#0D2046]">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-[12px] font-medium leading-relaxed text-[#53637A]">{subtitle}</p>
          ) : null}
        </div>

        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-[10px] border border-[#E0E8F3] bg-white px-3.5 text-[12px] font-semibold text-[#2F6EF6] transition hover:border-[#2F6EF6]/30 hover:bg-[#F8FBFF]"
          >
            {seeAllLabel}
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : null}
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

        <div ref={viewportRef} className="w-full overflow-hidden py-1" dir="ltr">
          <div style={trackStyle} onTransitionEnd={handleTransitionEnd}>
            {track.map(({ property, key }) => (
              <div key={key} dir={contentDir} style={cardStyle}>
                <HomePropertyCard property={property} variant="feature" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
