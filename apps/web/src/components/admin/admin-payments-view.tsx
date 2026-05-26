'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { AdminPaymentRow } from '@mazare3/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchAdminPayments } from '@/lib/api-admin';
import { PriceDisplay } from '@/components/marketplace/price-display';

export function AdminPaymentsView() {
  const t = useTranslations('admin');
  const locale = useLocale() as 'ar' | 'en';
  const [rows, setRows] = useState<AdminPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchAdminPayments();
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
      <div data-testid="admin-payments" className="flex justify-center py-20">
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
        <CardContent className="py-16 text-center text-muted">{t('paymentsEmpty')}</CardContent>
      </Card>
    );
  }

  return (
    <div data-testid="admin-payments" className="overflow-x-auto rounded-2xl border border-primary/12 bg-surface shadow-card">
      <table className="w-full min-w-[1200px] text-start text-sm">
        <thead>
          <tr className="border-b border-border bg-primary-soft/40 text-muted">
            <th className="px-4 py-3">{t('colPaymentId')}</th>
            <th className="px-4 py-3">{t('colCode')}</th>
            <th className="px-4 py-3">{t('colCustomer')}</th>
            <th className="px-4 py-3">{t('colBookingTotal')}</th>
            <th className="px-4 py-3">{t('colCustomerPayable')}</th>
            <th className="px-4 py-3">{t('colCommission')}</th>
            <th className="px-4 py-3">{t('colOwnerNet')}</th>
            <th className="px-4 py-3">{t('colPayoutStatus')}</th>
            <th className="px-4 py-3">{t('colPayoutAt')}</th>
            <th className="px-4 py-3">{t('colRefund')}</th>
            <th className="px-4 py-3">{t('colStatus')}</th>
            <th className="px-4 py-3">{t('colCreated')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-border/60">
              <td className="px-4 py-3 font-mono text-xs">{p.id.slice(0, 10)}…</td>
              <td className="px-4 py-3 font-mono text-xs">{p.publicCode}</td>
              <td className="px-4 py-3">
                <span className="block">{p.customerName ?? '—'}</span>
                <span className="text-xs text-muted">{p.customerEmail}</span>
              </td>
              <td className="px-4 py-3">
                <PriceDisplay amount={p.bookingTotalAmount} currency={p.currency} locale={locale} />
              </td>
              <td className="px-4 py-3">
                <PriceDisplay amount={p.customerPayableAmount} currency={p.currency} locale={locale} />
              </td>
              <td className="px-4 py-3">
                <PriceDisplay
                  amount={p.platformCommissionAmount}
                  currency={p.currency}
                  locale={locale}
                />
              </td>
              <td className="px-4 py-3">
                <PriceDisplay amount={p.ownerNetPayoutAmount} currency={p.currency} locale={locale} />
              </td>
              <td className="px-4 py-3">
                <Badge variant="muted">{t(`payoutStatus.${p.payoutStatus}`)}</Badge>
              </td>
              <td className="px-4 py-3 text-muted">
                {p.payoutAvailableAt
                  ? new Date(p.payoutAvailableAt).toLocaleString(locale === 'ar' ? 'ar-JO' : 'en-GB')
                  : '—'}
              </td>
              <td className="px-4 py-3 text-xs">
                <span>{t(`refundStatus.${p.refundStatus}`)}</span>
                {p.cancellationRefundAmount != null && (
                  <span className="mt-1 block">
                    <PriceDisplay
                      amount={p.cancellationRefundAmount}
                      currency={p.currency}
                      locale={locale}
                    />
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge variant={p.status === 'succeeded' ? 'highlight' : 'muted'}>
                  {t(`payStatus.${p.status}`)}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted">
                {new Date(p.createdAt).toLocaleString(locale === 'ar' ? 'ar-JO' : 'en-GB')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
