'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getMe, refreshSession } from '@/lib/api-auth';
import {
  acceptPartnerAgreement,
  fetchPartnerOnboarding,
  fetchPartnerRequirements,
  patchPartnerOnboarding,
  putPartnerPayoutProfile,
  submitPartnerOnboarding,
  uploadPartnerDocument,
  PartnerApiError,
  type PartnerOnboardingView,
  type PartnerRequirementRow,
} from '@/lib/api-partner';
import { isApprovedOwnerForAddFarm, rememberPartnerVerificationStatus } from '@/lib/add-farm-entry';
import { Button } from '@/components/ui/button';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';
import { PartnerEntryLanding } from './partner-onboarding/partner-entry-landing';
import { PartnerOnboardingShell } from './partner-onboarding/partner-onboarding-shell';
import { PartnerStatusPanel } from './partner-onboarding/partner-status-panel';
import {
  PartnerWizardSteps,
  type PartnerWizardFormState,
} from './partner-onboarding/partner-wizard-steps';
import {
  APPROVED_PARTNER_STATUSES,
  EDITABLE_PARTNER_STATUSES,
  PARTNER_ONBOARDING_STEPS,
  PENDING_PARTNER_STATUSES,
  PLACEHOLDER_PARTNER_NAME,
  PLACEHOLDER_PARTNER_PHONE,
  derivePartnerSectionCompletion,
  emptyIfPartnerPlaceholder,
  hasMeaningfulPartnerProgress,
  looksLikeMaskedPayoutValue,
  missingRequiredPartnerDocuments,
  hasAcceptedCurrentPartnerAgreement,
  hasDistinctOperatingLocation,
  resolvePartnerOnboardingStepId,
  validatePartnerDocumentFile,
  validatePartnerPayoutForm,
  type PartnerOnboardingStepId,
} from './partner-onboarding/partner-onboarding-model';

const INITIAL_FORM: PartnerWizardFormState = {
  entityType: '',
  displayName: '',
  businessName: '',
  phone: '',
  city: '',
  area: '',
  bio: '',
  approximateFarmCount: '',
  legalName: '',
  operatingPhone: '',
  operatingCity: '',
  operatingArea: '',
  contactEmail: '',
  beneficiaryName: '',
  bankName: '',
  iban: '',
  optionalNotes: '',
};

