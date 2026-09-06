'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { AdminPayoutRow } from '@mazare3/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchAdminPayouts, markAdminPayoutPaid } from '@/lib/api-admin';
import { PriceDisplay } from '@/components/marketplace/price-display';

export function AdminPayoutsView() {
  const t = useTranslations('admin');
  const locale = useLocale() as 'ar' | 'en';
  const [rows, setRows] = useState<AdminPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminPayouts();
      setRows(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markPaid(paymentId: string) {
    const manualReference = refs[paymentId]?.trim();
    if (!manualReference) {
      setError(t('payoutRefRequired'));
      return;
    }
    setBusy(paymentId);
    try {
      await markAdminPayoutPaid(paymentId, { manualReference });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div data-testid="admin-payouts" className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div data-testid="admin-payouts" className="space-y-4">
      <p className="text-sm text-muted">{t('payoutsSubtitle')}</p>
      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">{error}</p>
      )}
      {rows.length === 0 ? (
        <Card className="glass-panel rounded-2xl border-primary/12">
          <CardContent className="py-16 text-center text-muted">{t('payoutsEmpty')}</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((p) => (
            <Card key={p.paymentId} className="glass-panel rounded-2xl border-primary/12">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-mono font-semibold text-navy">{p.publicCode}</p>
                    <p className="text-sm text-muted">
                      {p.ownerDisplayName} · {p.ownerEmail ?? '—'}
                    </p>
                  </div>
                  <Badge variant={p.payoutStatus === 'paid' ? 'highlight' : 'muted'}>
                    {t(`payoutStatus.${p.payoutStatus}`)}
                  </Badge>
                </div>
                <p className="text-sm">
                  {t('colEligible')}:{' '}
                  <PriceDisplay amount={p.amount} currency={p.currency} locale={locale} />
                </p>
                {p.payoutAvailableAt && (
                  <p className="text-xs text-muted">
                    {t('colPayoutAt')}: {new Date(p.payoutAvailableAt).toLocaleString(locale)}
                  </p>
                )}
                {p.blocked && p.blockedReason && (
                  <p className="text-sm text-danger">{t(`blockedReason.${p.blockedReason}`)}</p>
                )}
                {p.payoutStatus === 'eligible' && !p.blocked && (
                  <>
                    <Input
                      data-testid={`payout-ref-${p.paymentId}`}
                      placeholder={t('manualReferencePlaceholder')}
                      value={refs[p.paymentId] ?? ''}
                      onChange={(e) => setRefs((r) => ({ ...r, [p.paymentId]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      data-testid={`payout-mark-paid-${p.paymentId}`}
                      disabled={busy === p.paymentId}
                      onClick={() => void markPaid(p.paymentId)}
                    >
                      {t('markPayoutPaid')}
                    </Button>
                  </>
                )}
                {p.manualReference && (
                  <p className="text-xs text-muted">
                    {t('colReference')}: {p.manualReference}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
