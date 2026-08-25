'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AvailabilityPeriod, PublicPropertyDetail, RebookIntent } from '@mazare3/shared';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { BookingPanel } from './booking-panel';
import { BookingApiError, fetchRebookIntent } from '@/lib/api-bookings';

type Props = {
  property: PublicPropertyDetail;
  locale: 'ar' | 'en';
  initialDate?: string;
  initialPeriod?: AvailabilityPeriod;
  initialGuests?: number;
  rebookId?: string;
};

export function PropertyBookingAside({
  property,
  locale,
  initialDate,
  initialPeriod,
  initialGuests,
  rebookId,
}: Props) {
  const t = useTranslations('property');
  const router = useRouter();
  const pathname = usePathname();
  const [intent, setIntent] = useState<RebookIntent | null>(null);
  const [intentError, setIntentError] = useState(false);

  useEffect(() => {
    if (!rebookId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchRebookIntent(rebookId);
        if (!cancelled) setIntent(res.data);
      } catch (err) {
        if (err instanceof BookingApiError && err.status === 401) {
          router.push(`/login?returnUrl=${encodeURIComponent(pathname)}`);
          return;
        }
        if (!cancelled) setIntentError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rebookId, pathname, router]);

  const unavailable =
    property.bookingDisabled ||
    (rebookId && (intentError || (intent && !intent.bookable)));

  if (unavailable) {
    return (
      <div
        className="rounded-3xl border border-primary/15 bg-surface p-6 text-center"
        data-testid="rebook-unavailable"
      >
        <p className="font-medium text-navy">{t('rebookUnavailable')}</p>
        <p className="mt-2 text-sm text-muted">{t('rebookUnavailableHint')}</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button asChild className="shadow-soft">
            <Link href="/search">{t('rebookSearchCta')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/account/favorites">{t('rebookFavoritesCta')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const guests = intent?.guestsToApply ?? initialGuests;
  const guestsCapped = Boolean(intent?.guestsCapped);

  return (
    <div className="space-y-3">
      {rebookId && intent && (
        <div
          className="rounded-2xl border border-primary/20 bg-primary-soft/50 px-4 py-3 text-sm text-navy"
          data-testid="rebook-banner"
        >
          <p>{t('rebookWelcome')}</p>
          {guestsCapped && (
            <p className="mt-2 text-muted" data-testid="rebook-capacity-note">
              {t('rebookGuestsCapped', { capacity: intent.propertyCapacity })}
            </p>
          )}
        </div>
      )}
      {property.activeOffers && property.activeOffers.length > 0 ? (
        <div
          className="rounded-2xl border border-primary/20 bg-primary-soft/40 px-4 py-3 text-sm text-navy"
          data-testid="property-offers"
        >
          <p className="font-medium">{t('activeOffersTitle')}</p>
          <ul className="mt-2 space-y-1 text-muted">
            {property.activeOffers.map((o) => (
              <li key={o.id}>
                {locale === 'ar' ? o.titleAr : o.titleEn}
                {o.discountType === 'percentage'
                  ? ` · ${o.discountValue}%`
                  : ` · ${o.discountValue} JOD`}
                {o.period ? ` · ${o.period}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <BookingPanel
        property={property}
        locale={locale}
        initialDate={rebookId ? '' : initialDate}
        initialPeriod={rebookId ? '' : initialPeriod}
        initialGuests={guests}
        preferredPeriod={intent?.preferredPeriod}
        rebookMode={Boolean(rebookId)}
      />
    </div>
  );
}
