'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { Calendar, CalendarClock, KeyRound, Loader2, UserX, XCircle } from 'lucide-react';
import type { OwnerBookingRow, OwnerInboxTab, OwnerCancellationReasonCode } from '@mazare3/shared';
import {
  CUSTOMER_NO_SHOW_GRACE_MINUTES,
  isCustomerNoShowEligible,
  OWNER_CANCELLATION_REASONS,
  OWNER_INBOX_TABS,
  ownerInboxTabMatches,
  resolveBookingPeriodStart,
  resolveCheckInWindow,
} from '@mazare3/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchOwnerBookings,
  fetchOwnerBookingListingSnapshot,
  acceptOwnerBooking,
  rejectOwnerBooking,
  previewOwnerCancel,
  cancelOwnerBooking,
  verifyOwnerCheckIn,
  reportCustomerNoShowOwner,
  requestOwnerReschedule,
  respondToOwnerReschedule,
  OwnerApiError,
} from '@/lib/api-owner';
import { formatPlatformDateTime, formatRemainingDuration } from '@/lib/format-platform-time';
import { PriceDisplay } from '@/components/marketplace/price-display';
import {
  RescheduleSlotPicker,
  type RescheduleSlotSelection,
} from '@/components/bookings/reschedule-slot-picker';
import {
  BookingListingSnapshotPanel,
  type ListingSnapshotApiResult,
} from '@/components/bookings/booking-listing-snapshot-panel';
import { cn } from '@/lib/utils';

const POLL_MS = 20_000;

function isInboxTab(value: string | null): value is OwnerInboxTab {
  return OWNER_INBOX_TABS.includes(value as OwnerInboxTab);
}

function isConfirmedUpcoming(b: OwnerBookingRow): boolean {
  if (b.status !== 'confirmed' || (b.inboxGroup ?? 'closed') !== 'upcoming') return false;
  // Phase 3C.4E.4C — completed / terminal visits are not pending attendance.
  if (
    b.visitOutcome === 'completed' ||
    b.visitLifecycleDisplayKey === 'completed' ||
    b.visitOutcome === 'customer_no_show' ||
    b.visitOutcome === 'owner_no_show' ||
    b.visitOutcome === 'access_denied' ||
    b.visitOutcome === 'force_majeure' ||
    b.visitOutcome === 'resolved_other'
  ) {
    return false;
  }
  return true;
}

function bookingPeriodStart(b: OwnerBookingRow): Date {
  return resolveBookingPeriodStart(
    b.startAtLocal ? new Date(b.startAtLocal) : null,
    new Date(`${b.date.slice(0, 10)}T12:00:00`),
  );
}

function canVerifyCheckIn(b: OwnerBookingRow, now: Date): boolean {
  if (!isConfirmedUpcoming(b)) return false;
  const window = resolveCheckInWindow(bookingPeriodStart(b), now);
  return window.status === 'available';
}

function canReportNoShow(b: OwnerBookingRow, now: Date): boolean {
  if (!isConfirmedUpcoming(b)) return false;
  return isCustomerNoShowEligible({
    bookingStartAt: bookingPeriodStart(b),
    checkInVerified: false,
    graceMinutes: CUSTOMER_NO_SHOW_GRACE_MINUTES,
    now,
  });
}

