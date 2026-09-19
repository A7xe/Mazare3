'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { Building2, Loader2, User } from 'lucide-react';
import {
  type PartnerEntityType,
  type PartnerOnboardingView,
  type PartnerRequirementRow,
} from '@/lib/api-partner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PriorConsentCheckbox } from '@/components/legal/prior-consent-checkbox';
import { cn } from '@/lib/utils';
import {
  PARTNER_DOC_ACCEPT,
  PARTNER_DOC_MAX_MB_DEFAULT,
  cleanPartnerRequirementText,
  countRequiredPartnerDocuments,
  hasAcceptedCurrentPartnerAgreement,
  hasDistinctOperatingLocation,
  applicantSubmitMissingKeys,
  stepForApplicantMissingKey,
  partnerDocumentUiState,
  type PartnerDocUiState,
  type PartnerOnboardingStepId,
  type PartnerSectionCompletion,
} from './partner-onboarding-model';

function docStatusClass(state: PartnerDocUiState): string {
  switch (state) {
    case 'accepted':
      return "bg-green-100 text-green-700 ring-1 ring-green-200";
    case 'needs_attention':
      return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
    case 'uploaded':
    case 'under_review':
      return "bg-primary-soft text-primary ring-1 ring-primary/20";
    default:
      return "bg-background text-muted ring-1 ring-border";
  }
}

export type PartnerWizardFormState = {
  entityType: '' | PartnerEntityType;
  accountHolderRelation: '' | import('@/lib/api-partner').AccountHolderOperatorRelation;
  displayName: string;
  businessName: string;
  phone: string;
  city: string;
  area: string;
  bio: string;
  approximateFarmCount: string;
  legalName: string;
  operatingPhone: string;
  operatingCity: string;
  operatingArea: string;
  contactEmail: string;
};

export type PartnerWizardStepId = PartnerOnboardingStepId;

