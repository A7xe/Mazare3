'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PlatformCouponRow } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  activateAdminPlatformCoupon,
  createAdminPlatformCoupon,
  fetchAdminPlatformCoupons,
  pauseAdminPlatformCoupon,
} from '@/lib/api-admin';

function toIsoStart(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}
function toIsoEnd(date: string) {
  return new Date(`${date}T23:59:59.000Z`).toISOString();
}

export function AdminPlatformCouponsView() {
  const t = useTranslations('admin.platformCoupons');
  const [items, setItems] = useState<PlatformCouponRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('PLAT20');
  const [titleAr, setTitleAr] = useState('خصم المنصة');
  const [titleEn, setTitleEn] = useState('Platform discount');
  const [discountValue, setDiscountValue] = useState('20');
  const [propertyId, setPropertyId] = useState('');
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 21);
    return d.toISOString().slice(0, 10);
  });

  const load = useCallback(async () => {
    const res = await fetchAdminPlatformCoupons();
    setItems(res.data);
  }, []);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'error'));
  }, [load]);

  async function onCreate() {
    setError(null);
    try {
      const created = await createAdminPlatformCoupon({
        code,
        titleAr,
        titleEn,
        discountType: 'fixed_amount',
        discountValue: Number(discountValue),
        startsAt: toIsoStart(start),
        endsAt: toIsoEnd(end),
        maxUsesPerCustomer: 1,
        propertyId: propertyId.trim() || null,
      });
      await activateAdminPlatformCoupon(created.data.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
    }
  }

  return (
    <Card className="rounded-2xl border-primary/12" data-testid="admin-platform-coupons">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <p className="text-sm text-muted">{t('subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input data-testid="platform-coupon-code" value={code} onChange={(e) => setCode(e.target.value)} />
          <Input
            data-testid="platform-coupon-value"
            type="number"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
          />
          <Input data-testid="platform-coupon-title-ar" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
          <Input data-testid="platform-coupon-title-en" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
          <Input data-testid="platform-coupon-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input data-testid="platform-coupon-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          <Input
            data-testid="platform-coupon-property"
            placeholder={t('propertyOptional')}
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
          />
        </div>
        <Button type="button" data-testid="platform-coupon-create" onClick={() => void onCreate()}>
          {t('createActivate')}
        </Button>
        {items.length === 0 ? <p className="text-sm text-muted">{t('empty')}</p> : null}
        <ul className="space-y-2">
          {items.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
              data-testid={`platform-coupon-row-${c.status}`}
            >
              <span>
                {c.normalizedCode} · {c.discountValue} · {c.status}
              </span>
              {c.status === 'active' ? (
                <Button size="sm" variant="outline" onClick={() => void pauseAdminPlatformCoupon(c.id).then(load)}>
                  {t('pause')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
