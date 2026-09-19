'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { OwnerPayoutSummaryRow, OwnerSettlementSummary } from '@mazare3/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import {
  fetchOwnerPayouts,
  fetchOwnerSettlements,
  fetchOwnerFinancialAdjustments,
  type OwnerFinancialAdjustmentRow,
} from '@/lib/api-owner-payouts';
import { PriceDisplay } from '@/components/marketplace/price-display';

export function OwnerPayoutsView() {
  const t = useTranslations('owner');
  const locale = useLocale() as 'ar' | 'en';
  const searchParams = useSearchParams();
  const focus = searchParams.get('settlement');
  const [rows, setRows] = useState<OwnerPayoutSummaryRow[]>([]);
  const [settlements, setSettlements] = useState<OwnerSettlementSummary[]>([]);
  const [adjustments, setAdjustments] = useState<OwnerFinancialAdjustmentRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(focus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [payouts, stmts, adjs] = await Promise.all([
          fetchOwnerPayouts(),
          fetchOwnerSettlements(),
          fetchOwnerFinancialAdjustments(),
        ]);
        setRows(payouts.data);
        setSettlements(stmts.data);
        setAdjustments(adjs.data);
        if (focus) setOpenId(focus);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t, focus]);

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

  return (
    <div data-testid="owner-payouts" className="space-y-6">
      <section data-testid="owner-settlements" className="space-y-3">
        <h2 className="text-lg font-bold text-navy">{t('settlements.title')}</h2>
        {settlements.length === 0 ? (
          <Card className="glass-panel rounded-2xl border-primary/12">
            <CardContent className="py-10 text-center text-muted">{t('settlements.empty')}</CardContent>
          </Card>
        ) : (
          settlements.map((s) => (
            <Card
              key={s.id}
              data-testid={`owner-settlement-${s.id}`}
              className="glass-panel rounded-2xl border-primary/12"
            >
              <CardContent className="space-y-2 p-4">
                <button type="button" className="w-full text-start" onClick={() => setOpenId(openId === s.id ? null : s.id)}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-navy">
                      {s.periodStart} → {s.periodEnd}
                    </p>
                    <Badge variant={s.status === 'paid' ? 'highlight' : 'muted'}>
                      {t(`settlements.status.${s.status}`)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted">
                    {t('settlements.items', { count: s.itemCount })}
                  </p>
                  <PriceDisplay amount={s.ownerNetAmount} currency={s.currency} locale={locale} />
                </button>
                {openId === s.id ? (
                  <div className="space-y-1 border-t border-primary/10 pt-2 text-sm">
                    <p>
                      {t('settlements.gross')}:{' '}
                      <PriceDisplay amount={s.grossBookingAmount} currency={s.currency} locale={locale} />
                    </p>
                    <p>
                      {t('settlements.commission')}:{' '}
                      <PriceDisplay amount={s.platformCommissionTotal} currency={s.currency} locale={locale} />
                    </p>
                    {s.paidAt ? (
                      <p>
                        {t('settlements.paidAt')}: {new Date(s.paidAt).toLocaleString(locale)}
                        {s.paymentReference ? ` · ${s.paymentReference}` : ''}
                      </p>
                    ) : null}
                    {s.items?.map((item) => (
                      <p key={item.id} className="font-mono text-xs text-muted">
                        {item.publicCode} · {item.bookingDate}
                      </p>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section data-testid="owner-financial-adjustments" className="space-y-3">
        <h2 className="text-lg font-bold text-navy">{t('adjustments.title')}</h2>
        <p className="text-sm text-muted">{t('adjustments.subtitle')}</p>
        {adjustments.length === 0 ? (
          <Card className="glass-panel rounded-2xl border-primary/12">
            <CardContent className="py-8 text-center text-muted">{t('adjustments.empty')}</CardContent>
          </Card>
        ) : (
          adjustments.map((adj) => (
            <Card
              key={adj.id}
              data-testid={`owner-adjustment-${adj.id}`}
              className="glass-panel rounded-2xl border-primary/12"
            >
              <CardContent className="space-y-1 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-navy">
                    {adj.bookingPublicCode ?? adj.bookingId}
                  </p>
                  <Badge variant="muted">{t(`adjustments.status.${adj.status}`)}</Badge>
                </div>
                <p className="text-muted">
                  {adj.type === 'owner_cancel_penalty' ||
                  adj.type === 'owner_no_show_penalty' ||
                  adj.type === 'access_denied_penalty' ||
                  adj.type === 'other'
                    ? t(`adjustments.type.${adj.type}`)
                    : adj.type}
                </p>
                <PriceDisplay amount={adj.amount} currency={adj.currency} locale={locale} />
                <p className="text-muted">{adj.reason}</p>
                <p className="text-xs text-muted">
                  {t('adjustments.createdAt')}: {new Date(adj.createdAt).toLocaleString(locale)}
                </p>
              </CardContent>
            </Card>
          ))
        )}
        <p className="text-sm text-muted">
          {t('adjustments.reviewHint')}{' '}
          <Link href="/contact" className="text-primary underline-offset-2 hover:underline">
            {t('adjustments.contactLink')}
          </Link>
        </p>
      </section>

      <p className="text-sm text-muted">{t('payoutsSubtitle')}</p>
      {rows.length === 0 ? (
        <Card className="glass-panel rounded-2xl border-primary/12">
          <CardContent className="py-16 text-center text-muted">{t('payoutsEmpty')}</CardContent>
        </Card>
      ) : (
        rows.map((p) => (
          <Card key={p.paymentId} className="glass-panel rounded-2xl border-primary/12">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-mono text-sm font-semibold text-navy">{p.publicCode}</p>
                <p className="text-sm text-muted">{p.date}</p>
              </div>
              <div className="text-end">
                <PriceDisplay amount={p.ownerNetPayoutAmount} currency={p.currency} locale={locale} />
                <Badge variant="muted" className="mt-2">
                  {t(`payoutStatus.${p.payoutStatus}`)}
                </Badge>
                {p.blocked && p.blockedReason && (
                  <p className="mt-1 text-xs text-danger">{t(`blockedReason.${p.blockedReason}`)}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
