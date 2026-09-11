'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Bell,
  Building2,
  CalendarDays,
  CheckCheck,
  CreditCard,
  Heart,
  Home,
  LifeBuoy,
  Loader2,
  MessageCircle,
  Settings,
  Tag,
} from 'lucide-react';
import type { NotificationItem } from '@mazare3/shared';
import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api-notifications';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type FilterId = 'all' | 'bookings' | 'offers' | 'system';

function typePrefix(type: string) {
  return type.split('.')[0] ?? type;
}

function matchesFilter(n: NotificationItem, filter: FilterId) {
  if (filter === 'all') return true;
  const prefix = typePrefix(n.type);
  if (filter === 'bookings') {
    return ['booking', 'payment', 'refund', 'dispute', 'review'].includes(prefix);
  }
  if (filter === 'offers') {
    return ['coupon', 'sponsorship', 'placement', 'promotion', 'offer'].includes(prefix);
  }
  // system + everything else
  return !['booking', 'payment', 'refund', 'dispute', 'review', 'coupon', 'sponsorship', 'placement', 'promotion', 'offer'].includes(
    prefix,
  );
}

function categoryStyle(type: string) {
  const prefix = typePrefix(type);
  if (prefix === 'booking') {
    return { Icon: CalendarDays, wrap: 'bg-[#EAF2FF]', icon: 'text-[#2F6EF6]' };
  }
  if (prefix === 'payment' || prefix === 'refund' || prefix === 'payout' || prefix === 'settlement') {
    return { Icon: CreditCard, wrap: 'bg-[#E8F8EF]', icon: 'text-[#16A34A]' };
  }
  if (prefix === 'review') {
    return { Icon: Heart, wrap: 'bg-[#FEE8EC]', icon: 'text-[#E11D48]' };
  }
  if (prefix === 'coupon' || prefix === 'sponsorship' || prefix === 'placement' || prefix === 'promotion' || prefix === 'offer') {
    return { Icon: Tag, wrap: 'bg-[#F1E9FF]', icon: 'text-[#7C3AED]' };
  }
  if (prefix === 'owner' || prefix === 'partner' || prefix === 'admin') {
    return { Icon: Building2, wrap: 'bg-[#E8F8EF]', icon: 'text-[#16A34A]' };
  }
  if (prefix === 'support') {
    return { Icon: MessageCircle, wrap: 'bg-[#EAF2FF]', icon: 'text-[#2F6EF6]' };
  }
  return { Icon: Bell, wrap: 'bg-[#EEF2FF]', icon: 'text-[#6366F1]' };
}

function formatWhen(iso: string, locale: string, t: (key: string) => string) {
  try {
    const date = new Date(iso);
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startThat = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayDiff = Math.round((startToday.getTime() - startThat.getTime()) / 86_400_000);
    const time = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-JO' : 'en-GB', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
    if (dayDiff === 0) return `${t('today')} ${time}`;
    if (dayDiff === 1) return `${t('yesterday')} ${time}`;
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-JO' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return iso;
  }
}