export function OwnerBookingsView() {
  const t = useTranslations('owner');
  const tSnap = useTranslations('bookingListingSnapshot');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();
  const searchParams = useSearchParams();
  const inboxParam = searchParams.get('inbox');
  const focusId = searchParams.get('focus');
  const tab: OwnerInboxTab = isInboxTab(inboxParam) ? inboxParam : 'action';

  const [bookings, setBookings] = useState<OwnerBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [cancelReason, setCancelReason] = useState<Record<string, OwnerCancellationReasonCode>>({});
  const [cancelPreview, setCancelPreview] = useState<
    Record<
      string,
      { customerRefund: number; ownerPayout: number; ownerPenaltyJod: number; forceMajeure: boolean }
    >
  >({});
  const [checkInPin, setCheckInPin] = useState<Record<string, string>>({});
  const [noShowEvidence, setNoShowEvidence] = useState<Record<string, string>>({});
  const [rescheduleSelection, setRescheduleSelection] = useState<
    Record<string, RescheduleSlotSelection | null>
  >({});
  const [proposeOpen, setProposeOpen] = useState<Record<string, boolean>>({});
  const [listingSnapshots, setListingSnapshots] = useState<
    Record<string, ListingSnapshotApiResult | 'loading' | 'error'>
  >({});

  const reload = useCallback(async (silent = false) => {
    if (!silent) setError(null);
    try {
      const res = await fetchOwnerBookings();
      setBookings(res.data);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reload(false);
  }, [reload]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (document.visibilityState !== 'visible' || cancelled) return;
      await reload(true);
    };
    const id = setInterval(() => void poll(), POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reload]);

  useEffect(() => {
    if (!focusId) return;
    const el = document.querySelector(`[data-booking-id="${focusId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusId, bookings, tab]);

  const counts = useMemo(() => {
    const c = { action: 0, waiting: 0, upcoming: 0, history: 0 };
    for (const b of bookings) {
      const g = b.inboxGroup ?? 'closed';
      if (g === 'needs_action') c.action++;
      else if (g === 'waiting_payment') c.waiting++;
      else if (g === 'upcoming') c.upcoming++;
      else c.history++;
    }
    return c;
  }, [bookings]);

  const visible = useMemo(() => {
    const rows = bookings.filter((b) => ownerInboxTabMatches(tab, b.inboxGroup ?? 'closed'));
    return rows.sort((a, b) => {
      if (tab === 'action') {
        const ae = a.ownerApprovalExpiresAt ?? '';
        const be = b.ownerApprovalExpiresAt ?? '';
        return ae.localeCompare(be);
      }
      return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
    });
  }, [bookings, tab]);

  function setTab(next: OwnerInboxTab) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('inbox', next);
    router.replace(`/owner/bookings?${sp.toString()}`);
  }

  async function handleCancelPreview(id: string) {
    const reasonCode = cancelReason[id] ?? 'OTHER';
    setBusyId(`preview-${id}`);
    setError(null);
    try {
      const res = await previewOwnerCancel(id, reasonCode);
      setCancelPreview((p) => ({ ...p, [id]: res.data }));
    } catch (e) {
      setError(e instanceof OwnerApiError ? e.message : t('saveError'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancelConfirm(id: string) {
    const reasonCode = cancelReason[id] ?? 'OTHER';
    setBusyId(`cancel-${id}`);
    setError(null);
    try {
      await cancelOwnerBooking(id, { reasonCode });
      setCancelPreview((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
      await reload(true);
      setTab('history');
    } catch (e) {
      setError(e instanceof OwnerApiError ? e.message : t('saveError'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleVerifyCheckIn(id: string) {
    const pin = checkInPin[id]?.trim();
    if (!pin || !/^\d{6}$/.test(pin)) {
      setError(t('checkInPinInvalid'));
      return;
    }
    setBusyId(`checkin-${id}`);
    setError(null);
    try {
      await verifyOwnerCheckIn(id, pin);
      setCheckInPin((p) => ({ ...p, [id]: '' }));
    } catch (e) {
      setError(e instanceof OwnerApiError ? e.message : t('saveError'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReportNoShow(id: string) {
    setBusyId(`noshow-${id}`);
    setError(null);
    try {
      await reportCustomerNoShowOwner(id, noShowEvidence[id]?.trim() || undefined);
      setNoShowEvidence((p) => ({ ...p, [id]: '' }));
    } catch (e) {
      setError(e instanceof OwnerApiError ? e.message : t('saveError'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRespondReschedule(requestId: string, accept: boolean) {
    setBusyId(`respond-${requestId}`);
    setError(null);
    try {
      await respondToOwnerReschedule(requestId, accept);
      await reload(true);
    } catch (e) {
      setError(e instanceof OwnerApiError ? e.message : t('saveError'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleProposeReschedule(booking: OwnerBookingRow) {
    const selection = rescheduleSelection[booking.id];
    if (!selection?.slotId) {
      setError(t('rescheduleSlotRequired'));
      return;
    }
    setBusyId(`reschedule-${booking.id}`);
    setError(null);
    try {
      await requestOwnerReschedule(booking.id, selection.slotId);
      setRescheduleSelection((r) => ({ ...r, [booking.id]: null }));
      setProposeOpen((p) => ({ ...p, [booking.id]: false }));
      await reload(true);
    } catch (e) {
      setError(e instanceof OwnerApiError ? e.message : t('rescheduleError'));
    } finally {
      setBusyId(null);
    }
  }

  async function decide(id: string, action: 'accept' | 'reject') {
    setBusyId(id);
    setError(null);
    try {
      if (action === 'accept') await acceptOwnerBooking(id);
      else await rejectOwnerBooking(id);
      await reload(true);
      if (action === 'accept') setTab('waiting');
      else setTab('history');
    } catch (e) {
      setError(e instanceof OwnerApiError ? e.message : t('saveError'));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tabs: { id: OwnerInboxTab; label: string; count: number }[] = [
    { id: 'action', label: t('inboxTabAction'), count: counts.action },
    { id: 'waiting', label: t('inboxTabWaiting'), count: counts.waiting },
    { id: 'upcoming', label: t('inboxTabUpcoming'), count: counts.upcoming },
    { id: 'history', label: t('inboxTabHistory'), count: counts.history },
  ];

  return (
    <div data-testid="owner-booking-inbox" className="space-y-4 overflow-x-hidden">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`owner-inbox-tab-${item.id}`}
            onClick={() => setTab(item.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors',
              tab === item.id
                ? 'bg-primary text-primary-foreground shadow-soft'
                : 'bg-primary-soft text-navy ring-1 ring-primary/15',
            )}
          >
            {item.label}
            <span
              data-testid={`owner-inbox-count-${item.id}`}
              className={cn(
                'min-w-5 rounded-full px-1.5 text-xs',
                tab === item.id ? 'bg-white/20' : 'bg-primary/10 text-primary',
              )}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <Card className="glass-panel rounded-3xl border-primary/12">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <Calendar className="h-10 w-10 text-primary/40" />
            <p className="mt-3 text-base font-medium text-navy">{t(`inboxEmpty.${tab}`)}</p>
          </CardContent>
        </Card>
      ) : (
        <div data-testid="owner-bookings-list" className="space-y-3">
          {visible.map((b) => {
            const title = locale === 'ar' ? b.propertyTitleAr : b.propertyTitleEn;
            const focused = focusId === b.id;
            const urgent = b.status === 'pending_owner_approval';
            const cancelPreviewInfo = cancelPreview[b.id];
            return (
              <Card
                key={b.id}
                data-booking-id={b.id}
                data-testid={`owner-booking-card-${b.id}`}
                data-inbox-group={b.inboxGroup}
                className={cn(
                  'overflow-hidden rounded-2xl border-primary/12',
                  focused && 'ring-2 ring-primary',
                  urgent && 'border-primary/30',
                )}
              >
                <div className="gradient-primary h-1" />
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-navy">{title}</p>
                      {b.customerName && (
                        <p className="text-sm text-muted">{b.customerName}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant={urgent ? 'highlight' : b.status === 'confirmed' ? 'default' : 'muted'}
                        data-testid={`owner-booking-status-${b.status}`}
                      >
                        {b.status === 'expired' && !b.instantBookingEnabled
                          ? t('responseTimeExpired')
                          : t(`bookingStatus.${b.status}`)}
                      </Badge>
                      {b.visitLifecycleDisplayKey ? (
                        <Badge
                          variant={
                            b.visitLifecycleDisplayKey === 'completed' ||
                            b.visitOutcome === 'completed'
                              ? 'muted'
                              : 'default'
                          }
                          data-testid={`owner-booking-visit-lifecycle-${b.visitLifecycleDisplayKey}`}
                        >
                          {t(`visitLifecycle.${b.visitLifecycleDisplayKey}` as never)}
                        </Badge>
                      ) : null}
                      {b.status === 'confirmed' &&
                        b.visitLifecycleDisplayKey !== 'completed' &&
                        b.visitOutcome !== 'completed' && (
                        <Badge variant="highlight">{t('depositPaidChip')}</Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-muted sm:grid-cols-3">
                    <p>
                      <span className="font-medium text-navy">{t('date')}</span> {b.date}
                    </p>
                    <p>
                      <span className="font-medium text-navy">{t('periodLabel')}</span>{' '}
                      {t(`period.${b.period}`)}
                    </p>
                    <p>
                      <span className="font-medium text-navy">{t('guests')}</span> {b.guestsCount}
                    </p>
                    {(b.startAtLocal || b.endAtLocal) && (
                      <p className="col-span-2 sm:col-span-3">
                        <span className="font-medium text-navy">{t('localTimes')}</span>{' '}
                        {b.startAtLocal} – {b.endAtLocal}
                      </p>
                    )}
                    <p>
                      <span className="font-medium text-navy">{t('bookingTotal')}</span>{' '}
                      <PriceDisplay amount={b.totalAmount} currency={b.currency} locale={locale} />
                    </p>
                    {b.depositAmount != null && (
                      <p>
                        <span className="font-medium text-navy">{t('expectedDeposit')}</span>{' '}
                        <PriceDisplay amount={b.depositAmount} currency={b.currency} locale={locale} />
                      </p>
                    )}
                  </div>

                  {urgent && b.ownerApprovalExpiresAt && (
                    <p
                      data-testid="owner-approval-deadline"
                      className="rounded-xl bg-primary-soft px-3 py-2 text-sm font-semibold text-primary"
                    >
                      {formatRemainingDuration(b.ownerApprovalExpiresAt, locale, now)} ·{' '}
                      {formatPlatformDateTime(b.ownerApprovalExpiresAt, locale)}
                    </p>
                  )}

                  {b.status === 'pending_payment' && (
                    <p className="text-sm font-medium text-primary">{t('waitingCustomerDeposit')}</p>
                  )}

                  <div className="space-y-2">
                    {listingSnapshots[b.id] === undefined ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9"
                        data-testid={`owner-listing-snapshot-btn-${b.id}`}
                        onClick={() => {
                          setListingSnapshots((prev) => ({ ...prev, [b.id]: 'loading' }));
                          void fetchOwnerBookingListingSnapshot(b.id)
                            .then((res) => {
                              setListingSnapshots((prev) => ({ ...prev, [b.id]: res.data }));
                            })
                            .catch(() => {
                              setListingSnapshots((prev) => ({ ...prev, [b.id]: 'error' }));
                            });
                        }}
                      >
                        {tSnap('title')}
                      </Button>
                    ) : (
                      <BookingListingSnapshotPanel
                        data={listingSnapshots[b.id]}
                        testId={`owner-listing-snapshot-${b.id}`}
                      />
                    )}
                  </div>

                  {b.canAccept && b.canReject && (
                    <div className="flex gap-2">
                      <Button
                        className="h-11 min-h-11 flex-1 shadow-soft"
                        data-testid={`owner-accept-${b.id}`}
                        disabled={busyId === b.id}
                        onClick={() => void decide(b.id, 'accept')}
                      >
                        {busyId === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : t('acceptRequest')}
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 min-h-11 flex-1"
                        data-testid={`owner-reject-${b.id}`}
                        disabled={busyId === b.id}
                        onClick={() => void decide(b.id, 'reject')}
                      >
                        {t('rejectRequest')}
                      </Button>
                    </div>
                  )}

                  {isConfirmedUpcoming(b) && (
                    <div
                      className="space-y-3 rounded-xl border border-primary/10 p-3"
                      data-testid={`owner-phase2-${b.id}`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        {t('phase2Title')}
                      </p>

                      {b.pendingReschedule && (
                        <div
                          className="space-y-2 rounded-lg border border-primary/15 bg-primary-soft/20 p-3"
                          data-testid={`owner-pending-reschedule-${b.id}`}
                        >
                          <p className="text-sm font-semibold text-navy">
                            {t('pendingRescheduleTitle')}
                          </p>
                          <p className="text-xs text-muted">
                            {t('rescheduleRequestedBy')}: {b.pendingReschedule.requestedBy} ·{' '}
                            {t(`rescheduleStatus.${b.pendingReschedule.status}` as never)}
                          </p>
                          {b.pendingReschedule.expiresAt && (
                            <p className="text-xs text-muted">
                              {t('rescheduleExpiresAt')}:{' '}
                              {formatPlatformDateTime(b.pendingReschedule.expiresAt, locale)}
                            </p>
                          )}
                          <div className="grid gap-1 text-xs text-navy sm:grid-cols-2">
                            <p>
                              {t('rescheduleFrom')}: {b.pendingReschedule.fromSlot.date} ·{' '}
                              {t(`period.${b.pendingReschedule.fromSlot.period}`)}
                            </p>
                            <p>
                              {t('rescheduleTo')}: {b.pendingReschedule.toSlot.date} ·{' '}
                              {t(`period.${b.pendingReschedule.toSlot.period}`)}
                            </p>
                            <p>
                              {t('reschedulePriceDelta')}:{' '}
                              <PriceDisplay
                                amount={b.pendingReschedule.customerPayableDelta}
                                currency={b.currency}
                                locale={locale}
                              />
                            </p>
                            {b.pendingReschedule.ownerAbsorbsAmount > 0 && (
                              <p>
                                {t('rescheduleOwnerAbsorbs')}:{' '}
                                <PriceDisplay
                                  amount={b.pendingReschedule.ownerAbsorbsAmount}
                                  currency={b.currency}
                                  locale={locale}
                                />
                              </p>
                            )}
                          </div>
                          {b.pendingReschedule.status === 'pending' &&
                            b.pendingReschedule.requestedBy === 'customer' && (
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  data-testid={`owner-reschedule-accept-${b.id}`}
                                  disabled={busyId === `respond-${b.pendingReschedule.id}`}
                                  onClick={() =>
                                    void handleRespondReschedule(b.pendingReschedule!.id, true)
                                  }
                                >
                                  {t('rescheduleAccept')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  data-testid={`owner-reschedule-reject-${b.id}`}
                                  disabled={busyId === `respond-${b.pendingReschedule.id}`}
                                  onClick={() =>
                                    void handleRespondReschedule(b.pendingReschedule!.id, false)
                                  }
                                >
                                  {t('rescheduleReject')}
                                </Button>
                              </div>
                            )}
                          {b.pendingReschedule.status === 'pending' &&
                            b.pendingReschedule.requestedBy !== 'customer' && (
                              <p className="text-xs font-medium text-muted">
                                {t('rescheduleWaitingCustomer')}
                              </p>
                            )}
                          {b.pendingReschedule.status === 'accepted_pending_payment' && (
                            <p className="text-xs font-medium text-primary">
                              {t('rescheduleWaitingPayment')}
                            </p>
                          )}
                        </div>
                      )}

                      {!b.pendingReschedule && (
                        <div className="space-y-2 border-t border-primary/10 pt-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-navy">
                              {t('proposeRescheduleTitle')}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              data-testid={`owner-reschedule-toggle-${b.id}`}
                              onClick={() =>
                                setProposeOpen((p) => ({ ...p, [b.id]: !p[b.id] }))
                              }
                            >
                              <CalendarClock className="h-4 w-4" />
                              {proposeOpen[b.id]
                                ? t('proposeRescheduleHide')
                                : t('proposeRescheduleShow')}
                            </Button>
                          </div>
                          {proposeOpen[b.id] && (
                            <>
                              <RescheduleSlotPicker
                                bookingId={b.id}
                                propertySlug={b.propertySlug}
                                currentDate={b.date}
                                currentPeriod={b.period}
                                currentMerchantValue={b.totalAmount}
                                locale={locale}
                                initiatedBy="owner"
                                currency={b.currency}
                                testIdPrefix={`owner-reschedule-picker-${b.id}`}
                                onSelect={(selection) =>
                                  setRescheduleSelection((r) => ({
                                    ...r,
                                    [b.id]: selection,
                                  }))
                                }
                              />
                              <Button
                                size="sm"
                                className="gap-1"
                                data-testid={`owner-reschedule-submit-${b.id}`}
                                disabled={
                                  busyId === `reschedule-${b.id}` ||
                                  !rescheduleSelection[b.id]?.slotId
                                }
                                onClick={() => void handleProposeReschedule(b)}
                              >
                                {busyId === `reschedule-${b.id}` ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CalendarClock className="h-4 w-4" />
                                )}
                                {t('proposeReschedule')}
                              </Button>
                            </>
                          )}
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-navy">{t('cancelBookingTitle')}</p>
                        <select
                          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                          data-testid={`owner-cancel-reason-${b.id}`}
                          value={cancelReason[b.id] ?? 'OTHER'}
                          onChange={(e) =>
                            setCancelReason((r) => ({
                              ...r,
                              [b.id]: e.target.value as OwnerCancellationReasonCode,
                            }))
                          }
                        >
                          {OWNER_CANCELLATION_REASONS.map((code) => (
                            <option key={code} value={code}>
                              {t(`cancelReason.${code}`)}
                            </option>
                          ))}
                        </select>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            data-testid={`owner-cancel-preview-${b.id}`}
                            disabled={busyId === `preview-${b.id}`}
                            onClick={() => void handleCancelPreview(b.id)}
                          >
                            {busyId === `preview-${b.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            {t('cancelPreview')}
                          </Button>
                          {cancelPreviewInfo && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-danger hover:border-danger/30 hover:bg-danger/5"
                              data-testid={`owner-cancel-confirm-${b.id}`}
                              disabled={busyId === `cancel-${b.id}`}
                              onClick={() => void handleCancelConfirm(b.id)}
                            >
                              {busyId === `cancel-${b.id}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                              {t('cancelConfirm')}
                            </Button>
                          )}
                        </div>
                        {cancelPreviewInfo && (
                          <div
                            className="rounded-lg bg-primary-soft/30 px-3 py-2 text-xs text-navy"
                            data-testid={`owner-cancel-preview-result-${b.id}`}
                          >
                            <p>
                              {t('cancelPreviewCustomerRefund')}:{' '}
                              <PriceDisplay
                                amount={cancelPreviewInfo.customerRefund}
                                currency={b.currency}
                                locale={locale}
                              />
                            </p>
                            <p>
                              {t('cancelPreviewOwnerPayout')}:{' '}
                              <PriceDisplay
                                amount={cancelPreviewInfo.ownerPayout}
                                currency={b.currency}
                                locale={locale}
                              />
                            </p>
                            <p>
                              {t('cancelPreviewOwnerPenalty')}:{' '}
                              <PriceDisplay
                                amount={cancelPreviewInfo.ownerPenaltyJod}
                                currency={b.currency}
                                locale={locale}
                              />
                            </p>
                          </div>
                        )}
                      </div>

                      {canVerifyCheckIn(b, now) && (
                        <div className="space-y-2 border-t border-primary/10 pt-3">
                          <p className="text-sm font-medium text-navy">{t('verifyCheckInTitle')}</p>
                          <Input
                            inputMode="numeric"
                            maxLength={6}
                            placeholder={t('checkInPinPlaceholder')}
                            data-testid={`owner-checkin-pin-${b.id}`}
                            value={checkInPin[b.id] ?? ''}
                            onChange={(e) =>
                              setCheckInPin((p) => ({
                                ...p,
                                [b.id]: e.target.value.replace(/\D/g, '').slice(0, 6),
                              }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            data-testid={`owner-checkin-verify-${b.id}`}
                            disabled={busyId === `checkin-${b.id}`}
                            onClick={() => void handleVerifyCheckIn(b.id)}
                          >
                            {busyId === `checkin-${b.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <KeyRound className="h-4 w-4" />
                            )}
                            {t('verifyCheckIn')}
                          </Button>
                        </div>
                      )}

                      {canReportNoShow(b, now) && (
                        <div className="space-y-2 border-t border-primary/10 pt-3">
                          <p className="text-sm font-medium text-navy">{t('reportNoShowTitle')}</p>
                          <p className="text-[11px] text-muted-foreground">{t('reportNoShowReviewNote')}</p>
                          <Input
                            placeholder={t('noShowEvidencePlaceholder')}
                            data-testid={`owner-noshow-evidence-${b.id}`}
                            value={noShowEvidence[b.id] ?? ''}
                            onChange={(e) =>
                              setNoShowEvidence((p) => ({ ...p, [b.id]: e.target.value }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            data-testid={`owner-noshow-report-${b.id}`}
                            disabled={busyId === `noshow-${b.id}`}
                            onClick={() => void handleReportNoShow(b.id)}
                          >
                            {busyId === `noshow-${b.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserX className="h-4 w-4" />
                            )}
                            {t('reportNoShow')}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
