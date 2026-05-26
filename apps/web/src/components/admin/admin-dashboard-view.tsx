'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Users, UserCircle, Home, CalendarCheck, Wallet, Loader2 } from 'lucide-react';
import type { AdminDashboardSummary } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchAdminSummary } from '@/lib/api-admin';
import { PriceDisplay } from '@/components/marketplace/price-display';
import { Link } from '@/i18n/navigation';

export function AdminDashboardView() {
  const t = useTranslations('admin');
  const locale = useLocale() as 'ar' | 'en';
  const [data, setData] = useState<AdminDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchAdminSummary();
        setData(res.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) {
    return (
      <div data-testid="admin-dashboard" className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">
        {error ?? t('loadError')}
      </p>
    );
  }

  const stats = [
    { label: t('stats.users'), value: data.usersCount, icon: Users },
    { label: t('stats.customers'), value: data.customersCount, icon: Users },
    { label: t('stats.owners'), value: data.ownersCount, icon: UserCircle },
    { label: t('stats.properties'), value: data.propertiesCount, icon: Home },
    { label: t('stats.published'), value: data.publishedPropertiesCount, icon: Home },
    { label: t('stats.bookings'), value: data.bookingsCount, icon: CalendarCheck },
    { label: t('stats.today'), value: data.todayBookingsCount, icon: CalendarCheck },
    { label: t('stats.week'), value: data.weekBookingsCount, icon: CalendarCheck },
  ];

  return (
    <div data-testid="admin-dashboard" className="space-y-8">
      <p className="text-muted">{t('dashboardSubtitle')}</p>
      <div
        data-testid="admin-summary-cards"
        className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="glass-panel overflow-hidden rounded-2xl border-primary/12">
            <div className="gradient-primary h-1" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted">{label}</CardTitle>
              <Icon className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-navy">{value}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="glass-panel overflow-hidden rounded-2xl border-primary/12 min-[400px]:col-span-2">
          <div className="gradient-primary h-1" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted">{t('stats.revenue')}</CardTitle>
            <Wallet className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <PriceDisplay amount={data.estimatedRevenueJod} currency="JOD" locale={locale} large />
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel rounded-2xl border-primary/12">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg text-navy">{t('recentAudit')}</CardTitle>
          <Link href="/admin/audit-logs" className="text-sm text-primary hover:underline">
            {t('viewAllAudit')}
          </Link>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {data.recentAuditLogs.length === 0 ? (
            <p className="text-sm text-muted">{t('auditEmpty')}</p>
          ) : (
            <table className="w-full min-w-[520px] text-start text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pe-4">{t('auditAction')}</th>
                  <th className="py-2 pe-4">{t('auditActor')}</th>
                  <th className="py-2">{t('auditDate')}</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAuditLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border/60">
                    <td className="py-2 pe-4 font-mono text-xs">{log.action}</td>
                    <td className="py-2 pe-4">{log.actorEmail ?? '—'}</td>
                    <td className="py-2 text-muted">
                      {new Date(log.createdAt).toLocaleString(locale === 'ar' ? 'ar-JO' : 'en-GB')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
