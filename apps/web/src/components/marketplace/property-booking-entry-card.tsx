'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck, Users } from 'lucide-react';
import type { AvailabilityPeriod, PublicPropertyDetail } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/property-helpers';
import { fetchPropertyAvailability } from '@/lib/api-properties';
import {
  addDaysIso,
  BOOKING_CALENDAR_HORIZON_DAYS,
} from '@/lib/booking-calendar';
import { todayIsoInPlatformZone } from '@/lib/format-platform-time';

type Props = {
  property: PublicPropertyDetail;
  locale: 'ar' | 'en';
  /** Optional preselected query params forwarded to the booking page. */
  query?: {
    date?: string;
    period?: AvailabilityPeriod;
    guests?: number;
  };
};

const PERIOD_ORDER: AvailabilityPeriod[] = ['morning', 'evening', 'full_day', 'overnight'];

/**
 * Informational Property Detail booking card (CB-UX-1).
 * No date/period/guest inputs — navigates only to `/properties/[slug]/book`.
 */
export function PropertyBookingEntryCard({ property, locale, query }: Props) {
  const t = useTranslations('property');
  const tCommon = useTranslations('common');
  const instant = property.instantBookingEnabled !== false;

  const [morningFrom, setMorningFrom] = useState<number | null>(null);
  const [morningFound, setMorningFound] = useState(false);
  const [supportedPeriods, setSupportedPeriods] = useState<AvailabilityPeriod[] | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const from = todayIsoInPlatformZone();
    const to = addDaysIso(from, Math.min(45, BOOKING_CALENDAR_HORIZON_DAYS));

    void (async () => {
      try {
        const slots = await fetchPropertyAvailability(property.slug, from, to);
        if (cancelled) return;
        const bookable = slots.filter((s) => s.bookable);
        const periods = new Set<AvailabilityPeriod>();
        for (const s of bookable) periods.add(s.period);

        const morningPrices = bookable
          .filter((s) => s.period === 'morning')
          .map((s) => s.price);
        if (morningPrices.length > 0) {
          setMorningFound(true);
          setMorningFrom(Math.min(...morningPrices));
        } else {
          setMorningFound(false);
          setMorningFrom(null);
        }

        const ordered = PERIOD_ORDER.filter((p) => periods.has(p));
        setSupportedPeriods(
          ordered.length > 0
            ? ordered
            : PERIOD_ORDER.filter((p) => p !== 'overnight' || property.allowsOvernight),
        );
      } catch {
        if (cancelled) return;
        setMorningFound(false);
        setMorningFrom(null);
        setSupportedPeriods(
          PERIOD_ORDER.filter((p) => p !== 'overnight' || property.allowsOvernight),
        );
      } finally {
        if (!cancelled) setPriceLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [property.slug, property.allowsOvernight]);

  const bookHref = useMemo(() => {
    const sp = new URLSearchParams();
    if (query?.date) sp.set('date', query.date);
    if (query?.period) sp.set('period', query.period);
    if (query?.guests && Number.isFinite(query.guests)) sp.set('guests', String(query.guests));
    const q = sp.toString();
    return `/properties/${property.slug}/book${q ? `?${q}` : ''}`;
  }, [property.slug, query?.date, query?.period, query?.guests]);

  const displayFrom = morningFound && morningFrom != null ? morningFrom : property.basePrice;
  const periods = supportedPeriods ?? PERIOD_ORDER.filter((p) => p !== 'overnight' || property.allowsOvernight);

  if (property.bookingDisabled) {
    return (
      <div
        data-testid="booking-entry-card"
        data-booking-disabled="true"
        className="rounded-[22px] border border-[#E0E8F3] bg-white px-4 py-5 text-center shadow-[0_8px_14px_-8px_rgba(47,90,150,.12)]"
      >
        <p className="font-semibold text-[#0D2046]">{t('bookingUnavailable')}</p>
      </div>
    );
  }

  return (
    <div
      data-testid="booking-entry-card"
      data-instant={instant ? 'true' : 'false'}
      className="rounded-[22px] border border-[#E0E8F3] bg-white px-4 py-4 shadow-[0_8px_14px_-8px_rgba(47,90,150,.12)]"
    >
      <h2 className="text-[18px] font-bold leading-snug text-[#0D2046]">
        {t('bookingPanelTitle')}
      </h2>
      <p className="mt-1 text-[12px] leading-relaxed text-[#53637A]">
        {t('bookingEntrySubtitle')}
      </p>

      <div
        className="mt-4 rounded-[14px] border border-[#E7EEF8] bg-[#F8FBFF] px-3.5 py-3"
        data-testid="booking-entry-price"
        data-morning={morningFound ? 'true' : 'false'}
      >
        <p className="text-[11px] font-medium text-[#8794A7]">{tCommon('from')}</p>
        <p className="mt-0.5 text-[22px] font-bold tabular-nums text-[#0D2046]">
          {priceLoading && !morningFound ? (
            <span className="inline-block h-7 w-24 animate-pulse rounded bg-[#EAF1FB]" />
          ) : (
            <>
              {formatPrice(displayFrom, property.currency, locale)}
            </>
          )}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-[#53637A]">
          {morningFound ? t('bookingEntryMorningPeriod') : t('bookingEntryGenericFrom')}
        </p>
      </div>

      <div
        className="mt-3 flex items-center gap-2 text-[13px] text-[#0D2046]"
        data-testid="booking-entry-capacity"
      >
        <Users className="h-4 w-4 text-[#2F6EF6]" aria-hidden />
        <span>
          {t('bookingEntryMaxGuestsLabel')}{' '}
          <strong className="font-bold">{t('bookingEntryMaxGuestsValue', { count: property.capacity })}</strong>
        </span>
      </div>

      <div className="mt-3" data-testid="booking-entry-periods">
        <p className="text-[11px] font-medium text-[#8794A7]">{t('bookingEntryPeriodsLabel')}</p>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {periods.map((p) => (
            <li
              key={p}
              data-testid={`booking-entry-period-${p}`}
              className="rounded-full border border-[#D7E6FA] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0D2046]"
            >
              {t(`period.${p}`)}
            </li>
          ))}
        </ul>
      </div>

      <p
        className="mt-3 text-[12px] font-semibold text-[#0D2046]"
        data-testid="booking-entry-mode"
      >
        {instant ? t('bookingEntryInstant') : t('bookingEntryOwnerApproval')}
      </p>

      <Button
        asChild
        size="lg"
        data-testid="booking-entry-cta"
        className="mt-4 h-[44px] w-full rounded-[12px] bg-[linear-gradient(90deg,#2F6EF6_0%,#4B8CFF_100%)] text-[14px] font-semibold text-white shadow-[0_8px_16px_rgba(47,110,246,.22)]"
      >
        <Link href={bookHref}>{tCommon('bookNow')}</Link>
      </Button>

      <div className="mt-3 flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" aria-hidden />
        <Link
          href="/cancellation-refund"
          data-testid="booking-cancellation-policy-link"
          className="text-[11px] font-medium leading-relaxed text-[#2F6EF6] hover:underline"
        >
          {t('safeBookingPolicyLink')}
        </Link>
      </div>
    </div>
  );
}
