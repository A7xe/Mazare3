'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import type { PublicBookingSummary } from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import { submitBookingReview, BookingApiError } from '@/lib/api-bookings';

export function BookingReviewForm({
  booking,
  onSubmitted,
}: {
  booking: PublicBookingSummary;
  onSubmitted: () => Promise<void>;
}) {
  const t = useTranslations('bookings');
  const existing = booking.myReview;
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (existing) {
    return (
      <div className="mt-3 rounded-xl bg-primary-soft/70 px-3 py-3" data-testid={`booking-review-done-${booking.id}`}>
        <p className="text-sm font-medium text-navy">{t('yourRating')}</p>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={`h-4 w-4 ${n <= existing.rating ? 'fill-primary text-primary' : 'text-muted'}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!booking.canReview) return null;

  async function submit() {
    if (rating < 1) {
      setError(t('ratingRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitBookingReview(booking.id, { rating, comment: comment.trim() || undefined });
      await onSubmitted();
    } catch (err) {
      setError(err instanceof BookingApiError ? err.message : t('reviewError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-primary/15 bg-primary-soft/50 px-3 py-3" data-testid={`booking-review-form-${booking.id}`}>
      <p className="text-sm font-medium text-navy">{t('rateStay')}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            data-testid={`review-star-${n}`}
            className="rounded-md p-1 text-primary"
            onClick={() => setRating(n)}
            aria-label={String(n)}
          >
            <Star className={`h-6 w-6 ${n <= rating ? 'fill-primary text-primary' : 'text-muted'}`} />
          </button>
        ))}
      </div>
      <textarea
        data-testid="review-comment"
        className="min-h-[72px] w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
        maxLength={500}
        placeholder={t('reviewCommentPlaceholder')}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <Button size="sm" disabled={busy} data-testid="review-submit" onClick={() => void submit()}>
        {t('submitReview')}
      </Button>
    </div>
  );
}
