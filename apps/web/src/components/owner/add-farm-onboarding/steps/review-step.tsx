'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  XCircle,
} from 'lucide-react';
import {
  AMENITY_KEYS,
  MIN_MEDIA_FOR_PUBLISH,
  MIN_MEDIA_FOR_SUBMIT_REVIEW,
  PROPERTY_TYPES,
  assessPropertyMedia,
  isAddFarmBasicComplete,
  isAddFarmLocationComplete,
  isAddFarmPhotosComplete,
  isAddFarmPricingComplete,
  type AddFarmReadinessBreakdown,
  type AddFarmStepId,
  type AvailabilityPeriod,
  type PropertyMediaItem,
} from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/property-helpers';
import {
  fetchOwnerAvailabilityHealth,
  fetchOwnerAvailabilityRules,
} from '@/lib/api-owner';
import type { AddFarmFormState } from '../add-farm-wizard';
import { jordanCityLabel } from './location-step';

type PeriodPriceRow = { period: AvailabilityPeriod; price: number };

type Props = {
  form: AddFarmFormState;
  readiness: AddFarmReadinessBreakdown;
  media: PropertyMediaItem[];
  locale: 'ar' | 'en';
  propertyId: string | null;
  coverUrl?: string;
  onEditStep: (step: AddFarmStepId) => void;
  onSubmitReview: () => void;
  submitting: boolean;
};

function ChecklistItem({
  ok,
  label,
  tone = 'required',
  onEdit,
  editLabel,
}: {
  ok: boolean;
  label: string;
  tone?: 'required' | 'publish';
  onEdit?: () => void;
  editLabel?: string;
}) {
  const Icon = ok ? CheckCircle2 : tone === 'publish' ? AlertTriangle : XCircle;
  const iconClass = ok
    ? 'text-[#15803D]'
    : tone === 'publish'
      ? 'text-amber-600'
      : 'text-danger';
  return (
    <li className="flex items-start gap-2 text-[13px]">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} aria-hidden />
      <span className="min-w-0 flex-1 text-[#0D2046]">
        <span className="sr-only">{ok ? 'complete: ' : 'incomplete: '}</span>
        {label}
      </span>
      {!ok && onEdit && editLabel ? (
        <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-[#2F6EF6]" onClick={onEdit}>
          {editLabel}
        </Button>
      ) : null}
    </li>
  );
}

