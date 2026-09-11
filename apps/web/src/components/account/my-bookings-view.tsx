'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import {
  Calendar,
  Clock,
  Eye,
  Headphones,
  Loader2,
  MapPin,
  MessageSquare,
  MessageSquareWarning,
  Plane,
  RotateCcw,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import type { CancellationPolicyView, DisputeType, PublicBookingSummary, SupportTicketSummary } from '@mazare3/shared';
import { DISPUTE_TYPES } from '@mazare3/shared';
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
import { fetchDiscovery, fetchPropertyBySlug } from '@/lib/api-properties';
import { PriceDisplay } from '@/components/marketplace/price-display';
import { formatPlatformDateTime, formatRemainingDuration } from '@/lib/format-platform-time';
import { BookingReviewForm } from '@/components/account/booking-review-form';
import { BookingExactMap } from '@/components/maps/booking-exact-map';
import { BookingSupportForm } from '@/components/account/booking-support-form';
import { FavoriteButton } from '@/components/favorites/favorite-button';
import { cn } from '@/lib/utils';

type BookingTab = 'upcoming' | 'previous' | 'canceled';

type PropertyMeta = { id: string; imageUrl?: string };

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

function bookingEndMs(b: PublicBookingSummary): number {
  if (b.bookingEndAt) return new Date(b.bookingEndAt).getTime();
  const day = b.date?.slice(0, 10);
  if (day) return new Date(`${day}T23:59:59.999`).getTime();
  return 0;
}

function bookingBucket(b: PublicBookingSummary, now: Date): BookingTab {
  if (b.status === 'cancelled') return 'canceled';
  if (b.status === 'expired') return 'previous';
  if (b.status === 'confirmed' && bookingEndMs(b) < now.getTime()) return 'previous';
  return 'upcoming';
}

function parseDisplayDate(isoOrDate: string | null | undefined, fallbackDate: string): Date {
  if (isoOrDate) {
    const d = new Date(isoOrDate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const day = fallbackDate?.slice(0, 10);
  if (day) return new Date(`${day}T12:00:00`);
  return new Date();
}

function formatDayParts(date: Date, locale: 'ar' | 'en') {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const weekday = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-JO' : 'en-GB', {
    weekday: 'long',
    numberingSystem: 'latn',
  }).format(date);
  return { ymd: `${y}/${m}/${day}`, weekday };
}

