'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Loader2, MapPin, Save } from 'lucide-react';
import type { AdminPropertyDetail, PatchAdminPropertyStatusInput } from '@mazare3/shared';

const PROPERTY_STATUSES: PatchAdminPropertyStatusInput['status'][] = [
  'draft',
  'pending_review',
  'changes_requested',
  'approved',
  'published',
  'unpublished',
  'suspended',
  'rejected',
];
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchAdminProperty, patchAdminPropertyStatus } from '@/lib/api-admin';
import { PriceDisplay } from '@/components/marketplace/price-display';

export function AdminPropertyDetailView({ propertyId }: { propertyId: string }) {
  const t = useTranslations('admin');
  const locale = useLocale() as 'ar' | 'en';
  const [property, setProperty] = useState<AdminPropertyDetail | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchAdminProperty(propertyId);
        setProperty(res.data);
        setStatus(res.data.status);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [propertyId, t]);

  async function applyStatus(next: PatchAdminPropertyStatusInput['status']) {
    setSaving(true);
    setError(null);
    try {
      const res = await patchAdminPropertyStatus(propertyId, { status: next });
      setProperty(res.data);
      setStatus(res.data.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function saveStatus() {
    if (!property || status === property.status) return;
    await applyStatus(status as PatchAdminPropertyStatusInput['status']);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !property) {
    return (
      <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">
        {error ?? t('propertyNotFound')}
      </p>
    );
  }

  if (!property) return null;

  const title = locale === 'ar' ? property.titleAr : property.titleEn;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="gap-1">
        <Link href="/admin/properties">
          <ArrowLeft className="h-4 w-4" />
          {t('backToProperties')}
        </Link>
      </Button>
      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">{error}</p>
      )}
      <Card className="glass-panel overflow-hidden rounded-2xl border-primary/12">
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
          <p className="text-sm text-muted">
            {t('colOwner')}: {property.ownerDisplayName} ({property.ownerEmail})
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-6">
            <PriceDisplay amount={property.basePrice} currency={property.currency} locale={locale} large />
            <p className="text-sm text-muted">
              {t('bookingsCount', { count: property.bookingsCount })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(property.status === 'pending_review' ||
              property.status === 'approved' ||
              property.status === 'draft') && (
              <Button
                size="sm"
                className="shadow-soft"
                disabled={saving}
                data-testid="admin-property-publish"
                onClick={() => void applyStatus('published')}
              >
                {t('publishProperty')}
              </Button>
            )}
            {property.status === 'pending_review' && (
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void applyStatus('changes_requested')}
              >
                {t('requestChanges')}
              </Button>
            )}
            {property.status === 'published' && (
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void applyStatus('suspended')}
              >
                {t('suspendProperty')}
              </Button>
            )}
            {(property.status === 'pending_review' || property.status === 'draft') && (
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void applyStatus('rejected')}
              >
                {t('rejectProperty')}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-navy">{t('changeStatus')}</span>
              <select
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {PROPERTY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`propertyStatus.${s}`)}
                  </option>
                ))}
              </select>
            </label>
            <Button
              className="shadow-soft"
              disabled={saving || status === property.status}
              onClick={() => void saveStatus()}
            >
              <Save className="h-4 w-4" />
              {t('saveStatus')}
            </Button>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/properties/${property.slug}`}>{t('viewPublic')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
