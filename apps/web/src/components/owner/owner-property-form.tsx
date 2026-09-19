'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { ArrowLeft, ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  AMENITY_KEYS,
  PROPERTY_TYPES,
  isOwnerPropertyEditableStatus,
  isOwnerReviewContentMutableStatus,
  type CreateOwnerPropertyInput,
  type OwnerPropertyEdit,
  type UpdateOwnerPropertyInput,
  assessPropertyMedia,
} from '@mazare3/shared';
import { PropertyMediaQualityBox } from '@/components/property/property-media-quality-box';
import { OwnerPropertyMediaEditor } from '@/components/owner/owner-property-media-editor';
import { OwnerLocationPicker } from '@/components/maps/owner-location-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createOwnerProperty,
  submitOwnerPropertyReview,
  uploadOwnerPropertyMediaFile,
  updateOwnerProperty,
  OwnerApiError,
} from '@/lib/api-owner';
import { PriorConsentCheckbox } from '@/components/legal/prior-consent-checkbox';
import { ensurePriorConsentsForPurposes } from '@/lib/ensure-prior-consents';

type Props = {
  mode: 'create' | 'edit';
  initial?: OwnerPropertyEdit;
};

const emptyRule = { titleAr: '', titleEn: '' };

export function OwnerPropertyForm({ mode, initial }: Props) {
  const t = useTranslations('ownerProperty');
  const tOwner = useTranslations('owner');
  const tCommon = useTranslations('common');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exactLocationConsent, setExactLocationConsent] = useState(false);
  const [media, setMedia] = useState<OwnerPropertyEdit['media']>(initial?.media ?? []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [createFileInputKey, setCreateFileInputKey] = useState(0);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const createFileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    type: initial?.type ?? 'farm',
    titleAr: initial?.titleAr ?? '',
    titleEn: initial?.titleEn ?? '',
    descriptionAr: initial?.descriptionAr ?? '',
    descriptionEn: initial?.descriptionEn ?? '',
    city: initial?.city ?? '',
    area: initial?.area ?? '',
    approximateAddress: initial?.approximateAddress ?? '',
    exactAddress: initial?.exactAddress ?? '',
    latitudeApprox: initial?.latitudeApprox != null ? String(initial.latitudeApprox) : '',
    longitudeApprox: initial?.longitudeApprox != null ? String(initial.longitudeApprox) : '',
    latitudeExact: initial?.latitudeExact != null ? String(initial.latitudeExact) : '',
    longitudeExact: initial?.longitudeExact != null ? String(initial.longitudeExact) : '',
    arrivalInstructionsAr: initial?.arrivalInstructionsAr ?? '',
    arrivalInstructionsEn: initial?.arrivalInstructionsEn ?? '',
    basePrice: initial ? String(initial.basePrice ?? '') : '',
    capacity: initial ? String(initial.capacity) : '10',
    allowsOvernight: initial?.allowsOvernight ?? true,
    allowsFamilies: initial?.allowsFamilies ?? true,
    allowsYouth: initial?.allowsYouth ?? false,
    instantBookingEnabled: initial?.instantBookingEnabled ?? true,
    poolsCount: initial ? String(initial.poolsCount) : '0',
    amenityKeys: initial?.amenityKeys ?? ([] as string[]),
    imageUrls: initial?.imageUrls?.length ? initial.imageUrls : [''],
    rules: initial?.rules?.length
      ? initial.rules.map((r) => ({ titleAr: r.titleAr, titleEn: r.titleEn ?? '' }))
      : [emptyRule],
  });

  const [locationSaved, setLocationSaved] = useState(false);

  function parseOptionalCoord(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return Number(trimmed);
  }

  function buildLocationPayload() {
    return {
      city: form.city,
      area: form.area,
      approximateAddress: form.approximateAddress,
      exactAddress: form.exactAddress,
      latitudeApprox: parseOptionalCoord(form.latitudeApprox),
      longitudeApprox: parseOptionalCoord(form.longitudeApprox),
      latitudeExact: parseOptionalCoord(form.latitudeExact),
      longitudeExact: parseOptionalCoord(form.longitudeExact),
      arrivalInstructionsAr: form.arrivalInstructionsAr.trim() || null,
      arrivalInstructionsEn: form.arrivalInstructionsEn.trim() || null,
    };
  }

  function buildPayload(): CreateOwnerPropertyInput {
    const urls = form.imageUrls.map((u) => u.trim()).filter(Boolean);
    return {
      type: form.type as CreateOwnerPropertyInput['type'],
      titleAr: form.titleAr,
      titleEn: form.titleEn || undefined,
      descriptionAr: form.descriptionAr,
      descriptionEn: form.descriptionEn || undefined,
      city: form.city,
      area: form.area,
      approximateAddress: form.approximateAddress,
      exactAddress: form.exactAddress,
      latitudeApprox: parseOptionalCoord(form.latitudeApprox),
      longitudeApprox: parseOptionalCoord(form.longitudeApprox),
      latitudeExact: parseOptionalCoord(form.latitudeExact),
      longitudeExact: parseOptionalCoord(form.longitudeExact),
      arrivalInstructionsAr: form.arrivalInstructionsAr.trim() || null,
      arrivalInstructionsEn: form.arrivalInstructionsEn.trim() || null,
      basePrice: Number(form.basePrice),
      capacity: Number(form.capacity),
      allowsOvernight: form.allowsOvernight,
      allowsFamilies: form.allowsFamilies,
      allowsYouth: form.allowsYouth,
      instantBookingEnabled: form.instantBookingEnabled,
      poolsCount: Number(form.poolsCount) || 0,
      amenityKeys: form.amenityKeys,
      imageUrls: urls,
      rules: form.rules
        .filter((r) => r.titleAr.trim())
        .map((r) => ({ titleAr: r.titleAr, titleEn: r.titleEn || undefined })),
    };
  }

  function getEffectiveMediaForQuality(): { sortOrder: number }[] {
    if (mode === 'edit') {
      return (media ?? []).map((m) => ({ sortOrder: m.sortOrder }));
    }
    const urlCount = form.imageUrls.map((u) => u.trim()).filter(Boolean).length;
    const total = urlCount + pendingFiles.length;
    return Array.from({ length: total }, (_, i) => ({ sortOrder: i }));
  }

  const mediaForQuality = getEffectiveMediaForQuality();
  const mediaAssessment = assessPropertyMedia(mediaForQuality);

  useEffect(() => {
    if (mode !== 'create') return;
    const urls = pendingFiles.map((file) => URL.createObjectURL(file));
    setPendingPreviews(urls);
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [mode, pendingFiles]);

  async function ensureExactLocationConsentIfNeeded(fields: {
    exactAddress?: string | null;
    latitudeExact?: number | null;
    longitudeExact?: number | null;
    arrivalInstructionsAr?: string | null;
    arrivalInstructionsEn?: string | null;
  }): Promise<boolean> {
    const needs =
      (typeof fields.exactAddress === 'string' && fields.exactAddress.trim().length > 0) ||
      fields.latitudeExact != null ||
      fields.longitudeExact != null ||
      (typeof fields.arrivalInstructionsAr === 'string' &&
        fields.arrivalInstructionsAr.trim().length > 0) ||
      (typeof fields.arrivalInstructionsEn === 'string' &&
        fields.arrivalInstructionsEn.trim().length > 0);
    if (!needs) return true;
    const result = await ensurePriorConsentsForPurposes({
      purposeKeys: ['property_and_exact_location_processing'],
      checkedPurposes: {
        property_and_exact_location_processing: exactLocationConsent,
      },
      language: locale,
      sourceSurface: 'owner.property-form.exact-location',
    });
    if (!result.ok) {
      setError(t('exactLocationPriorConsentRequired'));
      return false;
    }
    return true;
  }

  async function handleSave(submitReview: boolean) {
    setError(null);
    if (submitReview && !mediaAssessment.canSubmitReview) {
      setError(t('mediaSubmitRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (!(await ensureExactLocationConsentIfNeeded(payload))) {
        setSaving(false);
        return;
      }
      let propertyId = initial?.id;
      if (mode === 'create') {
        const res = await createOwnerProperty(payload);
        propertyId = res.data.id;

        // Upload selected files after creating the property.
        if (pendingFiles.length) {
          for (const f of pendingFiles) {
            const up = await uploadOwnerPropertyMediaFile(propertyId, f);
            setMedia(up.data.media);
          }
          setPendingFiles([]);
          setCreateFileInputKey((k) => k + 1);
        }
      } else if (initial) {
        const { imageUrls, ...rest } = payload;
        void imageUrls;
        await updateOwnerProperty(initial.id, rest as UpdateOwnerPropertyInput);
      }
      if (submitReview && propertyId) {
        await submitOwnerPropertyReview(propertyId);
      }

      router.push(mode === 'create' ? `/owner/properties/${propertyId}/edit` : '/owner/properties');
      router.refresh();
    } catch (e) {
      if (e instanceof OwnerApiError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : t('saveError'));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBookingMode() {
    if (!initial?.id) return;
    setSaving(true);
    setError(null);
    try {
      await updateOwnerProperty(initial.id, {
        instantBookingEnabled: form.instantBookingEnabled,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof OwnerApiError ? e.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveLocation() {
    if (!initial?.id) return;
    setSaving(true);
    setError(null);
    setLocationSaved(false);
    try {
      const loc = buildLocationPayload();
      if (!(await ensureExactLocationConsentIfNeeded(loc))) {
        setSaving(false);
        return;
      }
      await updateOwnerProperty(initial.id, loc);
      setLocationSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof OwnerApiError ? e.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  function syncMediaToForm(nextMedia: NonNullable<OwnerPropertyEdit['media']>) {
    setMedia(nextMedia);
    setForm((f) => ({
      ...f,
      imageUrls: nextMedia.map((m) => m.url),
    }));
  }

  const canSubmitReview =
    !initial || initial.status === 'draft' || initial.status === 'changes_requested';
  const listingEditable = !initial || isOwnerPropertyEditableStatus(initial.status);
  const mediaMutable = !initial || isOwnerReviewContentMutableStatus(initial.status);

  return (
    <div data-testid="owner-property-form" className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="gap-1">
        <Link href={initial ? `/owner/properties/${initial.id}` : '/owner/properties'}>
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {tCommon('back')}
        </Link>
      </Button>
      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">
          {error}
        </p>
      )}
      {initial && (
        <p className="text-sm text-muted">
          {t('currentStatus')}:{' '}
          <span className="font-medium text-navy">{tOwner(`propertyStatus.${initial.status}`)}</span>
        </p>
      )}
      {initial?.status === 'pending_review' ? (
        <div
          role="status"
          data-testid="owner-edit-pending-frozen"
          className="rounded-2xl border border-primary/25 bg-primary-soft/50 px-4 py-3 text-start"
        >
          <p className="text-sm font-bold text-navy">{tOwner('submittedForReviewTitle')}</p>
          <p className="mt-1 text-sm text-muted">{tOwner('pendingReviewFrozenHint')}</p>
        </div>
      ) : null}
      {initial?.status === 'changes_requested' && initial.reviewChangeReason ? (
        <div
          role="status"
          data-testid="owner-edit-correction-notice"
          className="rounded-2xl border border-amber-500/30 bg-amber-50/80 px-4 py-3 text-start"
        >
          <p className="text-sm font-bold text-navy">{tOwner('editCorrectionNoticeTitle')}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-navy">{initial.reviewChangeReason}</p>
        </div>
      ) : null}

      <fieldset
        disabled={!listingEditable}
        className="glass-panel space-y-4 rounded-2xl border-primary/12 p-4 sm:p-6 disabled:opacity-80"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-navy">{t('type')}</label>
            <select
              className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {PROPERTY_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {t(`propertyType.${pt}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-navy">{t('basePrice')}</label>
            <Input
              type="number"
              min={1}
              required
              value={form.basePrice}
              onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-navy">{t('titleAr')}</label>
            <Input
              required
              value={form.titleAr}
              onChange={(e) => setForm((f) => ({ ...f, titleAr: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-navy">{t('titleEn')}</label>
            <Input
              value={form.titleEn}
              onChange={(e) => setForm((f) => ({ ...f, titleEn: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-navy">{t('descriptionAr')}</label>
            <textarea
              required
              rows={3}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
              value={form.descriptionAr}
              onChange={(e) => setForm((f) => ({ ...f, descriptionAr: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-navy">{t('descriptionEn')}</label>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
              value={form.descriptionEn}
              onChange={(e) => setForm((f) => ({ ...f, descriptionEn: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-navy">{t('capacity')}</label>
            <Input
              type="number"
              min={1}
              required
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-navy">{t('poolsCount')}</label>
            <Input
              type="number"
              min={0}
              value={form.poolsCount}
              onChange={(e) => setForm((f) => ({ ...f, poolsCount: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allowsOvernight}
              onChange={(e) => setForm((f) => ({ ...f, allowsOvernight: e.target.checked }))}
            />
            {t('allowsOvernight')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allowsFamilies}
              onChange={(e) => setForm((f) => ({ ...f, allowsFamilies: e.target.checked }))}
            />
            {t('allowsFamilies')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allowsYouth}
              onChange={(e) => setForm((f) => ({ ...f, allowsYouth: e.target.checked }))}
            />
            {t('allowsYouth')}
          </label>
        </div>

        <fieldset
          className="space-y-3 rounded-2xl border border-primary/15 bg-primary-soft/20 p-4"
          data-testid="owner-location-section"
        >
          <legend className="px-1 text-sm font-medium text-navy">{t('locationSectionTitle')}</legend>
          <p className="text-xs text-muted">{t('locationSectionHint')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-navy">{t('city')}</label>
              <Input
                required
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-navy">{t('area')}</label>
              <Input
                required
                value={form.area}
                onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-navy">{t('approximateAddress')}</label>
              <Input
                required
                value={form.approximateAddress}
                onChange={(e) => setForm((f) => ({ ...f, approximateAddress: e.target.value }))}
              />
              <p className="text-xs text-muted">{t('approximateAddressHint')}</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-navy">{t('exactAddress')}</label>
              <Input
                required
                value={form.exactAddress}
                onChange={(e) => setForm((f) => ({ ...f, exactAddress: e.target.value }))}
              />
              <p className="text-xs text-muted">{t('exactAddressHint')}</p>
              <div
                className="mt-3 rounded-xl border border-[#C5D4E8] bg-[#F8FBFF] px-3 py-3"
                data-testid="owner-exact-location-prior-consent"
              >
                <PriorConsentCheckbox
                  purposeKey="property_and_exact_location_processing"
                  checked={exactLocationConsent}
                  disabled={saving || !listingEditable}
                  testId="owner-exact-location-prior-consent"
                  onChange={setExactLocationConsent}
                />
              </div>
            </div>
            <OwnerLocationPicker
              latitudeExact={form.latitudeExact}
              longitudeExact={form.longitudeExact}
              latitudeApprox={form.latitudeApprox}
              longitudeApprox={form.longitudeApprox}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium text-navy">{t('latitudeApprox')}</label>
              <Input
                inputMode="decimal"
                placeholder="31.55"
                data-testid="owner-latitude-approx"
                value={form.latitudeApprox}
                onChange={(e) => setForm((f) => ({ ...f, latitudeApprox: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-navy">{t('longitudeApprox')}</label>
              <Input
                inputMode="decimal"
                placeholder="35.47"
                data-testid="owner-longitude-approx"
                value={form.longitudeApprox}
                onChange={(e) => setForm((f) => ({ ...f, longitudeApprox: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-navy">{t('latitudeExact')}</label>
              <Input
                inputMode="decimal"
                placeholder="31.5482"
                data-testid="owner-latitude-exact"
                value={form.latitudeExact}
                onChange={(e) => setForm((f) => ({ ...f, latitudeExact: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-navy">{t('longitudeExact')}</label>
              <Input
                inputMode="decimal"
                placeholder="35.4731"
                data-testid="owner-longitude-exact"
                value={form.longitudeExact}
                onChange={(e) => setForm((f) => ({ ...f, longitudeExact: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-navy">{t('arrivalInstructionsAr')}</label>
              <textarea
                rows={3}
                maxLength={2000}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
                value={form.arrivalInstructionsAr}
                onChange={(e) => setForm((f) => ({ ...f, arrivalInstructionsAr: e.target.value }))}
                placeholder={t('arrivalInstructionsPlaceholderAr')}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-navy">{t('arrivalInstructionsEn')}</label>
              <textarea
                rows={3}
                maxLength={2000}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
                value={form.arrivalInstructionsEn}
                onChange={(e) => setForm((f) => ({ ...f, arrivalInstructionsEn: e.target.value }))}
                placeholder={t('arrivalInstructionsPlaceholderEn')}
              />
            </div>
          </div>
          {mode === 'edit' && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                data-testid="owner-save-location"
                onClick={() => void handleSaveLocation()}
              >
                {t('saveLocation')}
              </Button>
              {locationSaved && <p className="text-xs text-navy">{t('locationSaved')}</p>}
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-2 rounded-2xl border border-primary/15 bg-primary-soft/20 p-4">
          <legend className="px-1 text-sm font-medium text-navy">{t('bookingMode')}</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="bookingMode"
              checked={form.instantBookingEnabled}
              onChange={() => setForm((f) => ({ ...f, instantBookingEnabled: true }))}
            />
            {t('instantBooking')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="bookingMode"
              checked={!form.instantBookingEnabled}
              onChange={() => setForm((f) => ({ ...f, instantBookingEnabled: false }))}
            />
            {t('ownerApprovalRequired')}
          </label>
          {mode === 'edit' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => void handleSaveBookingMode()}
            >
              {t('saveBookingMode')}
            </Button>
          )}
        </fieldset>

        <div>
          <p className="mb-2 text-sm font-medium text-navy">{t('amenities')}</p>
          <div className="flex flex-wrap gap-2">
            {AMENITY_KEYS.map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={form.amenityKeys.includes(key)}
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      amenityKeys: e.target.checked
                        ? [...f.amenityKeys, key]
                        : f.amenityKeys.filter((k) => k !== key),
                    }));
                  }}
                />
                {t(`amenity.${key}`)}
              </label>
            ))}
          </div>
        </div>

        <PropertyMediaQualityBox media={mediaForQuality} namespace="ownerProperty" />

        {mode === 'edit' && initial?.id ? (
          <OwnerPropertyMediaEditor
            propertyId={initial.id}
            media={media ?? []}
            onMediaChange={syncMediaToForm}
            disabled={saving || !mediaMutable}
          />
        ) : (
          <div>
            <p className="mb-2 text-sm font-medium text-navy">{t('imageUrls')}</p>
            <p className="mb-3 text-xs text-muted">{t('mediaGalleryHint')}</p>
            {form.imageUrls.map((url, i) => (
              <div key={i} className="mb-2 flex gap-2">
                <Input
                  placeholder={t('mediaUrlPlaceholder')}
                  value={url}
                  onChange={(e) => {
                    const next = [...form.imageUrls];
                    next[i] = e.target.value;
                    setForm((f) => ({ ...f, imageUrls: next }));
                  }}
                />
                {form.imageUrls.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        imageUrls: f.imageUrls.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setForm((f) => ({ ...f, imageUrls: [...f.imageUrls, ''] }))
              }
            >
              <Plus className="h-4 w-4" />
              {t('addImage')}
            </Button>

            <div className="mt-4 rounded-2xl border border-primary/15 bg-primary-soft/30 p-4">
              <input
                key={createFileInputKey}
                ref={createFileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                onChange={(e) => {
                  setPendingFiles(Array.from(e.target.files ?? []));
                }}
              />
              <button
                type="button"
                onClick={() => createFileInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-primary/35 bg-surface px-4 py-6 text-center transition-colors hover:border-primary/60 hover:bg-primary-soft/50"
              >
                <ImagePlus className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium text-navy">{t('mediaChooseFiles')}</span>
                <span className="text-xs text-muted">{t('mediaFormats')}</span>
                <span className="text-xs text-muted">{t('mediaMaxSize')}</span>
              </button>
              {pendingFiles.length > 0 && (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-navy">{t('mediaSelected', { count: pendingFiles.length })}</p>
                  <p className="text-xs text-muted">{t('mediaCreateUploadHint')}</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {pendingPreviews.map((src, i) => (
                      <div key={src} className="relative aspect-square overflow-hidden rounded-xl bg-primary-soft">
                        {/* Local object URLs — not remote. */}
                        <img
                          src={src}
                          alt={pendingFiles[i]?.name ?? t('imageUrls')}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-navy">{t('rules')}</p>
          {form.rules.map((rule, i) => (
            <div key={i} className="mb-3 grid gap-2 sm:grid-cols-2">
              <Input
                placeholder={t('ruleAr')}
                value={rule.titleAr}
                onChange={(e) => {
                  const next = [...form.rules];
                  next[i] = { ...next[i]!, titleAr: e.target.value };
                  setForm((f) => ({ ...f, rules: next }));
                }}
              />
              <Input
                placeholder={t('ruleEn')}
                value={rule.titleEn}
                onChange={(e) => {
                  const next = [...form.rules];
                  next[i] = { ...next[i]!, titleEn: e.target.value };
                  setForm((f) => ({ ...f, rules: next }));
                }}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setForm((f) => ({ ...f, rules: [...f.rules, emptyRule] }))}
          >
            <Plus className="h-4 w-4" />
            {t('addRule')}
          </Button>
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button
          className="shadow-soft"
          disabled={saving || !listingEditable}
          onClick={() => void handleSave(false)}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('saveDraft')}
        </Button>
        {canSubmitReview && (
          <Button
            variant="default"
            className="shadow-soft"
            disabled={saving || !mediaAssessment.canSubmitReview || !listingEditable}
            data-testid="owner-property-submit-review"
            onClick={() => void handleSave(true)}
          >
            {t('submitReview')}
          </Button>
        )}
      </div>
    </div>
  );
}
