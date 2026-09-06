'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Loader2, ExternalLink } from 'lucide-react';
import type { AdminPropertyRow } from '@mazare3/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchAdminProperties } from '@/lib/api-admin';
import { PriceDisplay } from '@/components/marketplace/price-display';

export function AdminPropertiesView() {
  const t = useTranslations('admin');
  const locale = useLocale() as 'ar' | 'en';
  const [items, setItems] = useState<AdminPropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchAdminProperties();
        setItems(res.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) {
    return (
      <div data-testid="admin-properties" className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">{error}</p>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="glass-panel rounded-2xl border-primary/12">
        <CardContent className="py-16 text-center text-muted">{t('propertiesEmpty')}</CardContent>
      </Card>
    );
  }

  return (
    <div data-testid="admin-properties" className="overflow-x-auto rounded-2xl border border-primary/12 bg-surface shadow-card">
      <table className="w-full min-w-[900px] text-start text-sm">
        <thead>
          <tr className="border-b border-border bg-primary-soft/40 text-muted">
            <th className="px-4 py-3">{t('colProperty')}</th>
            <th className="px-4 py-3">{t('colOwner')}</th>
            <th className="px-4 py-3">{t('colArea')}</th>
            <th className="px-4 py-3">{t('colStatus')}</th>
            <th className="px-4 py-3">{t('colVerification')}</th>
            <th className="px-4 py-3">{t('colPrice')}</th>
            <th className="px-4 py-3">{t('colBookings')}</th>
            <th className="px-4 py-3">{t('colActions')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const title = locale === 'ar' ? p.titleAr : p.titleEn;
            return (
              <tr key={p.id} className="border-b border-border/60">
                <td className="px-4 py-3 font-medium text-navy">{title}</td>
                <td className="px-4 py-3">
                  <span className="block">{p.ownerDisplayName}</span>
                  <span className="text-xs text-muted">{p.ownerEmail ?? '—'}</span>
                </td>
                <td className="px-4 py-3">
                  {p.area && p.city ? `${p.area} — ${p.city}` : p.city || p.area || '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="muted">{t(`propertyStatus.${p.status}`)}</Badge>
                </td>
                <td className="px-4 py-3 text-xs">{t(`verification.${p.verificationStatus}`)}</td>
                <td className="px-4 py-3">
                  {p.basePrice != null ? (
                    <PriceDisplay amount={p.basePrice} currency={p.currency} locale={locale} />
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3">{p.bookingsCount}</td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/admin/properties/${p.id}`}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t('viewDetails')}
                    </Link>
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
