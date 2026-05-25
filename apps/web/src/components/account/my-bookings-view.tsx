'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Calendar, Loader2, MapPin, XCircle } from 'lucide-react';
import type { PublicBookingSummary } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookingApiError, cancelBooking, fetchMyBookings } from '@/lib/api-bookings';
import { getMe } from '@/lib/api-auth';
import { PriceDisplay } from '@/components/marketplace/price-display';

export function MyBookingsView() {
  const t = useTranslations('bookings');
  const tCommon = useTranslations('common');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();

  const [bookings, setBookings] = useState<PublicBookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await getMe();
      const res = await fetchMyBookings();
      setBookings(res.data);
    } catch {
      router.push('/login?returnUrl=' + encodeURIComponent('/account/bookings'));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCancel(id: string) {
    setCancellingId(id);
    try {
      await cancelBooking(id);
      await load();
    } catch (err) {
      if (err instanceof BookingApiError && err.code === 'INVALID_STATUS') {
        setError(t('cancelNotAllowed'));
      } else {
        setError(err instanceof Error ? err.message : t('cancelError'));
      }
    } finally {
      setCancellingId(null);
    }
  }

  const canCancel = (status: string) => status === 'confirmed' || status === 'pending';

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>{tCommon('loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-4">
      <div>
        <h1 className="text-3xl font-bold text-navy">{t('title')}</h1>
        <p className="mt-2 text-muted">{t('subtitle')}</p>
      </div>

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {bookings.length === 0 ? (
        <Card className="glass-panel rounded-3xl border-primary/12">
          <CardContent className="py-16 text-center">
            <Calendar className="mx-auto h-12 w-12 text-primary/50" />
            <p className="mt-4 text-lg font-medium text-navy">{t('emptyTitle')}</p>
            <p className="mt-2 text-sm text-muted">{t('emptyHint')}</p>
            <Button asChild className="mt-6 shadow-soft">
              <Link href="/search">{tCommon('search')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const title = locale === 'ar' ? b.propertyTitleAr : b.propertyTitleEn;
            return (
              <Card key={b.id} className="glass-panel overflow-hidden rounded-3xl border-primary/12">
                <div className="gradient-primary h-1" />
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-2">
                  <div>
                    <CardTitle className="text-lg">
                      <Link
                        href={`/properties/${b.propertySlug}`}
                        className="hover:text-primary hover:underline"
                      >
                        {title}
                      </Link>
                    </CardTitle>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                      <MapPin className="h-3.5 w-3.5" />
                      {b.approximateLocation}
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted">{b.publicCode}</p>
                  </div>
                  <Badge variant={b.status === 'cancelled' ? 'muted' : 'highlight'}>
                    {t(`status.${b.status}`)}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end justify-between gap-4">
                  <div className="space-y-1 text-sm text-muted">
                    <p>
                      <span className="font-medium text-navy">{t('date')}:</span> {b.date}
                    </p>
                    <p>
                      <span className="font-medium text-navy">{t('periodLabel')}:</span>{' '}
                      {t(`period.${b.period}`)}
                    </p>
                    <p>
                      <span className="font-medium text-navy">{t('guests')}:</span> {b.guestsCount}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <PriceDisplay
                      amount={b.totalAmount}
                      currency={b.currency}
                      locale={locale}
                      large
                    />
                    {canCancel(b.status) && (
                      <Button
                        data-testid="booking-cancel"
                        variant="outline"
                        size="sm"
                        disabled={cancellingId === b.id}
                        onClick={() => void handleCancel(b.id)}
                        className="gap-1 text-danger hover:border-danger/30 hover:bg-danger/5"
                      >
                        {cancellingId === b.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        {t('cancel')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
