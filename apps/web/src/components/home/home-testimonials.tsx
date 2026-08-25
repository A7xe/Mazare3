'use client';

import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Link } from '@/i18n/navigation';
import { useCircularCarousel } from '@/components/home/use-circular-carousel';

export type HomeTestimonial = {
  id: string;
  name: string;
  city: string;
  quote: string;
  propertyLabel: string;
  rating: number;
};

type HomeTestimonialsProps = {
  title: string;
  subtitle: string;
  seeMoreLabel: string;
  seeMoreHref: string;
  testimonials: HomeTestimonial[];
  contentDir?: 'rtl' | 'ltr';
};

function visibleCardsForWidth(width: number): number {
  if (width >= 1024) return 3;
  if (width >= 768) return 2;
  return 1;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center justify-start gap-0.5" aria-hidden>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`h-3.5 w-3.5 ${
            index < rating ? 'fill-[#F5B942] text-[#F5B942]' : 'fill-transparent text-[#D5DEEA]'
          }`}
          strokeWidth={1.6}
        />
      ))}
    </div>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

function TestimonialCard({
  item,
  contentDir,
  cardStyle,
}: {
  item: HomeTestimonial;
  contentDir: 'rtl' | 'ltr';
  cardStyle: CSSProperties;
}) {
  return (
    <article
      dir={contentDir}
      className="relative flex h-full min-h-[200px] flex-col rounded-[18px] border border-[#E6EBF3] bg-white px-4 pb-4 pt-4"
      style={cardStyle}
      data-testid={`home-testimonial-${item.id}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute end-3.5 top-2.5 select-none font-[Georgia,Times_New_Roman,serif] text-[40px] leading-none text-[#C2D6FF]"
      >
        “
      </span>

      <div className="relative z-[1] flex items-center gap-3 pe-9">
        <div
          className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E6EBF3] bg-[#EEF5FF] text-[13px] font-bold text-[#2F6EF6]"
          aria-hidden
        >
          {initialsFromName(item.name)}
        </div>
        <div className="min-w-0 text-start">
          <p className="truncate text-[14.5px] font-bold leading-snug text-[#0D2046]">{item.name}</p>
          <p className="mt-0.5 truncate text-[12px] font-medium leading-snug text-[#8A96A8]">
            {item.city}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <Stars rating={item.rating} />
      </div>

      <p className="mt-2.5 flex-1 text-start text-[13px] font-medium leading-7 text-[#3A4A63]">
        {item.quote}
      </p>

      <div className="mt-3 flex justify-start">
        <span className="inline-flex max-w-full truncate rounded-full bg-[#EAF2FF] px-3.5 py-1.5 text-[11.5px] font-semibold text-[#2F6EF6]">
          {item.propertyLabel}
        </span>
      </div>
    </article>
  );
}

export function HomeTestimonials({
  title,
  subtitle,
  seeMoreLabel,
  seeMoreHref,
  testimonials,
  contentDir = 'rtl',
}: HomeTestimonialsProps) {
  const {
    viewportRef,
    trackStyle,
    cardStyle,
    handleTransitionEnd,
    canNavigate,
    goNext,
    goPrev,
  } = useCircularCarousel(testimonials.length, visibleCardsForWidth);

  const prevLabel = contentDir === 'rtl' ? 'التقييمات السابقة' : 'Previous testimonials';
  const nextLabel = contentDir === 'rtl' ? 'التقييمات التالية' : 'Next testimonials';

  if (!testimonials.length) return null;

  const track = [0, 1, 2].flatMap((copy) =>
    testimonials.map((item) => ({
      item,
      key: `${copy}-${item.id}`,
    })),
  );

  return (
    <section className="bg-transparent" data-testid="home-testimonials">
      <div className="mb-3 text-start">
        <h2 className="text-[18px] font-bold leading-tight text-[#0D2046] sm:text-[20px]">
          {title}
        </h2>
        <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-[#53637A]">
          {subtitle}
        </p>
      </div>

      <div className="relative w-full">
        {canNavigate ? (
          <>
            <button
              type="button"
              aria-label={prevLabel}
              onClick={goPrev}
              className="absolute left-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#D7E6FF] bg-[#EEF5FF] text-[#2F6EF6] transition hover:bg-white sm:left-3"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>

            <button
              type="button"
              aria-label={nextLabel}
              onClick={goNext}
              className="absolute right-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#D7E6FF] bg-[#EEF5FF] text-[#2F6EF6] transition hover:bg-white sm:right-3"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </>
        ) : null}

        <div ref={viewportRef} className="w-full overflow-hidden" dir="ltr">
          <div style={trackStyle} onTransitionEnd={handleTransitionEnd}>
            {track.map(({ item, key }) => (
              <TestimonialCard
                key={key}
                item={item}
                contentDir={contentDir}
                cardStyle={cardStyle}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-center">
        <Link
          href={seeMoreHref}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#2F6EF6] transition hover:text-[#1F5AD6]"
        >
          {seeMoreLabel}
          {contentDir === 'rtl' ? (
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          )}
        </Link>
      </div>
    </section>
  );
}