export function PartnerWizardSteps(props: {
  currentStep: PartnerWizardStepId;
  form: PartnerWizardFormState;
  setForm: Dispatch<SetStateAction<PartnerWizardFormState>>;
  editable: boolean;
  locale: 'ar' | 'en';
  onboarding: PartnerOnboardingView | null;
  requirements: PartnerRequirementRow[];
  uploadingId: string | null;
  saving: boolean;
  acceptedTerms: boolean;
  setAcceptedTerms: (v: boolean) => void;
  handleUpload: (requirementId: string, file: File) => void;
  handleAcceptAgreement: () => void;
  handleSubmit: () => void;
  fieldErrors?: Record<string, string>;
  accountEmail?: string | null;
  completion?: PartnerSectionCompletion;
  onEditStep?: (step: PartnerOnboardingStepId) => void;
  needKycPriorConsent?: boolean;
  kycPriorConsent?: boolean;
  setKycPriorConsent?: (v: boolean) => void;
}) {
  const {
    currentStep,
    form,
    setForm,
    editable,
    locale,
    onboarding,
    requirements,
    uploadingId,
    saving,
    acceptedTerms,
    setAcceptedTerms,
    handleUpload,
    handleAcceptAgreement,
    handleSubmit,
    fieldErrors = {},
    accountEmail = null,
    completion,
    onEditStep,
    needKycPriorConsent = false,
    kycPriorConsent = false,
    setKycPriorConsent,
  } = props;

  const t = useTranslations('becomeOwner');

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
    <div data-testid={`partner-wizard-step-${currentStep}`}>
      {currentStep === 'entity' && (
        <div
          className="space-y-5"
          data-testid="partner-step-entity-panel"
          aria-label={t('steps.entity')}
        >
          <div data-testid="partner-step-about-panel" className="space-y-5">
            <div data-testid="partner-about-you" className="space-y-5">
              <div>
                <h2 className="text-[17px] font-bold text-[#0D2046]">{t('steps.entity')}</h2>
                <p className="mt-1 text-[13px] text-[#53637A]">{t('about.stepHint')}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="partner-display-name" className="text-sm font-semibold text-[#0D2046]">
                    {t('info.displayName')}
                  </label>
                  <Input
                    id="partner-display-name"
                    required
                    disabled={!editable}
                    aria-invalid={Boolean(fieldErrors.displayName)}
                    data-testid="owner-apply-displayName"
                    placeholder={t('info.displayNamePlaceholder')}
                    value={form.displayName}
                    onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  />
                  <p className="text-[12px] text-[#8A96A8]">
                    {form.entityType === 'individual'
                      ? t('info.displayNameHintIndividual')
                      : form.entityType === 'business'
                        ? t('info.displayNameHintBusiness')
                        : t('info.displayNameHint')}
                  </p>
                  {fieldErrors.displayName ? (
                    <p className="text-xs text-danger" role="alert">
                      {fieldErrors.displayName}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <p className="text-[12px] text-[#8A96A8]" data-testid="partner-location-clarification">
                    {t('info.locationClarification')}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="partner-city" className="text-sm font-semibold text-[#0D2046]">
                        {form.entityType === 'individual'
                          ? t('info.cityIndividual')
                          : form.entityType === 'business'
                            ? t('info.cityBusiness')
                            : t('info.city')}
                      </label>
                      <Input
                        id="partner-city"
                        required
                        disabled={!editable}
                        aria-invalid={Boolean(fieldErrors.city)}
                        data-testid="owner-apply-city"
                        value={form.city}
                        onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      />
                      {fieldErrors.city ? (
                        <p className="text-xs text-danger" role="alert">
                          {fieldErrors.city}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="partner-area" className="text-sm font-semibold text-[#0D2046]">
                        {form.entityType === 'individual'
                          ? t('info.areaIndividual')
                          : form.entityType === 'business'
                            ? t('info.areaBusiness')
                            : t('info.area')}
                      </label>
                      <Input
                        id="partner-area"
                        required
                        disabled={!editable}
                        aria-invalid={Boolean(fieldErrors.area)}
                        data-testid="owner-apply-area"
                        value={form.area}
                        onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                      />
                      {fieldErrors.area ? (
                        <p className="text-xs text-danger" role="alert">
                          {fieldErrors.area}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-[12px] text-[#8A96A8]">
                    {form.entityType === 'individual'
                      ? t('info.locationHintIndividual')
                      : form.entityType === 'business'
                        ? t('info.locationHintBusiness')
                        : t('info.locationHint')}
                  </p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <p className="text-sm font-semibold text-[#0D2046]">
                    {t('farmCount')}{' '}
                    <span className="font-normal text-[#8A96A8]">({t('optional')})</span>
                  </p>
                  <input
                    type="hidden"
                    id="partner-farm-count"
                    data-testid="owner-apply-farmCount"
                    value={form.approximateFarmCount}
                    readOnly
                  />
                  <div
                    className="grid gap-3 sm:grid-cols-2"
                    role="group"
                    aria-label={t('farmCount')}
                  >
                    <button
                      type="button"
                      data-testid="partner-farm-count-one"
                      disabled={!editable}
                      aria-pressed={form.approximateFarmCount === '1'}
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          approximateFarmCount: f.approximateFarmCount === '1' ? '' : '1',
                        }));
                      }}
                      className={`min-h-[3.25rem] rounded-2xl border p-4 text-start transition-colors ${
                        form.approximateFarmCount === '1'
                          ? 'border-primary bg-[#EEF4FF] ring-1 ring-primary/30'
                          : 'border-[#E5EAF1] bg-white hover:border-primary/30'
                      }`}
                    >
                      <p className="font-semibold text-[#0D2046]">
                        {t('farmCountChoices.one')}
                      </p>
                    </button>
                    <button
                      type="button"
                      data-testid="partner-farm-count-more"
                      disabled={!editable}
                      aria-pressed={form.approximateFarmCount === '2'}
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          approximateFarmCount: f.approximateFarmCount === '2' ? '' : '2',
                        }));
                      }}
                      className={`min-h-[3.25rem] rounded-2xl border p-4 text-start transition-colors ${
                        form.approximateFarmCount === '2'
                          ? 'border-primary bg-[#EEF4FF] ring-1 ring-primary/30'
                          : 'border-[#E5EAF1] bg-white hover:border-primary/30'
                      }`}
                    >
                      <p className="font-semibold text-[#0D2046]">
                        {t('farmCountChoices.more')}
                      </p>
                    </button>
                  </div>
                  <p className="text-[12px] text-[#8A96A8]">{t('info.farmCountHint')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentStep === 'contact' && (
        <div className="space-y-5" data-testid="partner-step-contact-panel">
          <div>
            <h2 className="text-[17px] font-bold text-[#0D2046]">{t('steps.contact')}</h2>
            <p className="mt-1 text-[13px] text-[#53637A]">{t('details.stepHint')}</p>
          </div>

          <div data-testid="partner-partner-details" className="space-y-5">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#0D2046]">{t('entityType')}</h3>

              <fieldset className="space-y-3">
                <legend className="sr-only">{t('entityType')}</legend>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('entityType')}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={form.entityType === 'individual'}
                    data-testid="partner-entity-individual"
                    disabled={!editable}
                    onClick={() => {
                      setForm((f) => ({ ...f, entityType: 'individual' }));
                    }}
                    className={`rounded-2xl border p-4 text-start transition-colors ${
                      form.entityType === 'individual'
                        ? 'border-primary bg-[#EEF4FF] ring-1 ring-primary/30'
                        : 'border-[#E5EAF1] bg-white hover:border-primary/30'
                    }`}
                  >
                    <User className="mb-2 h-5 w-5 text-primary" aria-hidden />
                    <p className="font-semibold text-[#0D2046]">{t('entityIndividual')}</p>
                    <p className="mt-1 text-[12px] text-[#53637A]">{t('entityIndividualHint')}</p>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={form.entityType === 'business'}
                    data-testid="partner-entity-business"
                    disabled={!editable}
                    onClick={() => {
                      setForm((f) => ({ ...f, entityType: 'business' }));
                    }}
                    className={`rounded-2xl border p-4 text-start transition-colors ${
                      form.entityType === 'business'
                        ? 'border-primary bg-[#EEF4FF] ring-1 ring-primary/30'
                        : 'border-[#E5EAF1] bg-white hover:border-primary/30'
                    }`}
                  >
                    <Building2 className="mb-2 h-5 w-5 text-primary" aria-hidden />
                    <p className="font-semibold text-[#0D2046]">{t('entityBusiness')}</p>
                    <p className="mt-1 text-[12px] text-[#53637A]">{t('entityBusinessHint')}</p>
                  </button>
                </div>
                {fieldErrors.entityType ? (
                  <p className="text-xs text-danger" role="alert">
                    {fieldErrors.entityType}
                  </p>
                ) : null}
              </fieldset>

              {form.entityType ? (
                <label className="block space-y-2" data-testid="partner-account-holder-relation">
                  <span className="text-sm font-semibold text-[#0D2046]">
                    {t('accountHolderRelation')}
                  </span>
                  <select
                    className="w-full rounded-xl border border-[#E5EAF1] bg-white px-3 py-2 text-sm"
                    disabled={!editable}
                    value={form.accountHolderRelation}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        accountHolderRelation: e.target
                          .value as PartnerWizardFormState['accountHolderRelation'],
                      }))
                    }
                  >
                    <option value="">{t('accountHolderRelationSelect')}</option>
                    <option value="is_contracting_party">{t('relation.is_contracting_party')}</option>
                    <option value="acts_for_entity">{t('relation.acts_for_entity')}</option>
                    <option value="authorised_representative">
                      {t('relation.authorised_representative')}
                    </option>
                    <option value="authorised_manager">{t('relation.authorised_manager')}</option>
                  </select>
                  <span className="block text-[12px] text-[#53637A]">{t('accountHolderRelationHint')}</span>
                </label>
              ) : null}

              {form.entityType === 'business' ? (
                <div className="space-y-2" data-testid="partner-business-name-field">
                  <label htmlFor="partner-business-name" className="text-sm font-semibold text-[#0D2046]">
                    {t('info.businessName')}
                  </label>
                  <Input
                    id="partner-business-name"
                    disabled={!editable}
                    data-testid="owner-apply-businessName"
                    placeholder={t('info.businessNamePlaceholder')}
                    value={form.businessName}
                    onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                  />
                  <p className="text-[12px] text-[#8A96A8]">{t('info.businessNameHintBusiness')}</p>
                </div>
              ) : null}

              <div className="space-y-2">
                <label htmlFor="partner-bio" className="text-sm font-semibold text-[#0D2046]">
                  {t('info.bio')}
                </label>
                <textarea
                  id="partner-bio"
                  required
                  rows={4}
                  disabled={!editable}
                  aria-invalid={Boolean(fieldErrors.bio)}
                  data-testid="owner-apply-bio"
                  className="flex min-h-[7rem] w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm disabled:opacity-50"
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                />
                <p className="text-[12px] text-[#8A96A8]">{t('info.bioHint')}</p>
                {fieldErrors.bio ? (
                  <p className="text-xs text-danger" role="alert">
                    {fieldErrors.bio}
                  </p>
                ) : null}
              </div>
            </div>

            <div
              className="rounded-2xl border border-[#DCE6F5] bg-[#F8FBFF] px-4 py-3 text-[13px] text-[#53637A]"
              data-testid="partner-contact-privacy"
            >
              {t('contact.privacyNote')}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#0D2046]">{t('steps.contact')}</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="partner-legal-name" className="text-sm font-semibold text-[#0D2046]">
                    {t('contact.legalName')}{' '}
                    <span className="font-normal text-[#8A96A8]">({t('optional')})</span>
                  </label>
                  <Input
                    id="partner-legal-name"
                    disabled={!editable}
                    data-testid="owner-apply-legalName"
                    value={form.legalName}
                    onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
                  />
                  <p className="text-[12px] text-[#8A96A8]">{t('contact.legalNameHint')}</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="partner-phone" className="text-sm font-semibold text-[#0D2046]">
                    {t('contact.phone')}
                  </label>
                  <Input
                    id="partner-phone"
                    required
                    type="tel"
                    dir="ltr"
                    disabled={!editable}
                    aria-invalid={Boolean(fieldErrors.phone)}
                    data-testid="owner-apply-phone"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                  <p className="text-[12px] text-[#8A96A8]">{t('contact.phoneHint')}</p>
                  {fieldErrors.phone ? (
                    <p className="text-xs text-danger" role="alert">
                      {fieldErrors.phone}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label htmlFor="partner-operating-phone" className="text-sm font-semibold text-[#0D2046]">
                    {t('operatingPhone')}{' '}
                    <span className="font-normal text-[#8A96A8]">({t('optional')})</span>
                  </label>
                  <Input
                    id="partner-operating-phone"
                    type="tel"
                    dir="ltr"
                    disabled={!editable}
                    data-testid="owner-apply-operatingPhone"
                    value={form.operatingPhone}
                    onChange={(e) => setForm((f) => ({ ...f, operatingPhone: e.target.value }))}
                  />
                  <p className="text-[12px] text-[#8A96A8]">{t('contact.operatingPhoneHint')}</p>
                </div>

                {accountEmail ? (
                  <div className="space-y-2 sm:col-span-2">
                    <label htmlFor="partner-account-email" className="text-sm font-semibold text-[#0D2046]">
                      {t('contact.accountEmail')}
                    </label>
                    <Input
                      id="partner-account-email"
                      type="email"
                      dir="ltr"
                      readOnly
                      disabled
                      value={accountEmail}
                      data-testid="partner-account-email"
                      className="opacity-90"
                    />
                    <p className="text-[12px] text-[#8A96A8]">{t('contact.accountEmailHint')}</p>
                  </div>
                ) : null}

                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="partner-contact-email" className="text-sm font-semibold text-[#0D2046]">
                    {t('contact.contactEmail')}{' '}
                    <span className="font-normal text-[#8A96A8]">({t('optional')})</span>
                  </label>
                  <Input
                    id="partner-contact-email"
                    type="email"
                    dir="ltr"
                    disabled={!editable}
                    aria-invalid={Boolean(fieldErrors.contactEmail)}
                    data-testid="owner-apply-contactEmail"
                    value={form.contactEmail}
                    onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                  />
                  <p className="text-[12px] text-[#8A96A8]">{t('contact.contactEmailHint')}</p>
                  {fieldErrors.contactEmail ? (
                    <p className="text-xs text-danger" role="alert">
                      {fieldErrors.contactEmail}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <p className="text-[12px] text-[#8A96A8]" data-testid="partner-contact-next-hint">
            {t('contact.nextHint')}
          </p>
        </div>
      )}

      {currentStep === 'documents' && (
        <div className="space-y-5" data-testid="partner-step-documents-panel">
          <div>
            <h2 className="text-[17px] font-bold text-[#0D2046]">{t('docs.checklistTitle')}</h2>
            <p className="mt-1 text-[13px] text-[#53637A]">{t('docs.stepHint')}</p>
          </div>

          {(() => {
            const { requiredTotal, uploadedRequired } = countRequiredPartnerDocuments(requirements);
            return (
              <p className="text-[13px] font-medium text-[#0D2046]" data-testid="partner-docs-progress">
                {t('shell.docsProgress', { uploaded: uploadedRequired, total: requiredTotal })}
              </p>
            );
          })()}

          {onboarding?.entityType ? (
            <p className="text-[13px] text-[#53637A]" data-testid="partner-docs-entity-hint">
              {t('reqs.forEntity', {
                type:
                  onboarding.entityType === 'business'
                    ? t('entityBusiness')
                    : t('entityIndividual'),
              })}
            </p>
          ) : (
            <p className="rounded-xl bg-[#FEF3C7]/80 px-3 py-2 text-[13px] text-[#92400E]">
              {t('reqs.chooseEntityFirst')}
            </p>
          )}

          <div
            className="rounded-2xl border border-[#DCE6F5] bg-[#F8FBFF] px-4 py-3 text-[13px] text-[#53637A]"
            data-testid="partner-docs-privacy"
          >
            {t('docs.privacyNote')}
          </div>

          {needKycPriorConsent && setKycPriorConsent ? (
            <div
              className="rounded-2xl border border-[#C5D4E8] bg-white px-4 py-3"
              data-testid="partner-kyc-prior-consent"
            >
              <PriorConsentCheckbox
                purposeKey="owner_identity_and_authority_verification"
                checked={kycPriorConsent}
                disabled={!editable}
                testId="partner-kyc-prior-consent"
                onChange={setKycPriorConsent}
              />
            </div>
          ) : null}

          <p className="text-[12px] text-[#8A96A8]" data-testid="partner-docs-formats">
            {t('docs.formatsHint', { mb: PARTNER_DOC_MAX_MB_DEFAULT })}
          </p>

          <ul className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2" data-testid="partner-documents-list">
            {requirements.map((req) => {
              const ui = partnerDocumentUiState(req.currentDocument);
              const label = locale === 'ar' ? req.labelAr : req.labelEn;
              const description = cleanPartnerRequirementText(
                locale === 'ar' ? req.descriptionAr : req.descriptionEn,
              );
              const busy = uploadingId === req.id;
              const fileName = req.currentDocument?.originalFileName;
              const needsUpdate = ui === 'needs_attention';
              return (
                <li
                  key={req.id}
                  className={cn(
                    'flex flex-col rounded-2xl border bg-white p-4',
                    needsUpdate ? 'border-amber-300' : 'border-[#E5EAF1]',
                  )}
                  data-testid={`partner-doc-card-${req.id}`}
                  data-doc-type={req.documentType}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 text-[15px] font-semibold text-[#0D2046]">{label}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={req.required ? 'default' : 'muted'}>
                        {req.required ? t('required') : t('optional')}
                      </Badge>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          docStatusClass(ui),
                        )}
                        data-testid={`partner-doc-status-${req.id}`}
                      >
                        {t(`reqs.state.${ui}`)}
                      </span>
                    </div>
                  </div>

                  {needsUpdate ? (
                    <p
                      className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-950"
                      role="alert"
                      data-testid={`partner-doc-change-needed-${req.id}`}
                    >
                      {t('docs.changeNeeded')}
                      {req.currentDocument?.rejectionReason
                        ? ` — ${req.currentDocument.rejectionReason}`
                        : null}
                    </p>
                  ) : description ? (
                    <p className="mt-2 text-[13px] leading-relaxed text-[#53637A]">{description}</p>
                  ) : null}

                  {fileName ? (
                    <p
                      className="mt-3 truncate text-[12px] text-[#53637A]"
                      dir="auto"
                      title={fileName}
                      data-testid={`partner-doc-filename-${req.id}`}
                    >
                      {t('uploadedFile', { name: fileName })}
                    </p>
                  ) : null}

                  {!needsUpdate && req.currentDocument?.rejectionReason ? (
                    <p className="mt-2 text-[13px] text-[#B45309]" role="alert">
                      {req.currentDocument.rejectionReason}
                    </p>
                  ) : null}

                  {editable ? (
                    <label
                      className={cn(
                        'mt-4 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-primary/25 bg-[#EEF4FF] px-4 py-2.5 text-sm font-semibold text-primary sm:w-fit',
                        busy && 'pointer-events-none opacity-70',
                      )}
                    >
                      <input
                        type="file"
                        accept={PARTNER_DOC_ACCEPT}
                        className="sr-only"
                        data-testid={`partner-doc-upload-${req.id}`}
                        disabled={busy || (needKycPriorConsent && !kycPriorConsent)}
                        aria-label={
                          req.currentDocument ? t('replaceFile') : t('uploadFile')
                        }
                        onChange={(e) => {
                          if (needKycPriorConsent && !kycPriorConsent) return;
                          const file = e.target.files?.[0];
                          if (file) void handleUpload(req.id, file);
                          e.target.value = '';
                        }}
                      />
                      {busy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          {t('uploading')}
                        </>
                      ) : req.currentDocument ? (
                        t('replaceFile')
                      ) : (
                        t('uploadFile')
                      )}
                    </label>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <p className="text-[12px] text-[#8A96A8]">{t('docs.uploadNotApproval')}</p>
        </div>
      )}

      {currentStep === 'review' && onboarding && (
        <div className="mx-auto w-full max-w-2xl space-y-5" data-testid="partner-step-review-panel">
          <div>
            <h2 className="text-[17px] font-bold text-[#0D2046]">{t('steps.review')}</h2>
            <p className="mt-1 text-[13px] text-[#53637A]">{t('reviewUx.stepHint')}</p>
          </div>

          <div
            className="rounded-2xl border border-[#DCE6F5] bg-[#F8FBFF] px-4 py-3 text-[13px] text-[#53637A]"
            data-testid="partner-review-applicant-vs-admin"
          >
            {t('reviewUx.applicantVsAdmin')}
          </div>

          {(() => {
            const missing = applicantSubmitMissingKeys(onboarding);
            const ready = onboarding.readiness.canSubmit;
            const agreementDone = hasAcceptedCurrentPartnerAgreement(onboarding);
            return (
              <div
                className={cn(
                  'rounded-2xl border px-4 py-3',
                  ready ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50',
                )}
                data-testid="partner-review-checklist"
              >
                <p className="font-semibold text-[#0D2046]">
                  {ready ? t('reviewUx.readyTitle') : t('reviewUx.notReadyTitle')}
                </p>
                <p className="mt-1 text-[12px] text-[#53637A]">
                  {ready ? t('reviewUx.readyHint') : t('reviewUx.notReadyHint')}
                </p>
                <ul className="mt-3 space-y-2">
                  {(
                    [
                      ['entity', 'steps.entity', completion?.entity],
                      ['contact', 'steps.contact', completion?.contact],
                      ['documents', 'steps.documents', completion?.documents],
                    ] as const
                  ).map(([id, labelKey, done]) => (
                    <li key={id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                      <span className={done ? 'text-green-800' : 'text-amber-900'}>
                        {done ? t('reviewUx.checkDone') : t('reviewUx.checkMissing')} {t(labelKey)}
                      </span>
                      {!done && onEditStep && editable ? (
                        <button
                          type="button"
                          className="font-semibold text-primary underline-offset-2 hover:underline"
                          data-testid={`partner-review-edit-${id}`}
                          onClick={() => onEditStep(id)}
                        >
                          {t('reviewUx.complete')}
                        </button>
                      ) : null}
                    </li>
                  ))}
                  <li className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                    <span className={agreementDone ? 'text-green-800' : 'text-amber-900'}>
                      {agreementDone ? t('reviewUx.checkDone') : t('reviewUx.checkMissing')}{' '}
                      {t('steps.agreement')}
                    </span>
                  </li>
                </ul>
                {missing.length > 0 ? (
                  <ul className="mt-3 space-y-1 border-t border-amber-200/80 pt-3 text-[13px]">
                    {missing.map((key) => (
                      <li key={key} className="flex flex-wrap items-center justify-between gap-2">
                        <span>{t(`missing.${key}`)}</span>
                        {onEditStep && editable && completion && key !== 'agreement' ? (
                          <button
                            type="button"
                            className="font-semibold text-primary underline-offset-2 hover:underline"
                            onClick={() => onEditStep(stepForApplicantMissingKey(key, completion))}
                          >
                            {t('reviewUx.edit')}
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })()}

          {/* Section summaries */}
          <section className="space-y-3" data-testid="partner-review-summaries">
            <ReviewSection
              title={t('steps.entity')}
              testId="partner-review-section-entity"
              onEdit={editable && onEditStep ? () => onEditStep('entity') : undefined}
              editLabel={t('reviewUx.edit')}
            >
              <p>{onboarding.displayName || '—'}</p>
              <p>
                {onboarding.city}
                {onboarding.area ? ` · ${onboarding.area}` : ''}
              </p>
              {onboarding.approximateFarmCount != null ? (
                <p>
                  {t('farmCount')}: {onboarding.approximateFarmCount}
                </p>
              ) : null}
            </ReviewSection>

            <ReviewSection
              title={t('steps.contact')}
              testId="partner-review-section-contact"
              onEdit={editable && onEditStep ? () => onEditStep('contact') : undefined}
              editLabel={t('reviewUx.edit')}
            >
              <p>
                {onboarding.entityType
                  ? t(
                      onboarding.entityType === 'business'
                        ? 'entityBusiness'
                        : 'entityIndividual',
                    )
                  : '—'}
              </p>
              {onboarding.businessName ? <p>{onboarding.businessName}</p> : null}
              <p dir="ltr">{onboarding.phone}</p>
              {accountEmail ? <p dir="ltr">{accountEmail}</p> : null}
              {onboarding.contactEmail && onboarding.contactEmail !== accountEmail ? (
                <p dir="ltr">{onboarding.contactEmail}</p>
              ) : null}
              {onboarding.operatingPhone &&
              onboarding.operatingPhone !== onboarding.phone ? (
                <p dir="ltr">
                  {t('operatingPhone')}: {onboarding.operatingPhone}
                </p>
              ) : null}
              {hasDistinctOperatingLocation({
                city: onboarding.city,
                area: onboarding.area,
                operatingCity: onboarding.operatingCity,
                operatingArea: onboarding.operatingArea,
              }) ? (
                <p data-testid="partner-review-operating-location">
                  {t('operatingCity')}: {onboarding.operatingCity}
                  {onboarding.operatingArea ? ` · ${onboarding.operatingArea}` : ''}
                </p>
              ) : null}
            </ReviewSection>

            <ReviewSection
              title={t('steps.documents')}
              testId="partner-review-section-documents"
              onEdit={editable && onEditStep ? () => onEditStep('documents') : undefined}
              editLabel={t('reviewUx.edit')}
            >
              <ul className="space-y-1">
                {requirements.map((req) => {
                  const ui = partnerDocumentUiState(req.currentDocument);
                  return (
                    <li key={req.id} className="flex flex-wrap justify-between gap-2">
                      <span>{locale === 'ar' ? req.labelAr : req.labelEn}</span>
                      <span className="text-[#53637A]">{t(`reqs.state.${ui}`)}</span>
                    </li>
                  );
                })}
              </ul>
            </ReviewSection>
          </section>

          {/* Agreement acceptance — lives on Review (PF-3) */}
          <section
            className="space-y-4 rounded-2xl border border-[#E5EAF1] bg-white p-4"
            data-testid="partner-review-section-agreement"
          >
            <div>
              <h3 className="text-[15px] font-semibold text-[#0D2046]">{t('steps.agreement')}</h3>
              <p className="mt-1 text-[13px] text-[#53637A]">{t('agreementUx.stepHint')}</p>
            </div>

            {agreement ? (
              <>
                <div className="space-y-1">
                  <p className="text-[14px] font-medium text-[#0D2046]">{agreementTitle}</p>
                  <p className="text-[12px] text-[#8A96A8]">
                    {t('agreementVersion', { version: agreement.version })}
                    {agreement.effectiveAt
                      ? ` · ${new Date(agreement.effectiveAt).toLocaleDateString(
                          locale === 'ar' ? 'ar-JO' : 'en-GB',
                        )}`
                      : null}
                  </p>
                  {agreementSummary ? (
                    <p className="mt-2 text-[13px] leading-relaxed text-[#53637A]">{agreementSummary}</p>
                  ) : (
                    <p className="mt-2 text-[13px] text-[#53637A]">{t('agreementUx.readPrompt')}</p>
                  )}
                </div>

                <div
                  className="max-h-[min(16rem,40vh)] overflow-y-auto rounded-xl border border-[#E5EAF1] bg-[#FBFCFE] p-3 text-[13px] leading-relaxed whitespace-pre-wrap text-[#0D2046] sm:max-h-[min(22rem,50vh)]"
                  data-testid="partner-agreement-content"
                  tabIndex={0}
                >
                  {agreementContent}
                </div>

                {onboarding.commercialTerms ? (
                  <div
                    className="rounded-xl border border-[#E5EAF1] bg-[#FBFCFE] px-3 py-2 text-[13px] text-[#53637A]"
                    data-testid="partner-commercial-terms-note"
                  >
                    <p className="font-semibold text-[#0D2046]">{t('agreementUx.commercialTitle')}</p>
                    <p className="mt-1">
                      {t('agreementUx.commissionLabel', {
                        percent: onboarding.commercialTerms.commissionPercent,
                      })}
                    </p>
                    <p className="mt-1 text-[12px] text-[#8A96A8]">{t('agreementUx.commercialHint')}</p>
                  </div>
                ) : null}

                {hasAcceptedCurrentPartnerAgreement(onboarding) ? (
                  <div
                    className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-[13px] text-green-800"
                    data-testid="partner-agreement-accepted"
                  >
                    <p className="font-semibold">{t('agreementUx.acceptedTitle')}</p>
                    {onboarding.acceptedAgreement?.acceptedAt ? (
                      <p className="mt-1">
                        {t('agreementAcceptedOn', {
                          date: new Date(onboarding.acceptedAgreement.acceptedAt).toLocaleDateString(
                            locale === 'ar' ? 'ar-JO' : 'en-GB',
                          ),
                        })}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[12px]">{t('agreementUx.acceptedNotApproved')}</p>
                  </div>
                ) : (
                  <>
                    {onboarding.acceptedAgreement &&
                    onboarding.currentAgreement &&
                    onboarding.acceptedAgreement.agreementId !== onboarding.currentAgreement.id ? (
                      <p
                        className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900"
                        role="status"
                        data-testid="partner-agreement-version-refresh"
                      >
                        {t('agreementUx.versionChanged')}
                      </p>
                    ) : null}
                    <label className="flex items-start gap-3 text-[13px] text-[#53637A]">
                      <input
                        type="checkbox"
                        data-testid="owner-apply-terms"
                        checked={acceptedTerms}
                        disabled={!editable}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-border"
                      />
                      <span>{t('agreementUx.acceptLabel')}</span>
                    </label>
                    {editable ? (
                      <Button
                        type="button"
                        data-testid="partner-agreement-accept"
                        disabled={saving || !acceptedTerms}
                        onClick={() => void handleAcceptAgreement()}
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          t('agreementUx.confirmAccept')
                        )}
                      </Button>
                    ) : null}
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">{t('agreementUx.unavailable')}</p>
            )}
          </section>

          <div
            className="rounded-2xl border border-[#E5EAF1] bg-white px-4 py-3 text-[13px] text-[#53637A]"
            data-testid="partner-review-what-next"
          >
            <p className="font-semibold text-[#0D2046]">{t('reviewUx.whatNextTitle')}</p>
            <ol className="mt-2 list-decimal space-y-1 ps-5">
              <li>{t('reviewUx.whatNext1')}</li>
              <li>{t('reviewUx.whatNext2')}</li>
              <li>{t('reviewUx.whatNext3')}</li>
            </ol>
          </div>

          {editable ? (
            <Button
              type="button"
              className="w-full shadow-soft sm:w-auto"
              disabled={
                saving ||
                !(
                  onboarding.readiness.canSubmit ||
                  (acceptedTerms &&
                    Boolean(onboarding.currentAgreement) &&
                    applicantSubmitMissingKeys(onboarding).every((k) => k === 'agreement'))
                )
              }
              data-testid="partner-submit"
              onClick={() => void handleSubmit()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('reviewUx.submitCta')}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ReviewSection(props: {
  title: string;
  testId: string;
  children: ReactNode;
  onEdit?: () => void;
  editLabel: string;
}) {
  return (
    <div
      className="rounded-2xl border border-[#E5EAF1] bg-white p-4"
      data-testid={props.testId}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-[#0D2046]">{props.title}</h3>
        {props.onEdit ? (
          <button
            type="button"
            className="text-[13px] font-semibold text-primary underline-offset-2 hover:underline"
            onClick={props.onEdit}
          >
            {props.editLabel}
          </button>
        ) : null}
      </div>
      <div className="space-y-1 text-[13px] text-[#53637A]">{props.children}</div>
    </div>
  );
}
