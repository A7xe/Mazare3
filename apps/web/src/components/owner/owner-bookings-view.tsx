'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { Calendar, Loader2 } from 'lucide-react';
import type { OwnerBookingRow, OwnerInboxTab } from '@mazare3/shared';
import { OWNER_INBOX_TABS, ownerInboxTabMatches } from '@mazare3/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchOwnerBookings, acceptOwnerBooking, rejectOwnerBooking, OwnerApiError } from '@/lib/api-owner';
import { formatPlatformDateTime, formatRemainingDuration } from '@/lib/format-platform-time';
import { PriceDisplay } from '@/components/marketplace/price-display';
import { cn } from '@/lib/utils';

const POLL_MS = 20_000;

function isInboxTab(value: string | null): value is OwnerInboxTab {
  return OWNER_INBOX_TABS.includes(value as OwnerInboxTab);
}

export function OwnerBookingsView() {
  const t = useTranslations('owner');
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
                      {b.status === 'confirmed' && (
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
