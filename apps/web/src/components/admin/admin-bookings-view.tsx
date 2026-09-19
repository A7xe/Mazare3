'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Loader2 } from 'lucide-react';
import type { AdminBookingRow } from '@mazare3/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchAdminBookings, fetchAdminBookingListingSnapshot } from '@/lib/api-admin';
import { PriceDisplay } from '@/components/marketplace/price-display';
import {
  BookingListingSnapshotPanel,
  type ListingSnapshotApiResult,
} from '@/components/bookings/booking-listing-snapshot-panel';

type ComparisonState = {
  atTimeOfBooking: ListingSnapshotApiResult;
  currentListing: {
    property: { titleAr: string; titleEn: string | null };
    capacity: { capacity: number };
    amenities: Array<{ key: string }>;
  };
};

export function AdminBookingsView() {
  const t = useTranslations('admin');
  const tSnap = useTranslations('bookingListingSnapshot');
  const locale = useLocale() as 'ar' | 'en';
  const [bookings, setBookings] = useState<AdminBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comparisons, setComparisons] = useState<
    Record<string, ComparisonState | 'loading' | 'error'>
  >({});

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchAdminBookings();
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
      <div data-testid="admin-bookings" className="flex justify-center py-20">
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
      <Card className="glass-panel rounded-2xl border-primary/12">
        <CardContent className="py-16 text-center text-muted">{t('bookingsEmpty')}</CardContent>
      </Card>
    );
  }

  return (
    <div data-testid="admin-bookings" className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-primary/12 bg-surface shadow-card">
        <table className="w-full min-w-[960px] text-start text-sm">
          <thead>
            <tr className="border-b border-border bg-primary-soft/40 text-muted">
              <th className="px-4 py-3">{t('colCode')}</th>
              <th className="px-4 py-3">{t('colCustomer')}</th>
              <th className="px-4 py-3">{t('colProperty')}</th>
              <th className="px-4 py-3">{t('colOwner')}</th>
              <th className="px-4 py-3">{t('colDate')}</th>
              <th className="px-4 py-3">{t('colPeriod')}</th>
              <th className="px-4 py-3">{t('colGuests')}</th>
              <th className="px-4 py-3">{t('colStatus')}</th>
              <th className="px-4 py-3">{t('colPrice')}</th>
              <th className="px-4 py-3">{t('colOwnerNet')}</th>
              <th className="px-4 py-3">{t('colPayoutStatus')}</th>
              <th className="px-4 py-3">{t('colRefund')}</th>
              <th className="px-4 py-3">{tSnap('compare')}</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const title = locale === 'ar' ? b.propertyTitleAr : b.propertyTitleEn;
              return (
                <tr
                  key={b.id}
                  className="border-b border-border/60"
                  data-testid={`admin-booking-row-${b.publicCode}`}
                >
                  <td className="px-4 py-3 font-mono text-xs">{b.publicCode}</td>
                  <td className="px-4 py-3">
                    <span className="block">{b.customerName ?? '—'}</span>
                    <span className="text-xs text-muted">{b.customerEmail ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/properties/${b.propertySlug}`}
                      className="text-primary hover:underline"
                    >
                      {title}
                    </Link>
                    {b.listingSnapshotStatus === 'LEGACY_SNAPSHOT_UNAVAILABLE' ? (
                      <span className="mt-1 block text-[10px] text-muted">legacy</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{b.ownerDisplayName}</td>
                  <td className="px-4 py-3">{b.date}</td>
                  <td className="px-4 py-3">{t(`period.${b.period}`)}</td>
                  <td className="px-4 py-3">{b.guestsCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <Badge variant={b.status === 'cancelled' ? 'muted' : 'highlight'}>
                        {t(`bookingStatus.${b.status}`)}
                      </Badge>
                      {b.status === 'cancelled' &&
                        b.cancellationReasonCode === 'BALANCE_NOT_PAID' && (
                          <span className="text-xs text-muted">
                            {t('cancellationReasonBalanceUnpaid')}
                          </span>
                        )}
                      {b.paymentStatus && (
                        <span className="text-xs text-muted">
                          {t(`paymentStatus.${b.paymentStatus}`)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <PriceDisplay amount={b.totalAmount} currency={b.currency} locale={locale} />
                    {b.customerPayableAmount != null && (
                      <p className="mt-1 text-xs text-muted">
                        {t('colCustomerPayable')}:{' '}
                        <PriceDisplay
                          amount={b.customerPayableAmount}
                          currency={b.currency}
                          locale={locale}
                        />
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3" data-testid={`admin-booking-owner-net-${b.publicCode}`}>
                    {b.ownerNetPayoutAmount != null ? (
                      <PriceDisplay
                        amount={b.ownerNetPayoutAmount}
                        currency={b.currency}
                        locale={locale}
                      />
                    ) : (
                      '—'
                    )}
                    {b.platformCommissionAmount != null && (
                      <p className="mt-1 text-xs text-muted">
                        {t('colCommission')}:{' '}
                        <PriceDisplay
                          amount={b.platformCommissionAmount}
                          currency={b.currency}
                          locale={locale}
                        />
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {b.payoutStatus ? (
                      <Badge variant="muted">{t(`payoutStatus.${b.payoutStatus}`)}</Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {b.refundStatus && b.refundStatus !== 'none'
                      ? t(`refundStatus.${b.refundStatus}`)
                      : '—'}
                    {b.cancellationRefundAmount != null && (
                      <span className="mt-1 block">
                        <PriceDisplay
                          amount={b.cancellationRefundAmount}
                          currency={b.currency}
                          locale={locale}
                        />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid={`admin-listing-snapshot-btn-${b.id}`}
                      onClick={() => {
                        setComparisons((prev) => ({ ...prev, [b.id]: 'loading' }));
                        void fetchAdminBookingListingSnapshot(b.id)
                          .then((res) => {
                            setComparisons((prev) => ({
                              ...prev,
                              [b.id]: {
                                atTimeOfBooking: res.data.atTimeOfBooking,
                                currentListing: res.data.currentListing,
                              },
                            }));
                          })
                          .catch(() => {
                            setComparisons((prev) => ({ ...prev, [b.id]: 'error' }));
                          });
                      }}
                    >
                      {tSnap('compare')}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {Object.entries(comparisons).map(([bookingId, state]) => {
        if (state === 'loading') {
          return (
            <BookingListingSnapshotPanel
              key={bookingId}
              data="loading"
              testId={`admin-listing-snapshot-${bookingId}`}
            />
          );
        }
        if (state === 'error') {
          return (
            <BookingListingSnapshotPanel
              key={bookingId}
              data="error"
              testId={`admin-listing-snapshot-${bookingId}`}
            />
          );
        }
        return (
          <BookingListingSnapshotPanel
            key={bookingId}
            data={state.atTimeOfBooking}
            currentListing={state.currentListing}
            testId={`admin-listing-snapshot-${bookingId}`}
          />
        );
      })}
    </div>
  );
}
