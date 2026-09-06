'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { AdminRefundRequestRow, RefundRequestStatus } from '@mazare3/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchAdminRefundRequests, patchAdminRefundRequest } from '@/lib/api-admin';
import { PriceDisplay } from '@/components/marketplace/price-display';

export function AdminRefundsView() {
  const t = useTranslations('admin');
  const locale = useLocale() as 'ar' | 'en';
  const [rows, setRows] = useState<AdminRefundRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminRefundRequests();
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

  async function updateStatus(id: string, status: RefundRequestStatus) {
    setBusy(id);
    try {
      await patchAdminRefundRequest(id, {
        status,
        adminNote: notes[id]?.trim() || undefined,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div data-testid="admin-refunds" className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div data-testid="admin-refunds" className="space-y-4">
      <p className="text-sm text-muted">{t('refundsSubtitle')}</p>
      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">{error}</p>
      )}
      {rows.length === 0 ? (
        <Card className="glass-panel rounded-2xl border-primary/12">
          <CardContent className="py-16 text-center text-muted">{t('refundsEmpty')}</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <Card key={r.id} className="glass-panel rounded-2xl border-primary/12">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-semibold text-navy">{r.publicCode}</p>
                    <p className="text-sm text-muted">
                      {r.customerName ?? '—'} · {r.customerEmail ?? '—'}
                    </p>
                    <p className="text-sm">{r.propertyTitleAr}</p>
                  </div>
                  <Badge variant="highlight">{t(`refundRequestStatus.${r.status}`)}</Badge>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <p>
                    {t('colAmountPaid')}:{' '}
                    <PriceDisplay amount={r.amountPaid} currency="JOD" locale={locale} />
                  </p>
                  <p>
                    {t('colPolicyRefund')}:{' '}
                    <PriceDisplay amount={r.policyRefundAmount} currency="JOD" locale={locale} />
                  </p>
                  <p>
                    {t('colRequested')}:{' '}
                    <PriceDisplay amount={r.requestedAmount} currency="JOD" locale={locale} />
                  </p>
                </div>
                <p className="text-sm text-muted">{r.reason}</p>
                <Input
                  placeholder={t('adminNotePlaceholder')}
                  value={notes[r.id] ?? r.adminNote ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                />
                {r.status === 'pending' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      data-testid={`refund-approve-${r.id}`}
                      disabled={busy === r.id}
                      onClick={() => void updateStatus(r.id, 'approved')}
                    >
                      {t('approveRefund')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`refund-reject-${r.id}`}
                      disabled={busy === r.id}
                      onClick={() => void updateStatus(r.id, 'rejected')}
                    >
                      {t('rejectRefund')}
                    </Button>
                  </div>
                )}
                {r.status === 'approved' && (
                  <Button
                    size="sm"
                    data-testid={`refund-process-${r.id}`}
                    disabled={busy === r.id}
                    onClick={() => void updateStatus(r.id, 'processed')}
                  >
                    {t('markRefundProcessed')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
