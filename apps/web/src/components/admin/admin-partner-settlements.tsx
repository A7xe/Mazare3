'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { OwnerSettlementCycleInfo, OwnerSettlementPreview, OwnerSettlementSummary } from '@mazare3/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  cancelAdminSettlement,
  createAdminPartnerSettlement,
  fetchAdminPartnerSettlements,
  fetchAdminSettlementPreview,
  finalizeAdminSettlement,
  markAdminSettlementPaid,
} from '@/lib/api-admin';
import { PriceDisplay } from '@/components/marketplace/price-display';

export function AdminPartnerSettlements({ ownerId }: { ownerId: string }) {
  const t = useTranslations('admin');
  const locale = useLocale() as 'ar' | 'en';
  const [through, setThrough] = useState(() => new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<OwnerSettlementPreview | null>(null);
  const [rows, setRows] = useState<OwnerSettlementSummary[]>([]);
  const [cycle, setCycle] = useState<OwnerSettlementCycleInfo | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [refById, setRefById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetchAdminPartnerSettlements(ownerId);
    setRows(res.data);
    setCycle(res.cycle);
  }, [ownerId]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : t('loadError')));
  }, [load, t]);

  async function runPreview() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetchAdminSettlementPreview(ownerId, through);
      setPreview(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setBusy(false);
    }
  }

  async function createDraft() {
    setBusy(true);
    setError(null);
    try {
      await createAdminPartnerSettlement(ownerId, { through });
      await load();
      await runPreview();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-2xl border-primary/12" data-testid="admin-settlements">
      <CardHeader>
        <CardTitle>{t('settlements.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {cycle ? (
          <div className="rounded-xl border border-primary/15 bg-primary-soft/60 px-3 py-3 text-sm" data-testid="admin-settlement-cycle">
            <p>
              {t('settlements.cycleDays')}: {cycle.cycleDays}
            </p>
            <p>
              {t('settlements.nextExpected')}: {cycle.nextExpectedPeriodEnd ?? '—'}
            </p>
            <p>
              {t('settlements.lastGenerated')}:{' '}
              {cycle.lastGeneratedPeriodStart && cycle.lastGeneratedPeriodEnd
                ? `${cycle.lastGeneratedPeriodStart} → ${cycle.lastGeneratedPeriodEnd}`
                : '—'}
            </p>
            <p>
              {t('settlements.draftForCycle')}:{' '}
              {cycle.draftExistsForCurrentCycle ? t('settlements.yes') : t('settlements.no')}
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-muted">{t('settlements.through')}</label>
            <Input
              type="date"
              data-testid="admin-settlement-through"
              value={through}
              onChange={(e) => setThrough(e.target.value)}
            />
          </div>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void runPreview()}>
            {t('settlements.preview')}
          </Button>
          <Button size="sm" disabled={busy} data-testid="admin-settlement-create" onClick={() => void createDraft()}>
            {t('settlements.create')}
          </Button>
        </div>
        {preview ? (
          <div className="rounded-xl bg-primary-soft px-3 py-3 text-sm" data-testid="admin-settlement-preview">
            <p>
              {t('settlements.eligibleCount')}: {preview.eligibleCount} · {t('settlements.excludedCount')}:{' '}
              {preview.excludedCount}
            </p>
            <p>
              {t('settlements.net')}:{' '}
              <PriceDisplay amount={preview.ownerNetAmount} currency={preview.currency} locale={locale} />
            </p>
          </div>
        ) : null}
        <ul className="space-y-2">
          {rows.map((s) => (
            <li key={s.id} className="rounded-xl border border-border px-3 py-2" data-testid={`admin-settlement-${s.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" className="text-start text-sm font-medium text-navy" onClick={() => setOpenId(openId === s.id ? null : s.id)}>
                  {s.periodStart} → {s.periodEnd} · {s.itemCount}
                </button>
                <Badge variant={s.status === 'paid' ? 'highlight' : 'muted'}>
                  {t(`settlements.status.${s.status}`)}
                </Badge>
              </div>
              {openId === s.id ? (
                <div className="mt-2 space-y-2 text-sm">
                  <PriceDisplay amount={s.ownerNetAmount} currency={s.currency} locale={locale} />
                  {s.items?.map((item) => (
                    <p key={item.id} className="font-mono text-xs">
                      {item.publicCode}
                    </p>
                  ))}
                  {s.status === 'draft' ? (
                    <Button size="sm" disabled={busy} onClick={() => void finalizeAdminSettlement(s.id).then(load)}>
                      {t('settlements.finalize')}
                    </Button>
                  ) : null}
                  {s.status === 'ready' ? (
                    <div className="flex flex-wrap gap-2">
                      <Input
                        placeholder={t('settlements.reference')}
                        value={refById[s.id] ?? ''}
                        onChange={(e) => setRefById((m) => ({ ...m, [s.id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        data-testid={`admin-settlement-pay-${s.id}`}
                        disabled={busy}
                        onClick={() =>
                          void markAdminSettlementPaid(s.id, {
                            paymentReference: refById[s.id] || 'MANUAL',
                          }).then(load)
                        }
                      >
                        {t('settlements.markPaid')}
                      </Button>
                    </div>
                  ) : null}
                  {s.status === 'draft' || s.status === 'ready' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void cancelAdminSettlement(s.id).then(load)}
                    >
                      {t('settlements.cancel')}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
