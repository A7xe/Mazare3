'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Calendar, Loader2, MapPin, MessageSquareWarning, RotateCcw, XCircle } from 'lucide-react';
import type { CancellationPolicyView, DisputeType, PublicBookingSummary, SupportTicketSummary } from '@mazare3/shared';
import { DISPUTE_TYPES } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BookingApiError, cancelBooking, fetchMyBookings } from '@/lib/api-bookings';
import {
  fetchMySupportTickets,
  openDispute,
  requestRefund,
  OperationsApiError,
} from '@/lib/api-operations';
import { getMe } from '@/lib/api-auth';
import { PriceDisplay } from '@/components/marketplace/price-display';
import { formatPlatformDateTime, formatRemainingDuration } from '@/lib/format-platform-time';
import { BookingReviewForm } from '@/components/account/booking-review-form';
import { AccountSubnav } from '@/components/account/account-subnav';
import { BookingExactMap } from '@/components/maps/booking-exact-map';
import { BookingSupportForm } from '@/components/account/booking-support-form';

function policySummaryText(
  t: ReturnType<typeof useTranslations<'bookings'>>,
  policy: CancellationPolicyView,
): string {
  if (!policy.canCancel) return t('policyPast');
  if (policy.tier === 'free') return t('policyFree');
  if (policy.tier === 'partial') {
    return t('policyPartial', { percent: policy.refundPercent ?? 50 });
  }
  if (policy.tier === 'late') return t('policyLate');
  return t('policyPast');
}