function badgeLabelKey(tab: BookingTab): 'badgeUpcoming' | 'badgeCompleted' | 'badgeCanceled' {
  if (tab === 'upcoming') return 'badgeUpcoming';
  if (tab === 'previous') return 'badgeCompleted';
  return 'badgeCanceled';
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
  const [activeTab, setActiveTab] = useState<BookingTab>('upcoming');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [propertyMeta, setPropertyMeta] = useState<Record<string, PropertyMeta>>({});
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

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
      router.push('/auth?returnUrl=' + encodeURIComponent('/account/bookings'));
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

  useEffect(() => {
    if (bookings.length === 0) return;
    let cancelled = false;

    async function resolvePropertyMeta() {
      const slugs = [...new Set(bookings.map((b) => b.propertySlug).filter(Boolean))];
      const next: Record<string, PropertyMeta> = {};

      try {
        const discovery = await fetchDiscovery();
        for (const section of discovery.sections ?? []) {
          for (const p of section.properties ?? []) {
            if (p.slug) next[p.slug] = { id: p.id, imageUrl: p.imageUrl };
          }
        }
      } catch {
        /* discovery optional */
      }

      const missing = slugs.filter((slug) => !next[slug]?.id);
      await Promise.all(
        missing.map(async (slug) => {
          try {
            const { property } = await fetchPropertyBySlug(slug);
            next[slug] = {
              id: property.id,
              imageUrl: property.imageUrl,
            };
          } catch {
            /* placeholder OK */
          }
        }),
      );

      if (!cancelled) setPropertyMeta(next);
    }

    void resolvePropertyMeta();
    return () => {
      cancelled = true;
    };
  }, [bookings]);

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

  const bucketed = useMemo(() => {
    const upcoming: PublicBookingSummary[] = [];
    const previous: PublicBookingSummary[] = [];
    const canceled: PublicBookingSummary[] = [];
    for (const b of bookings) {
      const tab = bookingBucket(b, now);
      if (tab === 'upcoming') upcoming.push(b);
      else if (tab === 'previous') previous.push(b);
      else canceled.push(b);
    }
    const byStart = (a: PublicBookingSummary, b: PublicBookingSummary) => {
      const aStart = a.bookingStartAt ? new Date(a.bookingStartAt).getTime() : new Date(a.date).getTime();
      const bStart = b.bookingStartAt ? new Date(b.bookingStartAt).getTime() : new Date(b.date).getTime();
      return aStart - bStart;
    };
    upcoming.sort(byStart);
    previous.sort((a, b) => bookingEndMs(b) - bookingEndMs(a));
    canceled.sort((a, b) => bookingEndMs(b) - bookingEndMs(a));
    return { upcoming, previous, canceled };
  }, [bookings, now]);

  const visibleBookings =
    activeTab === 'upcoming'
      ? bucketed.upcoming
      : activeTab === 'previous'
        ? bucketed.previous
        : bucketed.canceled;

  const nextTrip = bucketed.upcoming[0] ?? null;

  function toggleExpanded(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  function focusBooking(id: string) {
    setActiveTab('upcoming');
    setExpandedId(id);
    requestAnimationFrame(() => {
      cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const tabs: { id: BookingTab; label: string; icon: typeof Calendar }[] = [
    { id: 'upcoming', label: t('tabUpcoming'), icon: Calendar },
    { id: 'previous', label: t('tabPrevious'), icon: Clock },
    { id: 'canceled', label: t('tabCanceled'), icon: XCircle },
  ];

  const tabEmptyKey =
    activeTab === 'upcoming'
      ? 'tabEmptyUpcoming'
      : activeTab === 'previous'
        ? 'tabEmptyPrevious'
        : 'tabEmptyCanceled';

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-muted" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>{tCommon('loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10" data-testid="my-bookings" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <header>
        <div className="flex items-center gap-2.5">
          <Calendar className="h-7 w-7 shrink-0 text-[#2F6EF6]" strokeWidth={1.75} aria-hidden />
          <h1 className="text-[28px] font-bold tracking-tight text-[#2F6EF6] sm:text-[32px]">
            {t('title')}
          </h1>
        </div>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[#7A879B] sm:text-sm">
          {t('subtitle')}
        </p>
      </header>

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {bookings.length === 0 ? (
        <div className="rounded-2xl border border-[#E4EAF3] bg-white px-6 py-16 text-center shadow-[0_2px_14px_rgba(35,72,120,.05)]">
          <Calendar className="mx-auto h-12 w-12 text-[#2F6EF6]/50" />
          <p className="mt-4 text-lg font-medium text-[#0D2046]">{t('emptyTitle')}</p>
          <p className="mt-2 text-sm text-[#6B7A90]">{t('emptyHint')}</p>
          <Button asChild className="mt-6 shadow-soft">
            <Link href="/search">{tCommon('search')}</Link>
          </Button>
        </div>
      ) : (
        <>
          <div
            className="flex gap-6 border-b border-[#E4EAF3] sm:gap-8"
            role="tablist"
            aria-label={t('title')}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'relative inline-flex items-center gap-2 pb-3 text-[14px] font-semibold transition',
                    active ? 'text-[#2F6EF6]' : 'text-[#8A96A8] hover:text-[#0D2046]',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {tab.label}
                  {active ? (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#2F6EF6]" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start lg:gap-7">
            <div className="min-w-0 space-y-4">
              {visibleBookings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D5DEEB] bg-white px-6 py-14 text-center">
                  <p className="text-sm font-medium text-[#6B7A90]">{t(tabEmptyKey)}</p>
                </div>
              ) : (
                visibleBookings.map((b) => {
                  const title = locale === 'ar' ? b.propertyTitleAr : b.propertyTitleEn;
                  const policy = b.cancellationPolicy;
                  const tab = bookingBucket(b, now);
                  const meta = propertyMeta[b.propertySlug];
                  const expanded = expandedId === b.id;
                  const checkIn = formatDayParts(
                    parseDisplayDate(b.bookingStartAt, b.date),
                    locale,
                  );
                  const checkOut = formatDayParts(
                    parseDisplayDate(b.bookingEndAt, b.date),
                    locale,
                  );
                  const badgeKey = badgeLabelKey(tab);

                  return (
                    <article
                      key={b.id}
                      ref={(el) => {
                        cardRefs.current[b.id] = el;
                      }}
                      id={`booking-card-${b.id}`}
                      className="overflow-hidden rounded-[18px] border border-[#E8EEF6] bg-white shadow-[0_8px_28px_-18px_rgba(13,32,70,.45)]"
                      data-testid="booking-card"
                    >
                      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:gap-5">
                        {/* Image — right in RTL */}
                        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-2xl bg-[#EAF2FF] lg:aspect-auto lg:h-[200px] lg:w-[240px]">
                          {meta?.imageUrl ? (
                            <Image
                              src={meta.imageUrl}
                              alt={title}
                              fill
                              className="object-cover"
                              sizes="(max-width: 1024px) 100vw, 240px"
                            />
                          ) : (
                            <span className="flex h-full min-h-[160px] items-center justify-center p-4 text-center text-sm font-semibold text-[#0D2046] lg:min-h-0">
                              {title}
                            </span>
                          )}
                          {meta?.id ? (
                            <div className="absolute start-3 top-3 z-10">
                              <FavoriteButton propertyId={meta.id} variant="favorites" />
                            </div>
                          ) : null}
                        </div>

                        {/* Content */}
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h2 className="text-[17px] font-bold leading-snug sm:text-[18px]">
                                <Link
                                  href={`/properties/${b.propertySlug}`}
                                  className="text-[#2F6EF6] hover:underline"
                                >
                                  {title}
                                </Link>
                              </h2>
                              <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[#8A96A8]">
                                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                <span className="truncate">{b.approximateLocation || '—'}</span>
                              </p>
                            </div>
                            <span
                              className={cn(
                                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
                                tab === 'upcoming' && 'bg-[#E8F8EF] text-[#16A34A]',
                                tab === 'previous' && 'bg-[#F1F4F8] text-[#64748B]',
                                tab === 'canceled' && 'bg-[#F3F4F6] text-[#94A3B8]',
                              )}
                            >
                              <span
                                className={cn(
                                  'h-1.5 w-1.5 rounded-full',
                                  tab === 'upcoming' && 'bg-[#16A34A]',
                                  tab === 'previous' && 'bg-[#94A3B8]',
                                  tab === 'canceled' && 'bg-[#CBD5E1]',
                                )}
                                aria-hidden
                              />
                              {t(badgeKey)}
                            </span>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="flex gap-2.5">
                              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF2FF] text-[#2F6EF6]">
                                <Calendar className="h-4 w-4" aria-hidden />
                              </span>
                              <div>
                                <p className="text-[11px] font-medium text-[#8A96A8]">{t('checkIn')}</p>
                                <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-[#0D2046]">
                                  {checkIn.ymd}
                                </p>
                                <p className="text-[12px] text-[#8A96A8]">{checkIn.weekday}</p>
                              </div>
                            </div>
                            <div className="flex gap-2.5">
                              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF2FF] text-[#2F6EF6]">
                                <Calendar className="h-4 w-4" aria-hidden />
                              </span>
                              <div>
                                <p className="text-[11px] font-medium text-[#8A96A8]">{t('checkOut')}</p>
                                <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-[#0D2046]">
                                  {checkOut.ymd}
                                </p>
                                <p className="text-[12px] text-[#8A96A8]">{checkOut.weekday}</p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                            <div className="inline-flex items-center gap-2 text-[13px] text-[#53637A]">
                              <Users className="h-4 w-4 text-[#8A96A8]" aria-hidden />
                              <span>
                                <span className="text-[#8A96A8]">{t('guests')}: </span>
                                {t('guestsPeople', { count: b.guestsCount })}
                              </span>
                            </div>
                            <div className="inline-flex items-center gap-2 text-[13px] text-[#0D2046]">
                              <Wallet className="h-4 w-4 text-[#8A96A8]" aria-hidden />
                              <span className="text-[#8A96A8]">{t('totalLabel')}:</span>
                              <span className="font-bold">
                                <PriceDisplay
                                  amount={b.totalAmount}
                                  currency={b.currency}
                                  locale={locale}
                                />
                              </span>
                            </div>
                          </div>

                          <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row sm:flex-wrap">
                            <Button
                              type="button"
                              size="sm"
                              className="h-10 gap-2 rounded-xl bg-[#2F6EF6] px-5 text-[13px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(47,110,246,.85)] hover:bg-[#255FE0]"
                              onClick={() => toggleExpanded(b.id)}
                              aria-expanded={expanded}
                            >
                              <Eye className="h-4 w-4" aria-hidden />
                              {expanded ? t('hideBooking') : t('viewBooking')}
                            </Button>
                            {!expanded ? (
                              <BookingSupportForm
                                bookingId={b.id}
                                bookingPublicCode={b.publicCode}
                                tickets={supportTickets.filter(
                                  (ticket) => ticket.bookingId === b.id,
                                )}
                                onSubmitted={refreshSupportTickets}
                                triggerLabel={t('contactBooking')}
                                triggerClassName="h-10 gap-2 rounded-xl border border-[#2F6EF6] bg-white px-5 text-[13px] font-semibold text-[#2F6EF6] hover:bg-[#F3F7FF]"
                              />
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {expanded ? (
                        <div className="space-y-4 border-t border-[#E4EAF3] px-4 py-4 md:px-5">
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

                          <div className="flex flex-wrap items-end justify-between gap-4">
                            <div className="space-y-2 text-sm text-muted">
                              <p className="font-mono text-xs text-muted">{b.publicCode}</p>
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
                                <span className="font-medium text-navy">{t('guests')}:</span>{' '}
                                {b.guestsCount}
                              </p>
                              {b.arrival && (
                                <div
                                  className="rounded-xl border border-primary/15 bg-primary-soft/40 p-3"
                                  data-testid={`booking-arrival-${b.id}`}
                                >
                                  <p className="font-medium text-navy">{t('arrivalTitle')}</p>
                                  {b.arrival.exactAddress ? (
                                    <p className="mt-1">
                                      <span className="font-medium text-navy">
                                        {t('arrivalExactAddress')}:
                                      </span>{' '}
                                      {b.arrival.exactAddress}
                                    </p>
                                  ) : null}
                                  {(locale === 'ar'
                                    ? b.arrival.arrivalInstructionsAr || b.arrival.arrivalInstructionsEn
                                    : b.arrival.arrivalInstructionsEn ||
                                      b.arrival.arrivalInstructionsAr) ? (
                                    <p className="mt-1">
                                      <span className="font-medium text-navy">
                                        {t('arrivalInstructions')}:
                                      </span>{' '}
                                      {locale === 'ar'
                                        ? b.arrival.arrivalInstructionsAr ||
                                          b.arrival.arrivalInstructionsEn
                                        : b.arrival.arrivalInstructionsEn ||
                                          b.arrival.arrivalInstructionsAr}
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
                                <PriceDisplay
                                  amount={b.totalAmount}
                                  currency={b.currency}
                                  locale={locale}
                                />
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
                                    <span className="font-medium text-navy">
                                      {t('remainingBalance')}:
                                    </span>{' '}
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
                                      {formatPlatformDateTime(
                                        b.ownerApprovalExpiresAt,
                                        locale,
                                        b.timeZone,
                                      )}{' '}
                                      ({t('timeRemaining')}:{' '}
                                      {formatRemainingDuration(b.ownerApprovalExpiresAt, locale, now)}
                                      )
                                    </p>
                                  )}
                                </div>
                              )}
                              {b.ownerDecisionState === 'expired' && (
                                <div className="space-y-2">
                                  <p className="text-muted">{t('ownerDidNotRespond')}</p>
                                  <p className="text-muted">{t('noPaymentTaken')}</p>
                                  <Button asChild variant="outline" size="sm">
                                    <Link href={`/properties/${b.propertySlug}`}>
                                      {t('browseAgain')}
                                    </Link>
                                  </Button>
                                </div>
                              )}
                              {b.ownerDecisionState === 'accepted' && b.status === 'pending_payment' && (
                                <p className="text-primary">{t('acceptedPayDeposit')}</p>
                              )}
                              {b.ownerRejectionReason && (
                                <p>
                                  <span className="font-medium text-navy">
                                    {t('ownerRejectionReason')}:
                                  </span>{' '}
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
                                    (policy.refundableAmount == null ||
                                      policy.refundableAmount === 0) && (
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

                            <div className="flex w-full max-w-sm flex-col items-stretch gap-3 sm:items-end">
                              {b.canRebook && (
                                <Button
                                  asChild
                                  size="sm"
                                  className="shadow-soft"
                                  data-testid={`book-again-${b.id}`}
                                >
                                  <Link
                                    href={`/properties/${b.propertySlug}/book?rebook=${b.id}&guests=${b.guestsCount}`}
                                  >
                                    {t('bookAgain')}
                                  </Link>
                                </Button>
                              )}
                              {b.canPayDeposit && (
                                <Button
                                  asChild
                                  size="sm"
                                  className="shadow-soft"
                                  data-testid="pay-deposit"
                                >
                                  <Link href={`/checkout/${b.id}`}>{t('payDeposit')}</Link>
                                </Button>
                              )}
                              {b.canPayBalance && (
                                <Button
                                  asChild
                                  size="sm"
                                  className="shadow-soft"
                                  data-testid="pay-balance"
                                >
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
                                  <p className="text-xs font-medium text-navy">
                                    {t('requestRefundTitle')}
                                  </p>
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
                                  <p className="text-xs font-medium text-navy">
                                    {t('openDisputeTitle')}
                                  </p>
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
                                tickets={supportTickets.filter(
                                  (ticket) => ticket.bookingId === b.id,
                                )}
                                onSubmitted={refreshSupportTickets}
                              />
                            </div>
                          </div>

                          <BookingReviewForm booking={b} onSubmitted={load} />
                        </div>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24">
              {nextTrip ? (
                <div className="overflow-hidden rounded-[18px] border border-[#E8EEF6] bg-white shadow-[0_8px_28px_-18px_rgba(13,32,70,.45)]">
                  <div className="flex items-center gap-2 border-b border-[#F0F3F8] px-4 py-3">
                    <Plane className="h-4 w-4 text-[#2F6EF6]" aria-hidden />
                    <h3 className="text-[14px] font-bold text-[#0D2046]">{t('nextTripTitle')}</h3>
                  </div>
                  <div className="relative aspect-[16/10] w-full bg-[#EAF2FF]">
                    {propertyMeta[nextTrip.propertySlug]?.imageUrl ? (
                      <Image
                        src={propertyMeta[nextTrip.propertySlug]!.imageUrl!}
                        alt={
                          locale === 'ar' ? nextTrip.propertyTitleAr : nextTrip.propertyTitleEn
                        }
                        fill
                        className="object-cover"
                        sizes="340px"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-2.5 p-4">
                    <p className="truncate text-[15px] font-bold text-[#2F6EF6]">
                      {locale === 'ar' ? nextTrip.propertyTitleAr : nextTrip.propertyTitleEn}
                    </p>
                    <p className="flex items-center gap-1.5 truncate text-[12px] text-[#8A96A8]">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {nextTrip.approximateLocation || '—'}
                    </p>
                    <p className="flex items-center gap-1.5 text-[12px] text-[#53637A]">
                      <Calendar className="h-3.5 w-3.5 text-[#2F6EF6]" aria-hidden />
                      {
                        formatDayParts(
                          parseDisplayDate(nextTrip.bookingStartAt, nextTrip.date),
                          locale,
                        ).ymd
                      }
                      {' – '}
                      {
                        formatDayParts(
                          parseDisplayDate(nextTrip.bookingEndAt, nextTrip.date),
                          locale,
                        ).ymd
                      }
                    </p>
                    <p className="flex items-center gap-1.5 text-[12px] text-[#53637A]">
                      <Users className="h-3.5 w-3.5 text-[#8A96A8]" aria-hidden />
                      {t('guestsPeople', { count: nextTrip.guestsCount })}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-1 h-11 w-full rounded-xl bg-[#2F6EF6] text-[13px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(47,110,246,.85)] hover:bg-[#255FE0]"
                      onClick={() => focusBooking(nextTrip.id)}
                    >
                      {t('viewBookingDetails')}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-[18px] border border-[#E8EEF6] bg-white px-5 py-6 text-center shadow-[0_8px_28px_-18px_rgba(13,32,70,.45)]">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2F6EF6]">
                  <Headphones className="h-7 w-7" strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="mt-4 text-[15px] font-bold text-[#0D2046]">{t('needHelpTitle')}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[#7A879B]">{t('needHelpBody')}</p>
                <Link
                  href="/contact"
                  className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#EAF2FF] text-[13px] font-semibold text-[#2F6EF6] transition hover:bg-[#DCE9FF]"
                >
                  <MessageSquare className="h-4 w-4" aria-hidden />
                  {t('contactUs')}
                </Link>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