function DiscoverCard() {
  const t = useTranslations('accountHome');
  return (
    <Link
      href="/search"
      className="group relative block overflow-hidden rounded-2xl border border-[#E4EAF3] bg-white shadow-[0_8px_24px_-16px_rgba(13,32,70,.4)]"
      data-testid="notifications-discover"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <img
          src="/account/discover-destinations.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-[42%] w-full"
          viewBox="0 0 320 110"
          preserveAspectRatio="none"
        >
          <path
            d="M0 55 C55 95 95 18 160 48 C225 78 265 20 320 52 L320 110 L0 110 Z"
            fill="white"
          />
        </svg>
      </div>
      <div className="relative -mt-1 flex items-end justify-between gap-3 bg-white px-4 pb-4 pt-1">
        <div className="min-w-0 flex-1 text-start">
          <p className="text-[15px] font-bold leading-snug text-[#0D2046]">{t('discoverTitle')}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#7A879B]">{t('discoverSubtitle')}</p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#2F6EF6] shadow-[0_8px_18px_-6px_rgba(47,110,246,.55)] ring-1 ring-[#E8EEF8]">
          <Home className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

function SupportCard() {
  const t = useTranslations('accountHome');
  return (
    <div className="flex flex-col items-center rounded-2xl border border-[#E4EAF3] bg-white px-5 py-6 text-center shadow-[0_8px_24px_-16px_rgba(13,32,70,.35)]">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2F6EF6]">
        <LifeBuoy className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-4 text-[16px] font-bold text-[#0D2046]">{t('supportCardTitle')}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-[#7A879B]">{t('supportCardBody')}</p>
      <Link
        href="/contact"
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2F6EF6] px-4 py-3 text-[13px] font-semibold text-white shadow-[0_10px_20px_-12px_rgba(47,110,246,.9)] transition hover:bg-[#255FE0]"
      >
        <MessageCircle className="h-4 w-4" aria-hidden />
        {t('contactUs')}
      </Link>
    </div>
  );
}

export function NotificationsView() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMyNotifications();
      setItems(res.data.items);
      setUnreadCount(res.data.unreadCount);
    } catch {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => items.filter((n) => matchesFilter(n, filter)), [items, filter]);

  async function handleMarkRead(id: string) {
    setActingId(id);
    try {
      const res = await markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? res.data : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } finally {
      setActingId(null);
    }
  }

  async function handleMarkAllRead() {
    setActingId('all');
    try {
      await markAllNotificationsRead();
      setItems((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })),
      );
      setUnreadCount(0);
    } finally {
      setActingId(null);
    }
  }

  const filters: { id: FilterId; label: string; Icon?: typeof CalendarDays }[] = [
    { id: 'all', label: t('filterAll') },
    { id: 'bookings', label: t('filterBookings'), Icon: CalendarDays },
    { id: 'offers', label: t('filterOffers'), Icon: Tag },
    { id: 'system', label: t('filterSystem'), Icon: Settings },
  ];

  const sidebar = (
    <aside className="space-y-3 lg:sticky lg:top-24">
      <DiscoverCard />
      <SupportCard />
    </aside>
  );

  return (
    <div data-testid="notifications-page" className="pb-10" dir={locale === 'en' ? 'ltr' : 'rtl'}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:items-start lg:gap-6">
        <div className="min-w-0 space-y-4">
          <header>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F1E9FF]">
                  <Bell className="h-5 w-5 text-[#7C3AED]" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold leading-tight text-[#0D2046] sm:text-[28px]">
                    {t('title')}
                  </h1>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#7A879B]">{t('pageSubtitle')}</p>
                </div>
              </div>
              <Link
                href="/account"
                className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#F06A4D] transition hover:bg-[#FFF1EC]"
                aria-label={t('backToAccount')}
                data-testid="notifications-back"
              >
                <ArrowLeft className={cn('h-5 w-5', locale === 'en' && 'rotate-180')} aria-hidden />
              </Link>
            </div>
          </header>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('filtersLabel')}>
              {filters.map((f) => {
                const active = filter === f.id;
                const Icon = f.Icon;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-testid={`notifications-filter-${f.id}`}
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-semibold transition',
                      active
                        ? 'border-[#2F6EF6] bg-[#2F6EF6] text-white'
                        : 'border-[#E4EAF3] bg-white text-[#0D2046] hover:border-[#2F6EF6]/30',
                    )}
                  >
                    {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
                    {f.label}
                  </button>
                );
              })}
            </div>

            {unreadCount > 0 ? (
              <button
                type="button"
                data-testid="notifications-page-mark-all"
                disabled={actingId === 'all'}
                onClick={() => void handleMarkAllRead()}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#EAF2FF] px-3.5 text-[12.5px] font-semibold text-[#2F6EF6] transition hover:bg-[#DCE9FF] disabled:opacity-60"
              >
                {actingId === 'all' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                )}
                {t('markAllRead')}
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[#2F6EF6]" aria-hidden />
            </div>
          ) : error ? (
            <p className="rounded-xl border border-[#FEE8EC] bg-[#FFF5F7] px-4 py-3 text-sm text-[#E11D48]">
              {error}
            </p>
          ) : filtered.length === 0 ? (
            <p className="rounded-2xl border border-[#E4EAF3] bg-white px-4 py-12 text-center text-sm text-[#7A879B]">
              {items.length === 0 ? t('empty') : t('filterEmpty')}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {filtered.map((n) => {
                const { Icon, wrap, icon } = categoryStyle(n.type);
                const body = (
                  <>
                    <span className={cn('relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full', wrap)}>
                      <Icon className={cn('h-5 w-5', icon)} aria-hidden />
                      {!n.isRead ? (
                        <span className="absolute -top-0.5 inset-e-0 h-2.5 w-2.5 rounded-full bg-[#2F6EF6] ring-2 ring-white" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 text-start">
                      <span className={cn('block text-[14px] leading-snug text-[#0D2046]', !n.isRead ? 'font-bold' : 'font-semibold')}>
                        {n.title}
                      </span>
                      <span className="mt-1 block text-[12.5px] leading-relaxed text-[#7A879B]">
                        {n.message}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] font-medium text-[#9AA6B8]">
                      {formatWhen(n.createdAt, locale, t)}
                    </span>
                  </>
                );

                return (
                  <li key={n.id} data-testid={`notification-row-${n.id}`}>
                    {n.href ? (
                      <Link
                        href={n.href}
                        data-testid={`notification-link-${n.type}`}
                        onClick={() => {
                          if (!n.isRead) void handleMarkRead(n.id);
                        }}
                        className={cn(
                          'flex items-start gap-3 rounded-2xl border bg-white px-3.5 py-3.5 transition hover:border-[#2F6EF6]/25',
                          n.isRead ? 'border-[#E8EEF6]' : 'border-[#2F6EF6]/25 shadow-[0_2px_12px_rgba(47,110,246,.06)]',
                        )}
                      >
                        {body}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        data-testid={`notification-mark-read-${n.id}`}
                        disabled={actingId === n.id}
                        onClick={() => {
                          if (!n.isRead) void handleMarkRead(n.id);
                        }}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-2xl border bg-white px-3.5 py-3.5 text-start transition hover:border-[#2F6EF6]/25',
                          n.isRead ? 'border-[#E8EEF6]' : 'border-[#2F6EF6]/25 shadow-[0_2px_12px_rgba(47,110,246,.06)]',
                        )}
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="hidden lg:block">{sidebar}</div>
      </div>

      <div className="mt-5 space-y-3 lg:hidden">{sidebar}</div>
    </div>
  );
}
