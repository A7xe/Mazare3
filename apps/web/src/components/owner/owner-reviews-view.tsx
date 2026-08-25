'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchOwnerReviews } from '@/lib/api-owner';

export function OwnerReviewsView() {
  const t = useTranslations('owner');
  const locale = useLocale();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchOwnerReviews>>['data']>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchOwnerReviews()
      .then((res) => setRows(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : t('loadError')));
  }, [t]);

  return (
    <Card className="rounded-2xl border-primary/12" data-testid="owner-reviews">
      <CardHeader>
        <CardTitle>{t('nav.reviews')}</CardTitle>
        <p className="text-sm text-muted">{t('reviewsSubtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {rows.length === 0 ? <p className="text-sm text-muted">{t('reviewsEmpty')}</p> : null}
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-border px-3 py-3">
            <p className="text-sm font-medium text-navy">
              {locale === 'ar' ? r.propertyTitleAr : r.propertyTitleEn} · {r.publicCode}
            </p>
            <p className="mt-1 flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-primary text-primary" /> {r.rating}/5 · {r.customerDisplayName}
            </p>
            {r.comment ? <p className="mt-1 text-sm text-muted">{r.comment}</p> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
