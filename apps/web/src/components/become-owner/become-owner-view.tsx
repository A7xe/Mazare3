'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import {
  Shield,
  CalendarCheck,
  Ban,
  CalendarRange,
  Sparkles,
  HeadphonesIcon,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
} from 'lucide-react';
import { getMe, refreshSession } from '@/lib/api-auth';
import {
  acceptPartnerAgreement,
  fetchPartnerAgreement,
  fetchPartnerOnboarding,
  fetchPartnerRequirements,
  patchPartnerOnboarding,
  putPartnerPayoutProfile,
  submitPartnerOnboarding,
  uploadPartnerDocument,
  PartnerApiError,
  type PartnerEntityType,
  type PartnerOnboardingView,
  type PartnerRequirementRow,
  type PartnerVerificationStatus,
} from '@/lib/api-partner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';

const benefits = [
  { icon: Shield, key: 'secureBooking' },
  { icon: Ban, key: 'reduceFake' },
  { icon: CalendarRange, key: 'availability' },
  { icon: Sparkles, key: 'visibility' },
  { icon: HeadphonesIcon, key: 'support' },
  { icon: CalendarCheck, key: 'noPublicPhone' },
] as const;

const STEPS = [
  'entity',
  'contact',
  'requirements',
  'documents',
  'payout',
  'agreement',
  'review',
] as const;

const PLACEHOLDER_NAME = 'شريك جديد';
const PLACEHOLDER_PHONE = '00000000';

const EDITABLE_STATUSES: PartnerVerificationStatus[] = ['draft', 'changes_requested'];
const APPROVED_STATUSES: PartnerVerificationStatus[] = ['approved', 'legacy_approved'];
const PENDING_STATUSES: PartnerVerificationStatus[] = ['submitted', 'under_review'];

function emptyIfPlaceholder(value: string | null | undefined, placeholder: string) {
  if (!value || value === placeholder) return '';
  return value;
}

function verificationBadgeVariant(status: PartnerVerificationStatus) {
  if (status === 'approved' || status === 'legacy_approved') return 'highlight' as const;
  if (status === 'rejected' || status === 'suspended') return 'muted' as const;
  return 'default' as const;
}

