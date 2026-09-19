'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AvailabilityPeriod, PublicPropertyDetail, RebookIntent } from '@mazare3/shared';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { BookingConfigurationView } from './booking-configuration-view';
import { BookingApiError, fetchRebookIntent } from '@/lib/api-bookings';

type Props = {
  property: PublicPropertyDetail;
  locale: 'ar' | 'en';
  initialDate?: string;
  initialPeriod?: AvailabilityPeriod;
  initialGuests?: number;
  rebookId?: string;
};

export function BookingConfigurationClient({
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
  const [intentLoading, setIntentLoading] = useState(Boolean(rebookId));

  useEffect(() => {
    if (!rebookId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchRebookIntent(rebookId);
        if (!cancelled) {
          setIntent(res.data);
          setIntentLoading(false);
        }
      } catch (err) {
        if (err instanceof BookingApiError && err.status === 401) {
          router.push(`/auth?returnUrl=${encodeURIComponent(pathname)}`);
          return;
        }
        if (!cancelled) {
          setIntentError(true);
          setIntentLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rebookId, pathname, router]);

  if (property.bookingDisabled) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-primary/15 bg-surface p-6 text-center">
        <p className="font-medium text-navy">{t('bookingUnavailable')}</p>
        <Button asChild className="mt-4">
          <Link href={`/properties/${property.slug}`}>{t('bookingConfigBack')}</Link>
        </Button>
      </div>
    );
  }

  if (rebookId && intentLoading) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center text-sm text-[#53637A]">
        {t('rebookRedirecting')}
      </div>
    );
  }

  if (rebookId && (intentError || (intent && !intent.bookable))) {
    return (
      <div
        className="mx-auto max-w-lg rounded-3xl border border-primary/15 bg-surface p-6 text-center"
        data-testid="rebook-unavailable"
      >
        <p className="font-medium text-navy">{t('rebookUnavailable')}</p>
        <p className="mt-2 text-sm text-muted">{t('rebookUnavailableHint')}</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button asChild>
            <Link href="/search">{t('rebookSearchCta')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/properties/${property.slug}`}>{t('bookingConfigBack')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const guests = intent?.guestsToApply ?? initialGuests;

  return (
    <div className="space-y-3">
      {rebookId && intent ? (
        <div
          className="rounded-2xl border border-primary/20 bg-primary-soft/50 px-4 py-3 text-sm text-navy"
          data-testid="rebook-banner"
        >
          <p>{t('rebookWelcome')}</p>
          {intent.guestsCapped ? (
            <p className="mt-2 text-muted" data-testid="rebook-capacity-note">
              {t('rebookGuestsCapped', { capacity: intent.propertyCapacity })}
            </p>
          ) : null}
        </div>
      ) : null}
      <BookingConfigurationView
        property={property}
        locale={locale}
        initialDate={rebookId ? '' : initialDate}
        initialPeriod={rebookId ? undefined : initialPeriod}
        initialGuests={guests}
        preferredPeriod={intent?.preferredPeriod}
        rebookMode={Boolean(rebookId)}
      />
    </div>
  );
}