function ReviewSection({
  title,
  onEdit,
  editLabel,
  children,
  testId,
}: {
  title: string;
  onEdit: () => void;
  editLabel: string;
  children: ReactNode;
  testId: string;
}) {
  return (
    <section
      data-testid={testId}
      className="rounded-[14px] border border-[#E5EAF1] bg-white p-4 text-start"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold text-[#0D2046]">{title}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={onEdit}
          data-testid={`${testId}-edit`}
        >
          {editLabel}
        </Button>
      </div>
      {children}
    </section>
  );
}

export function ReviewStep({
  form,
  readiness,
  media,
  locale,
  propertyId,
  coverUrl,
  onEditStep,
  onSubmitReview,
  submitting,
}: Props) {
  const t = useTranslations('addFarm');
  const tProp = useTranslations('ownerProperty');
  const tOwner = useTranslations('owner');
  const tCommon = useTranslations('common');

  const [periodPrices, setPeriodPrices] = useState<PeriodPriceRow[]>([]);
  const [futureSlots, setFutureSlots] = useState<number | null>(null);
  const [rangeLabel, setRangeLabel] = useState<string | null>(null);
  const [healthWarning, setHealthWarning] = useState<string | null>(null);
  const [availLoading, setAvailLoading] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    setAvailLoading(true);
    void (async () => {
      try {
        const [rulesRes, healthRes] = await Promise.all([
          fetchOwnerAvailabilityRules(propertyId),
          fetchOwnerAvailabilityHealth(propertyId),
        ]);
        if (cancelled) return;
        const byPeriod = new Map<AvailabilityPeriod, number>();
        for (const rule of rulesRes.data) {
          if (!rule.enabled) continue;
          if (!byPeriod.has(rule.period)) byPeriod.set(rule.period, rule.price);
        }
        setPeriodPrices(
          [...byPeriod.entries()].map(([period, price]) => ({ period, price })),
        );
        const h = healthRes.data;
        setFutureSlots(h.futureBookableCount ?? null);
        setHealthWarning(h.warning);
        if (h.earliestAvailableDate && h.latestAvailableDate) {
          setRangeLabel(`${h.earliestAvailableDate} → ${h.latestAvailableDate}`);
        } else {
          setRangeLabel(null);
        }
      } catch {
        if (!cancelled) {
          setPeriodPrices([]);
          setFutureSlots(null);
          setRangeLabel(null);
        }
      } finally {
        if (!cancelled) setAvailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const title =
    locale === 'ar'
      ? form.titleAr.trim() || t('previewTitlePlaceholder')
      : form.titleEn.trim() || form.titleAr.trim() || t('previewTitlePlaceholder');

  const typeLabel = (PROPERTY_TYPES as readonly string[]).includes(form.type)
    ? tProp(`propertyType.${form.type}`)
    : form.type;

  const cityLabel = jordanCityLabel(form.city, locale);
  const mediaAssessment = assessPropertyMedia(media.map((m) => ({ sortOrder: m.sortOrder })));
  const orderedMedia = useMemo(
    () => [...media].sort((a, b) => a.sortOrder - b.sortOrder),
    [media],
  );
  const cover =
    orderedMedia.find((m) => m.isCover) ??
    orderedMedia.find((m) => m.sortOrder === 0) ??
    orderedMedia[0];
  const previewCover = coverUrl ?? cover?.url;

  const basePrice = Number(form.basePrice);
  const hasPrice = Number.isFinite(basePrice) && basePrice > 0;
  const capacity = Number(form.capacity);
  const poolsCount = Number(form.poolsCount) || 0;

  const basicOk = isAddFarmBasicComplete({
    titleAr: form.titleAr,
    descriptionAr: form.descriptionAr,
    type: form.type,
    capacity: Number.isFinite(capacity) ? capacity : null,
  });
  const locationOk = isAddFarmLocationComplete({
    city: form.city,
    area: form.area,
    approximateAddress: form.approximateAddress,
    exactAddress: form.exactAddress,
  });
  const photosOk = isAddFarmPhotosComplete({ mediaCount: media.length });
  const pricingOk = isAddFarmPricingComplete({
    basePrice: hasPrice ? basePrice : null,
  });
  const canSubmit = Boolean(propertyId) && readiness.review && mediaAssessment.canSubmitReview;

  const photosNeededForPublish = Math.max(0, MIN_MEDIA_FOR_PUBLISH - mediaAssessment.count);
  const hasCover = mediaAssessment.hasCover;
  const hasRules = periodPrices.length > 0;
  const hasFutureSlots = (futureSlots ?? 0) >= 1;
  const publishMediaOk = mediaAssessment.canPublish;
  const publishAvailOk = hasRules && hasFutureSlots;

  const selectedAmenities = form.amenityKeys.filter((k) =>
    (AMENITY_KEYS as readonly string[]).includes(k),
  );

  const editLabel = t('editSection');

  return (
    <div className="space-y-5 text-start" data-testid="add-farm-step-review-panel">
      <div>
        <h2 className="text-[17px] font-bold text-[#0D2046]">{t('steps.review')}</h2>
        <p className="mt-1 text-[12px] text-[#64748B]">{t('reviewHint')}</p>
      </div>

      {/* Final listing preview (mobile + main column) */}
      <section
        data-testid="add-farm-review-preview"
        className="overflow-hidden rounded-[16px] border border-[#E5EAF1] bg-white shadow-[0_4px_14px_rgba(13,32,70,.04)]"
        aria-label={t('previewLabel')}
      >
        <div className="flex items-center justify-between border-b border-[#EEF2F7] px-3.5 py-2.5">
          <div>
            <p className="text-[12px] font-bold text-[#0D2046]">{t('previewLabel')}</p>
            <p className="text-[11px] text-[#8A96A8]">{t('previewBeforePublish')}</p>
          </div>
          <span className="rounded-lg bg-[#EEF2F7] px-2 py-1 text-[11px] font-semibold text-[#53637A]">
            {t('unpublishedBadge')}
          </span>
        </div>
        <div className="relative aspect-[16/10] bg-[#EEF5FF]">
          {previewCover ? (
            <img
              src={previewCover}
              alt={t('coverAlt', { title })}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[12px] text-[#8A96A8]">
              {t('previewImagePlaceholder')}
            </div>
          )}
        </div>
        <div className="space-y-2 p-3.5">
          <h3 className="text-[15px] font-bold text-[#0D2046]">{title}</h3>
          <p className="text-[12px] text-[#64748B]">
            {typeLabel}
            {cityLabel || form.area
              ? ` · ${[cityLabel, form.area.trim()].filter(Boolean).join(' · ')}`
              : ''}
          </p>
          {Number.isFinite(capacity) && capacity >= 1 ? (
            <p className="text-[12px] font-semibold text-[#0D2046]">
              {t('previewGuests', { count: capacity })}
            </p>
          ) : null}
          {hasPrice ? (
            <p className="text-[14px] font-bold text-[#0D2046]" data-testid="add-farm-review-price">
              <span className="me-1 text-[12px] font-semibold text-[#64748B]">
                {tCommon('from')}
              </span>
              {formatPrice(basePrice, 'JOD', locale)}
            </p>
          ) : (
            <p className="text-[12px] text-[#94A3B8]">{t('previewPricePlaceholder')}</p>
          )}
          <p className="text-[12px] text-[#53637A]">
            {t('reviewPhotoCount', { count: media.length })}
          </p>
          {selectedAmenities.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" data-testid="add-farm-review-amenities">
              {selectedAmenities.map((key) => (
                <li
                  key={key}
                  className="rounded-lg border border-primary/15 bg-primary-soft/50 px-2 py-0.5 text-[11px] font-medium text-navy"
                >
                  {tProp(`amenity.${key}`)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {/* Ready for review */}
      <section
        className="rounded-[14px] border border-primary/20 bg-primary-soft/30 p-4"
        data-testid="add-farm-ready-for-review"
      >
        <h3 className="text-[14px] font-bold text-[#0D2046]">{t('readyForReviewTitle')}</h3>
        <p className="mt-1 text-[12px] text-[#53637A]">{t('readyForReviewHint')}</p>
        <ul className="mt-3 space-y-2">
          <ChecklistItem
            ok={basicOk}
            label={t('checkBasic')}
            onEdit={() => onEditStep('basic')}
            editLabel={editLabel}
          />
          <ChecklistItem
            ok={locationOk}
            label={t('checkLocation')}
            onEdit={() => onEditStep('location')}
            editLabel={editLabel}
          />
          <ChecklistItem
            ok={photosOk}
            label={t('checkPhotos', { min: MIN_MEDIA_FOR_SUBMIT_REVIEW })}
            onEdit={() => onEditStep('photos')}
            editLabel={editLabel}
          />
          <ChecklistItem
            ok={pricingOk}
            label={t('checkPricing')}
            onEdit={() => onEditStep('pricing')}
            editLabel={editLabel}
          />
        </ul>
      </section>

      {/* Before going live */}
      <section
        className="rounded-[14px] border border-amber-400/35 bg-amber-50/80 p-4"
        data-testid="add-farm-before-live"
      >
        <h3 className="text-[14px] font-bold text-[#0D2046]">{t('beforeLiveTitle')}</h3>
        <p className="mt-1 text-[12px] text-[#53637A]">{t('beforeLiveHint')}</p>
        <ul className="mt-3 space-y-2">
          <ChecklistItem
            ok={publishMediaOk}
            tone="publish"
            label={
              publishMediaOk
                ? t('checkPublishPhotosOk', { min: MIN_MEDIA_FOR_PUBLISH })
                : t('checkPublishPhotosNeed', {
                    min: MIN_MEDIA_FOR_PUBLISH,
                    remaining: photosNeededForPublish,
                    cover: hasCover ? t('checkCoverYes') : t('checkCoverNo'),
                  })
            }
            onEdit={() => onEditStep('photos')}
            editLabel={editLabel}
          />
          <ChecklistItem
            ok={publishAvailOk}
            tone="publish"
            label={
              publishAvailOk
                ? t('checkPublishAvailOk')
                : !hasRules
                  ? t('checkPublishAvailRules')
                  : t('checkPublishAvailSlots')
            }
            onEdit={() => onEditStep('pricing')}
            editLabel={editLabel}
          />
        </ul>
        {!publishMediaOk || !publishAvailOk ? (
          <p className="mt-3 text-[12px] text-[#53637A]" data-testid="add-farm-submit-vs-publish">
            {t('submitVsPublishNote', { min: MIN_MEDIA_FOR_PUBLISH })}
          </p>
        ) : null}
      </section>

      {/* Section summaries */}
      <ReviewSection
        title={t('steps.basic')}
        onEdit={() => onEditStep('basic')}
        editLabel={editLabel}
        testId="add-farm-review-basic"
      >
        <dl className="space-y-2 text-[13px]">
          <div className="flex justify-between gap-2">
            <dt className="text-[#64748B]">{t('fields.titleAr')}</dt>
            <dd className="font-semibold text-[#0D2046]">{form.titleAr.trim() || '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[#64748B]">{t('fields.type')}</dt>
            <dd className="font-semibold text-[#0D2046]">{typeLabel}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[#64748B]">{t('fields.capacity')}</dt>
            <dd className="font-semibold text-[#0D2046]">{form.capacity || '—'}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">{t('fields.descriptionAr')}</dt>
            <dd className="mt-1 line-clamp-3 text-[#53637A]">{form.descriptionAr.trim() || '—'}</dd>
          </div>
          <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-[#53637A]">
            {form.allowsOvernight ? <span className="rounded-md bg-[#EEF5FF] px-2 py-0.5">{tProp('allowsOvernight')}</span> : null}
            {form.allowsFamilies ? <span className="rounded-md bg-[#EEF5FF] px-2 py-0.5">{tProp('allowsFamilies')}</span> : null}
            {form.allowsYouth ? <span className="rounded-md bg-[#EEF5FF] px-2 py-0.5">{tProp('allowsYouth')}</span> : null}
          </div>
        </dl>
      </ReviewSection>

      <ReviewSection
        title={t('steps.location')}
        onEdit={() => onEditStep('location')}
        editLabel={editLabel}
        testId="add-farm-review-location"
      >
        <div className="space-y-3 text-[13px]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2F6EF6]">
              {t('publicLocationTitle')}
            </p>
            <p className="mt-1 font-semibold text-[#0D2046]">
              {[cityLabel, form.area.trim()].filter(Boolean).join(' · ') || '—'}
            </p>
            <p className="mt-1 text-[#53637A]">{form.approximateAddress.trim() || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
              {t('privateLocationTitle')}
            </p>
            <p className="mt-1 text-[#53637A]">{form.exactAddress.trim() || '—'}</p>
          </div>
          <p className="rounded-xl border border-primary/15 bg-primary-soft/40 px-3 py-2 text-[12px] text-[#53637A]">
            {t('privacyBody')}
          </p>
        </div>
      </ReviewSection>

      <ReviewSection
        title={t('steps.photos')}
        onEdit={() => onEditStep('photos')}
        editLabel={editLabel}
        testId="add-farm-review-photos"
      >
        <p className="text-[13px] text-[#53637A]">
          {t('reviewPhotoCount', { count: media.length })}
          {cover ? ` · ${t('coverPhotoLabel')}` : ''}
        </p>
        {orderedMedia.length > 0 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {orderedMedia.slice(0, 8).map((item, i) => (
              <div
                key={item.id}
                className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-primary-soft"
              >
                <img
                  src={item.url}
                  alt={t('thumbAlt', { title, n: i + 1 })}
                  className="h-full w-full object-cover"
                />
                {item.isCover || item.sortOrder === 0 ? (
                  <span className="absolute inset-x-0 bottom-0 bg-primary/90 px-1 py-0.5 text-center text-[9px] font-medium text-white">
                    {t('coverPhotoLabel')}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {selectedAmenities.length > 0 ? (
          <div className="mt-3">
            <p className="text-[12px] font-semibold text-[#0D2046]">{t('amenitiesHeading')}</p>
            <p className="mt-1 text-[12px] text-[#53637A]">
              {t('amenitiesSelected', { count: selectedAmenities.length })}
              {poolsCount > 0 ? ` · ${tProp('poolsCount')}: ${poolsCount}` : ''}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-[12px] text-[#8A96A8]">{t('amenitiesNone')}</p>
        )}
      </ReviewSection>

      <ReviewSection
        title={t('steps.pricing')}
        onEdit={() => onEditStep('pricing')}
        editLabel={editLabel}
        testId="add-farm-review-pricing"
      >
        <div className="space-y-3 text-[13px]">
          <div>
            <p className="font-semibold text-[#0D2046]">
              {t('basePriceLabel')}:{' '}
              {hasPrice ? formatPrice(basePrice, 'JOD', locale) : '—'}
            </p>
            <p className="mt-1 text-[12px] text-[#53637A]">{t('basePriceBrowseHint')}</p>
          </div>
          {periodPrices.length > 0 ? (
            <ul className="space-y-1" data-testid="add-farm-review-period-prices">
              {periodPrices.map((row) => (
                <li key={row.period} className="flex justify-between gap-2">
                  <span className="text-[#64748B]">{tOwner(`period.${row.period}`)}</span>
                  <span className="font-semibold text-[#0D2046]">
                    {formatPrice(row.price, 'JOD', locale)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-[#8A96A8]">{t('periodsNoneConfigured')}</p>
          )}
          <p className="rounded-xl border border-[#E5EAF1] bg-[#F8FBFF] px-3 py-2 text-[12px] text-[#53637A]">
            {t('depositReviewNote')}
          </p>
          <p className="text-[12px] text-[#53637A]">
            {form.instantBookingEnabled
              ? tProp('instantBooking')
              : tProp('ownerApprovalRequired')}
          </p>
        </div>
      </ReviewSection>

      <ReviewSection
        title={t('availabilitySummaryTitle')}
        onEdit={() => onEditStep('pricing')}
        editLabel={editLabel}
        testId="add-farm-review-availability"
      >
        {availLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
        ) : (
          <div className="space-y-1 text-[13px] text-[#53637A]">
            <p>{t('periodsSelected', { count: periodPrices.length })}</p>
            {rangeLabel ? <p>{t('availabilityRange', { range: rangeLabel })}</p> : null}
            {futureSlots != null ? (
              <p data-testid="add-farm-review-future-slots">
                {t('futureSlotsCount', { count: futureSlots })}
              </p>
            ) : null}
            {healthWarning ? (
              <p className="text-amber-700">{tOwner(`availabilityWarning.${healthWarning}`)}</p>
            ) : null}
            {!hasFutureSlots ? (
              <p className="text-[12px]">{t('availabilityGenerateReviewHint')}</p>
            ) : null}
          </div>
        )}
      </ReviewSection>

      {/* What happens next */}
      <section
        className="rounded-[14px] border border-[#E5EAF1] bg-[#F8FBFF] p-4"
        data-testid="add-farm-what-next"
      >
        <h3 className="text-[14px] font-bold text-[#0D2046]">{t('whatHappensNextTitle')}</h3>
        <ol className="mt-2 list-decimal space-y-1.5 ps-4 text-[12px] leading-relaxed text-[#53637A]">
          <li>{t('whatHappensNext.a')}</li>
          <li>{t('whatHappensNext.b')}</li>
          <li>{t('whatHappensNext.c')}</li>
        </ol>
      </section>

      <p className="text-[12px] text-[#53637A]" data-testid="add-farm-accuracy-note">
        {t('accuracyNote')}
      </p>

      <Button
        type="button"
        disabled={submitting || !canSubmit}
        aria-busy={submitting}
        onClick={onSubmitReview}
        className="w-full bg-[#2F6EF6] hover:bg-[#2563EB] sm:w-auto"
        data-testid="add-farm-submit-review"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {t('submitReview')}
      </Button>
      {!propertyId ? (
        <p className="text-[12px] text-[#8A96A8]">{t('reviewNeedDraft')}</p>
      ) : null}
      {propertyId && !canSubmit ? (
        <p className="text-[12px] text-[#8A96A8]" data-testid="add-farm-review-incomplete">
          {t('reviewIncomplete')}
        </p>
      ) : null}
    </div>
  );
}
