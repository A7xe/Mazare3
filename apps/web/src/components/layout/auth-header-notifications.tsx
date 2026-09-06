'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { fetchMyNotifications } from '@/lib/api-notifications';
import { isCheckoutReturnPath } from '@/lib/checkout-return-path';
import { cn } from '@/lib/utils';

/** Compact notifications control — links to the existing notifications page. */
export function AuthHeaderNotifications() {
  const t = useTranslations('notifications');
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    if (isCheckoutReturnPath(pathname)) return;
    try {
      const res = await fetchMyNotifications();
      setUnreadCount(res.data.unreadCount ?? 0);
    } catch {
      setUnreadCount(0);
    }
  }, [pathname]);

  useEffect(() => {
    void load();
  }, [load]);

  const label =
    unreadCount > 0 ? `${t('bellLabel')} — ${t('unreadCount', { count: unreadCount })}` : t('bellLabel');

  return (
    <Link
      href="/account/notifications"
      data-testid="auth-header-notifications"
      aria-label={label}
      className={cn(
        'relative flex h-11 w-11 items-center justify-center rounded-[14px] bg-white',
        'shadow-[0_2px_12px_rgba(13,32,70,0.08)] transition-shadow hover:shadow-[0_4px_16px_rgba(13,32,70,0.12)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      )}
    >
      <Bell className="h-[19px] w-[19px] text-[#53637A]" strokeWidth={1.75} aria-hidden />
      {unreadCount > 0 ? (
        <span
          data-testid="auth-header-unread-badge"
          className="absolute top-2 end-2.5 h-2 w-2 rounded-full bg-[#2F6EF6]"
          aria-hidden
        />
      ) : null}
    </Link>
  );
}
