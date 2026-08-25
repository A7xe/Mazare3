'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, CalendarRange, Loader2, MapPin, Users } from 'lucide-react';
import type { OwnerPropertyDetail } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchOwnerProperty } from '@/lib/api-owner';
import { OwnerPromotionsPanel } from '@/components/owner/owner-promotions-panel';
import { OwnerSponsorshipPanel } from '@/components/owner/owner-sponsorship-panel';
import { PriceDisplay } from '@/components/marketplace/price-display';

export function OwnerPropertyDetailView({ propertyId }: { propertyId: string }) {
  const t = useTranslations('owner');
  const locale = useLocale() as 'ar' | 'en';
  const [property, setProperty] = useState<OwnerPropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchOwnerProperty(propertyId);
        setProperty(res.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [propertyId, t]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !property) {
    return (
      <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">
        {error ?? t('propertyNotFound')}
      </p>
    );
  }

  const title = locale === 'ar' ? property.titleAr : property.titleEn;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="gap-1">
        <Link href="/owner/properties">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('backToProperties')}
        </Link>
      </Button>
      <Card className="glass-panel overflow-hidden rounded-3xl border-primary/12">
        <div className="gradient-primary h-1" />
        {property.imageUrl && (
          <div
            className="h-48 bg-cover bg-center"
            style={{ backgroundImage: `url(${property.imageUrl})` }}
          />
        )}
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="text-2xl text-navy">{title}</CardTitle>
            <Badge variant="highlight">{t(`propertyStatus.${property.status}`)}</Badge>
          </div>
          <p className="flex items-center gap-1 text-muted">
            <MapPin className="h-4 w-4" />
            {property.area} — {property.city}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <PriceDisplay
              amount={property.basePrice}
              currency={property.currency}
              locale={locale}
              large
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Users className="h-4 w-4 text-primary" />
            {t('capacity', { count: property.capacity })}
          </div>
          <p className="text-sm text-muted sm:col-span-2">
            {t('upcomingBookings', { count: property.upcomingBookingsCount })}
          </p>
          <Button asChild className="shadow-soft sm:col-span-2 sm:w-fit">
            <Link href={`/owner/availability?propertyId=${property.id}`}>
              <CalendarRange className="h-4 w-4" />
              {t('manageAvailability')}
            </Link>
          </Button>
        </CardContent>
      </Card>
      <OwnerSponsorshipPanel propertyId={property.id} published={property.status === 'published'} />
      <OwnerPromotionsPanel propertyId={property.id} />
    </div>
  );
}
