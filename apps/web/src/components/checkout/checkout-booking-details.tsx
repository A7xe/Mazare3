'use client';

import { useTranslations, useLocale } from 'next-intl';
import { CalendarDays, Clock3, Users } from 'lucide-react';
import type { CheckoutBookingView } from '@mazare3/shared';

function formatBookingDate(isoDate: string, locale: 'ar' | 'en') {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-JO' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    numberingSystem: 'latn',
    timeZone: 'UTC',
  }).format(d);
}

export function CheckoutBookingDetails({ booking }: { booking: CheckoutBookingView }) {
  const t = useTranslations('checkout');
  const locale = useLocale() as 'ar' | 'en';

  return (
    <section
      data-testid="checkout-booking-details"
      className="rounded-[18px] border border-[#E0E8F3] bg-white px-3.5 py-3 shadow-[0_6px_18px_rgba(47,90,150,.06)] sm:px-4"
    >
      <h2 className="text-[13px] font-bold text-[#0D2046]">{t('bookingDetailsTitle')}</h2>
      <ul className="mt-2.5 space-y-2 text-[12px] text-[#53637A]">
        <li className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#2F6EF6]" aria-hidden />
          <div>
            <p className="font-semibold text-[#0D2046]" data-testid="checkout-booking-date">
              {formatBookingDate(booking.date, locale)}
            </p>
            <p className="font-mono text-[10px] text-[#8794A7]">{booking.publicCode}</p>
          </div>
        </li>
        <li className="flex items-start gap-2">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#2F6EF6]" aria-hidden />
          <div>
            <p className="font-semibold text-[#0D2046]" data-testid="checkout-booking-period">
              {t(`period.${booking.period}`)}
            </p>
            {booking.startAtLocal && booking.endAtLocal ? (
              <p data-testid="checkout-booking-times" className="tabular-nums text-[#53637A]">
                {booking.startAtLocal} – {booking.endAtLocal}
              </p>
            ) : null}
            {booking.usesLegacyTiming ? (
              <p data-testid="checkout-legacy-timing" className="text-[11px] text-[#8794A7]">
                {t('legacyTimingNote')}
              </p>
            ) : null}
          </div>
        </li>
        <li className="flex items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-[#2F6EF6]" aria-hidden />
          <p data-testid="checkout-booking-guests" className="font-semibold text-[#0D2046]">
            {booking.guestsCount} {t('guests')}
          </p>
        </li>
      </ul>
    </section>
  );
}
