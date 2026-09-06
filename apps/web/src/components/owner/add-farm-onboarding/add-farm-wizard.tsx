'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import {
  ADD_FARM_STEPS,
  MIN_MEDIA_FOR_SUBMIT_REVIEW,
  PROPERTY_TYPES,
  assessPropertyMedia,
  calculatePropertyOnboardingReadiness,
  createOwnerPropertyDraftSchema,
  isAddFarmBasicComplete,
  isAddFarmLocationComplete,
  isAddFarmPhotosComplete,
  isAddFarmPricingComplete,
  isAddFarmStepId,
  isOwnerPropertyEditableStatus,
  type AddFarmStepId,
  type CreateOwnerPropertyDraftInput,
  type PropertyMediaItem,
  type PropertyType,
  type UpdateOwnerPropertyInput,
} from '@mazare3/shared';
import {
  createOwnerPropertyDraft,
  fetchOwnerPropertyEdit,
  submitOwnerPropertyReview,
  updateOwnerProperty,
  uploadOwnerPropertyMediaFile,
  OwnerApiError,
} from '@/lib/api-owner';
import { AddFarmStepper } from './add-farm-stepper';
import { AddFarmActions } from './add-farm-actions';
import { AddFarmPreview } from './add-farm-preview';
import { AddFarmMapPreview } from './add-farm-map-preview';
import { AddFarmReadiness } from './add-farm-readiness';
import { AddFarmTips } from './add-farm-tips';
import { BasicInformationStep } from './steps/basic-information-step';
import { LocationStep } from './steps/location-step';
import { PhotosAmenitiesStep } from './steps/photos-amenities-step';
import {
  PricingAvailabilityStep,
  type AddFarmAvailabilitySummary,
} from './steps/pricing-availability-step';
import { ReviewStep } from './steps/review-step';

export type AddFarmFormState = {
  type: PropertyType;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  city: string;
  area: string;
  approximateAddress: string;
  exactAddress: string;
  latitudeApprox: string;
  longitudeApprox: string;
  latitudeExact: string;
  longitudeExact: string;
  arrivalInstructionsAr: string;
  arrivalInstructionsEn: string;
  basePrice: string;
  capacity: string;
  allowsOvernight: boolean;
  allowsFamilies: boolean;
  allowsYouth: boolean;
  instantBookingEnabled: boolean;
  poolsCount: string;
  amenityKeys: string[];
  imageUrls: string[];
  rules: Array<{ titleAr: string; titleEn: string }>;
};

const INITIAL_FORM: AddFarmFormState = {
  type: 'farm',
  titleAr: '',
  titleEn: '',
  descriptionAr: '',
  descriptionEn: '',
  city: '',
  area: '',
  approximateAddress: '',
  exactAddress: '',
  latitudeApprox: '',
  longitudeApprox: '',
  latitudeExact: '',
  longitudeExact: '',
  arrivalInstructionsAr: '',
  arrivalInstructionsEn: '',
  basePrice: '',
  capacity: '10',
  allowsOvernight: true,
  allowsFamilies: true,
  allowsYouth: false,
  instantBookingEnabled: true,
  poolsCount: '0',
  amenityKeys: [],
  imageUrls: [''],
  rules: [{ titleAr: '', titleEn: '' }],
};