export function MyBookingsView() {
  const t = useTranslations('bookings');
  const tCommon = useTranslations('common');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();

  const [bookings, setBookings] = useState<PublicBookingSummary[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState<Record<string, string>>({});
  const [disputeForm, setDisputeForm] = useState<
    Record<string, { type: DisputeType; description: string }>
  >({});
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tmr = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tmr);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await getMe();
      const bookingRes = await fetchMyBookings();
      setBookings(bookingRes.data);
      const supportRes = await fetchMySupportTickets().catch(() => ({ data: [] as SupportTicketSummary[] }));
      setSupportTickets(supportRes.data);
    } catch {
      router.push('/login?returnUrl=' + encodeURIComponent('/account/bookings'));
    } finally {
      setLoading(false);
    }
  }, [router]);

  const refreshSupportTickets = useCallback(async () => {
    const supportRes = await fetchMySupportTickets().catch(() => ({ data: [] as SupportTicketSummary[] }));
    setSupportTickets(supportRes.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRefundRequest(booking: PublicBookingSummary) {
    const reason = refundReason[booking.id]?.trim();
    if (!reason || reason.length < 10) {
      setError(t('refundReasonMin'));
      return;
    }
    setActionBusy(booking.id);
    setError(null);
    try {
      await requestRefund(booking.id, { reason });
      await load();
    } catch (err) {
      setError(err instanceof OperationsApiError ? err.message : t('refundError'));
    } finally {
      setActionBusy(null);
    }
  }

  async function handleOpenDispute(booking: PublicBookingSummary) {
    const form = disputeForm[booking.id];
    if (!form?.description || form.description.length < 10) {
      setError(t('disputeDescMin'));
      return;
    }
    setActionBusy(`dispute-${booking.id}`);
    setError(null);
    try {
      await openDispute(booking.id, form);
      await load();
    } catch (err) {
      setError(err instanceof OperationsApiError ? err.message : t('disputeError'));
    } finally {
      setActionBusy(null);
    }
  }

  async function handleCancel(id: string) {
    setCancellingId(id);
    try {
      await cancelBooking(id);
      await load();
    } catch (err) {
      if (err instanceof BookingApiError && err.code === 'CANCELLATION_NOT_ALLOWED') {
        setError(t('cancelNotAllowedPolicy'));
      } else if (err instanceof BookingApiError && err.code === 'INVALID_STATUS') {
        setError(t('cancelNotAllowed'));
      } else {
        setError(err instanceof Error ? err.message : t('cancelError'));
      }
    } finally {
      setCancellingId(null);
    }
  }

  const canCancelBooking = (b: PublicBookingSummary) => {
    if (b.canCancel) return true;
    return b.status === 'confirmed' && b.cancellationPolicy?.canCancel === true;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>{tCommon('loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-4" data-testid="my-bookings">
      <AccountSubnav />
      <div>
        <h1 className="text-3xl font-bold text-navy">{t('title')}</h1>
        <p className="mt-2 text-muted">{t('subtitle')}</p>
      </div>

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {bookings.length === 0 ? (
        <Card className="glass-panel rounded-3xl border-primary/12">
          <CardContent className="py-16 text-center">
            <Calendar className="mx-auto h-12 w-12 text-primary/50" />
            <p className="mt-4 text-lg font-medium text-navy">{t('emptyTitle')}</p>
            <p className="mt-2 text-sm text-muted">{t('emptyHint')}</p>
            <Button asChild className="mt-6 shadow-soft">
              <Link href="/search">{tCommon('search')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const title = locale === 'ar' ? b.propertyTitleAr : b.propertyTitleEn;
            const policy = b.cancellationPolicy;
            return (
              <Card
                key={b.id}
                className="glass-panel overflow-hidden rounded-3xl border-primary/12"
                data-testid="booking-card"
              >
                <div className="gradient-primary h-1" />
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-2">
                  <div>
                    <CardTitle className="text-lg">
                      <Link
                        href={`/properties/${b.propertySlug}`}
                        className="hover:text-primary hover:underline"
                      >
                        {title}
                      </Link>
                    </CardTitle>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                      <MapPin className="h-3.5 w-3.5" />
                      {b.approximateLocation}
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted">{b.publicCode}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={b.status === 'cancelled' ? 'muted' : 'highlight'}>
                      {t(`status.${b.status}`)}
                    </Badge>
                    {b.paymentStatus && (
                      <Badge variant={b.paymentStatus === 'paid' ? 'highlight' : 'default'}>
                        {t(`paymentStatus.${b.paymentStatus}`)}
                      </Badge>
                    )}
                    {b.paymentState && (
                      <Badge
                        variant={b.paymentState === 'balance_overdue' ? 'default' : 'highlight'}
                        data-testid={`booking-payment-state-${b.paymentState}`}
                      >
                        {t(`paymentState.${b.paymentState}`)}
                      </Badge>
                    )}
                    {b.paidInFull && (
                      <Badge variant="highlight" data-testid="booking-paid-in-full">
                        {t('paidInFull')}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end justify-between gap-4">
                  <div className="space-y-2 text-sm text-muted">
                    <p>
                      <span className="font-medium text-navy">{t('date')}:</span> {b.date}
                    </p>
                    <p>
                      <span className="font-medium text-navy">{t('periodLabel')}:</span>{' '}
                      {t(`period.${b.period}`)}
                    </p>
                    {b.startAtLocal && b.endAtLocal && (
                      <p data-testid="booking-local-times">
                        <span className="font-medium text-navy">{t('localTimes')}:</span>{' '}
                        {b.startAtLocal} – {b.endAtLocal} ({b.timeZone})
                      </p>
                    )}
                    <p>
                      <span className="font-medium text-navy">{t('guests')}:</span> {b.guestsCount}
                    </p>
                    {b.arrival && (
                      <div
                        className="rounded-xl border border-primary/15 bg-primary-soft/40 p-3"
                        data-testid={`booking-arrival-${b.id}`}
                      >
                        <p className="font-medium text-navy">{t('arrivalTitle')}</p>
                        {b.arrival.exactAddress ? (
                          <p className="mt-1">
                            <span className="font-medium text-navy">{t('arrivalExactAddress')}:</span>{' '}
                            {b.arrival.exactAddress}
                          </p>
                        ) : null}
                        {(locale === 'ar'
                          ? b.arrival.arrivalInstructionsAr || b.arrival.arrivalInstructionsEn
                          : b.arrival.arrivalInstructionsEn || b.arrival.arrivalInstructionsAr) ? (
                          <p className="mt-1">
                            <span className="font-medium text-navy">{t('arrivalInstructions')}:</span>{' '}
                            {locale === 'ar'
                              ? b.arrival.arrivalInstructionsAr || b.arrival.arrivalInstructionsEn
                              : b.arrival.arrivalInstructionsEn || b.arrival.arrivalInstructionsAr}
                          </p>
                        ) : null}
                        <BookingExactMap
                          latitudeExact={b.arrival.latitudeExact}
                          longitudeExact={b.arrival.longitudeExact}
                          label={t('exactMapLabel')}
                          testId={`booking-exact-map-${b.id}`}
                        />
                        {b.arrival.googleMapsDirectionsUrl ? (
                          <a
                            href={b.arrival.googleMapsDirectionsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex font-medium text-primary hover:underline"
                            data-testid={`booking-maps-link-${b.id}`}
                          >
                            {t('openInGoogleMaps')}
                          </a>
                        ) : null}
                      </div>
                    )}
                    <p>
                      <span className="font-medium text-navy">{t('bookingTotal')}:</span>{' '}
                      <PriceDisplay amount={b.totalAmount} currency={b.currency} locale={locale} />
                    </p>
                    {b.depositPaidAmount != null && b.paymentCollectionMode !== 'full' && (
                      <p>
                        <span className="font-medium text-navy">{t('depositPaid')}:</span>{' '}
                        <PriceDisplay
                          amount={b.depositPaidAmount}
                          currency={b.currency}
                          locale={locale}
                        />
                      </p>
                    )}
                    {b.remainingAmount != null &&
                      b.remainingAmount > 0 &&
                      !b.isFullyPaid &&
                      b.status !== 'cancelled' &&
                      b.status !== 'expired' && (
                        <p>
                          <span className="font-medium text-navy">{t('remainingBalance')}:</span>{' '}
                          <PriceDisplay
                            amount={b.remainingAmount}
                            currency={b.currency}
                            locale={locale}
                          />
                        </p>
                      )}
                    {b.balanceDueAt && !b.isFullyPaid && b.status === 'confirmed' && (
                      <p data-testid="booking-balance-due-at">
                        <span className="font-medium text-navy">{t('balanceDueAt')}:</span>{' '}
                        {formatPlatformDateTime(b.balanceDueAt, locale, b.timeZone)}
                      </p>
                    )}
                    {b.ownerApprovalRequired && (
                      <div className="space-y-1 text-primary">
                        <p>{t('awaitingOwnerApproval')}</p>
                        {b.ownerApprovalExpiresAt && (
                          <p data-testid="customer-approval-deadline">
                            {t('responseDeadline')}:{' '}
                            {formatPlatformDateTime(b.ownerApprovalExpiresAt, locale, b.timeZone)} (
                            {t('timeRemaining')}:{' '}
                            {formatRemainingDuration(b.ownerApprovalExpiresAt, locale, now)})
                          </p>
                        )}
                      </div>
                    )}
                    {b.ownerDecisionState === 'expired' && (
                      <div className="space-y-2">
                        <p className="text-muted">{t('ownerDidNotRespond')}</p>
                        <p className="text-muted">{t('noPaymentTaken')}</p>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/properties/${b.propertySlug}`}>{t('browseAgain')}</Link>
                        </Button>
                      </div>
                    )}
                    {b.ownerDecisionState === 'accepted' && b.status === 'pending_payment' && (
                      <p className="text-primary">{t('acceptedPayDeposit')}</p>
                    )}
                    {b.ownerRejectionReason && (
                      <p>
                        <span className="font-medium text-navy">{t('ownerRejectionReason')}:</span>{' '}
                        {b.ownerRejectionReason}
                      </p>
                    )}
                    {policy && b.status !== 'cancelled' && (
                      <div className="rounded-xl border border-primary/10 bg-primary-soft/20 p-3 text-xs">
                        <p className="font-medium text-navy">{t('cancellationPolicy')}</p>
                        <p className="mt-1">{policySummaryText(t, policy)}</p>
                        {policy.canCancel &&
                          policy.refundableAmount != null &&
                          policy.refundableAmount > 0 && (
                            <p className="mt-2 text-navy">
                              {t('expectedRefund')}:{' '}
                              <PriceDisplay
                                amount={policy.refundableAmount}
                                currency={b.currency}
                                locale={locale}
                              />
                            </p>
                          )}
                        {policy.canCancel &&
                          (policy.refundableAmount == null || policy.refundableAmount === 0) && (
                            <p className="mt-2">{t('noRefundExpected')}</p>
                          )}
                        {!policy.canCancel && policy.reason && (
                          <p className="mt-2 text-danger">{policy.reason}</p>
                        )}
                        {b.paidInFull && (
                          <p className="mt-2 text-muted">{t('refundNote')}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    {b.canRebook && (
                      <Button asChild size="sm" className="shadow-soft" data-testid={`book-again-${b.id}`}>
                        <Link
                          href={`/properties/${b.propertySlug}?rebook=${b.id}&guests=${b.guestsCount}`}
                        >
                          {t('bookAgain')}
                        </Link>
                      </Button>
                    )}
                    {b.canPayDeposit && (
                      <Button asChild size="sm" className="shadow-soft" data-testid="pay-deposit">
                        <Link href={`/checkout/${b.id}`}>{t('payDeposit')}</Link>
                      </Button>
                    )}
                    {b.canPayBalance && (
                      <Button asChild size="sm" className="shadow-soft" data-testid="pay-balance">
                        <Link href={`/checkout/${b.id}`}>{t('payBalance')}</Link>
                      </Button>
                    )}
                    {b.paymentCollectionMode === 'full' && b.status === 'pending_payment' && (
                      <Button asChild size="sm" className="shadow-soft">
                        <Link href={`/checkout/${b.id}`}>{t('payDeposit')}</Link>
                      </Button>
                    )}
                    {canCancelBooking(b) && (
                      <Button
                        data-testid="booking-cancel"
                        variant="outline"
                        size="sm"
                        disabled={cancellingId === b.id}
                        onClick={() => void handleCancel(b.id)}
                        className="gap-1 text-danger hover:border-danger/30 hover:bg-danger/5"
                      >
                        {cancellingId === b.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        {t('cancel')}
                      </Button>
                    )}
                    {b.canRequestRefund && (
                      <div className="w-full max-w-sm space-y-2 rounded-xl border border-primary/10 p-3">
                        <p className="text-xs font-medium text-navy">{t('requestRefundTitle')}</p>
                        {policy?.refundableAmount != null && (
                          <p className="text-xs text-muted">
                            {t('expectedRefund')}:{' '}
                            <PriceDisplay
                              amount={policy.refundableAmount}
                              currency={b.currency}
                              locale={locale}
                            />
                          </p>
                        )}
                        <Input
                          data-testid={`refund-reason-${b.id}`}
                          placeholder={t('refundReasonPlaceholder')}
                          value={refundReason[b.id] ?? ''}
                          onChange={(e) =>
                            setRefundReason((r) => ({ ...r, [b.id]: e.target.value }))
                          }
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`refund-request-${b.id}`}
                          disabled={actionBusy === b.id}
                          className="gap-1"
                          onClick={() => void handleRefundRequest(b)}
                        >
                          <RotateCcw className="h-4 w-4" />
                          {t('requestRefund')}
                        </Button>
                      </div>
                    )}
                    {b.refundRequest && (
                      <Badge variant="muted" data-testid={`refund-status-${b.id}`}>
                        {t(`refundRequestStatus.${b.refundRequest.status}`)}
                      </Badge>
                    )}
                    {b.canOpenDispute && (
                      <div className="w-full max-w-sm space-y-2 rounded-xl border border-primary/10 p-3">
                        <p className="text-xs font-medium text-navy">{t('openDisputeTitle')}</p>
                        <select
                          data-testid={`dispute-type-${b.id}`}
                          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                          value={disputeForm[b.id]?.type ?? 'property_mismatch'}
                          onChange={(e) =>
                            setDisputeForm((f) => ({
                              ...f,
                              [b.id]: {
                                type: e.target.value as DisputeType,
                                description: f[b.id]?.description ?? '',
                              },
                            }))
                          }
                        >
                          {DISPUTE_TYPES.map((dt) => (
                            <option key={dt} value={dt}>
                              {t(`disputeType.${dt}`)}
                            </option>
                          ))}
                        </select>
                        <Input
                          data-testid={`dispute-desc-${b.id}`}
                          placeholder={t('disputeDescPlaceholder')}
                          value={disputeForm[b.id]?.description ?? ''}
                          onChange={(e) =>
                            setDisputeForm((f) => ({
                              ...f,
                              [b.id]: {
                                type: f[b.id]?.type ?? 'property_mismatch',
                                description: e.target.value,
                              },
                            }))
                          }
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`dispute-open-${b.id}`}
                          disabled={actionBusy === `dispute-${b.id}`}
                          className="gap-1"
                          onClick={() => void handleOpenDispute(b)}
                        >
                          <MessageSquareWarning className="h-4 w-4" />
                          {t('openDispute')}
                        </Button>
                      </div>
                    )}
                    <BookingSupportForm
                      bookingId={b.id}
                      bookingPublicCode={b.publicCode}
                      tickets={supportTickets.filter((ticket) => ticket.bookingId === b.id)}
                      onSubmitted={refreshSupportTickets}
                    />
                  </div>
                </CardContent>
                <div className="px-6 pb-4">
                  <BookingReviewForm booking={b} onSubmitted={load} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
