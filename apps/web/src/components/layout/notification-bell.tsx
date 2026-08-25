'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import type { NotificationItem } from '@mazare3/shared';
import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api-notifications';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isCheckoutReturnPath } from '@/lib/checkout-return-path';

function formatWhen(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-JO' : 'en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function NotificationBell() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [actingId, setActingId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (isCheckoutReturnPath(pathname)) return;
    setLoading(true);
    try {
      const res = await fetchMyNotifications();
      setItems(res.data.items);
      setUnreadCount(res.data.unreadCount);
    } catch {
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [pathname]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  async function handleMarkRead(id: string) {
    setActingId(id);
    try {
      const res = await markNotificationRead(id);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? res.data : n)),
      );
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

  const badge =
    unreadCount > 0 ? (
      <span
        data-testid="notification-unread-badge"
        className="absolute -inset-e-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
      >
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    ) : null;

  return (
    <div className="relative" ref={panelRef}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-testid="notification-bell"
        className="relative h-9 w-9 p-0"
        aria-label={t('bellLabel')}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
      >
        <Bell className="h-5 w-5 text-muted" aria-hidden />
        {badge}
      </Button>

      {open && (
        <div
          data-testid="notification-dropdown"
          className={cn(
            'absolute top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-border bg-surface shadow-card',
            'inset-e-0',
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <p className="text-sm font-semibold text-navy">{t('title')}</p>
            {unreadCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-testid="notification-mark-all-read"
                className="h-8 gap-1 px-2 text-xs"
                disabled={actingId === 'all'}
                onClick={() => void handleMarkAllRead()}
              >
                {actingId === 'all' ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <CheckCheck className="h-3 w-3" aria-hidden />
                )}
                {t('markAllRead')}
              </Button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted" aria-hidden />
              </div>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted">{t('empty')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => (
                  <li
                    key={n.id}
                    data-testid={`notification-item-${n.id}`}
                    className={cn('px-3 py-2.5', !n.isRead && 'bg-primary/5')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {n.href ? (
                          <Link
                            href={n.href}
                            data-testid={`notification-link-${n.type}`}
                            className="text-sm font-medium text-navy hover:text-primary hover:underline"
                            onClick={() => setOpen(false)}
                          >
                            {n.title}
                          </Link>
                        ) : (
                          <p className="text-sm font-medium text-navy">{n.title}</p>
                        )}
                        <p className="mt-0.5 text-xs text-muted line-clamp-2">{n.message}</p>
                        <p className="mt-1 text-[10px] text-muted">
                          {formatWhen(n.createdAt, locale)}
                        </p>
                      </div>
                      {!n.isRead && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          data-testid={`notification-mark-read-${n.id}`}
                          className="h-7 w-7 shrink-0 p-0"
                          aria-label={t('markRead')}
                          disabled={actingId === n.id}
                          onClick={() => void handleMarkRead(n.id)}
                        >
                          {actingId === n.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Check className="h-3.5 w-3.5" aria-hidden />
                          )}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-3 py-2">
            <Link
              href="/account/notifications"
              className="text-xs font-medium text-primary hover:text-navy"
              onClick={() => setOpen(false)}
            >
              {t('viewAll')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
