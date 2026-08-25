'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Loader2, MapPin, Save } from 'lucide-react';
import Image from 'next/image';
import {
  assessPropertyMedia,
  type AdminPropertyDetail,
  type PatchAdminPropertyStatusInput,
} from '@mazare3/shared';
import { PropertyMediaQualityBox } from '@/components/property/property-media-quality-box';
import { AdminPropertyPlacementsPanel } from '@/components/admin/admin-property-placements-panel';

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
import {
  AdminApiError,
  disableAdminCoupon,
  disableAdminPromotion,
  fetchAdminProperty,
  patchAdminPropertyStatus,
} from '@/lib/api-admin';
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
      if (e instanceof AdminApiError && e.code === 'PROPERTY_MIN_MEDIA_REQUIRED') {
        setError(t('mediaMinRequired'));
      } else if (e instanceof AdminApiError && e.code === 'AVAILABILITY_SCHEDULE_REQUIRED') {
        setError(t('availabilityScheduleRequired'));
      } else if (e instanceof AdminApiError && e.code === 'AVAILABILITY_SLOTS_REQUIRED') {
        setError(t('availabilitySlotsRequired'));
      } else {
        setError(e instanceof Error ? e.message : t('saveError'));
      }
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
  const media = property.media ?? [];
  const coverUrl = media[0]?.url ?? property.imageUrl;
  const mediaAssessment = assessPropertyMedia(media.map((m) => ({ sortOrder: m.sortOrder })));

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="gap-1">
        <Link href="/admin/properties">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('backToProperties')}
        </Link>
      </Button>
      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">{error}</p>
      )}
      <Card className="glass-panel overflow-hidden rounded-2xl border-primary/12">
        <div className="gradient-primary h-1" />
        {coverUrl && (
          <div className="relative h-48 bg-cover bg-center">
            <Image src={coverUrl} alt={title} fill className="object-cover" priority />
          </div>
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
          <PropertyMediaQualityBox
            media={media.map((m) => ({ sortOrder: m.sortOrder }))}
            namespace="admin"
          />
          {property.availabilityHealth && (
            <div
              data-testid="admin-availability-health"
              className="rounded-2xl border border-primary/12 bg-primary-soft/20 p-4 text-sm"
            >
              <p className="font-medium text-navy">{t('availabilityHealthTitle')}</p>
              <p className="mt-2 text-muted">
                {t('availabilityHealthRules', {
                  count: property.availabilityHealth.enabledRuleCount,
                })}
              </p>
              <p className="text-muted">
                {t('availabilityHealthFuture', {
                  count: property.availabilityHealth.futureBookableCount,
                })}
              </p>
              {property.availabilityHealth.earliestAvailableDate &&
                property.availabilityHealth.latestAvailableDate && (
                  <p className="text-muted">
                    {t('availabilityHealthRange', {
                      from: property.availabilityHealth.earliestAvailableDate,
                      to: property.availabilityHealth.latestAvailableDate,
                    })}
                  </p>
                )}
              {property.availabilityHealth.usesLegacyFallback && (
                <p className="mt-1 text-muted">{t('availabilityHealthLegacy')}</p>
              )}
              {property.availabilityHealth.warning && (
                <p className="mt-2 text-navy">
                  {t(`availabilityWarning.${property.availabilityHealth.warning}`)}
                </p>
              )}
            </div>
          )}

          {property.promotions && property.promotions.length > 0 ? (
            <div className="space-y-2" data-testid="admin-promotions">
              <p className="font-medium text-navy">{t('promotionsTitle')}</p>
              {property.promotions.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <span>
                    {p.titleAr} · {p.status} ·{' '}
                    {p.discountType === 'percentage' ? `${p.discountValue}%` : `${p.discountValue} JOD`}
                  </span>
                  {p.status === 'active' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void disableAdminPromotion(property.id, p.id).then(() =>
                          fetchAdminProperty(property.id).then((r) => setProperty(r.data)),
                        )
                      }
                    >
                      {t('disablePromotion')}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {property.coupons && property.coupons.length > 0 ? (
            <div className="space-y-2" data-testid="admin-coupons">
              <p className="font-medium text-navy">{t('couponsTitle')}</p>
              {property.coupons.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <span>
                    {c.normalizedCode} · {c.status} · {c.discountValue}% · uses {c.usageCount}
                  </span>
                  {c.status === 'active' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void disableAdminCoupon(property.id, c.id).then(() =>
                          fetchAdminProperty(property.id).then((r) => setProperty(r.data)),
                        )
                      }
                    >
                      {t('disableCoupon')}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <AdminPropertyPlacementsPanel propertyId={property.id} />

          <div className="flex flex-wrap gap-2">
            {(property.status === 'pending_review' ||
              property.status === 'approved' ||
              property.status === 'draft') && (
              <Button
                size="sm"
                className="shadow-soft"
                disabled={saving || !mediaAssessment.canPublish}
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

          {media.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-navy">{t('propertyMediaGallery')}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {media.map((m, i) => (
                  <div
                    key={m.id}
                    className={`relative aspect-[4/3] overflow-hidden rounded-xl border ${
                      i === 0 ? 'border-primary/60' : 'border-border'
                    }`}
                  >
                    <Image src={m.url} alt={title} fill className="object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
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
              disabled={
                saving ||
                status === property.status ||
                (status === 'published' && !mediaAssessment.canPublish)
              }
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
