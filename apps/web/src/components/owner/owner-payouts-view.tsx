'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { OwnerPayoutSummaryRow } from '@mazare3/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchOwnerPayouts } from '@/lib/api-owner-payouts';
import { PriceDisplay } from '@/components/marketplace/price-display';

export function OwnerPayoutsView() {
  const t = useTranslations('owner');
  const locale = useLocale() as 'ar' | 'en';
  const [rows, setRows] = useState<OwnerPayoutSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchOwnerPayouts();
        setRows(res.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) {
    return (
      <div data-testid="owner-payouts" className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">{error}</p>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="glass-panel rounded-2xl border-primary/12">
        <CardContent className="py-16 text-center text-muted">{t('payoutsEmpty')}</CardContent>
      </Card>
    );
  }

  return (
    <div data-testid="owner-payouts" className="space-y-4">
      <p className="text-sm text-muted">{t('payoutsSubtitle')}</p>
      {rows.map((p) => (
        <Card key={p.paymentId} className="glass-panel rounded-2xl border-primary/12">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-mono text-sm font-semibold text-navy">{p.publicCode}</p>
              <p className="text-sm text-muted">{p.date}</p>
            </div>
            <div className="text-end">
              <PriceDisplay
                amount={p.ownerNetPayoutAmount}
                currency={p.currency}
                locale={locale}
              />
              <Badge variant="muted" className="mt-2">
                {t(`payoutStatus.${p.payoutStatus}`)}
              </Badge>
              {p.blocked && p.blockedReason && (
                <p className="mt-1 text-xs text-danger">{t(`blockedReason.${p.blockedReason}`)}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
