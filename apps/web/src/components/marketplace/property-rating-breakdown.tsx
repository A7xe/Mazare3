'use client';

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PublicPropertyReview } from '@mazare3/shared';

type Props = {
  rating: number;
  reviewCount: number;
  reviews: PublicPropertyReview[];
};

function distribution(reviews: PublicPropertyReview[]) {
  if (reviews.length === 0) return null;
  const counts = [0, 0, 0, 0, 0] as [number, number, number, number, number];
  for (const r of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(r.rating)));
    const idx = (5 - star) as 0 | 1 | 2 | 3 | 4;
    counts[idx] += 1;
  }
  const total = reviews.length;
  return counts.map((c) => Math.round((c / total) * 100));
}

export function PropertyRatingBreakdown({ rating, reviewCount, reviews }: Props) {
  const t = useTranslations('property');
  const pct = distribution(reviews);

  if (reviewCount <= 0) {
    return <p className="mt-4 text-sm text-[#8A94A6]">{t('noReviews')}</p>;
  }

  return (
    <div
      className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8"
      data-testid="property-reviews-summary"
    >
      <div className="shrink-0 text-center sm:text-start">
        <p className="text-[2.75rem] font-bold leading-none tracking-tight text-[#0D2046]">
          {rating.toFixed(1)}
        </p>
        <div className="mt-2 flex items-center justify-center gap-0.5 sm:justify-start" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${
                i < Math.round(rating)
                  ? 'fill-[#F5B301] text-[#F5B301]'
                  : 'fill-transparent text-[#D0D7E2]'
              }`}
            />
          ))}
        </div>
        <p className="mt-1.5 text-[12px] text-[#8A94A6]">
          ({reviewCount} {t('reviews')})
        </p>
      </div>

      {pct ? (
        <div className="min-w-0 flex-1 space-y-2.5">
          {[5, 4, 3, 2, 1].map((star, idx) => (
            <div key={star} className="flex items-center gap-2.5 text-[11px] text-[#5B6B7C]">
              <span className="w-[3.25rem] shrink-0 text-start font-medium text-[#0D2046]">
                {t('starsCount', { count: star })}
              </span>
              <div className="h-[6px] min-w-0 flex-1 overflow-hidden rounded-full bg-[#E8EEF5]">
                <div
                  className="h-full rounded-full bg-[#0D2046]"
                  style={{ width: `${pct[idx]}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-end tabular-nums text-[#8A94A6]">
                {pct[idx]}%
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
