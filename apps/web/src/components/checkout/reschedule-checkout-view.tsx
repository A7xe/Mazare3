'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type {
  PaymentMethod,
  PaymentPublicConfig,
  PaymentSummary,
  PublicBookingSummary,
} from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import {
  createRescheduleDifferencePayment,
  fetchPaymentConfig,
  PaymentApiError,
  simulatePaymentFailure,
  simulatePaymentSuccess,
} from '@/lib/api-payments';
import { fetchMyBookings } from '@/lib/api-bookings';
import { formatPlatformDateTime } from '@/lib/format-platform-time';
import { formatPrice } from '@/lib/property-helpers';
import { CheckoutPaymentContact } from '@/components/checkout/checkout-payment-contact';
import {
  BookingLegalAck,
  type BookingLegalAckState,
} from '@/components/legal/booking-legal-ack';
import {
  BALANCE_DUE_HOURS_BEFORE_START,
  CANCELLATION_FREE_UNTIL_HOURS,
  DEPOSIT_PERCENT,
} from '@mazare3/shared';

type ContactRequiredFields = Array<'email' | 'phone' | 'name'>;

export function RescheduleCheckoutView({ requestId }: { requestId: string }) {
  const t = useTranslations('checkout');
  const tBookings = useTranslations('bookings');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();

  const [booking, setBooking] = useState<PublicBookingSummary | null>(null);
  const [payConfig, setPayConfig] = useState<PaymentPublicConfig | null>(null);
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legalAck, setLegalAck] = useState<BookingLegalAckState | null>(null);
  const [contactRequired, setContactRequired] = useState<ContactRequiredFields | null>(null);
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [method] = useState<PaymentMethod>('card');

  const pending = booking?.pendingReschedule;
  const amountDue = pending?.customerPayableDelta ?? 0;

  function applyPaymentContactError(e: unknown): boolean {
    if (!(e instanceof PaymentApiError)) return false;
    if (e.code === 'PAYMENT_CONTACT_EMAIL_UNAVAILABLE') {
      setError(t('paymentContactEmailUnavailable'));
      return true;
    }
    if (e.code === 'PAYMENT_CONTACT_REQUIRED') {
      const details = e.details as { requiredFields?: ContactRequiredFields } | undefined;
      const fields = details?.requiredFields?.filter((f) => f === 'email' || f === 'phone') ?? [
        'email',
      ];
      setContactRequired(fields.length ? fields : ['email']);
      setError(null);
      return true;
    }
    return false;
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configRes, bookingsRes] = await Promise.all([
        fetchPaymentConfig(),
        fetchMyBookings(),
      ]);
      setPayConfig(configRes.data);
      const match = bookingsRes.data.find((b) => b.pendingReschedule?.id === requestId) ?? null;
      setBooking(match);
      if (!match?.pendingReschedule) {
        setError(t('rescheduleNotFound'));
      } else if (
        match.pendingReschedule.status !== 'accepted_pending_payment' ||
        match.pendingReschedule.customerPayableDelta <= 0
      ) {
        setError(t('rescheduleNothingDue'));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [requestId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createIntent(opts?: { withContact?: boolean }) {
    const payload: Parameters<typeof createRescheduleDifferencePayment>[0] = {
      rescheduleRequestId: requestId,
      method,
    };
    if (opts?.withContact || contactRequired) {
      if (contactRequired?.includes('email') || contactEmail.trim()) {
        payload.contactEmail = contactEmail.trim();
      }
      if (contactRequired?.includes('phone') || contactPhone.trim()) {
        payload.contactPhone = contactPhone.trim();
      }
    }
    const intent = await createRescheduleDifferencePayment(payload);
    setPayment(intent.data);
    setContactRequired(null);
    return intent.data;
  }

  async function handlePay() {
    if (!booking) return;
    if (!legalAck?.isValid) {
      setError(t('legalAckRequired'));
      return;
    }
    setActing(true);
    setError(null);
    try {
      const intent = await createIntent();
      if (intent.redirectUrl) {
        window.location.assign(intent.redirectUrl);
        return;
      }
      if (intent.status === 'succeeded') {
        router.push(`/checkout/${booking.id}/return?paymentId=${intent.id}`);
        return;
      }
      router.push(`/checkout/${booking.id}/return?paymentId=${intent.id}`);
    } catch (e) {
      if (applyPaymentContactError(e)) return;
      setError(e instanceof Error ? e.message : t('payError'));
    } finally {
      setActing(false);
    }
  }

  async function handleSimulate(success: boolean) {
    if (!booking) return;
    if (!legalAck?.isValid) {
      setError(t('legalAckRequired'));
      return;
    }
    setActing(true);
    setError(null);
    try {
      const pay = payment ?? (await createIntent());
      if (success) {
        await simulatePaymentSuccess(pay.id);
        router.push(`/checkout/${booking.id}/return?paymentId=${pay.id}`);
        router.refresh();
      } else {
        await simulatePaymentFailure(pay.id);
        setError(t('paymentFailed'));
        await load();
      }
    } catch (e) {
      if (applyPaymentContactError(e)) return;
      setError(e instanceof Error ? e.message : t('payError'));
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div data-testid="reschedule-checkout-loading" className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="mx-auto max-w-lg space-y-3 rounded-[18px] border border-danger/20 bg-danger/10 px-4 py-5">
        <p className="text-danger" role="alert">
          {error}
        </p>
        <Button asChild variant="outline">
          <Link href="/account/bookings">{t('viewBookings')}</Link>
        </Button>
      </div>
    );
  }

  if (!booking || !pending) {
    return (
      <div className="mx-auto max-w-lg space-y-3">
        <p className="text-danger">{t('rescheduleNotFound')}</p>
        <Button asChild variant="outline">
          <Link href="/account/bookings">{t('viewBookings')}</Link>
        </Button>
      </div>
    );
  }

  const title = locale === 'ar' ? booking.propertyTitleAr : booking.propertyTitleEn;
  const canPay =
    pending.status === 'accepted_pending_payment' && pending.customerPayableDelta > 0;
  const showSimulate = payConfig?.simulateEnabled === true;

  return (
    <div data-testid="reschedule-checkout" className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-[22px] font-bold text-[#0D2046]">{t('rescheduleTitle')}</h1>
        <p className="mt-1 text-[13px] text-[#53637A]">{t('rescheduleSubtitle')}</p>
      </div>

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="space-y-3 rounded-[18px] border border-[#E0E8F3] bg-white px-4 py-4 shadow-sm">
        <p className="text-[15px] font-bold text-[#0D2046]">{title}</p>
        <p className="text-[12px] text-[#8794A7]">{booking.publicCode}</p>
        <div className="grid gap-1 text-[13px] text-[#53637A]">
          <p>
            {tBookings('rescheduleFrom')}: {pending.fromSlot.date} ·{' '}
            {tBookings(`period.${pending.fromSlot.period}`)}
          </p>
          <p>
            {tBookings('rescheduleTo')}: {pending.toSlot.date} ·{' '}
            {tBookings(`period.${pending.toSlot.period}`)}
          </p>
          {pending.expiresAt && (
            <p>
              {tBookings('rescheduleExpiresAt')}:{' '}
              {formatPlatformDateTime(pending.expiresAt, locale)}
            </p>
          )}
        </div>
        <p className="text-[16px] font-bold text-primary">
          {t('dueNow')}: {formatPrice(amountDue, booking.currency, locale)}
        </p>
      </div>

      {canPay && contactRequired && (
        <CheckoutPaymentContact
          fields={contactRequired}
          email={contactEmail}
          phone={contactPhone}
          acting={acting}
          onEmailChange={setContactEmail}
          onPhoneChange={setContactPhone}
          onContinue={() => {
            setContactRequired(null);
            void handlePay();
          }}
        />
      )}

      {canPay && !contactRequired && (
        <div className="space-y-3">
          <BookingLegalAck
            testIdPrefix="reschedule-checkout-legal"
            summary={{
              depositPercent: DEPOSIT_PERCENT,
              freeCancelUntilHours: CANCELLATION_FREE_UNTIL_HOURS,
              balanceDueHoursBeforeStart: BALANCE_DUE_HOURS_BEFORE_START,
              showCancelTiers: true,
            }}
            disabled={acting}
            onChange={setLegalAck}
          />
          {showSimulate ? (
            <div className="flex flex-wrap gap-2">
              <Button
                className="flex-1"
                disabled={acting || !legalAck?.isValid}
                data-testid="reschedule-simulate-success"
                onClick={() => void handleSimulate(true)}
              >
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('simulateSuccess')}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={acting || !legalAck?.isValid}
                data-testid="reschedule-simulate-failure"
                onClick={() => void handleSimulate(false)}
              >
                {t('simulateFailure')}
              </Button>
            </div>
          ) : (
            <Button
              className="w-full"
              disabled={acting || !legalAck?.isValid}
              data-testid="reschedule-pay"
              onClick={() => void handlePay()}
            >
              {acting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('payAmountCta', {
                  amount: formatPrice(amountDue, booking.currency, locale),
                })
              )}
            </Button>
          )}
        </div>
      )}

      {!canPay && (
        <Button asChild variant="outline" className="w-full">
          <Link href="/account/bookings">{t('viewBookings')}</Link>
        </Button>
      )}
    </div>
  );
}
