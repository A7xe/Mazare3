'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Calendar, Loader2 } from 'lucide-react';
import type { OwnerBookingRow } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchOwnerBookings } from '@/lib/api-owner';
import { PriceDisplay } from '@/components/marketplace/price-display';

export function OwnerBookingsView() {
  const t = useTranslations('owner');
  const locale = useLocale() as 'ar' | 'en';
  const [bookings, setBookings] = useState<OwnerBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchOwnerBookings();
        setBookings(res.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">{error}</p>
    );
  }

  if (bookings.length === 0) {
    return (
      <Card className="glass-panel rounded-3xl border-primary/12">
        <CardContent className="flex flex-col items-center py-16 text-center">
          <Calendar className="h-12 w-12 text-primary/40" />
          <p className="mt-4 text-lg font-medium text-navy">{t('bookingsEmpty')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
        <div data-testid="owner-bookings-list" className="space-y-4">
      {bookings.map((b) => {
        const title = locale === 'ar' ? b.propertyTitleAr : b.propertyTitleEn;
        return (
          <Card key={b.id} className="glass-panel overflow-hidden rounded-3xl border-primary/12">
            <div className="gradient-primary h-1" />
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-lg">
                  <Link
                    href={`/properties/${b.propertySlug}`}
                    className="hover:text-primary hover:underline"
                  >
                    {title}
                  </Link>
                </CardTitle>
                <p className="mt-1 font-mono text-xs text-muted">{b.publicCode}</p>
              </div>
              <Badge variant={b.status === 'cancelled' ? 'muted' : 'highlight'}>
                {t(`bookingStatus.${b.status}`)}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end justify-between gap-4 text-sm">
              <div className="space-y-1 text-muted">
                <p>
                  <span className="font-medium text-navy">{t('date')}:</span> {b.date}
                </p>
                <p>
                  <span className="font-medium text-navy">{t('period')}:</span>{' '}
                  {t(`period.${b.period}`)}
                </p>
                <p>
                  <span className="font-medium text-navy">{t('guests')}:</span> {b.guestsCount}
                </p>
              </div>
              <PriceDisplay amount={b.totalAmount} currency={b.currency} locale={locale} large />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
