'use client';

import { useTranslations } from 'next-intl';
import { ChevronLeft } from 'lucide-react';
import type { AvailabilityPeriod, PublicPropertyDetail } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { getPropertyTitle } from '@/lib/property-helpers';
import { BookingPanel } from './booking-panel';

type Props = {
  property: PublicPropertyDetail;
  locale: 'ar' | 'en';
  initialDate?: string;
  initialPeriod?: AvailabilityPeriod;
  initialGuests?: number;
  preferredPeriod?: AvailabilityPeriod;
  rebookMode?: boolean;
};

/**
 * Dedicated Booking Configuration page shell (CB-UX-1 Step 2).
 */
export function BookingConfigurationView({
  property,
  locale,
  initialDate,
  initialPeriod,
  initialGuests,
  preferredPeriod,
  rebookMode = false,
}: Props) {
  const t = useTranslations('property');
  const title = getPropertyTitle(property, locale);
  const cover = property.images?.[0]?.url;
  const locationLine = [property.city, property.area].filter(Boolean).join(' · ');

  return (
    <div
      data-testid="booking-configuration-page"
      className="mx-auto max-w-5xl pb-36 lg:pb-12"
    >
      <header className="mb-4 flex items-start gap-3">
        <Link
          href={`/properties/${property.slug}`}
          data-testid="booking-config-back"
          className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E0E8F3] bg-white text-[#0D2046] shadow-sm"
          aria-label={t('bookingConfigBack')}
        >
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {cover ? (
            <img
              src={cover}
              alt=""
              className="h-14 w-14 shrink-0 rounded-[12px] object-cover"
              data-testid="booking-config-cover"
            />
          ) : (
            <div className="h-14 w-14 shrink-0 rounded-[12px] bg-[#EAF1FB]" />
          )}
          <div className="min-w-0 text-start">
            <h1 className="truncate text-[17px] font-bold text-[#0D2046]">{title}</h1>
            {locationLine ? (
              <p
                className="mt-0.5 truncate text-[12px] text-[#53637A]"
                data-testid="booking-config-location"
              >
                {locationLine}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-start">
        <BookingPanel
          property={property}
          locale={locale}
          initialDate={initialDate}
          initialPeriod={initialPeriod}
          initialGuests={initialGuests}
          preferredPeriod={preferredPeriod}
          rebookMode={rebookMode}
          layout="page"
        />
      </div>
    </div>
  );
}
