'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { SponsoredPlacementOrderRow, SponsoredPlacementPackageRow } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PriceDisplay } from '@/components/marketplace/price-display';
import {
  createOwnerSponsorshipOrder,
  fetchOwnerSponsorshipOrders,
  fetchOwnerSponsorshipPackages,
} from '@/lib/api-owner';

export function OwnerSponsorshipPanel({
  propertyId,
  published,
}: {
  propertyId: string;
  published: boolean;
}) {
  const t = useTranslations('owner.sponsorship');
  const locale = useLocale() as 'ar' | 'en';
  const [packages, setPackages] = useState<SponsoredPlacementPackageRow[]>([]);
  const [orders, setOrders] = useState<SponsoredPlacementOrderRow[]>([]);
  const [packageId, setPackageId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const [pkgs, ords] = await Promise.all([
      fetchOwnerSponsorshipPackages(),
      fetchOwnerSponsorshipOrders(propertyId),
    ]);
    setPackages(pkgs.data);
    setOrders(ords.data);
    setPackageId((current) => current || pkgs.data[0]?.id || '');
  }, [propertyId]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'error'));
  }, [load]);

  const selected = packages.find((p) => p.id === packageId);

  async function onRequest() {
    if (!selected) return;
    setError(null);
    try {
      await createOwnerSponsorshipOrder(propertyId, selected.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
    }
  }

  return (
    <Card className="glass-panel rounded-3xl border-primary/12" data-testid="owner-promote">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <p className="text-sm text-muted">{t('hint')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {published ? (
          <>
            <Button type="button" data-testid="promote-open" onClick={() => setOpen((v) => !v)}>
              {t('cta')}
            </Button>
            {open ? (
              <div className="space-y-3 rounded-2xl border border-border p-4">
                <select
                  data-testid="package-select"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  value={packageId}
                  onChange={(e) => setPackageId(e.target.value)}
                >
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {locale === 'ar' ? p.nameAr : p.nameEn} — {p.durationDays} {t('days')}
                    </option>
                  ))}
                </select>
                {selected ? (
                  <p className="text-sm text-navy" data-testid="package-preview">
                    <PriceDisplay amount={selected.priceAmount} currency={selected.currency} locale={locale} />
                    <span className="ms-2 text-muted">
                      {selected.durationDays} {t('days')}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-muted">{t('noPackages')}</p>
                )}
                <Button
                  type="button"
                  data-testid="promote-confirm"
                  disabled={!selected}
                  onClick={() => void onRequest()}
                >
                  {t('confirm')}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">{t('publishFirst')}</p>
        )}
        <ul className="space-y-2">
          {orders.map((o) => (
            <li
              key={o.id}
              className="rounded-xl border border-border px-3 py-2 text-sm"
              data-testid={`sponsorship-order-row-${o.status}`}
            >
              <span className="font-medium">
                {locale === 'ar' ? o.packageNameArSnapshot : o.packageNameEnSnapshot}
              </span>
              <Badge variant="muted" className="ms-2">
                {t(`status.${o.status}`)}
              </Badge>
              {o.placementStartsAt && o.placementEndsAt ? (
                <p className="mt-1 text-muted">
                  {t('activeWindow', {
                    start: o.placementStartsAt.slice(0, 10),
                    end: o.placementEndsAt.slice(0, 10),
                  })}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
