'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  Home,
  CalendarDays,
  CalendarRange,
  ScrollText,
  UserCircle,
  Wallet,
  RotateCcw,
  AlertTriangle,
  Scale,
  Banknote,
  Star,
  Ticket,
  Megaphone,
  LifeBuoy,
  FileText,
} from 'lucide-react';
import { AdminGuard } from './admin-guard';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin', icon: LayoutDashboard, labelKey: 'nav.dashboard' as const },
  { href: '/admin/users', icon: Users, labelKey: 'nav.users' as const },
  { href: '/admin/owners', icon: UserCircle, labelKey: 'nav.owners' as const },
  { href: '/admin/properties', icon: Home, labelKey: 'nav.properties' as const },
  { href: '/admin/bookings', icon: CalendarDays, labelKey: 'nav.bookings' as const },
  { href: '/admin/payments', icon: Wallet, labelKey: 'nav.payments' as const },
  { href: '/admin/refunds', icon: RotateCcw, labelKey: 'nav.refunds' as const },
  { href: '/admin/disputes', icon: AlertTriangle, labelKey: 'nav.disputes' as const },
  {
    href: '/admin/marketplace-fairness',
    icon: Scale,
    labelKey: 'nav.marketplaceFairness' as const,
  },
  { href: '/admin/support', icon: LifeBuoy, labelKey: 'nav.support' as const },
  { href: '/admin/legal', icon: FileText, labelKey: 'nav.legal' as const },
  { href: '/admin/payouts', icon: Banknote, labelKey: 'nav.payouts' as const },
  { href: '/admin/reviews', icon: Star, labelKey: 'nav.reviews' as const },
  { href: '/admin/coupons', icon: Ticket, labelKey: 'nav.coupons' as const },
  { href: '/admin/sponsorship', icon: Megaphone, labelKey: 'nav.sponsorship' as const },
  { href: '/admin/availability', icon: CalendarRange, labelKey: 'nav.availability' as const },
  { href: '/admin/audit-logs', icon: ScrollText, labelKey: 'nav.auditLogs' as const },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin');
  const pathname = usePathname();

  return (
    <AdminGuard>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <p className="text-sm font-medium text-primary">{t('panelLabel')}</p>
            <h1 className="text-3xl font-bold text-navy">{t('panelTitle')}</h1>
          </div>
        </div>
        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="shrink-0 lg:w-56">
            <nav className="glass-panel flex flex-row gap-1 overflow-x-auto rounded-2xl border-primary/12 p-2 lg:flex-col lg:overflow-visible">
              {navItems.map(({ href, icon: Icon, labelKey }) => {
                const active =
                  href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground shadow-soft'
                        : 'text-muted hover:bg-primary-soft hover:text-navy',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t(labelKey)}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </AdminGuard>
  );
}
