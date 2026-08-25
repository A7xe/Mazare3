'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { OwnerPerformanceMetrics, OwnerPerformanceRange } from '@mazare3/shared';
import { OWNER_PERFORMANCE_RANGES } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function formatRate(value: number | null, locale: string): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-JO' : 'en', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMinutes(value: number | null, locale: string): string | null {
  if (value == null) return null;
  const rounded = Math.round(value);
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-JO' : 'en').format(rounded);
}

export function OwnerPerformancePanel({
  load,
  ns,
  locale,
}: {
  load: (range: OwnerPerformanceRange) => Promise<OwnerPerformanceMetrics>;
  ns: 'owner' | 'admin';
  locale: 'ar' | 'en';
}) {
  const t = useTranslations(ns);
  const [range, setRange] = useState<OwnerPerformanceRange>('30d');
  const [data, setData] = useState<OwnerPerformanceMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const next = await load(range);
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t('loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, range, t]);

  const insufficient = !data || data.resolved === 0;

  return (
    <section data-testid="owner-performance" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-navy">{t('performance.title')}</h2>
        <div className="flex gap-1">
          {OWNER_PERFORMANCE_RANGES.map((id) => (
            <button
              key={id}
              type="button"
              data-testid={`owner-performance-range-${id}`}
              onClick={() => setRange(id)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-semibold',
                range === id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-primary-soft text-navy ring-1 ring-primary/15',
              )}
            >
              {t(`performance.range.${id}`)}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted" data-testid="owner-performance-range-label">
        {t('performance.rangeLabel', { range: t(`performance.range.${range}`) })}
      </p>

      {error ? (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : loading && !data ? (
        <p className="text-sm text-muted">{t('performance.loading')}</p>
      ) : insufficient ? (
        <p
          data-testid="owner-performance-empty"
          className="rounded-2xl border border-primary/12 bg-primary-soft px-4 py-6 text-center text-sm font-medium text-navy"
        >
          {t('performance.notEnoughData')}
        </p>
      ) : (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <MetricCard
            testId="owner-performance-response-rate"
            label={t('performance.responseRate')}
            value={formatRate(data.responseRate, locale) ?? t('performance.notEnoughData')}
          />
          <MetricCard
            testId="owner-performance-acceptance-rate"
            label={t('performance.acceptanceRate')}
            value={formatRate(data.acceptanceRate, locale) ?? t('performance.notEnoughData')}
          />
          <MetricCard
            testId="owner-performance-avg-response"
            label={t('performance.averageResponse')}
            value={
              formatMinutes(data.averageResponseMinutes, locale) != null
                ? t('performance.minutes', { count: formatMinutes(data.averageResponseMinutes, locale)! })
                : t('performance.notEnoughData')
            }
          />
          <MetricCard
            testId="owner-performance-timeout-rate"
            label={t('performance.timeoutRate')}
            value={formatRate(data.timeoutRate, locale) ?? t('performance.notEnoughData')}
          />
          <MetricCard
            testId="owner-performance-handled"
            label={t('performance.handled')}
            value={String(data.resolved)}
          />
        </div>
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-primary/12" data-testid={testId}>
      <div className="gradient-primary h-1" />
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-bold text-navy sm:text-2xl">{value}</p>
      </CardContent>
    </Card>
  );
}
