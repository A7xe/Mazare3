'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { SponsoredPlacementOrderRow, SponsoredPlacementPackageRow } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  activateAdminSponsorshipOrder,
  approveAdminSponsorshipOrder,
  confirmAdminSponsorshipPayment,
  createAdminSponsorshipPackage,
  fetchAdminSponsorshipOrders,
  fetchAdminSponsorshipPackages,
  rejectAdminSponsorshipOrder,
} from '@/lib/api-admin';

export function AdminSponsorshipView() {
  const t = useTranslations('admin.sponsorship');
  const locale = useLocale() as 'ar' | 'en';
  const [packages, setPackages] = useState<SponsoredPlacementPackageRow[]>([]);
  const [orders, setOrders] = useState<SponsoredPlacementOrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nameAr, setNameAr] = useState('إعلان ٧ أيام');
  const [nameEn, setNameEn] = useState('7-day sponsored');
  const [days, setDays] = useState('7');
  const [price, setPrice] = useState('25');
  const [payRef, setPayRef] = useState('SPON-TEST-1');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    const [pkgs, ords] = await Promise.all([
      fetchAdminSponsorshipPackages(),
      fetchAdminSponsorshipOrders(),
    ]);
    setPackages(pkgs.data);
    setOrders(ords.data);
  }, []);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'error'));
  }, [load]);

  async function onCreatePackage() {
    setError(null);
    try {
      await createAdminSponsorshipPackage({
        nameAr,
        nameEn,
        durationDays: Number(days),
        priceAmount: Number(price),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Card className="rounded-2xl border-primary/12" data-testid="admin-sponsorship-packages">
        <CardHeader>
          <CardTitle>{t('packagesTitle')}</CardTitle>
          <p className="text-sm text-muted">{t('packagesHint')}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input data-testid="package-name-ar" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
            <Input data-testid="package-name-en" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            <Input data-testid="package-days" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
            <Input data-testid="package-price" type="number" min={0.01} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <Button type="button" data-testid="package-create" onClick={() => void onCreatePackage()}>
            {t('createPackage')}
          </Button>
          <ul className="space-y-2">
            {packages.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                data-testid={`package-row-${p.status}`}
              >
                <span>
                  {locale === 'ar' ? p.nameAr : p.nameEn} · {p.durationDays} {t('days')} · {p.priceAmount} {p.currency}
                </span>
                <Badge variant="muted">{p.status}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-primary/12" data-testid="admin-sponsorship-orders">
        <CardHeader>
          <CardTitle>{t('ordersTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input data-testid="order-pay-ref" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            <Input data-testid="order-pay-date" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </div>
          <ul className="space-y-3">
            {orders.map((o) => (
              <li
                key={o.id}
                className="space-y-2 rounded-xl border border-border px-3 py-3 text-sm"
                data-testid={`admin-order-row-${o.status}`}
              >
                <p className="font-medium text-navy">
                  {o.ownerDisplayName} · {locale === 'ar' ? o.propertyTitleAr : o.propertyTitleEn}
                </p>
                <p className="text-muted">
                  {locale === 'ar' ? o.packageNameArSnapshot : o.packageNameEnSnapshot} · {o.durationDaysSnapshot}{' '}
                  {t('days')} · {o.priceAmountSnapshot} {o.currency}
                </p>
                {o.paymentReference ? (
                  <p className="text-muted">
                    {t('payment')}: {o.paymentReference} {o.paymentDate}
                  </p>
                ) : null}
                {o.placementStartsAt ? (
                  <p className="text-muted">
                    {o.placementStartsAt.slice(0, 10)} → {o.placementEndsAt?.slice(0, 10)}
                  </p>
                ) : null}
                <Badge variant="muted">{t(`status.${o.status}`)}</Badge>
                <div className="flex flex-wrap gap-2">
                  {o.status === 'pending_review' ? (
                    <>
                      <Button size="sm" data-testid="order-approve" onClick={() => void approveAdminSponsorshipOrder(o.id).then(load)}>
                        {t('approve')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid="order-reject"
                        onClick={() => void rejectAdminSponsorshipOrder(o.id).then(load)}
                      >
                        {t('reject')}
                      </Button>
                    </>
                  ) : null}
                  {o.status === 'approved_pending_payment' ? (
                    <Button
                      size="sm"
                      data-testid="order-confirm-pay"
                      onClick={() =>
                        void confirmAdminSponsorshipPayment(o.id, {
                          paymentReference: payRef,
                          paymentDate: payDate,
                        }).then(load)
                      }
                    >
                      {t('confirmPayment')}
                    </Button>
                  ) : null}
                  {o.status === 'paid' ? (
                    <Button
                      size="sm"
                      data-testid="order-activate"
                      onClick={() => void activateAdminSponsorshipOrder(o.id).then(load)}
                    >
                      {t('activate')}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
