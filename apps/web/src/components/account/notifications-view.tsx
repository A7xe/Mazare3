'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, CheckCheck, Loader2 } from 'lucide-react';
import type { NotificationItem } from '@mazare3/shared';
import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api-notifications';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { AccountSubnav } from '@/components/account/account-subnav';

function formatWhen(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-JO' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function NotificationsView() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div>
      <AccountSubnav />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy">{t('pageTitle')}</h1>
          {unreadCount > 0 && (
            <p className="mt-1 text-sm text-muted">{t('unreadCount', { count: unreadCount })}</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="notifications-page-mark-all"
            className="gap-2"
            disabled={actingId === 'all'}
            onClick={() => void handleMarkAllRead()}
          >
            {actingId === 'all' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <CheckCheck className="h-4 w-4" aria-hidden />
            )}
            {t('markAllRead')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted" aria-hidden />
        </div>
      ) : error ? (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">{error}</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-muted">
          {t('empty')}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              data-testid={`notification-row-${n.id}`}
              className={cn(
                'rounded-xl border border-border bg-surface px-4 py-3 shadow-card',
                !n.isRead && 'border-primary/30',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {n.href ? (
                    <Link
                      href={n.href}
                      data-testid={`notification-link-${n.type}`}
                      className="font-medium text-navy hover:text-primary hover:underline"
                    >
                      {n.title}
                    </Link>
                  ) : (
                    <p className="font-medium text-navy">{n.title}</p>
                  )}
                  <p className="mt-1 text-sm text-muted">{n.message}</p>
                  <p className="mt-2 text-xs text-muted">{formatWhen(n.createdAt, locale)}</p>
                </div>
                {!n.isRead && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 gap-1"
                    disabled={actingId === n.id}
                    onClick={() => void handleMarkRead(n.id)}
                  >
                    {actingId === n.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Check className="h-4 w-4" aria-hidden />
                    )}
                    {t('markRead')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
