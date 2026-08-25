'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PropertyCouponRow, PropertyPromotionRow } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  activateOwnerCoupon,
  activateOwnerPromotion,
  createOwnerCoupon,
  createOwnerPromotion,
  fetchOwnerCoupons,
  fetchOwnerPromotions,
  pauseOwnerCoupon,
  pauseOwnerPromotion,
} from '@/lib/api-owner';

function toIsoStart(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}
function toIsoEnd(date: string) {
  return new Date(`${date}T23:59:59.000Z`).toISOString();
}

export function OwnerPromotionsPanel({ propertyId }: { propertyId: string }) {
  const t = useTranslations('owner.promotions');
  const [items, setItems] = useState<PropertyPromotionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [titleAr, setTitleAr] = useState('عرض خاص');
  const [titleEn, setTitleEn] = useState('Special offer');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [discountValue, setDiscountValue] = useState('10');
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [period, setPeriod] = useState('');

  const load = useCallback(async () => {
    const res = await fetchOwnerPromotions(propertyId);
    setItems(res.data);
  }, [propertyId]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'error'));
  }, [load]);

  async function onCreate() {
    setError(null);
    try {
      const created = await createOwnerPromotion(propertyId, {
        titleAr,
        titleEn,
        discountType,
        discountValue: Number(discountValue),
        startsAt: toIsoStart(start),
        endsAt: toIsoEnd(end),
        period: period ? (period as PropertyPromotionRow['period']) : null,
      });
      await activateOwnerPromotion(propertyId, created.data.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
    }
  }

  return (
    <Card className="glass-panel rounded-3xl border-primary/12" data-testid="owner-promotions">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input data-testid="promo-title-ar" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
          <Input data-testid="promo-title-en" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
          <select
            data-testid="promo-type"
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed_amount')}
          >
            <option value="percentage">{t('percentage')}</option>
            <option value="fixed_amount">{t('fixed')}</option>
          </select>
          <Input
            data-testid="promo-value"
            type="number"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
          />
          <Input data-testid="promo-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input data-testid="promo-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          <select
            data-testid="promo-period"
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm sm:col-span-2"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="">{t('allPeriods')}</option>
            <option value="morning">morning</option>
            <option value="evening">evening</option>
            <option value="full_day">full_day</option>
            <option value="overnight">overnight</option>
          </select>
        </div>
        <Button type="button" data-testid="promo-create" className="shadow-soft" onClick={() => void onCreate()}>
          {t('createActivate')}
        </Button>
        <ul className="space-y-2">
          {items.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
              data-testid={`promo-row-${p.status}`}
            >
              <span>
                {p.titleAr} · {p.discountType === 'percentage' ? `${p.discountValue}%` : `${p.discountValue} JOD`}
                {p.period ? ` · ${p.period}` : ''}
              </span>
              <span className="flex items-center gap-2">
                <Badge variant="muted">{p.status}</Badge>
                {p.status === 'active' ? (
                  <Button size="sm" variant="outline" onClick={() => void pauseOwnerPromotion(propertyId, p.id).then(load)}>
                    {t('pause')}
                  </Button>
                ) : p.status === 'paused' || p.status === 'draft' ? (
                  <Button size="sm" variant="outline" onClick={() => void activateOwnerPromotion(propertyId, p.id).then(load)}>
                    {t('activate')}
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        <OwnerCouponsSection propertyId={propertyId} />
      </CardContent>
    </Card>
  );
}

function OwnerCouponsSection({ propertyId }: { propertyId: string }) {
  const t = useTranslations('owner.coupons');
  const [items, setItems] = useState<PropertyCouponRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('SAVE10');
  const [discountValue, setDiscountValue] = useState('10');
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 14);
    return d.toISOString().slice(0, 10);
  });

  const load = useCallback(async () => {
    const res = await fetchOwnerCoupons(propertyId);
    setItems(res.data);
  }, [propertyId]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'error'));
  }, [load]);

  async function onCreate() {
    setError(null);
    try {
      const created = await createOwnerCoupon(propertyId, {
        code,
        discountType: 'percentage',
        discountValue: Number(discountValue),
        startsAt: toIsoStart(start),
        endsAt: toIsoEnd(end),
        maxUsesPerCustomer: 1,
      });
      await activateOwnerCoupon(propertyId, created.data.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
    }
  }

  return (
    <div className="space-y-3 border-t border-border pt-4" data-testid="owner-coupons">
      <p className="font-medium text-navy">{t('title')}</p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input data-testid="coupon-code" value={code} onChange={(e) => setCode(e.target.value)} />
        <Input
          data-testid="coupon-value"
          type="number"
          value={discountValue}
          onChange={(e) => setDiscountValue(e.target.value)}
        />
        <Input data-testid="coupon-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input data-testid="coupon-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <Button type="button" data-testid="coupon-create" onClick={() => void onCreate()}>
        {t('createActivate')}
      </Button>
      <ul className="space-y-2">
        {items.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
            data-testid={`coupon-row-${c.status}`}
          >
            <span>
              {c.normalizedCode} · {c.discountValue}% · {t('uses', { count: c.usageCount })}
            </span>
            <span className="flex items-center gap-2">
              <Badge variant="muted">{c.status}</Badge>
              {c.status === 'active' ? (
                <Button size="sm" variant="outline" onClick={() => void pauseOwnerCoupon(propertyId, c.id).then(load)}>
                  {t('pause')}
                </Button>
              ) : c.status === 'paused' || c.status === 'draft' ? (
                <Button size="sm" variant="outline" onClick={() => void activateOwnerCoupon(propertyId, c.id).then(load)}>
                  {t('activate')}
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