export function BecomeOwnerView() {
  const t = useTranslations('becomeOwner');
  const locale = useLocale() as 'ar' | 'en';
  const pathname = usePathname();
  const [authLoading, setAuthLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<PartnerOnboardingView | null>(null);
  const [requirements, setRequirements] = useState<PartnerRequirementRow[]>([]);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [form, setForm] = useState({
    entityType: '' as '' | PartnerEntityType,
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
  });

  const editable = onboarding
    ? EDITABLE_STATUSES.includes(onboarding.verificationStatus)
    : true;
  const currentStep = STEPS[step] ?? 'entity';

  const hydrate = useCallback((view: PartnerOnboardingView) => {
    setOnboarding(view);
    setForm((prev) => ({
      ...prev,
      entityType: view.entityType ?? prev.entityType,
      displayName: emptyIfPlaceholder(view.displayName, PLACEHOLDER_NAME) || prev.displayName,
      businessName: view.businessName ?? prev.businessName,
      phone: emptyIfPlaceholder(view.phone, PLACEHOLDER_PHONE) || prev.phone,
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
    if (view.acceptedAgreement) setAcceptedTerms(true);
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
        if (res.data.user.role === 'admin') return;
        const onboardRes = await fetchPartnerOnboarding();
        hydrate(onboardRes.data);
        if (
          onboardRes.data.verificationStatus === 'approved' ||
          onboardRes.data.verificationStatus === 'legacy_approved'
        ) {
          const refreshed = await refreshSession();
          setRole(refreshed.data.user.role);
        }
        if (PENDING_STATUSES.includes(onboardRes.data.verificationStatus)) {
          setStep(STEPS.length - 1);
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
  }, [hydrate]);

  const stepValid = useMemo(() => {
    if (currentStep === 'entity') {
      return (
        Boolean(form.entityType) &&
        form.displayName.trim().length >= 2 &&
        form.phone.trim().length >= 8 &&
        form.city.trim().length >= 2 &&
        form.area.trim().length >= 2 &&
        form.bio.trim().length >= 20
      );
    }
    if (currentStep === 'contact') {
      return (
        (form.legalName || form.displayName).trim().length >= 2 &&
        (form.operatingPhone || form.phone).trim().length >= 8 &&
        (form.operatingCity || form.city).trim().length >= 2 &&
        (form.operatingArea || form.area).trim().length >= 2
      );
    }
    if (currentStep === 'requirements') return true;
    if (currentStep === 'documents') {
      return requirements.filter((r) => r.required).every((r) => Boolean(r.currentDocument));
    }
    if (currentStep === 'payout') return Boolean(onboarding?.payout.complete);
    if (currentStep === 'agreement') return Boolean(onboarding?.acceptedAgreement);
    return true;
  }, [currentStep, form, onboarding, requirements]);

  async function saveProfile(fields: Parameters<typeof patchPartnerOnboarding>[0]) {
    const res = await patchPartnerOnboarding(fields);
    hydrate(res.data);
    await loadRequirements();
    return res.data;
  }

  async function handleNext() {
    setError(null);
    if (!editable) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      return;
    }
    setSaving(true);
    try {
      if (currentStep === 'entity') {
        await saveProfile({
          entityType: form.entityType || undefined,
          displayName: form.displayName.trim(),
          businessName: form.businessName.trim() || null,
          phone: form.phone.trim(),
          city: form.city.trim(),
          area: form.area.trim(),
          bio: form.bio.trim(),
          approximateFarmCount: form.approximateFarmCount
            ? Number(form.approximateFarmCount)
            : null,
        });
      } else if (currentStep === 'contact') {
        await saveProfile({
          legalName: (form.legalName || form.displayName).trim(),
          operatingPhone: (form.operatingPhone || form.phone).trim(),
          operatingCity: (form.operatingCity || form.city).trim(),
          operatingArea: (form.operatingArea || form.area).trim(),
          contactEmail: form.contactEmail.trim() || undefined,
        });
      }
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('submitError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(requirementId: string, file: File) {
    setError(null);
    setUploadingId(requirementId);
    try {
      await uploadPartnerDocument(file, requirementId);
      await loadRequirements();
      const res = await fetchPartnerOnboarding();
      hydrate(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('submitError'));
    } finally {
      setUploadingId(null);
    }
  }

  async function handleSavePayout() {
    setError(null);
    setSaving(true);
    try {
      const res = await putPartnerPayoutProfile({
        beneficiaryName: form.beneficiaryName.trim(),
        bankName: form.bankName.trim(),
        iban: form.iban.trim(),
        optionalNotes: form.optionalNotes.trim() || undefined,
      });
      hydrate(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('submitError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleAcceptAgreement() {
    if (!onboarding?.currentAgreement) return;
    setError(null);
    setSaving(true);
    try {
      await acceptPartnerAgreement({
        agreementId: onboarding.currentAgreement.id,
        acceptedLocale: locale,
      });
      const [view, agreement] = await Promise.all([fetchPartnerOnboarding(), fetchPartnerAgreement()]);
      hydrate(view.data);
      if (agreement.data.accepted) setAcceptedTerms(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('submitError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    setSaving(true);
    try {
      const res = await submitPartnerOnboarding();
      hydrate(res.data);
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

  if (authLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const status = onboarding?.verificationStatus;
  const isApproved = status ? APPROVED_STATUSES.includes(status) : false;
  const isPending = status ? PENDING_STATUSES.includes(status) : false;
  const agreement = onboarding?.currentAgreement;
  const agreementTitle = agreement
    ? locale === 'ar'
      ? agreement.titleAr
      : agreement.titleEn
    : '';
  const agreementSummary = agreement
    ? locale === 'ar'
      ? agreement.summaryAr
      : agreement.summaryEn
    : '';
  const agreementContent = agreement
    ? locale === 'ar'
      ? agreement.contentAr
      : agreement.contentEn
    : '';

  return (
    <div data-testid="become-owner-page" className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 text-center sm:mb-10">
        <h1 className="text-3xl font-bold text-navy sm:text-4xl">{t('title')}</h1>
        <p className="mt-3 text-lg text-muted">{t('subtitle')}</p>
      </div>

      <div className="mb-8 grid gap-3 sm:mb-10 sm:grid-cols-2 sm:gap-4">
        {benefits.map(({ icon: Icon, key }) => (
          <Card key={key} className="glass-panel rounded-2xl border-primary/12">
            <CardContent className="flex gap-3 p-4 sm:p-5">
              <Icon className="h-6 w-6 shrink-0 text-primary" />
              <p className="text-sm text-navy">{t(`benefits.${key}`)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {onboarding && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge
            data-testid="partner-status-chip"
            variant={verificationBadgeVariant(onboarding.verificationStatus)}
          >
            {t(`verification.${onboarding.verificationStatus}`)}
          </Badge>
          {onboarding.legacyApproved ? (
            <p className="text-sm text-muted">{t('legacyNotice')}</p>
          ) : null}
        </div>
      )}

      {onboarding?.changeRequestReason ? (
        <p
          data-testid="partner-change-reason"
          className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-navy"
        >
          <span className="font-medium">{t('changesRequestedTitle')}: </span>
          {onboarding.changeRequestReason}
        </p>
      ) : null}

      {onboarding?.rejectionReason && status === 'rejected' ? (
        <p className="mb-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">
          {t('rejectedNotice')}
          {`: ${onboarding.rejectionReason}`}
        </p>
      ) : null}

      {isApproved ? (
        <Card
          data-testid="owner-application-status"
          className="glass-panel mb-8 rounded-2xl border-primary/12"
        >
          <CardContent className="flex flex-col items-center py-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <h2 className="mt-4 text-xl font-bold text-navy">{t('approvedTitle')}</h2>
            <p className="mt-2 max-w-md text-muted">{t('approvedDesc')}</p>
            <Button asChild className="mt-6 shadow-soft">
              <Link href="/owner">{t('goToDashboard')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isPending ? (
        <Card
          data-testid="owner-application-status"
          className="glass-panel mb-8 rounded-2xl border-primary/12"
        >
          <CardContent className="flex flex-col items-center py-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <h2 className="mt-4 text-xl font-bold text-navy">{t('submittedTitle')}</h2>
            <p className="mt-2 max-w-md text-muted">{t('submittedDesc')}</p>
            <p className="mt-4 text-sm text-muted">
              {t('statusLabel')}: {status ? t(`verification.${status}`) : ''}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {isApproved ? null : (
        <Card className="glass-panel overflow-hidden rounded-3xl border-primary/12">
          <div className="gradient-primary h-1" />
          <CardHeader className="pb-3">
            <CardTitle className="text-xl text-navy">{t('formTitle')}</CardTitle>
            {loggedIn && role !== 'admin' ? (
              <p className="text-sm text-muted">{t('wizardHint')}</p>
            ) : null}
          </CardHeader>
          <CardContent>
            {!loggedIn ? (
              <div className="space-y-4 text-center">
                <p className="text-muted">{t('loginRequired')}</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button asChild className="shadow-soft">
                    <Link href={`/login?returnUrl=${encodeURIComponent(pathname)}`}>
                      {t('login')}
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`/signup?returnUrl=${encodeURIComponent(pathname)}`}>
                      {t('signup')}
                    </Link>
                  </Button>
                </div>
              </div>
            ) : role === 'admin' ? (
              <p className="text-muted">{t('adminNoApply')}</p>
            ) : (
              <div className="space-y-6">
                <div data-testid="partner-onboarding-progress" className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-muted">
                    <span>{t('stepOf', { current: step + 1, total: STEPS.length })}</span>
                    <span className="font-medium text-navy">{t(`steps.${currentStep}`)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-primary-soft">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                    />
                  </div>
                  <div className="hidden gap-1 sm:flex">
                    {STEPS.map((key, i) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setStep(i)}
                        className={`min-w-0 flex-1 rounded-lg px-1 py-1 text-[11px] ${
                          i === step
                            ? 'bg-primary text-primary-foreground'
                            : i < step
                              ? 'bg-primary-soft text-primary'
                              : 'bg-background text-muted'
                        }`}
                      >
                        {t(`steps.${key}`)}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {error}
                  </p>
                )}

                {!editable && !isPending && !isApproved ? (
                  <p className="text-sm text-muted">{t('readOnlyHint')}</p>
                ) : null}

                <div data-testid={`partner-wizard-step-${currentStep}`}>
                {currentStep === 'entity' && (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-navy">{t('entityType')}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        data-testid="partner-entity-individual"
                        disabled={!editable}
                        onClick={() => {
                          setForm((f) => ({ ...f, entityType: 'individual' }));
                          if (editable) {
                            void saveProfile({ entityType: 'individual' }).catch((err: unknown) => {
                              setError(err instanceof Error ? err.message : t('submitError'));
                            });
                          }
                        }}
                        className={`rounded-2xl border p-4 text-start transition-colors ${
                          form.entityType === 'individual'
                            ? 'border-primary bg-primary-soft'
                            : 'border-border bg-surface hover:border-primary/30'
                        }`}
                      >
                        <User className="mb-2 h-5 w-5 text-primary" />
                        <p className="font-medium text-navy">{t('entityIndividual')}</p>
                        <p className="mt-1 text-xs text-muted">{t('entityIndividualHint')}</p>
                      </button>
                      <button
                        type="button"
                        data-testid="partner-entity-business"
                        disabled={!editable}
                        onClick={() => {
                          setForm((f) => ({ ...f, entityType: 'business' }));
                          if (editable) {
                            void saveProfile({ entityType: 'business' }).catch((err: unknown) => {
                              setError(err instanceof Error ? err.message : t('submitError'));
                            });
                          }
                        }}
                        className={`rounded-2xl border p-4 text-start transition-colors ${
                          form.entityType === 'business'
                            ? 'border-primary bg-primary-soft'
                            : 'border-border bg-surface hover:border-primary/30'
                        }`}
                      >
                        <Building2 className="mb-2 h-5 w-5 text-primary" />
                        <p className="font-medium text-navy">{t('entityBusiness')}</p>
                        <p className="mt-1 text-xs text-muted">{t('entityBusinessHint')}</p>
                      </button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-navy">{t('displayName')}</label>
                        <Input
                          required
                          disabled={!editable}
                          data-testid="owner-apply-displayName"
                          value={form.displayName}
                          onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-navy">{t('businessName')}</label>
                        <Input
                          disabled={!editable}
                          value={form.businessName}
                          onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-navy">{t('phone')}</label>
                        <Input
                          required
                          type="tel"
                          dir="ltr"
                          disabled={!editable}
                          data-testid="owner-apply-phone"
                          value={form.phone}
                          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        />
                        <p className="text-xs text-muted">{t('phoneHint')}</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-navy">{t('farmCount')}</label>
                        <Input
                          type="number"
                          min={0}
                          disabled={!editable}
                          value={form.approximateFarmCount}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, approximateFarmCount: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-navy">{t('city')}</label>
                        <Input
                          required
                          disabled={!editable}
                          data-testid="owner-apply-city"
                          value={form.city}
                          onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-navy">{t('area')}</label>
                        <Input
                          required
                          disabled={!editable}
                          data-testid="owner-apply-area"
                          value={form.area}
                          onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-navy">{t('bio')}</label>
                      <textarea
                        required
                        rows={4}
                        disabled={!editable}
                        data-testid="owner-apply-bio"
                        className="flex w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm disabled:opacity-50"
                        value={form.bio}
                        onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                {currentStep === 'contact' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-navy">{t('legalName')}</label>
                      <Input
                        disabled={!editable}
                        value={form.legalName}
                        onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-navy">{t('contactEmail')}</label>
                      <Input
                        type="email"
                        dir="ltr"
                        disabled={!editable}
                        value={form.contactEmail}
                        onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-navy">{t('operatingPhone')}</label>
                      <Input
                        type="tel"
                        dir="ltr"
                        disabled={!editable}
                        value={form.operatingPhone}
                        onChange={(e) => setForm((f) => ({ ...f, operatingPhone: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-navy">{t('operatingCity')}</label>
                      <Input
                        disabled={!editable}
                        value={form.operatingCity}
                        onChange={(e) => setForm((f) => ({ ...f, operatingCity: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-sm font-medium text-navy">{t('operatingArea')}</label>
                      <Input
                        disabled={!editable}
                        value={form.operatingArea}
                        onChange={(e) => setForm((f) => ({ ...f, operatingArea: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                {currentStep === 'requirements' && (
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-medium text-navy">{t('requirementsTitle')}</h3>
                      <p className="mt-1 text-sm text-muted">{t('requirementsHint')}</p>
                    </div>
                    {requirements.map((req) => (
                      <div
                        key={req.id}
                        className="rounded-2xl border border-primary/12 bg-background px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-navy">
                            {locale === 'ar' ? req.labelAr : req.labelEn}
                          </p>
                          <Badge variant={req.required ? 'default' : 'muted'}>
                            {req.required ? t('required') : t('optional')}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          {locale === 'ar' ? req.descriptionAr : req.descriptionEn}
                        </p>
                        <p className="mt-2 text-xs text-muted">
                          {req.currentDocument ? t('hasFile') : t('needsFile')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {currentStep === 'documents' && (
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-medium text-navy">{t('documentsTitle')}</h3>
                      <p className="mt-1 text-sm text-muted">{t('documentsHint')}</p>
                    </div>
                    {requirements.map((req) => (
                      <div
                        key={req.id}
                        className="rounded-2xl border border-primary/12 bg-background px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-navy">
                            {locale === 'ar' ? req.labelAr : req.labelEn}
                          </p>
                          <Badge variant={req.required ? 'default' : 'muted'}>
                            {req.required ? t('required') : t('optional')}
                          </Badge>
                        </div>
                        {req.currentDocument ? (
                          <p className="mt-2 text-sm text-muted">
                            {t('uploadedFile', { name: req.currentDocument.originalFileName })}
                            {' · '}
                            {t(`docStatus.${req.currentDocument.reviewStatus}`)}
                          </p>
                        ) : null}
                        {req.currentDocument?.rejectionReason ? (
                          <p className="mt-1 text-sm text-danger">{req.currentDocument.rejectionReason}</p>
                        ) : null}
                        {editable ? (
                          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-primary">
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,application/pdf"
                              className="sr-only"
                              data-testid={`partner-doc-upload-${req.id}`}
                              disabled={uploadingId === req.id}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void handleUpload(req.id, file);
                                e.target.value = '';
                              }}
                            />
                            {uploadingId === req.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('uploading')}
                              </>
                            ) : req.currentDocument ? (
                              t('replaceFile')
                            ) : (
                              t('uploadFile')
                            )}
                          </label>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {currentStep === 'payout' && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted">{t('payoutHint')}</p>
                    {onboarding?.payout.ibanMasked ? (
                      <p
                        data-testid="partner-iban-masked"
                        className="rounded-xl bg-primary-soft px-4 py-3 text-sm text-navy"
                      >
                        {t('ibanSaved')}: {onboarding.payout.ibanMasked}
                      </p>
                    ) : null}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-navy">{t('beneficiaryName')}</label>
                        <Input
                          disabled={!editable}
                          data-testid="partner-payout-beneficiary"
                          value={form.beneficiaryName}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, beneficiaryName: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-navy">{t('bankName')}</label>
                        <Input
                          disabled={!editable}
                          data-testid="partner-payout-bank"
                          value={form.bankName}
                          onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <label className="text-sm font-medium text-navy">{t('iban')}</label>
                        <Input
                          dir="ltr"
                          disabled={!editable}
                          data-testid="partner-payout-iban"
                          value={form.iban}
                          onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <label className="text-sm font-medium text-navy">{t('payoutNotes')}</label>
                        <Input
                          disabled={!editable}
                          value={form.optionalNotes}
                          onChange={(e) => setForm((f) => ({ ...f, optionalNotes: e.target.value }))}
                        />
                      </div>
                    </div>
                    {editable ? (
                      <Button
                        type="button"
                        data-testid="partner-payout-save"
                        disabled={saving || form.iban.trim().length < 8}
                        onClick={() => void handleSavePayout()}
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('savePayout')}
                      </Button>
                    ) : null}
                  </div>
                )}

                {currentStep === 'agreement' && (
                  <div className="space-y-4">
                    {agreement ? (
                      <>
                        <div>
                          <h3 className="font-medium text-navy">{agreementTitle}</h3>
                          <p className="text-xs text-muted">
                            {t('agreementVersion', { version: agreement.version })}
                          </p>
                          <p className="mt-2 text-sm text-muted">{agreementSummary}</p>
                        </div>
                        <div className="max-h-64 overflow-y-auto rounded-2xl border border-border bg-background p-4 text-sm whitespace-pre-wrap text-navy">
                          {agreementContent}
                        </div>
                        {onboarding?.acceptedAgreement ? (
                          <p className="text-sm text-primary">
                            {t('agreementAcceptedOn', {
                              date: new Date(onboarding.acceptedAgreement.acceptedAt).toLocaleDateString(
                                locale === 'ar' ? 'ar-JO' : 'en-GB',
                              ),
                            })}
                          </p>
                        ) : null}
                        <label className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            data-testid="owner-apply-terms"
                            checked={acceptedTerms || Boolean(onboarding?.acceptedAgreement)}
                            disabled={!editable || Boolean(onboarding?.acceptedAgreement)}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            className="mt-1"
                          />
                          <span className="text-muted">{t('terms')}</span>
                        </label>
                        {editable && !onboarding?.acceptedAgreement ? (
                          <Button
                            type="button"
                            data-testid="partner-agreement-accept"
                            disabled={saving || !acceptedTerms}
                            onClick={() => void handleAcceptAgreement()}
                          >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('acceptAgreement')}
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-muted">{t('readOnlyHint')}</p>
                    )}
                  </div>
                )}

                {currentStep === 'review' && onboarding && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium text-navy">{t('reviewTitle')}</h3>
                      <p className="mt-1 text-sm text-muted">{t('reviewHint')}</p>
                    </div>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted">{t('reviewEntity')}</dt>
                        <dd className="font-medium text-navy">
                          {onboarding.entityType
                            ? t(
                                onboarding.entityType === 'business'
                                  ? 'entityBusiness'
                                  : 'entityIndividual',
                              )
                            : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">{t('displayName')}</dt>
                        <dd className="font-medium text-navy">{onboarding.displayName}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">{t('phone')}</dt>
                        <dd className="font-medium text-navy" dir="ltr">
                          {onboarding.phone}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">{t('city')}</dt>
                        <dd className="font-medium text-navy">
                          {onboarding.area} — {onboarding.city}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">{t('reviewPayout')}</dt>
                        <dd className="font-medium text-navy">
                          {onboarding.payout.ibanMasked ?? '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">{t('reviewAgreement')}</dt>
                        <dd className="font-medium text-navy">
                          {onboarding.acceptedAgreement
                            ? t('agreementVersion', { version: onboarding.acceptedAgreement.version })
                            : '—'}
                        </dd>
                      </div>
                    </dl>
                    <div>
                      <p className="text-sm text-muted">{t('reviewDocs')}</p>
                      <ul className="mt-1 space-y-1 text-sm text-navy">
                        {requirements.map((req) => (
                          <li key={req.id}>
                            {locale === 'ar' ? req.labelAr : req.labelEn}
                            {': '}
                            {req.currentDocument
                              ? t(`docStatus.${req.currentDocument.reviewStatus}`)
                              : t('needsFile')}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {!onboarding.readiness.canSubmit && onboarding.readiness.missingRequirements.length > 0 ? (
                      <div className="rounded-xl bg-primary-soft px-4 py-3 text-sm text-navy">
                        <p>{t('missingHint')}</p>
                        <ul className="mt-1 list-inside list-disc">
                          {onboarding.readiness.missingRequirements
                            .filter((key) =>
                              [
                                'profile',
                                'required_documents',
                                'payout_profile',
                                'agreement',
                                'unresolved_changes',
                              ].includes(key),
                            )
                            .map((key) => (
                              <li key={key}>{t(`missing.${key}`)}</li>
                            ))}
                        </ul>
                      </div>
                    ) : null}
                    {editable ? (
                      <Button
                        type="button"
                        className="w-full shadow-soft sm:w-auto"
                        disabled={saving || !onboarding.readiness.canSubmit}
                        data-testid="partner-submit"
                        onClick={() => void handleSubmit()}
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('submit')}
                      </Button>
                    ) : null}
                  </div>
                )}
                </div>

                <div className="sticky bottom-0 flex gap-2 border-t border-border/60 bg-surface/95 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:py-0">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 sm:flex-none"
                    disabled={step === 0}
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                  >
                    {locale === 'ar' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    {t('back')}
                  </Button>
                  {currentStep !== 'review' ? (
                    <Button
                      type="button"
                      className="flex-1 shadow-soft sm:flex-none"
                      disabled={saving || (editable && !stepValid && currentStep !== 'payout' && currentStep !== 'agreement')}
                      data-testid="partner-wizard-next"
                      onClick={() => void handleNext()}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('next')}
                      {locale === 'ar' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