export function BecomeOwnerView() {
  const t = useTranslations('becomeOwner');
  const locale = useLocale() as 'ar' | 'en';
  const pathname = usePathname();
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<PartnerOnboardingView | null>(null);
  const [requirements, setRequirements] = useState<PartnerRequirementRow[]>([]);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [form, setForm] = useState<PartnerWizardFormState>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [payoutEditing, setPayoutEditing] = useState(false);
  const [differentOperatingLocation, setDifferentOperatingLocation] = useState(false);

  const editable = onboarding
    ? EDITABLE_PARTNER_STATUSES.includes(onboarding.verificationStatus)
    : true;
  const currentStep = PARTNER_ONBOARDING_STEPS[step] ?? 'entity';

  const hydrate = useCallback((view: PartnerOnboardingView) => {
    setOnboarding(view);
    rememberPartnerVerificationStatus(view.verificationStatus);
    setForm((prev) => ({
      ...prev,
      entityType: view.entityType ?? prev.entityType,
      displayName:
        emptyIfPartnerPlaceholder(view.displayName, PLACEHOLDER_PARTNER_NAME) || prev.displayName,
      businessName: view.businessName ?? prev.businessName,
      phone: emptyIfPartnerPlaceholder(view.phone, PLACEHOLDER_PARTNER_PHONE) || prev.phone,
      city: view.city ?? prev.city,
      area: view.area ?? prev.area,
      bio: view.bio ?? prev.bio,
      approximateFarmCount:
        view.approximateFarmCount != null ? String(view.approximateFarmCount) : prev.approximateFarmCount,
      legalName: view.legalName ?? prev.legalName,
      operatingPhone: view.operatingPhone ?? prev.operatingPhone,
      operatingCity: view.operatingCity ?? prev.operatingCity,
      operatingArea: view.operatingArea ?? prev.operatingArea,
      contactEmail: view.contactEmail ?? prev.contactEmail,
    }));
    setDifferentOperatingLocation(
      hasDistinctOperatingLocation({
        city: view.city,
        area: view.area,
        operatingCity: view.operatingCity,
        operatingArea: view.operatingArea,
      }),
    );
    if (view.acceptedAgreement && view.currentAgreement && view.acceptedAgreement.agreementId === view.currentAgreement.id) {
      setAcceptedTerms(true);
    } else if (view.readiness?.agreementAccepted) {
      setAcceptedTerms(true);
    } else {
      setAcceptedTerms(false);
    }
  }, []);

  const loadRequirements = useCallback(async () => {
    const res = await fetchPartnerRequirements();
    setRequirements(res.data);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await getMe();
        setLoggedIn(true);
        setRole(res.data.user.role);
        setAccountEmail(res.data.user.email ?? null);
        if (isApprovedOwnerForAddFarm(res.data.user)) {
          router.replace('/owner/properties/new');
          return;
        }
        if (res.data.user.role === 'admin') {
          setAuthLoading(false);
          return;
        }
        const onboardRes = await fetchPartnerOnboarding();
        hydrate(onboardRes.data);
        if (
          onboardRes.data.verificationStatus === 'approved' ||
          onboardRes.data.verificationStatus === 'legacy_approved'
        ) {
          const refreshed = await refreshSession();
          setRole(refreshed.data.user.role);
          if (isApprovedOwnerForAddFarm(refreshed.data.user)) {
            router.replace('/owner/properties/new');
            return;
          }
        }
        if (hasMeaningfulPartnerProgress(onboardRes.data)) {
          setWizardOpen(true);
        }
        if (PENDING_PARTNER_STATUSES.includes(onboardRes.data.verificationStatus)) {
          setStep(PARTNER_ONBOARDING_STEPS.length - 1);
          setWizardOpen(false);
        }
        if (onboardRes.data.verificationStatus === 'changes_requested') {
          setWizardOpen(true);
        }
        try {
          const reqs = await fetchPartnerRequirements();
          setRequirements(reqs.data);
        } catch {
          /* requirements load after profile exists */
        }
      } catch {
        setLoggedIn(false);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [hydrate, router]);

  const completion = useMemo(
    () => derivePartnerSectionCompletion(onboarding, requirements),
    [onboarding, requirements],
  );

  const stepValid = useMemo(() => {
    if (currentStep === 'entity') {
      return (
        Boolean(form.entityType) &&
        form.displayName.trim().length >= 2 &&
        form.city.trim().length >= 2 &&
        form.area.trim().length >= 2 &&
        form.bio.trim().length >= 20
      );
    }
    if (currentStep === 'contact') {
      const email = form.contactEmail.trim();
      const emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      return form.phone.trim().length >= 8 && emailOk;
    }
    if (currentStep === 'documents') {
      return requirements.filter((r) => r.required).every((r) => Boolean(r.currentDocument));
    }
    if (currentStep === 'payout') {
      if (onboarding?.payout.complete && !payoutEditing) return true;
      return (
        form.beneficiaryName.trim().length >= 2 &&
        form.bankName.trim().length >= 2 &&
        form.iban.trim().length >= 8 &&
        form.iban.trim().length <= 40 &&
        !looksLikeMaskedPayoutValue(form.iban) &&
        !looksLikeMaskedPayoutValue(form.beneficiaryName) &&
        !looksLikeMaskedPayoutValue(form.bankName)
      );
    }
    if (currentStep === 'agreement') {
      return hasAcceptedCurrentPartnerAgreement(onboarding) || acceptedTerms;
    }
    return true;
  }, [currentStep, form, onboarding, requirements, payoutEditing, acceptedTerms]);

  function validateCurrentStep(): boolean {
    const errors: Record<string, string> = {};
    if (currentStep === 'entity') {
      if (!form.entityType) errors.entityType = t('info.errors.entityType');
      if (form.displayName.trim().length < 2) errors.displayName = t('info.errors.displayName');
      if (form.city.trim().length < 2) errors.city = t('info.errors.city');
      if (form.area.trim().length < 2) errors.area = t('info.errors.area');
      if (form.bio.trim().length < 20) errors.bio = t('info.errors.bio');
    } else if (currentStep === 'contact') {
      if (form.phone.trim().length < 8) errors.phone = t('contact.errors.phone');
      const email = form.contactEmail.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.contactEmail = t('contact.errors.contactEmail');
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function saveProfile(fields: Parameters<typeof patchPartnerOnboarding>[0]) {
    setSaveOk(false);
    const res = await patchPartnerOnboarding(fields);
    hydrate(res.data);
    await loadRequirements();
    setSaveOk(true);
    return res.data;
  }

  async function handleNext() {
    setError(null);
    if (!editable) {
      setStep((s) => Math.min(s + 1, PARTNER_ONBOARDING_STEPS.length - 1));
      return;
    }
    if ((currentStep === 'entity' || currentStep === 'contact') && !validateCurrentStep()) {
      return;
    }
    if (currentStep === 'documents') {
      const missing = missingRequiredPartnerDocuments(requirements);
      if (missing.length > 0) {
        setError(t('docs.missingRequired', { count: missing.length }));
        return;
      }
      setStep((s) => Math.min(s + 1, PARTNER_ONBOARDING_STEPS.length - 1));
      return;
    }
    if (currentStep === 'payout') {
      if (onboarding?.payout.complete && !payoutEditing) {
        setStep((s) => Math.min(s + 1, PARTNER_ONBOARDING_STEPS.length - 1));
        return;
      }
      const invalid = validatePartnerPayoutForm(form);
      if (invalid) {
        const mapped: Record<string, string> = {};
        if (invalid.beneficiaryName) mapped.beneficiaryName = t('transfer.errors.beneficiaryName');
        if (invalid.bankName) mapped.bankName = t('transfer.errors.bankName');
        if (invalid.iban === 'ibanMasked' || invalid.beneficiaryName === 'masked') {
          mapped.iban = t('transfer.errors.ibanMasked');
        } else if (invalid.iban) {
          mapped.iban = t('transfer.errors.iban');
        }
        setFieldErrors(mapped);
        setError(t('transfer.errors.incomplete'));
        return;
      }
      setSaving(true);
      try {
        await putPartnerPayoutProfile({
          beneficiaryName: form.beneficiaryName.trim(),
          bankName: form.bankName.trim(),
          iban: form.iban.trim(),
          optionalNotes: form.optionalNotes.trim() || undefined,
        });
        const res = await fetchPartnerOnboarding();
        hydrate(res.data);
        setForm((f) => ({
          ...f,
          beneficiaryName: '',
          bankName: '',
          iban: '',
          optionalNotes: '',
        }));
        setPayoutEditing(false);
        setFieldErrors({});
        setSaveOk(true);
        setStep((s) => Math.min(s + 1, PARTNER_ONBOARDING_STEPS.length - 1));
      } catch (err) {
        setError(err instanceof Error ? err.message : t('submitError'));
        setSaveOk(false);
      } finally {
        setSaving(false);
      }
      return;
    }
    if (currentStep === 'agreement') {
      if (hasAcceptedCurrentPartnerAgreement(onboarding)) {
        setStep((s) => Math.min(s + 1, PARTNER_ONBOARDING_STEPS.length - 1));
        return;
      }
      if (!acceptedTerms || !onboarding?.currentAgreement) {
        setError(t('agreementUx.mustAccept'));
        return;
      }
      setSaving(true);
      try {
        await acceptPartnerAgreement({
          agreementId: onboarding.currentAgreement.id,
          acceptedLocale: locale,
        });
        const res = await fetchPartnerOnboarding();
        hydrate(res.data);
        setAcceptedTerms(true);
        setSaveOk(true);
        setStep((s) => Math.min(s + 1, PARTNER_ONBOARDING_STEPS.length - 1));
      } catch (err) {
        setError(err instanceof Error ? err.message : t('submitError'));
        setSaveOk(false);
      } finally {
        setSaving(false);
      }
      return;
    }
    setSaving(true);
    try {
      if (currentStep === 'entity') {
        await saveProfile({
          entityType: form.entityType || undefined,
          displayName: form.displayName.trim(),
          businessName: form.businessName.trim() || null,
          city: form.city.trim(),
          area: form.area.trim(),
          bio: form.bio.trim(),
          approximateFarmCount: form.approximateFarmCount
            ? Number(form.approximateFarmCount)
            : null,
        });
      } else if (currentStep === 'contact') {
        const contactPayload: Parameters<typeof saveProfile>[0] = {
          phone: form.phone.trim(),
          legalName: (form.legalName || form.displayName).trim(),
          operatingPhone: (form.operatingPhone || form.phone).trim(),
          contactEmail: form.contactEmail.trim() || undefined,
        };
        // Only persist operating location when the applicant opted into a distinct management location.
        // Omitting these fields preserves backend fallback to Step 1 city/area.
        if (differentOperatingLocation) {
          const opCity = form.operatingCity.trim();
          const opArea = form.operatingArea.trim();
          if (opCity.length >= 2) contactPayload.operatingCity = opCity;
          if (opArea.length >= 2) contactPayload.operatingArea = opArea;
        }
        await saveProfile(contactPayload);
      } else {
        setSaveOk(false);
      }
      setFieldErrors({});
      setStep((s) => Math.min(s + 1, PARTNER_ONBOARDING_STEPS.length - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('submitError'));
      setSaveOk(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(requirementId: string, file: File) {
    setError(null);
    const clientCheck = validatePartnerDocumentFile(file);
    if (clientCheck === 'type') {
      setError(t('docs.errors.type'));
      return;
    }
    if (clientCheck === 'size') {
      setError(t('docs.errors.size'));
      return;
    }
    setSaveOk(false);
    setUploadingId(requirementId);
    try {
      await uploadPartnerDocument(file, requirementId);
      await loadRequirements();
      const res = await fetchPartnerOnboarding();
      hydrate(res.data);
      setSaveOk(true);
    } catch (err) {
      const msg =
        err instanceof PartnerApiError
          ? err.code === 'FILE_TOO_LARGE'
            ? t('docs.errors.size')
            : err.code === 'FILE_TYPE_REJECTED' || err.code === 'MIME_MISMATCH'
              ? t('docs.errors.type')
              : err.message
          : err instanceof Error
            ? err.message
            : t('submitError');
      setError(msg);
    } finally {
      setUploadingId(null);
    }
  }

  async function handleSavePayout() {
    setError(null);
    const invalid = validatePartnerPayoutForm(form);
    if (invalid) {
      const mapped: Record<string, string> = {};
      if (invalid.beneficiaryName) mapped.beneficiaryName = t('transfer.errors.beneficiaryName');
      if (invalid.bankName) mapped.bankName = t('transfer.errors.bankName');
      if (invalid.iban === 'ibanMasked' || invalid.beneficiaryName === 'masked') {
        mapped.iban = t('transfer.errors.ibanMasked');
      } else if (invalid.iban) {
        mapped.iban = t('transfer.errors.iban');
      }
      setFieldErrors(mapped);
      return;
    }
    setSaveOk(false);
    setSaving(true);
    try {
      const res = await putPartnerPayoutProfile({
        beneficiaryName: form.beneficiaryName.trim(),
        bankName: form.bankName.trim(),
        iban: form.iban.trim(),
        optionalNotes: form.optionalNotes.trim() || undefined,
      });
      hydrate(res.data);
      setForm((f) => ({
        ...f,
        beneficiaryName: '',
        bankName: '',
        iban: '',
        optionalNotes: '',
      }));
      setPayoutEditing(false);
      setFieldErrors({});
      setSaveOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('submitError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleAcceptAgreement() {
    if (!onboarding?.currentAgreement || !acceptedTerms) {
      setError(t('agreementUx.mustAccept'));
      return;
    }
    setError(null);
    setSaveOk(false);
    setSaving(true);
    try {
      await acceptPartnerAgreement({
        agreementId: onboarding.currentAgreement.id,
        acceptedLocale: locale,
      });
      const view = await fetchPartnerOnboarding();
      hydrate(view.data);
      setAcceptedTerms(hasAcceptedCurrentPartnerAgreement(view.data));
      setSaveOk(hasAcceptedCurrentPartnerAgreement(view.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('submitError'));
      setSaveOk(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    setSaveOk(false);
    setSaving(true);
    try {
      const res = await submitPartnerOnboarding();
      hydrate(res.data);
      setWizardOpen(false);
    } catch (err) {
      if (err instanceof PartnerApiError && err.code === 'ONBOARDING_INCOMPLETE') {
        setError(t('missingHint'));
      } else {
        setError(err instanceof Error ? err.message : t('submitError'));
      }
    } finally {
      setSaving(false);
    }
  }

  function selectStep(id: PartnerOnboardingStepId | string) {
    const resolved = resolvePartnerOnboardingStepId(id);
    if (!resolved) return;
    const idx = PARTNER_ONBOARDING_STEPS.indexOf(resolved);
    if (idx >= 0) setStep(idx);
  }

  // Legacy/bookmark `?step=requirements|documents|…` — apply once when wizard opens (no URL write).
  useEffect(() => {
    if (!wizardOpen) return;
    if (typeof window === 'undefined') return;
    const raw = new URLSearchParams(window.location.search).get('step');
    const resolved = resolvePartnerOnboardingStepId(raw);
    if (!resolved) return;
    const idx = PARTNER_ONBOARDING_STEPS.indexOf(resolved);
    if (idx >= 0) setStep(idx);
  }, [wizardOpen]);

  if (authLoading) {
    return (
      <div className="flex justify-center py-20" data-testid="become-owner-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const status = onboarding?.verificationStatus;
  const isApproved = status ? APPROVED_PARTNER_STATUSES.includes(status) : false;
  const isPending = status ? PENDING_PARTNER_STATUSES.includes(status) : false;
  const isTerminalLocked = status === 'rejected' || status === 'suspended';
  const meaningful = hasMeaningfulPartnerProgress(onboarding);
  const showStatusOnly = isPending || isTerminalLocked || isApproved;
  const showWizard =
    loggedIn &&
    role !== 'admin' &&
    wizardOpen &&
    !isPending &&
    !isTerminalLocked &&
    !isApproved;

  return (
    <MarketplacePageShell data-testid="become-owner-page" className="py-6 sm:py-10">
      {!loggedIn ? (
        <PartnerEntryLanding returnUrl={pathname} mode="guest" />
      ) : null}

      {loggedIn && role === 'admin' ? (
        <p className="rounded-2xl border border-[#E5EAF1] bg-white p-6 text-center text-muted">
          {t('adminNoApply')}
        </p>
      ) : null}

      {loggedIn && role !== 'admin' && showStatusOnly && onboarding ? (
        <PartnerStatusPanel
          onboarding={onboarding}
          onContinueCorrection={
            status === 'changes_requested'
              ? () => {
                  setWizardOpen(true);
                }
              : undefined
          }
        />
      ) : null}

      {loggedIn &&
      role !== 'admin' &&
      !showStatusOnly &&
      !wizardOpen ? (
        meaningful ? (
          <div
            className="mx-auto max-w-lg rounded-[24px] border border-[#E5EAF1] bg-white p-6 text-center shadow-[0_8px_24px_rgba(13,32,70,.05)] sm:p-8"
            data-testid="partner-applicant-intro"
          >
            <p className="text-sm font-semibold text-primary">{t('shell.eyebrow')}</p>
            <h1 className="mt-2 font-heading text-2xl text-[#0D2046]">{t('entry.continueCta')}</h1>
            <p className="mt-2 text-sm text-[#53637A]">{t('entry.continueHint')}</p>
            <Button
              type="button"
              className="mt-6 shadow-soft"
              data-testid="partner-continue-application"
              onClick={() => setWizardOpen(true)}
            >
              {t('entry.continueCta')}
            </Button>
          </div>
        ) : (
          <div data-testid="partner-applicant-intro">
            <PartnerEntryLanding
              returnUrl={pathname}
              mode="start"
              onStart={() => setWizardOpen(true)}
            />
          </div>
        )
      ) : null}

      {status === 'changes_requested' && onboarding && showWizard ? (
        <div className="mb-5">
          <PartnerStatusPanel
            onboarding={onboarding}
            onContinueCorrection={() => setWizardOpen(true)}
          />
        </div>
      ) : null}

      {showWizard ? (
        <PartnerOnboardingShell
          title={meaningful ? t('entry.continueCta') : t('entry.startCta')}
          subtitle={t('wizardHint')}
          current={currentStep}
          completion={completion}
          requirements={requirements}
          onSelectStep={selectStep}
          allowJump={editable}
          savedVisible={saveOk}
          banner={
            error ? (
              <p
                role="alert"
                className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger"
                data-testid="partner-onboarding-error"
              >
                {error}
              </p>
            ) : null
          }
          actions={
            <div
              className="sticky bottom-0 z-10 flex gap-2 border-t border-[#E5EAF1] bg-white/95 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:py-0"
              data-testid="partner-onboarding-actions"
            >
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-none"
                disabled={step === 0}
                data-testid="partner-wizard-back"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                {locale === 'ar' ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
                {t('back')}
              </Button>
              {currentStep !== 'review' ? (
                <Button
                  type="button"
                  className="flex-1 shadow-soft sm:flex-none"
                  disabled={saving || (editable && !stepValid)}
                  data-testid="partner-wizard-next"
                  onClick={() => void handleNext()}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('next')}
                  {locale === 'ar' ? (
                    <ChevronLeft className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              ) : null}
            </div>
          }
        >
          {!editable ? (
            <p className="mb-4 text-sm text-muted">{t('readOnlyHint')}</p>
          ) : null}
          <PartnerWizardSteps
              currentStep={currentStep}
              form={form}
              setForm={setForm}
              editable={editable}
              locale={locale}
              onboarding={onboarding}
              requirements={requirements}
              uploadingId={uploadingId}
              saving={saving}
              acceptedTerms={acceptedTerms}
              setAcceptedTerms={setAcceptedTerms}
              handleUpload={(id, file) => void handleUpload(id, file)}
              handleSavePayout={() => void handleSavePayout()}
              handleAcceptAgreement={() => void handleAcceptAgreement()}
              handleSubmit={() => void handleSubmit()}
              fieldErrors={fieldErrors}
              accountEmail={accountEmail}
              payoutEditing={payoutEditing}
              setPayoutEditing={setPayoutEditing}
              differentOperatingLocation={differentOperatingLocation}
              setDifferentOperatingLocation={setDifferentOperatingLocation}
              onGoToDocuments={() => selectStep('documents')}
              completion={completion}
              onEditStep={selectStep}
            />
        </PartnerOnboardingShell>
      ) : null}

      {/* Keep legacy testid available on page for approved redirect fallback */}
      {isApproved && onboarding ? (
        <div className="sr-only">
          <Link href="/owner/properties/new">{t('goToAddFarm')}</Link>
        </div>
      ) : null}
    </MarketplacePageShell>
  );
}
