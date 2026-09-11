'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { MapPin } from 'lucide-react';
import type { CheckoutBookingView } from '@mazare3/shared';

export function CheckoutPropertySummary({ booking }: { booking: CheckoutBookingView }) {
  const t = useTranslations('checkout');
  const locale = useLocale() as 'ar' | 'en';
  const title = locale === 'ar' ? booking.propertyTitleAr : booking.propertyTitleEn;

  return (
    <section
      data-testid="checkout-property-summary"
      className="overflow-hidden rounded-[18px] border border-[#E0E8F3] bg-white shadow-[0_6px_18px_rgba(47,90,150,.08)]"
    >
      <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
        <div className="relative h-[72px] w-[88px] shrink-0 overflow-hidden rounded-[14px] bg-[#EEF4FF] sm:h-[88px] sm:w-[108px]">
          {booking.propertyCoverUrl ? (
            <img
              src={booking.propertyCoverUrl}
              alt={title}
              className="h-full w-full object-cover"
              data-testid="checkout-property-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-[#8794A7]"
              aria-hidden
            >
              Mazare3
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 text-start">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#8794A7]">
            {t('destinationLabel')}
          </p>
          <h2 className="mt-0.5 truncate text-[15px] font-bold text-[#0D2046] sm:text-[16px]">
            {title}
          </h2>
          {booking.approximateLocation ? (
            <p
              className="mt-1 flex items-start gap-1 text-[12px] text-[#53637A]"
              data-testid="checkout-approximate-location"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2F6EF6]" aria-hidden />
              <span>{booking.approximateLocation}</span>
            </p>
          ) : null}
          <Link
            href={`/properties/${booking.propertySlug}`}
            className="mt-1.5 inline-block text-[11px] font-semibold text-[#2F6EF6] hover:underline"
            data-testid="checkout-property-link"
          >
            {t('viewProperty')}
          </Link>
        </div>
      </div>
    </section>
  );
}
