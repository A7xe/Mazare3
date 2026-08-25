'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, Smartphone } from 'lucide-react';
import type { CheckoutBookingView, PaymentMethod, PaymentPublicConfig, PaymentSummary } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PriceDisplay } from '@/components/marketplace/price-display';
import {
  createPaymentIntent,
  fetchCheckoutBooking,
  fetchPaymentConfig,
  simulatePaymentFailure,
  simulatePaymentSuccess,
} from '@/lib/api-payments';
import { Link } from '@/i18n/navigation';
import { formatPlatformDateTime } from '@/lib/format-platform-time';
import { LegalCommitmentNotice } from '@/components/legal/legal-commitment-notice';

export function CheckoutView({ bookingId }: { bookingId: string }) {
  const t = useTranslations('checkout');
  const tBookings = useTranslations('bookings');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();

  const [booking, setBooking] = useState<CheckoutBookingView | null>(null);
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [payConfig, setPayConfig] = useState<PaymentPublicConfig | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configRes, res] = await Promise.all([
        fetchPaymentConfig(),
        fetchCheckoutBooking(bookingId),
      ]);
      setPayConfig(configRes.data);
      setBooking(res.data);
      setPayment(res.data.payment);

      const canCreateIntent =
        configRes.data.simulateEnabled ||
        (configRes.data.livePaymentsEnabled && configRes.data.provider !== 'test');

      const duePurpose = res.data.duePurpose;
      const needsIntent =
        Boolean(duePurpose) &&
        !res.data.isFullyPaid &&
        canCreateIntent &&
        configRes.data.simulateEnabled;

      const activeMatches =
        res.data.payment &&
        ['initiated', 'pending'].includes(res.data.payment.status) &&
        (res.data.payment.purpose === duePurpose || !duePurpose);

      if (needsIntent && !activeMatches && duePurpose) {
        const intent = await createPaymentIntent({
          bookingId,
          method,
          purpose: duePurpose,
        });
        setPayment(intent.data);
      } else if (activeMatches) {
        setPayment(res.data.payment);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [bookingId, method, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSimulateSuccess() {
    if (!payment) return;
    setActing(true);
    setError(null);
    try {
      await simulatePaymentSuccess(payment.id);
      router.push('/account/bookings');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('payError'));
    } finally {
      setActing(false);
    }
  }

  async function handleSimulateFailure() {
    if (!payment) return;
    setActing(true);
    setError(null);
    try {
      await simulatePaymentFailure(payment.id);
      setError(t('paymentFailed'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('payError'));
    } finally {
      setActing(false);
    }
  }

  async function handlePaytabsCheckout() {
    setActing(true);
    setError(null);
    try {
      const duePurpose = booking?.duePurpose;
      if (!duePurpose) throw new Error(t('payError'));
      const intent = await createPaymentIntent({
        bookingId,
        method: 'card',
        purpose: duePurpose,
      });
      setPayment(intent.data);
      if (intent.data.redirectUrl) {
        window.location.assign(intent.data.redirectUrl);
        return;
      }
      setError(t('payError'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('payError'));
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div data-testid="checkout-loading" className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !booking) {
    return (
      <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">
        {error}
      </p>
    );
  }

  if (!booking) return null;

  if (booking.status === 'pending_owner_approval') {
    return (
      <Card className="glass-panel rounded-3xl border-primary/12">
        <CardHeader>
          <CardTitle>{t('awaitingOwnerApprovalTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted">
          <p>{t('awaitingOwnerApprovalBody')}</p>
          {booking.ownerApprovalExpiresAt && (
            <p>
              {formatPlatformDateTime(booking.ownerApprovalExpiresAt, locale, booking.timeZone)}
            </p>
          )}
          <Button asChild variant="outline">
            <Link href="/account/bookings">{t('viewBookings')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const title = locale === 'ar' ? booking.propertyTitleAr : booking.propertyTitleEn;
  const isFullyPaid = booking.isFullyPaid === true;
  const showSimulate = payConfig?.simulateEnabled === true;
  const liveHosted =
    payConfig?.livePaymentsEnabled === true &&
    (payConfig.provider === 'paytabs' || payConfig.provider === 'card_gateway');
  const awaitingPay = Boolean(booking.duePurpose) && !isFullyPaid;
  const showLiveNotReady =
    !showSimulate && !payConfig?.livePaymentsEnabled && awaitingPay;
  const dueNow = booking.dueNowAmount;
  const isDeposit = booking.duePurpose === 'deposit';
  const isBalance = booking.duePurpose === 'balance';
  const isFull = booking.duePurpose === 'full' || booking.paymentCollectionMode === 'full';
  const serviceFee = booking.pricing.customerServiceFeeAmount;

  return (
    <div data-testid="checkout-page" className="mx-auto max-w-2xl space-y-6">
      {showSimulate && (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>{t('devNotice')}</p>
          </div>
        </div>
      )}

      {showLiveNotReady && (
        <div
          data-testid="checkout-live-not-ready"
          className="rounded-xl border border-primary/20 bg-primary-soft/30 px-4 py-3 text-sm text-navy"
        >
          <div className="flex gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>{t('liveNotEnabled')}</p>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">
          {error}
        </p>
      )}

      <Card className="glass-panel overflow-hidden rounded-3xl border-primary/12">
        <div className="gradient-primary h-1" />
        <CardHeader>
          <CardTitle className="text-xl text-navy">{t('title')}</CardTitle>
          <p className="font-mono text-xs text-muted">{booking.publicCode}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-lg font-semibold text-navy">{title}</p>
            <p className="text-sm text-muted">
              {booking.date} — {t(`period.${booking.period}`)} — {booking.guestsCount}{' '}
              {t('guests')}
            </p>
            {booking.startAtLocal && booking.endAtLocal && (
              <p data-testid="checkout-booking-times" className="text-sm text-navy">
                {booking.startAtLocal} – {booking.endAtLocal} ({booking.timeZone})
              </p>
            )}
            {booking.usesLegacyTiming && (
              <p data-testid="checkout-legacy-timing" className="text-xs text-muted">
                {t('legacyTimingNote')}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="muted">{t(`bookingStatus.${booking.status}`)}</Badge>
            {isDeposit && (
              <Badge variant="highlight" data-testid="checkout-deposit-badge">
                {t('depositBadge')}
              </Badge>
            )}
            {isBalance && (
              <Badge variant="highlight" data-testid="checkout-balance-badge">
                {t('balanceBadge')}
              </Badge>
            )}
            {isFull && booking.paymentCollectionMode === 'full' && (
              <Badge variant="highlight" data-testid="checkout-full-payment-badge">
                {t('fullPaymentBadge')}
              </Badge>
            )}
            {booking.paymentState && (
              <Badge variant={isFullyPaid ? 'highlight' : 'default'}>
                {tBookings(`paymentState.${booking.paymentState}`)}
              </Badge>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-primary/12 bg-primary-soft/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-navy">{t('bookingTotal')}</span>
              <PriceDisplay
                amount={booking.pricing.bookingTotalAmount}
                currency={booking.currency}
                locale={locale}
              />
            </div>
            {serviceFee > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-navy">{t('serviceFee')}</span>
                <PriceDisplay amount={serviceFee} currency={booking.currency} locale={locale} />
              </div>
            )}
            {booking.depositAmount != null && booking.paymentCollectionMode !== 'full' && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-navy">
                  {t('depositLabel')}
                  {booking.depositPercent != null ? ` (${booking.depositPercent}%)` : ''}
                </span>
                <PriceDisplay
                  amount={booking.depositAmount}
                  currency={booking.currency}
                  locale={locale}
                />
              </div>
            )}
            {booking.remainingAmount != null && booking.paymentCollectionMode !== 'full' && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-navy">{t('remainingBalance')}</span>
                <PriceDisplay
                  amount={booking.remainingAmount}
                  currency={booking.currency}
                  locale={locale}
                />
              </div>
            )}
            {booking.balanceDueAt && booking.paymentCollectionMode !== 'full' && (
              <p className="text-xs text-muted" data-testid="checkout-balance-due-at">
                {t('balanceDueAt')}:{' '}
                {formatPlatformDateTime(booking.balanceDueAt, locale, booking.timeZone)}
              </p>
            )}
            {awaitingPay && (
              <div
                className="flex flex-wrap items-center justify-between gap-2 border-t border-primary/10 pt-3"
                data-testid="checkout-due-now"
              >
                <span className="text-sm font-semibold text-navy">
                  {isDeposit ? t('depositLabel') : t('dueNow')}
                </span>
                <PriceDisplay amount={dueNow} currency={booking.currency} locale={locale} large />
              </div>
            )}
            {isDeposit && <p className="text-xs text-muted">{t('depositNote')}</p>}
            {booking.paymentCollectionMode === 'full' && (
              <p className="text-xs text-muted">{t('fullPaymentNote')}</p>
            )}
            {awaitingPay ? <LegalCommitmentNotice testId="checkout-legal-notice" /> : null}
          </div>

          {showSimulate && awaitingPay && (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium text-navy">{t('chooseMethod')}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={method === 'card' ? 'default' : 'outline'}
                    onClick={() => setMethod('card')}
                  >
                    <CreditCard className="h-4 w-4" />
                    {t('methodCard')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={method === 'cliq' ? 'default' : 'outline'}
                    onClick={() => setMethod('cliq')}
                  >
                    <Smartphone className="h-4 w-4" />
                    {t('methodCliq')}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="flex-1 shadow-soft"
                  data-testid="checkout-simulate-success"
                  disabled={acting || !payment}
                  onClick={() => void handleSimulateSuccess()}
                >
                  {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {t('simulateSuccess')}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  data-testid="checkout-simulate-failure"
                  disabled={acting || !payment}
                  onClick={() => void handleSimulateFailure()}
                >
                  {t('simulateFailure')}
                </Button>
              </div>
            </>
          )}

          {liveHosted && awaitingPay && (
            <Button
              className="w-full shadow-soft"
              data-testid="checkout-paytabs-pay"
              disabled={acting}
              onClick={() => void handlePaytabsCheckout()}
            >
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {acting ? t('redirectingToPaytabs') : t('payWithCard')}
            </Button>
          )}

          {isFullyPaid && (
            <Button asChild className="w-full shadow-soft">
              <Link href="/account/bookings">{t('viewBookings')}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