function parseOptionalCoord(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function buildDraftCreatePayload(form: AddFarmFormState): CreateOwnerPropertyDraftInput {
  return {
    type: form.type,
    titleAr: form.titleAr.trim(),
    titleEn: form.titleEn.trim() || undefined,
    descriptionAr: form.descriptionAr.trim(),
    descriptionEn: form.descriptionEn.trim() || undefined,
    capacity: Number(form.capacity),
    allowsOvernight: form.allowsOvernight,
    allowsFamilies: form.allowsFamilies,
    allowsYouth: form.allowsYouth,
  };
}

/** PATCH only fields that are present/valid — never clear location/price with empty strings. */
function buildPatchPayload(form: AddFarmFormState): UpdateOwnerPropertyInput {
  const patch: UpdateOwnerPropertyInput = {
    type: form.type,
    titleAr: form.titleAr.trim(),
    titleEn: form.titleEn.trim() || undefined,
    descriptionAr: form.descriptionAr.trim(),
    descriptionEn: form.descriptionEn.trim() || undefined,
    capacity: Number(form.capacity),
    allowsOvernight: form.allowsOvernight,
    allowsFamilies: form.allowsFamilies,
    allowsYouth: form.allowsYouth,
    instantBookingEnabled: form.instantBookingEnabled,
    poolsCount: Number(form.poolsCount) || 0,
    amenityKeys: form.amenityKeys,
    rules: form.rules
      .filter((r) => r.titleAr.trim())
      .map((r) => ({ titleAr: r.titleAr, titleEn: r.titleEn || undefined })),
  };

  const city = form.city.trim();
  if (city.length >= 2) patch.city = city;
  if (form.area.trim().length >= 2) patch.area = form.area.trim();
  if (form.approximateAddress.trim().length >= 5) {
    patch.approximateAddress = form.approximateAddress.trim();
  }
  if (form.exactAddress.trim().length >= 5) patch.exactAddress = form.exactAddress.trim();

  const latA = parseOptionalCoord(form.latitudeApprox);
  const lngA = parseOptionalCoord(form.longitudeApprox);
  const latE = parseOptionalCoord(form.latitudeExact);
  const lngE = parseOptionalCoord(form.longitudeExact);
  if (latA != null) patch.latitudeApprox = latA;
  if (lngA != null) patch.longitudeApprox = lngA;
  if (latE != null) patch.latitudeExact = latE;
  if (lngE != null) patch.longitudeExact = lngE;

  const arrivalAr = form.arrivalInstructionsAr.trim();
  const arrivalEn = form.arrivalInstructionsEn.trim();
  if (arrivalAr) patch.arrivalInstructionsAr = arrivalAr;
  if (arrivalEn) patch.arrivalInstructionsEn = arrivalEn;

  const price = Number(form.basePrice);
  if (Number.isFinite(price) && price > 0) patch.basePrice = price;

  return patch;
}

function locationPatchExtras(form: AddFarmFormState): UpdateOwnerPropertyInput {
  const full = buildPatchPayload(form);
  const extras: UpdateOwnerPropertyInput = {};
  if (full.city !== undefined) extras.city = full.city;
  if (full.area !== undefined) extras.area = full.area;
  if (full.approximateAddress !== undefined) extras.approximateAddress = full.approximateAddress;
  if (full.exactAddress !== undefined) extras.exactAddress = full.exactAddress;
  if (full.latitudeApprox !== undefined) extras.latitudeApprox = full.latitudeApprox;
  if (full.longitudeApprox !== undefined) extras.longitudeApprox = full.longitudeApprox;
  if (full.latitudeExact !== undefined) extras.latitudeExact = full.latitudeExact;
  if (full.longitudeExact !== undefined) extras.longitudeExact = full.longitudeExact;
  if (full.arrivalInstructionsAr !== undefined) {
    extras.arrivalInstructionsAr = full.arrivalInstructionsAr;
  }
  if (full.arrivalInstructionsEn !== undefined) {
    extras.arrivalInstructionsEn = full.arrivalInstructionsEn;
  }
  if (full.basePrice !== undefined) extras.basePrice = full.basePrice;
  if (full.amenityKeys !== undefined && full.amenityKeys.length) {
    extras.amenityKeys = full.amenityKeys;
  }
  if (full.instantBookingEnabled !== undefined) {
    extras.instantBookingEnabled = full.instantBookingEnabled;
  }
  if (full.poolsCount !== undefined) extras.poolsCount = full.poolsCount;
  return extras;
}

function hasLocationExtras(extras: UpdateOwnerPropertyInput): boolean {
  return Object.keys(extras).length > 0;
}

function stepComplete(step: AddFarmStepId, form: AddFarmFormState, mediaCount: number): boolean {
  const capacity = Number(form.capacity);
  const basePrice = Number(form.basePrice);
  const input = {
    titleAr: form.titleAr,
    descriptionAr: form.descriptionAr,
    type: form.type,
    capacity: Number.isFinite(capacity) ? capacity : null,
    city: form.city,
    area: form.area,
    approximateAddress: form.approximateAddress,
    exactAddress: form.exactAddress,
    basePrice: Number.isFinite(basePrice) && basePrice > 0 ? basePrice : null,
    mediaCount,
  };
  switch (step) {
    case 'basic':
      return isAddFarmBasicComplete(input);
    case 'location':
      return isAddFarmLocationComplete(input);
    case 'photos':
      return isAddFarmPhotosComplete({ mediaCount });
    case 'pricing':
      return isAddFarmPricingComplete(input);
    case 'review':
      return calculatePropertyOnboardingReadiness(input).review;
    default:
      return false;
  }
}

export function AddFarmWizard() {
  const t = useTranslations('addFarm');
  const tProp = useTranslations('ownerProperty');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();
  const searchParams = useSearchParams();

  const stepParam = searchParams.get('step');
  const draftParam = searchParams.get('draft');

  const [step, setStep] = useState<AddFarmStepId>(
    isAddFarmStepId(stepParam) ? stepParam : 'basic',
  );
  const [propertyId, setPropertyId] = useState<string | null>(draftParam);
  const [form, setForm] = useState<AddFarmFormState>(INITIAL_FORM);
  const [media, setMedia] = useState<PropertyMediaItem[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(Boolean(draftParam));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveOk, setSaveOk] = useState(false);
  const creatingRef = useRef(false);
  /** Prevents late draft GET / step URL sync from clobbering in-progress form edits. */
  const hydratedDraftRef = useRef<string | null>(null);
  const availPersistRef = useRef<(() => Promise<void>) | null>(null);
  const [availSummary, setAvailSummary] = useState<AddFarmAvailabilitySummary>({
    enabledPeriodCount: 0,
    rangeLabel: null,
    healthWarning: null,
  });

  const registerAvailPersist = useCallback((fn: (() => Promise<void>) | null) => {
    availPersistRef.current = fn;
  }, []);

  const onAvailSummaryChange = useCallback((summary: AddFarmAvailabilitySummary) => {
    setAvailSummary(summary);
  }, []);

  const mediaCount = media.length || form.imageUrls.map((u) => u.trim()).filter(Boolean).length + pendingFiles.length;

  const readiness = useMemo(
    () =>
      calculatePropertyOnboardingReadiness({
        titleAr: form.titleAr,
        descriptionAr: form.descriptionAr,
        type: form.type,
        capacity: Number(form.capacity) || null,
        city: form.city,
        area: form.area,
        approximateAddress: form.approximateAddress,
        exactAddress: form.exactAddress,
        basePrice: Number(form.basePrice) || null,
        mediaCount,
        amenityCount: form.amenityKeys.length,
      }),
    [form, mediaCount],
  );

  const coverMediaUrl = useMemo(() => {
    const cover =
      media.find((m) => m.isCover) ?? media.find((m) => m.sortOrder === 0) ?? media[0];
    return cover?.url;
  }, [media]);

  const syncUrl = useCallback(
    (nextStep: AddFarmStepId, nextDraft: string | null) => {
      const sp = new URLSearchParams();
      sp.set('step', nextStep);
      if (nextDraft) sp.set('draft', nextDraft);
      router.replace(`/owner/properties/new?${sp.toString()}`, { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    if (isAddFarmStepId(stepParam) && stepParam !== step) setStep(stepParam);
  }, [stepParam, step]);

  useEffect(() => {
    if (!draftParam) {
      hydratedDraftRef.current = null;
      setLoadingDraft(false);
      return;
    }
    // Same draft already applied this session (create + URL sync, or step changes).
    // Re-fetching on every stepParam rewrite was wiping in-progress Location/Pricing edits.
    if (hydratedDraftRef.current === draftParam) {
      setLoadingDraft(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchOwnerPropertyEdit(draftParam);
        if (cancelled) return;
        const p = res.data;
        if (!isOwnerPropertyEditableStatus(p.status)) {
          setError(t('errors.draftNotEditable'));
          setPropertyId(null);
          hydratedDraftRef.current = null;
          syncUrl(isAddFarmStepId(stepParam) ? stepParam : 'basic', null);
          return;
        }
        setPropertyId(p.id);
        setMedia(p.media ?? []);
        setForm({
          type: (PROPERTY_TYPES as readonly string[]).includes(p.type)
            ? (p.type as PropertyType)
            : 'farm',
          titleAr: p.titleAr ?? '',
          titleEn: p.titleEn ?? '',
          descriptionAr: p.descriptionAr ?? '',
          descriptionEn: p.descriptionEn ?? '',
          city: p.city ?? '',
          area: p.area ?? '',
          approximateAddress: p.approximateAddress ?? '',
          exactAddress: p.exactAddress ?? '',
          latitudeApprox: p.latitudeApprox != null ? String(p.latitudeApprox) : '',
          longitudeApprox: p.longitudeApprox != null ? String(p.longitudeApprox) : '',
          latitudeExact: p.latitudeExact != null ? String(p.latitudeExact) : '',
          longitudeExact: p.longitudeExact != null ? String(p.longitudeExact) : '',
          arrivalInstructionsAr: p.arrivalInstructionsAr ?? '',
          arrivalInstructionsEn: p.arrivalInstructionsEn ?? '',
          basePrice: String(p.basePrice ?? ''),
          capacity: String(p.capacity ?? 10),
          allowsOvernight: p.allowsOvernight ?? true,
          allowsFamilies: p.allowsFamilies ?? true,
          allowsYouth: p.allowsYouth ?? false,
          instantBookingEnabled: p.instantBookingEnabled ?? true,
          poolsCount: String(p.poolsCount ?? 0),
          amenityKeys: p.amenityKeys ?? [],
          imageUrls: p.imageUrls?.length ? p.imageUrls : [''],
          rules: p.rules?.length
            ? p.rules.map((r) => ({ titleAr: r.titleAr, titleEn: r.titleEn ?? '' }))
            : [{ titleAr: '', titleEn: '' }],
        });
        hydratedDraftRef.current = p.id;
      } catch (e) {
        if (!cancelled) {
          const message =
            e instanceof OwnerApiError
              ? e.status === 404
                ? t('errors.draftInaccessible')
                : e.message
              : t('errors.draftLoadFailed');
          setError(message);
          setPropertyId(null);
          hydratedDraftRef.current = null;
        }
      } finally {
        if (!cancelled) setLoadingDraft(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftParam, t, syncUrl, stepParam]);

  function patchForm(patch: Partial<AddFarmFormState>) {
    setForm((f) => ({ ...f, ...patch }));
    setSaveOk(false);
  }

  function validateBasic(): boolean {
    const errors: Record<string, string> = {};
    if (form.titleAr.trim().length < 3) errors.titleAr = t('errors.titleAr');
    if (form.descriptionAr.trim().length < 20) errors.descriptionAr = t('errors.descriptionAr');
    const cap = Number(form.capacity);
    if (!Number.isFinite(cap) || cap < 1 || cap > 500) errors.capacity = t('errors.capacity');
    if (!(PROPERTY_TYPES as readonly string[]).includes(form.type)) {
      errors.type = t('errors.type');
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const focusId =
        errors.titleAr
          ? 'add-farm-title-ar'
          : errors.type
            ? 'add-farm-capacity'
            : errors.capacity
              ? 'add-farm-capacity'
              : errors.descriptionAr
                ? 'add-farm-desc-ar'
                : null;
      if (focusId) {
        queueMicrotask(() => document.getElementById(focusId)?.focus());
      }
      return false;
    }
    return true;
  }

  function validateStep(s: AddFarmStepId): boolean {
    if (s === 'basic') return validateBasic();
    if (s === 'location') {
      const errors: Record<string, string> = {};
      const city = form.city.trim();
      if (city.length < 2) errors.city = t('errors.city');
      if (form.area.trim().length < 2) errors.area = t('errors.area');
      if (form.approximateAddress.trim().length < 5) {
        errors.approximateAddress = t('errors.approximateAddress');
      }
      if (form.exactAddress.trim().length < 5) errors.exactAddress = t('errors.exactAddress');
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        const focusId = errors.city
          ? 'add-farm-city'
          : errors.area
            ? 'add-farm-area'
            : errors.approximateAddress
              ? 'add-farm-approx'
              : errors.exactAddress
                ? 'add-farm-exact'
                : null;
        if (focusId) queueMicrotask(() => document.getElementById(focusId)?.focus());
        return false;
      }
      return true;
    }
    if (s === 'photos') {
      if (!propertyId) {
        setError(t('errors.photosNeedDraft'));
        return false;
      }
      const assessment = assessPropertyMedia(media.map((m) => ({ sortOrder: m.sortOrder })));
      if (!assessment.canSubmitReview || media.length < MIN_MEDIA_FOR_SUBMIT_REVIEW) {
        setError(t('errors.photosNeedMin', { min: MIN_MEDIA_FOR_SUBMIT_REVIEW }));
        return false;
      }
      setFieldErrors({});
      setError(null);
      return true;
    }
    if (s === 'pricing') {
      if (!propertyId) {
        setError(t('errors.pricingNeedDraft'));
        return false;
      }
      const errors: Record<string, string> = {};
      const price = Number(form.basePrice);
      if (!Number.isFinite(price) || price <= 0) errors.basePrice = t('errors.basePrice');
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        queueMicrotask(() => document.getElementById('add-farm-base-price')?.focus());
        return false;
      }
      setError(null);
      return true;
    }
    setFieldErrors({});
    return true;
  }

  async function persistDraft(): Promise<string | null> {
    setError(null);
    setSaveOk(false);

    if (propertyId) {
      await updateOwnerProperty(propertyId, buildPatchPayload(form));
      if (pendingFiles.length) {
        for (const f of pendingFiles) {
          const up = await uploadOwnerPropertyMediaFile(propertyId, f);
          setMedia(up.data.media);
        }
        setPendingFiles([]);
      }
      setSaveOk(true);
      return propertyId;
    }

    const parsed = createOwnerPropertyDraftSchema.safeParse(buildDraftCreatePayload(form));
    if (!parsed.success) {
      setError(t('errors.draftCreateFailed'));
      return null;
    }
    if (creatingRef.current) return propertyId;
    creatingRef.current = true;
    try {
      const res = await createOwnerPropertyDraft(parsed.data);
      const id = res.data.id;
      // Authoritative ID before any navigation/toast work.
      setPropertyId(id);
      // Skip the draftParam-triggered GET so URL sync does not clobber local form.
      hydratedDraftRef.current = id;
      const extras = locationPatchExtras(form);
      if (hasLocationExtras(extras)) {
        await updateOwnerProperty(id, extras);
      }
      if (pendingFiles.length) {
        for (const f of pendingFiles) {
          const up = await uploadOwnerPropertyMediaFile(id, f);
          setMedia(up.data.media);
        }
        setPendingFiles([]);
      }
      setSaveOk(true);
      return id;
    } finally {
      creatingRef.current = false;
    }
  }

  async function persistAvailabilityIfNeeded(): Promise<boolean> {
    if (step !== 'pricing') return true;
    const fn = availPersistRef.current;
    if (!fn) return true;
    try {
      await fn();
      return true;
    } catch (e) {
      setError(
        e instanceof OwnerApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : t('errors.availabilitySaveFailed'),
      );
      setSaveOk(false);
      return false;
    }
  }

  async function handleSaveDraft() {
    if (saving || creatingRef.current) return;
    // Save Draft: Basic must be valid to create; Location/Photos/Pricing may be partial once a draft exists.
    if (step === 'basic' || !propertyId) {
      if (!validateBasic()) return;
    }
    setSaving(true);
    try {
      const id = await persistDraft();
      if (!id) return;
      const availOk = await persistAvailabilityIfNeeded();
      if (availOk) syncUrl(step, id);
    } catch (e) {
      setError(
        e instanceof OwnerApiError
          ? e.message
          : t('errors.draftCreateFailed'),
      );
      setSaveOk(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    if (!validateStep(step)) return;
    const idx = ADD_FARM_STEPS.indexOf(step);
    if (idx < 0 || idx >= ADD_FARM_STEPS.length - 1) return;
    if (saving || creatingRef.current) return;

    setSaving(true);
    try {
      // Step 1 (and later steps once a draft exists) must persist before advancing.
      if (step === 'basic' || propertyId) {
        const id = await persistDraft();
        if (!id) return;
        const availOk = await persistAvailabilityIfNeeded();
        if (!availOk) return;
        const next = ADD_FARM_STEPS[idx + 1]!;
        setStep(next);
        syncUrl(next, id);
        return;
      }
      const next = ADD_FARM_STEPS[idx + 1]!;
      setStep(next);
      syncUrl(next, propertyId);
    } catch (e) {
      setError(
        e instanceof OwnerApiError ? e.message : t('errors.draftCreateFailed'),
      );
      setSaveOk(false);
    } finally {
      setSaving(false);
    }
  }

  function handlePrevious() {
    const idx = ADD_FARM_STEPS.indexOf(step);
    if (idx <= 0) return;
    const prev = ADD_FARM_STEPS[idx - 1]!;
    setStep(prev);
    syncUrl(prev, propertyId);
  }

  function handleStepSelect(target: AddFarmStepId) {
    const targetIdx = ADD_FARM_STEPS.indexOf(target);
    const currentIdx = ADD_FARM_STEPS.indexOf(step);
    if (targetIdx <= currentIdx) {
      setStep(target);
      syncUrl(target, propertyId);
      return;
    }
    for (let i = 0; i < targetIdx; i++) {
      const s = ADD_FARM_STEPS[i]!;
      if (!stepComplete(s, form, mediaCount)) return;
    }
    setStep(target);
    syncUrl(target, propertyId);
  }

  async function handleSubmitReview() {
    if (saving || creatingRef.current) return;
    setSaving(true);
    setError(null);
    try {
      const id = propertyId;
      if (!id) {
        setError(t('errors.reviewNeedDraft'));
        return;
      }
      await persistDraft();
      const assessment = assessPropertyMedia(media.map((m) => ({ sortOrder: m.sortOrder })));
      if (!assessment.canSubmitReview) {
        setError(tProp('mediaSubmitRequired'));
        return;
      }
      if (!readiness.review) {
        setError(t('reviewIncomplete'));
        return;
      }
      await submitOwnerPropertyReview(id);
      // Authoritative transition: draft/changes_requested → pending_review (server).
      router.push(`/owner/properties/${id}?submitted=1`);
      router.refresh();
    } catch (e) {
      const code = e instanceof OwnerApiError ? e.code : undefined;
      if (code === 'PROPERTY_LISTING_INCOMPLETE') {
        setError(t('errors.listingIncomplete'));
      } else if (code === 'PROPERTY_MEDIA_REQUIRED') {
        setError(tProp('mediaSubmitRequired'));
      } else if (code === 'INVALID_STATUS') {
        setError(t('errors.alreadySubmitted'));
      } else {
        setError(e instanceof OwnerApiError ? e.message : tProp('saveError'));
      }
      setSaveOk(false);
    } finally {
      setSaving(false);
    }
  }

  if (loadingDraft) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#53637A]" data-testid="add-farm-loading">
        {t('loading')}
      </div>
    );
  }

  const completed = {
    basic: readiness.basic,
    location: readiness.location,
    photos: readiness.photos,
    pricing: readiness.pricing,
    review: readiness.review,
  };

  return (
    <div data-testid="add-farm-wizard" className="space-y-5 pb-10 sm:pb-8 lg:pb-10">
      <header className="space-y-1 text-start">
        <h1 className="font-heading text-[1.65rem] leading-tight text-[#0D2046] sm:text-[1.85rem]">
          {t('title')}
        </h1>
        <p className="max-w-2xl text-[13px] font-medium text-[#53637A] sm:text-[14px]">{t('subtitle')}</p>
      </header>

      <AddFarmStepper
        current={step}
        completed={completed}
        onSelect={handleStepSelect}
      />

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger"
          data-testid="add-farm-error"
        >
          {error}
        </p>
      ) : null}
      {saveOk ? (
        <p className="text-sm font-medium text-[#15803D]" data-testid="add-farm-saved">
          {t('saved')}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,30%)] xl:items-start xl:gap-7">
        <div className="min-w-0 space-y-4">
          <div className="rounded-[20px] border border-[#E5EAF1] bg-white p-4 shadow-[0_6px_20px_rgba(13,32,70,.04)] sm:p-6">
            {step === 'basic' ? (
              <BasicInformationStep
                form={form}
                errors={fieldErrors}
                onChange={patchForm}
              />
            ) : null}
            {step === 'location' ? (
              <LocationStep form={form} errors={fieldErrors} onChange={patchForm} />
            ) : null}
            {step === 'photos' ? (
              <PhotosAmenitiesStep
                form={form}
                propertyId={propertyId}
                media={media}
                onChange={patchForm}
                onMediaChange={setMedia}
                disabled={saving}
              />
            ) : null}
            {step === 'pricing' ? (
              <PricingAvailabilityStep
                form={form}
                errors={fieldErrors}
                propertyId={propertyId}
                locale={locale}
                onChange={patchForm}
                registerPersist={registerAvailPersist}
                onSummaryChange={onAvailSummaryChange}
                disabled={saving}
              />
            ) : null}
            {step === 'review' ? (
              <ReviewStep
                form={form}
                readiness={readiness}
                media={media}
                locale={locale}
                propertyId={propertyId}
                coverUrl={coverMediaUrl}
                onEditStep={(s) => {
                  setStep(s);
                  syncUrl(s, propertyId);
                }}
                onSubmitReview={() => void handleSubmitReview()}
                submitting={saving}
              />
            ) : null}
          </div>

          <AddFarmActions
            step={step}
            saving={saving}
            onPrevious={handlePrevious}
            onNext={() => void handleNext()}
            onSaveDraft={() => void handleSaveDraft()}
            showSaveDraft={step !== 'review'}
            showSubmit={false}
          />
        </div>

        <aside className="space-y-3 xl:sticky xl:top-4">
          <div className="hidden sm:block xl:block">
            <AddFarmPreview form={form} mediaUrl={coverMediaUrl} locale={locale} />
          </div>
          <div className="sm:hidden">
            <AddFarmReadiness readiness={readiness} />
          </div>
          <div className="hidden space-y-3 sm:block">
            <AddFarmReadiness readiness={readiness} />
            {step === 'review' ? (
              <section
                data-testid="add-farm-rail-publish-readiness"
                className="rounded-[16px] border border-amber-400/30 bg-amber-50/70 p-4 text-start"
              >
                <p className="text-[13px] font-bold text-[#0D2046]">{t('beforeLiveTitle')}</p>
                <p className="mt-1 text-[12px] text-[#53637A]">{t('beforeLiveRailHint')}</p>
              </section>
            ) : (
              <AddFarmTips step={step} />
            )}
            {step === 'pricing' && availSummary.enabledPeriodCount > 0 ? (
              <section
                data-testid="add-farm-availability-summary"
                className="rounded-[16px] border border-[#E5EAF1] bg-white p-4 text-start"
              >
                <p className="text-[13px] font-bold text-[#0D2046]">{t('availabilitySummaryTitle')}</p>
                <p className="mt-1 text-[12px] text-[#53637A]">
                  {t('periodsSelected', { count: availSummary.enabledPeriodCount })}
                </p>
                {availSummary.rangeLabel ? (
                  <p className="mt-1 text-[12px] text-[#53637A]">
                    {t('availabilityRange', { range: availSummary.rangeLabel })}
                  </p>
                ) : null}
              </section>
            ) : null}
            {step !== 'review' ? (
              <AddFarmMapPreview
                form={form}
                locale={locale}
                preferTextSummary={step === 'location'}
              />
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
