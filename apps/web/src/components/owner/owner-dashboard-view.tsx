'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Building2, CalendarCheck, CalendarClock, Percent, Wallet, Loader2 } from 'lucide-react';
import type { OwnerDashboardSummary, OwnerPerformanceRange } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchOwnerSummary, fetchOwnerPerformance } from '@/lib/api-owner';
import { OwnerPerformancePanel } from '@/components/owner/owner-performance-panel';
import { PriceDisplay } from '@/components/marketplace/price-display';
import { useLocale } from 'next-intl';

export function OwnerDashboardView() {
  const t = useTranslations('owner');
  const locale = useLocale() as 'ar' | 'en';
  const [data, setData] = useState<OwnerDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPerformance = useCallback(async (range: OwnerPerformanceRange) => {
    const res = await fetchOwnerPerformance(range);
    return res.data;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchOwnerSummary();
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
      <div data-testid="owner-dashboard" className="flex justify-center py-20">
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
    {
      label: t('stats.properties'),
      value: String(data.propertiesCount),
      icon: Building2,
    },
    {
      label: t('stats.upcoming'),
      value: String(data.upcomingBookingsCount),
      icon: CalendarClock,
    },
    {
      label: t('stats.today'),
      value: String(data.todayBookingsCount),
      icon: CalendarCheck,
    },
    {
      label: t('stats.week'),
      value: String(data.weekBookingsCount),
      icon: CalendarCheck,
    },
    {
      label: t('stats.occupancy'),
      value: `${data.occupancyPercent}%`,
      icon: Percent,
    },
  ];

  return (
    <div data-testid="owner-dashboard" className="space-y-6">
      <p className="text-muted">{t('dashboardSubtitle')}</p>
      <div
        data-testid="owner-summary-cards"
        className="grid gap-4 grid-cols-1 min-[400px]:grid-cols-2 xl:grid-cols-3"
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
        <Card className="glass-panel overflow-hidden rounded-2xl border-primary/12 sm:col-span-2 xl:col-span-1">
          <div className="gradient-primary h-1" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted">{t('stats.revenue')}</CardTitle>
            <Wallet className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <PriceDisplay
              amount={data.estimatedRevenueJod}
              currency="JOD"
              locale={locale}
              large
            />
            <p className="mt-1 text-xs text-muted">{t('stats.revenueHint')}</p>
          </CardContent>
        </Card>
      </div>
      <OwnerPerformancePanel ns="owner" locale={locale} load={loadPerformance} />
    </div>
  );
}
