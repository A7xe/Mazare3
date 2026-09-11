'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, Loader2, MapPin, XCircle } from 'lucide-react';
import type { PublicBookingSummary } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import {
  acknowledgePaymentReturn,
  fetchPaymentReturnStatus,
} from '@/lib/api-payment-return';
import { fetchMyBooking } from '@/lib/api-bookings';
import { formatPrice } from '@/lib/property-helpers';

const TERMINAL = new Set(['succeeded', 'failed', 'expired']);
const MAX_POLLS = 12;
const POLL_MS = 2500;

function displayStatus(status: string | null): 'pending' | 'succeeded' | 'failed' {
  if (status === 'succeeded') return 'succeeded';
  if (status === 'failed' || status === 'expired') return 'failed';
  return 'pending';
}

/**
 * PayTabs return UI — polls same-origin Web BFF only.
 * Never treats URL/query/form fields as payment truth.
 * On success: dedicated Mazare3 confirmation (CB-UX-1).
 */
export function CheckoutReturnView({ bookingId }: { bookingId: string }) {
  const t = useTranslations('checkout');
  const tProp = useTranslations('property');
  const locale = useLocale() as 'ar' | 'en';
  const search = useSearchParams();
  const paymentId = search.get('paymentId');
  const [status, setStatus] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<PublicBookingSummary | null>(null);
  const acked = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      if (!paymentId) {
        setStatus('pending');
        return;
      }
      try {
        if (!acked.current) {
          // Ack is informational only — never block status polling on ack failure.
          try {
            await acknowledgePaymentReturn(paymentId);
            if (cancelled) return;
            acked.current = true;
          } catch {
            /* continue to status */
          }
        }
        const res = await fetchPaymentReturnStatus(paymentId);
        if (cancelled) return;
        setError(null);
        setStatus(res.data.status);
        if (res.data.purpose) setPurpose(res.data.purpose);
        if (!TERMINAL.has(res.data.status) && tries < MAX_POLLS) {
          tries += 1;
          timer = setTimeout(() => {
            void tick();
          }, POLL_MS);
        }
      } catch (e) {
        if (cancelled) return;
        if (tries < MAX_POLLS) {
          tries += 1;
          timer = setTimeout(() => {
            void tick();
          }, POLL_MS);
          return;
        }
        setError(e instanceof Error ? e.message : t('payError'));
      }
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [paymentId, t]);

  const kind = displayStatus(status);

  useEffect(() => {
    if (kind !== 'succeeded') return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchMyBooking(bookingId);
        if (!cancelled) setBooking(res.data);
      } catch {
        /* confirmation still usable without booking details */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, bookingId]);

  if (kind === 'succeeded') {
    const propertyName = booking
      ? locale === 'ar'
        ? booking.propertyTitleAr
        : booking.propertyTitleEn || booking.propertyTitleAr
      : '';
    const arrival = booking?.arrival ?? null;
    const depositPaid =
      purpose === 'deposit' ||
      booking?.paymentState === 'deposit_paid' ||
      booking?.paymentState === 'balance_pending' ||
      booking?.paymentState === 'balance_overdue';
    const fullyPaid =
      purpose === 'full' ||
      booking?.paymentState === 'fully_paid' ||
      booking?.isFullyPaid === true;

    return (
      <div
        data-testid="checkout-return-page"
        data-confirmation="true"
        className="mx-auto max-w-lg space-y-4 py-6"
      >
        <div className="rounded-[22px] border border-[#E0E8F3] bg-white px-5 py-7 text-center shadow-[0_10px_28px_rgba(47,90,150,.08)]">
          <CheckCircle2 className="mx-auto h-11 w-11 text-[#16A34A]" aria-hidden />
          <h1
            data-testid="checkout-return-title"
            className="mt-4 text-[22px] font-bold text-[#0D2046]"
          >
            {t('returnConfirmedTitle')}
          </h1>
          <p
            data-testid="checkout-return-status"
            data-status="succeeded"
            data-purpose={purpose ?? undefined}
            className="mt-2 text-[13px] leading-relaxed text-[#53637A]"
          >
            {t('returnConfirmedHelper')}
          </p>
        </div>

        {booking ? (
          <div
            data-testid="booking-confirmation-summary"
            className="rounded-[18px] border border-[#E0E8F3] bg-white px-4 py-4 text-start shadow-sm"
          >
            <p className="text-[16px] font-bold text-[#0D2046]">{propertyName}</p>
            {booking.publicCode ? (
              <p className="mt-1 text-[12px] text-[#53637A]" data-testid="booking-confirmation-code">
                {t('returnBookingCode')}: <span className="font-semibold text-[#0D2046]">{booking.publicCode}</span>
              </p>
            ) : null}
            <dl className="mt-3 space-y-1.5 text-[13px] text-[#53637A]">
              <div className="flex justify-between gap-3">
                <dt>{tProp('summaryDate')}</dt>
                <dd className="font-medium text-[#0D2046]">{booking.date}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{tProp('summaryPeriod')}</dt>
                <dd className="font-medium text-[#0D2046]">{tProp(`period.${booking.period}`)}</dd>
              </div>
              {booking.startAtLocal && booking.endAtLocal ? (
                <div className="flex justify-between gap-3">
                  <dt>{t('returnPeriodTime')}</dt>
                  <dd className="font-medium text-[#0D2046]">
                    {booking.startAtLocal} – {booking.endAtLocal}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt>{tProp('summaryGuests')}</dt>
                <dd className="font-medium text-[#0D2046]">{booking.guestsCount}</dd>
              </div>
            </dl>

            <div className="mt-3 rounded-[12px] bg-[#F8FBFF] px-3 py-2.5 text-[13px]">
              {fullyPaid ? (
                <p className="font-semibold text-[#16A34A]" data-testid="confirmation-paid-full">
                  {t('returnFullyPaid')}
                </p>
              ) : depositPaid ? (
                <>
                  <p className="font-semibold text-[#16A34A]" data-testid="confirmation-paid-deposit">
                    {t('returnDepositPaid')}
                  </p>
                  {booking.remainingAmount != null && booking.remainingAmount > 0 ? (
                    <p className="mt-1 text-[#53637A]" data-testid="confirmation-remaining">
                      {t('returnRemaining')}:{' '}
                      {formatPrice(booking.remainingAmount, booking.currency, locale)}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="font-semibold text-[#0D2046]">{t('returnSuccessBody')}</p>
              )}
            </div>
          </div>
        ) : null}

        {arrival ? (
          <div
            data-testid="booking-confirmation-location"
            className="rounded-[18px] border border-[#E0E8F3] bg-white px-4 py-4 text-start shadow-sm"
          >
            <div className="flex items-center gap-2 text-[#0D2046]">
              <MapPin className="h-4 w-4 text-[#2F6EF6]" aria-hidden />
              <p className="font-bold">{t('returnVisitInfoTitle')}</p>
            </div>
            {arrival.exactAddress ? (
              <p className="mt-2 text-[13px] text-[#53637A]" data-testid="confirmation-exact-address">
                {arrival.exactAddress}
              </p>
            ) : null}
            {(locale === 'ar'
              ? arrival.arrivalInstructionsAr || arrival.arrivalInstructionsEn
              : arrival.arrivalInstructionsEn || arrival.arrivalInstructionsAr) ? (
              <p className="mt-2 text-[12px] leading-relaxed text-[#53637A]">
                {locale === 'ar'
                  ? arrival.arrivalInstructionsAr || arrival.arrivalInstructionsEn
                  : arrival.arrivalInstructionsEn || arrival.arrivalInstructionsAr}
              </p>
            ) : null}
            {arrival.googleMapsDirectionsUrl ? (
              <Button asChild variant="outline" className="mt-3 w-full rounded-[12px]">
                <a
                  href={arrival.googleMapsDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="confirmation-open-maps"
                >
                  {t('returnOpenMaps')}
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1 rounded-[12px] bg-[#2F6EF6]">
            <Link href="/account/bookings" data-testid="confirmation-my-bookings">
              {t('returnViewBooking')}
            </Link>
          </Button>
          {booking?.propertySlug ? (
            <Button asChild variant="outline" className="flex-1 rounded-[12px]">
              <Link href={`/properties/${booking.propertySlug}`}>{t('returnBackToProperty')}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const title =
    kind === 'failed' ? t('returnFailedTitle') : t('returnPendingTitle');
  const body =
    kind === 'failed'
      ? t('returnFailedBody')
      : t('returnProcessingBody');

  return (
    <div
      data-testid="checkout-return-page"
      className="mx-auto max-w-lg space-y-4 py-8"
    >
      <div className="rounded-[22px] border border-[#E0E8F3] bg-white px-5 py-8 text-center shadow-[0_10px_28px_rgba(47,90,150,.08)]">
        {kind === 'pending' && !error ? (
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#2F6EF6]" aria-hidden />
        ) : null}
        {kind === 'failed' ? (
          <XCircle className="mx-auto h-10 w-10 text-danger" aria-hidden />
        ) : null}

        <h1
          data-testid="checkout-return-title"
          className="mt-4 text-[20px] font-bold text-[#0D2046]"
        >
          {title}
        </h1>
        <p
          data-testid="checkout-return-status"
          data-status={kind}
          data-purpose={purpose ?? undefined}
          className="mt-2 text-[13px] leading-relaxed text-[#53637A]"
        >
          {body}
        </p>
        {kind === 'pending' && !error ? (
          <p className="mt-3 text-[12px] text-[#8794A7]">{t('returnProcessingTitle')}</p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-[12px] border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild className="flex-1 rounded-[12px] bg-[#2F6EF6]">
          <Link href="/account/bookings">{t('returnViewBooking')}</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1 rounded-[12px]">
          <Link href={`/checkout/${bookingId}`}>{t('returnBackCheckout')}</Link>
        </Button>
      </div>
    </div>
  );
}
