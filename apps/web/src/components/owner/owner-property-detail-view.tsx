'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { ArrowLeft, CalendarRange, Loader2, MapPin, Users } from 'lucide-react';
import { isOwnerPropertyEditableStatus, isOwnerReviewContentMutableStatus, type OwnerPropertyDetail } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchOwnerProperty, OwnerApiError, submitOwnerPropertyReview } from '@/lib/api-owner';
import { OwnerPromotionsPanel } from '@/components/owner/owner-promotions-panel';
import { OwnerSponsorshipPanel } from '@/components/owner/owner-sponsorship-panel';
import { PriceDisplay } from '@/components/marketplace/price-display';
import { useAuthBreadcrumbPropertyTitle } from '@/components/layout/auth-breadcrumb-extras';

export function OwnerPropertyDetailView({ propertyId }: { propertyId: string }) {
  const t = useTranslations('owner');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSubmitted = searchParams.get('submitted') === '1';
  const [property, setProperty] = useState<OwnerPropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState<string | null>(null);

  const breadcrumbTitle = property
    ? (locale === 'ar' ? property.titleAr : property.titleEn) || property.titleAr
    : null;
  useAuthBreadcrumbPropertyTitle(breadcrumbTitle);

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

  async function handleResubmit() {
    if (!property || resubmitting) return;
    setResubmitting(true);
    setResubmitError(null);
    try {
      const res = await submitOwnerPropertyReview(property.id);
      setProperty({
        ...property,
        status: res.data.status,
        reviewChangeReason: res.data.reviewChangeReason ?? null,
      });
      router.replace(`/owner/properties/${property.id}?submitted=1`);
    } catch (e) {
      if (e instanceof OwnerApiError) {
        setResubmitError(e.message || t('changesRequestedResubmitError'));
      } else {
        setResubmitError(e instanceof Error ? e.message : t('changesRequestedResubmitError'));
      }
    } finally {
      setResubmitting(false);
    }
  }

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
  const canCoreEdit = isOwnerPropertyEditableStatus(property.status);
  const showChangesPanel = property.status === 'changes_requested';
  const showRejectedPanel = property.status === 'rejected';
  const isPendingReview = property.status === 'pending_review';
  const canMutateAvailability = isOwnerReviewContentMutableStatus(property.status);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="gap-1">
        <Link href="/owner/properties">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('backToProperties')}
        </Link>
      </Button>

      {showRejectedPanel && (
        <div
          role="region"
          aria-labelledby="owner-rejected-title"
          data-testid="owner-property-rejected-panel"
          className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-4 text-start"
        >
          <p id="owner-rejected-title" className="text-base font-bold text-navy">
            {t('rejectedTitle')}
          </p>
          {property.reviewRejectionReason ? (
            <div className="mt-3 rounded-xl border border-danger/20 bg-white/70 px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {t('rejectedReviewNotes')}
              </p>
              <p
                data-testid="owner-property-rejection-reason"
                className="mt-1 whitespace-pre-wrap text-sm text-navy"
              >
                {property.reviewRejectionReason}
              </p>
            </div>
          ) : null}
          <p className="mt-3 text-sm text-muted">{t('rejectedHint')}</p>
          <p className="mt-2 text-sm text-muted">{t('rejectedPrivateNote')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" data-testid="owner-property-back-to-list">
              <Link href="/owner/properties">{t('backToProperties')}</Link>
            </Button>
            <Button asChild className="shadow-soft" data-testid="owner-property-add-another">
              <Link href="/owner/properties/new">{t('addProperty')}</Link>
            </Button>
          </div>
        </div>
      )}

      {showChangesPanel && (
        <div
          role="region"
          aria-labelledby="owner-changes-requested-title"
          data-testid="owner-property-changes-requested-panel"
          className="rounded-2xl border border-amber-500/30 bg-amber-50/80 px-4 py-4 text-start"
        >
          <p id="owner-changes-requested-title" className="text-base font-bold text-navy">
            {t('changesRequestedTitle')}
          </p>
          {property.reviewChangeReason ? (
            <div className="mt-3 rounded-xl border border-amber-500/20 bg-white/70 px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {t('changesRequestedReviewNotes')}
              </p>
              <p
                data-testid="owner-property-change-reason"
                className="mt-1 whitespace-pre-wrap text-sm text-navy"
              >
                {property.reviewChangeReason}
              </p>
            </div>
          ) : null}
          <p className="mt-3 text-sm text-muted">{t('changesRequestedHint')}</p>
          {resubmitError ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {resubmitError}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild className="shadow-soft" data-testid="owner-property-edit-cta">
              <Link href={`/owner/properties/${property.id}/edit`}>{t('changesRequestedEdit')}</Link>
            </Button>
            <Button
              variant="outline"
              disabled={resubmitting}
              aria-busy={resubmitting}
              data-testid="owner-property-resubmit-cta"
              onClick={() => void handleResubmit()}
            >
              {resubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('changesRequestedResubmitting')}
                </>
              ) : (
                t('changesRequestedResubmit')
              )}
            </Button>
          </div>
        </div>
      )}

      {(justSubmitted || isPendingReview) && !showChangesPanel && !showRejectedPanel && (
        <div
          role="status"
          data-testid="owner-property-submitted-banner"
          className="rounded-2xl border border-primary/25 bg-primary-soft/50 px-4 py-3 text-start"
        >
          <p className="text-sm font-bold text-navy">{t('submittedForReviewTitle')}</p>
          <p className="mt-1 text-sm text-muted">{t('submittedForReviewHint')}</p>
          <p className="mt-2 text-sm text-navy" data-testid="owner-property-pending-frozen-hint">
            {t('pendingReviewFrozenHint')}
          </p>
        </div>
      )}

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
          {property.status === 'approved' ? (
            <p
              className="text-sm text-muted"
              data-testid="owner-property-approved-hint"
            >
              {t('propertyApprovedAwaitingPublication')}
            </p>
          ) : null}
          <p className="flex items-center gap-1 text-muted">
            <MapPin className="h-4 w-4" />
            {property.area && property.city
              ? `${property.area} — ${property.city}`
              : property.city || property.area || '—'}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            {property.basePrice != null ? (
              <PriceDisplay
                amount={property.basePrice}
                currency={property.currency}
                locale={locale}
                large
              />
            ) : (
              <p className="text-sm text-muted">—</p>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Users className="h-4 w-4 text-primary" />
            {t('capacity', { count: property.capacity })}
          </div>
          <p className="text-sm text-muted sm:col-span-2">
            {t('upcomingBookings', { count: property.upcomingBookingsCount })}
          </p>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            {canCoreEdit && !showChangesPanel && !showRejectedPanel ? (
              <Button asChild className="shadow-soft" data-testid="owner-property-edit-cta">
                <Link href={`/owner/properties/${property.id}/edit`}>{t('editProperty')}</Link>
              </Button>
            ) : null}
            {canMutateAvailability ? (
              <Button asChild variant="outline" data-testid="owner-property-availability-cta">
                <Link href={`/owner/availability?propertyId=${property.id}`}>
                  <CalendarRange className="h-4 w-4" />
                  {t('manageAvailability')}
                </Link>
              </Button>
            ) : (
              <p
                className="text-sm text-muted"
                data-testid="owner-property-availability-frozen"
              >
                {t('pendingReviewAvailabilityFrozen')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <OwnerSponsorshipPanel propertyId={property.id} published={property.status === 'published'} />
      <OwnerPromotionsPanel propertyId={property.id} />
    </div>
  );
}
