'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import type { PropertyReviewAdminRow } from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetchAdminReviews, hideAdminReview, restoreAdminReview } from '@/lib/api-admin';

export function AdminReviewsView() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const [rows, setRows] = useState<PropertyReviewAdminRow[]>([]);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetchAdminReviews();
    setRows(res.data);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : t('loadError')));
  }, [t]);

  return (
    <Card className="rounded-2xl border-primary/12" data-testid="admin-reviews">
      <CardHeader>
        <CardTitle>{t('nav.reviews')}</CardTitle>
        <p className="text-sm text-muted">{t('reviewsSubtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {rows.length === 0 ? <p className="text-sm text-muted">{t('reviewsEmpty')}</p> : null}
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-border px-3 py-3" data-testid={`admin-review-${r.id}`}>
            <p className="text-sm font-medium text-navy">
              {locale === 'ar' ? r.propertyTitleAr : r.propertyTitleEn} · {r.publicCode}
            </p>
            <p className="mt-1 flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-primary text-primary" /> {r.rating}/5 · {r.customerDisplayName} · {r.status}
            </p>
            {r.comment ? <p className="mt-1 text-sm text-muted">{r.comment}</p> : null}
            {r.status === 'published' ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Input
                  placeholder={t('hideReason')}
                  value={reason[r.id] ?? ''}
                  onChange={(e) => setReason((m) => ({ ...m, [r.id]: e.target.value }))}
                />
                <Button
                  size="sm"
                  data-testid={`admin-review-hide-${r.id}`}
                  onClick={() =>
                    void hideAdminReview(r.id, reason[r.id] || 'moderation').then(load)
                  }
                >
                  {t('hideReview')}
                </Button>
              </div>
            ) : (
              <Button size="sm" className="mt-2" onClick={() => void restoreAdminReview(r.id).then(load)}>
                {t('restoreReview')}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
