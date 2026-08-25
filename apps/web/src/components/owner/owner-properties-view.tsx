'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Building2, CalendarRange, Loader2, MapPin, Plus } from 'lucide-react';
import type { OwnerPropertyCard } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchOwnerProperties } from '@/lib/api-owner';
import { PriceDisplay } from '@/components/marketplace/price-display';

export function OwnerPropertiesView() {
  const t = useTranslations('owner');
  const locale = useLocale() as 'ar' | 'en';
  const [items, setItems] = useState<OwnerPropertyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchOwnerProperties();
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
      <div className="flex justify-center py-20">
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
      <Card className="glass-panel rounded-3xl border-primary/12">
        <CardContent className="py-16 text-center text-muted">{t('propertiesEmpty')}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Button asChild className="shadow-soft" data-testid="owner-add-property">
        <Link href="/owner/properties/new">
          <Plus className="h-4 w-4" />
          {t('addProperty')}
        </Link>
      </Button>
    <div className="grid gap-4 md:grid-cols-2" data-testid="owner-properties-list">
      {items.map((p) => {
        const title = locale === 'ar' ? p.titleAr : p.titleEn;
        return (
          <Card key={p.id} className="glass-panel overflow-hidden rounded-3xl border-primary/12">
            <div className="gradient-primary h-1" />
            {p.imageUrl && (
              <div
                className="h-36 bg-cover bg-center"
                style={{ backgroundImage: `url(${p.imageUrl})` }}
              />
            )}
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg">
                  <Link href={`/owner/properties/${p.id}`} className="hover:text-primary hover:underline">
                    {title}
                  </Link>
                </CardTitle>
                <Badge variant="muted">{t(`propertyStatus.${p.status}`)}</Badge>
              </div>
              <p className="flex items-center gap-1 text-sm text-muted">
                <MapPin className="h-3.5 w-3.5" />
                {p.area} — {p.city}
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <PriceDisplay amount={p.basePrice} currency={p.currency} locale={locale} />
                <p className="mt-1 text-xs text-muted">
                  {t('bookingsCount', { count: p.bookingsCount })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/owner/properties/${p.id}/edit`} data-testid="owner-edit-property">
                    <Building2 className="h-4 w-4" />
                    {t('editProperty')}
                  </Link>
                </Button>
                <Button size="sm" asChild className="shadow-soft">
                  <Link href={`/owner/availability?propertyId=${p.id}`}>
                    <CalendarRange className="h-4 w-4" />
                    {t('manageAvailability')}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
    </div>
  );
}
