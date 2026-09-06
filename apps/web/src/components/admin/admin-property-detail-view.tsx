'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Loader2, MapPin } from 'lucide-react';
import Image from 'next/image';
import {
  assessPropertyMedia,
  getAllowedAdminPropertyTransitions,
  PROPERTY_REVIEW_CHANGE_REASON_MIN,
  PROPERTY_REVIEW_REJECTION_REASON_MIN,
  type AdminPropertyDetail,
  type PatchAdminPropertyStatusInput,
} from '@mazare3/shared';
import { PropertyMediaQualityBox } from '@/components/property/property-media-quality-box';
import { AdminPropertyPlacementsPanel } from '@/components/admin/admin-property-placements-panel';
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changeReasonOpen, setChangeReasonOpen] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [changeReasonError, setChangeReasonError] = useState<string | null>(null);
  const [rejectReasonOpen, setRejectReasonOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectReasonError, setRejectReasonError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchAdminProperty(propertyId);
        setProperty(res.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [propertyId, t]);

  async function applyStatus(
    next: PatchAdminPropertyStatusInput['status'],
    reason?: string,
  ) {
    setSaving(true);
    setError(null);
    try {
      const payload: PatchAdminPropertyStatusInput =
        next === 'changes_requested' || next === 'rejected'
          ? { status: next, reason: reason?.trim() }
          : { status: next };
      const res = await patchAdminPropertyStatus(propertyId, payload);
      setProperty(res.data);
      setChangeReasonOpen(false);
      setChangeReason('');
      setChangeReasonError(null);
      setRejectReasonOpen(false);
      setRejectReason('');
      setRejectReasonError(null);
    } catch (e) {
      if (e instanceof AdminApiError && e.code === 'PROPERTY_MIN_MEDIA_REQUIRED') {
        setError(t('mediaMinRequired'));
      } else if (e instanceof AdminApiError && e.code === 'AVAILABILITY_SCHEDULE_REQUIRED') {
        setError(t('availabilityScheduleRequired'));
      } else if (e instanceof AdminApiError && e.code === 'AVAILABILITY_SLOTS_REQUIRED') {
        setError(t('availabilitySlotsRequired'));
      } else if (
        e instanceof AdminApiError &&
        e.code === 'INVALID_PROPERTY_STATUS_TRANSITION'
      ) {
        setError(t('invalidPropertyStatusTransition'));
      } else if (e instanceof AdminApiError && e.code === 'VALIDATION_ERROR') {
        const msg = e.message || t('propertyRequestChangesReasonRequired');
        if (changeReasonOpen) {
          setChangeReasonError(msg);
        } else if (rejectReasonOpen) {
          setRejectReasonError(msg);
        } else {
          setError(msg);
        }
      } else {
        setError(e instanceof Error ? e.message : t('saveError'));
      }
    } finally {
      setSaving(false);
    }
  }

  function openChangeReasonDialog() {
    setChangeReasonError(null);
    setChangeReason('');
    setChangeReasonOpen(true);
  }

  function openRejectReasonDialog() {
    setRejectReasonError(null);
    setRejectReason('');
    setRejectReasonOpen(true);
  }

  async function confirmRejectReason() {
    const trimmed = rejectReason.trim();
    if (trimmed.length < PROPERTY_REVIEW_REJECTION_REASON_MIN) {
      setRejectReasonError(t('propertyRejectReasonRequired'));
      return;
    }
    await applyStatus('rejected', trimmed);
  }

  async function confirmChangeReason() {
    const trimmed = changeReason.trim();
    if (trimmed.length < PROPERTY_REVIEW_CHANGE_REASON_MIN) {
      setChangeReasonError(t('propertyRequestChangesReasonRequired'));
      return;
    }
    await applyStatus('changes_requested', trimmed);
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
  const allowedTransitions = getAllowedAdminPropertyTransitions(property.status);
  const canPublish =
    allowedTransitions.includes('published') && mediaAssessment.canPublish;
  const canRequestChanges = allowedTransitions.includes('changes_requested');

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
          {property.status === 'approved' ? (
            <p
              className="text-sm text-muted"
              data-testid="admin-property-approved-hint"
            >
              {t('propertyApprovedNotPublishedHint')}
            </p>
          ) : null}
          <p className="flex items-center gap-1 text-muted">
            <MapPin className="h-4 w-4" />
            {property.area && property.city
              ? `${property.area} — ${property.city}`
              : property.city || property.area || '—'}
          </p>
          <p className="text-sm text-muted">
            {t('colOwner')}: {property.ownerDisplayName} ({property.ownerEmail ?? '—'})
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-6">
            {property.basePrice != null ? (
              <PriceDisplay amount={property.basePrice} currency={property.currency} locale={locale} large />
            ) : (
              <p className="text-sm text-muted">—</p>
            )}
            <p className="text-sm text-muted">
              {t('bookingsCount', { count: property.bookingsCount })}
            </p>
          </div>
          {property.status === 'changes_requested' && property.reviewChangeReason ? (
            <div
              data-testid="admin-property-change-reason"
              className="rounded-2xl border border-primary/20 bg-primary-soft/30 p-4 text-sm"
            >
              <p className="font-medium text-navy">{t('activeReviewChangeReason')}</p>
              <p className="mt-2 whitespace-pre-wrap text-navy">{property.reviewChangeReason}</p>
            </div>
          ) : null}
          {property.status === 'rejected' && property.reviewRejectionReason ? (
            <div
              data-testid="admin-property-rejection-reason"
              className="rounded-2xl border border-danger/25 bg-danger/5 p-4 text-sm"
            >
              <p className="font-medium text-navy">{t('activeReviewRejectionReason')}</p>
              <p className="mt-2 whitespace-pre-wrap text-navy">{property.reviewRejectionReason}</p>
              {property.reviewRejectedAt ? (
                <p className="mt-2 text-xs text-muted">{property.reviewRejectedAt}</p>
              ) : null}
            </div>
          ) : null}
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

          <div className="flex flex-wrap gap-2" data-testid="admin-property-status-actions">
            {property.status === 'pending_review' && allowedTransitions.includes('approved') ? (
              <Button
                size="sm"
                className="shadow-soft"
                disabled={saving}
                data-testid="admin-property-approve"
                onClick={() => void applyStatus('approved')}
              >
                {t('approveProperty')}
              </Button>
            ) : null}
            {canPublish ? (
              <Button
                size="sm"
                className="shadow-soft"
                disabled={saving || !mediaAssessment.canPublish}
                data-testid="admin-property-publish"
                onClick={() => void applyStatus('published')}
              >
                {t('publishProperty')}
              </Button>
            ) : null}
            {canRequestChanges ? (
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                data-testid="admin-property-request-changes"
                onClick={() => openChangeReasonDialog()}
              >
                {property.status === 'changes_requested'
                  ? t('updateChangeReason')
                  : t('requestChanges')}
              </Button>
            ) : null}
            {property.status === 'pending_review' && allowedTransitions.includes('rejected') ? (
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                data-testid="admin-property-reject"
                onClick={() => openRejectReasonDialog()}
              >
                {t('rejectProperty')}
              </Button>
            ) : null}
            {property.status === 'published' && allowedTransitions.includes('unpublished') ? (
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                data-testid="admin-property-unpublish"
                onClick={() => void applyStatus('unpublished')}
              >
                {t('unpublishProperty')}
              </Button>
            ) : null}
            {property.status === 'published' && allowedTransitions.includes('suspended') ? (
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                data-testid="admin-property-suspend"
                onClick={() => void applyStatus('suspended')}
              >
                {t('suspendProperty')}
              </Button>
            ) : null}
            {property.status === 'suspended' && allowedTransitions.includes('unpublished') ? (
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                data-testid="admin-property-restore-unpublished"
                onClick={() => void applyStatus('unpublished')}
              >
                {t('restoreAsUnpublished')}
              </Button>
            ) : null}
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
          <Button variant="outline" size="sm" asChild>
            <Link href={`/properties/${property.slug}`}>{t('viewPublic')}</Link>
          </Button>
        </CardContent>
      </Card>

      {changeReasonOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-property-change-reason-title"
          data-testid="admin-property-change-reason-dialog"
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-4 sm:items-center"
          onClick={() => {
            if (!saving) {
              setChangeReasonOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="admin-property-change-reason-title"
              className="text-lg font-bold text-navy"
            >
              {t('propertyRequestChangesDialogTitle')}
            </h2>
            <label
              htmlFor="admin-property-change-reason-input"
              className="mt-4 block text-sm font-medium text-navy"
            >
              {t('propertyRequestChangesReason')}
            </label>
            <textarea
              id="admin-property-change-reason-input"
              data-testid="admin-property-change-reason-input"
              rows={4}
              autoFocus
              aria-invalid={Boolean(changeReasonError)}
              aria-describedby={changeReasonError ? 'admin-property-change-reason-error' : undefined}
              className="mt-2 flex w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
              placeholder={t('propertyRequestChangesReasonPlaceholder')}
              value={changeReason}
              onChange={(e) => {
                setChangeReason(e.target.value);
                if (changeReasonError) setChangeReasonError(null);
              }}
            />
            {changeReasonError ? (
              <p
                id="admin-property-change-reason-error"
                role="alert"
                className="mt-2 text-sm text-danger"
              >
                {changeReasonError}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setChangeReasonOpen(false)}
              >
                {t('propertyRequestChangesCancel')}
              </Button>
              <Button
                type="button"
                disabled={saving}
                data-testid="admin-property-change-reason-confirm"
                aria-busy={saving}
                onClick={() => void confirmChangeReason()}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('propertyRequestChangesConfirm')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectReasonOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-property-reject-reason-title"
          data-testid="admin-property-reject-reason-dialog"
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-4 sm:items-center"
          onClick={() => {
            if (!saving) {
              setRejectReasonOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="admin-property-reject-reason-title"
              className="text-lg font-bold text-navy"
            >
              {t('propertyRejectDialogTitle')}
            </h2>
            <label
              htmlFor="admin-property-reject-reason-input"
              className="mt-4 block text-sm font-medium text-navy"
            >
              {t('propertyRejectReason')}
            </label>
            <p id="admin-property-reject-reason-helper" className="mt-1 text-xs text-muted">
              {t('propertyRejectReasonHelper')}
            </p>
            <textarea
              id="admin-property-reject-reason-input"
              data-testid="admin-property-reject-reason-input"
              rows={4}
              autoFocus
              aria-invalid={Boolean(rejectReasonError)}
              aria-describedby={
                rejectReasonError
                  ? 'admin-property-reject-reason-error'
                  : 'admin-property-reject-reason-helper'
              }
              className="mt-2 flex w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
              placeholder={t('propertyRejectReasonPlaceholder')}
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                if (rejectReasonError) setRejectReasonError(null);
              }}
            />
            {rejectReasonError ? (
              <p
                id="admin-property-reject-reason-error"
                role="alert"
                className="mt-2 text-sm text-danger"
              >
                {rejectReasonError}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setRejectReasonOpen(false)}
              >
                {t('propertyRejectCancel')}
              </Button>
              <Button
                type="button"
                disabled={saving}
                data-testid="admin-property-reject-reason-confirm"
                aria-busy={saving}
                onClick={() => void confirmRejectReason()}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('propertyRejectConfirm')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
