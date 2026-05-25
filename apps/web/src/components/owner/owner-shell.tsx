'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import {
  CalendarDays,
  CalendarRange,
  LayoutDashboard,
  Building2,
} from 'lucide-react';
import { OwnerGuard } from './owner-guard';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/owner', icon: LayoutDashboard, labelKey: 'nav.dashboard' as const },
  { href: '/owner/properties', icon: Building2, labelKey: 'nav.properties' as const },
  { href: '/owner/bookings', icon: CalendarDays, labelKey: 'nav.bookings' as const },
  { href: '/owner/availability', icon: CalendarRange, labelKey: 'nav.availability' as const },
];

export function OwnerShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('owner');
  const pathname = usePathname();

  return (
    <OwnerGuard>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-medium text-primary">{t('panelLabel')}</p>
          <h1 className="text-3xl font-bold text-navy">{t('panelTitle')}</h1>
        </div>
        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="lg:w-56 shrink-0">
            <nav className="glass-panel flex flex-row gap-1 overflow-x-auto rounded-2xl border-primary/12 p-2 lg:flex-col lg:overflow-visible">
              {navItems.map(({ href, icon: Icon, labelKey }) => {
                const active =
                  href === '/owner'
                    ? pathname === '/owner'
                    : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground shadow-soft'
                        : 'text-muted hover:bg-primary-soft hover:text-navy',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {t(labelKey)}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </OwnerGuard>
  );
}
