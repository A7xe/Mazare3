'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchPartnerOnboarding,
  fetchOwnerPayoutRequirements,
  putPartnerPayoutProfile,
  uploadPartnerDocument,
  PartnerApiError,
  type PartnerOnboardingView,
  type PartnerRequirementRow,
} from '@/lib/api-partner';
import { grantPriorConsent, fetchPriorConsentStatus } from '@/lib/api-legal';
import { PriorConsentCheckbox } from '@/components/legal/prior-consent-checkbox';
import {
  cleanPartnerRequirementText,
  deriveOwnerPayoutReadiness,
  looksLikeMaskedPayoutValue,
  partnerDocumentUiState,
  partnerPayoutUiState,
  validatePartnerDocumentFile,
  validatePartnerPayoutForm,
} from '@/components/become-owner/partner-onboarding/partner-onboarding-model';
import { cn } from '@/lib/utils';

export function OwnerPayoutSetupView() {
  const t = useTranslations('becomeOwner');
  const tOwner = useTranslations('owner');
  const locale = useLocale() as 'ar' | 'en';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [onboarding, setOnboarding] = useState<PartnerOnboardingView | null>(null);
  const [requirements, setRequirements] = useState<PartnerRequirementRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [payoutPriorConsent, setPayoutPriorConsent] = useState(false);
  const [needPayoutPriorConsent, setNeedPayoutPriorConsent] = useState(true);
  const [form, setForm] = useState({
    beneficiaryName: '',
    bankName: '',
    iban: '',
    optionalNotes: '',
    beneficiaryRelationship: 'operator_self' as
      | 'operator_self'
      | 'operator_legal_entity'
      | 'authorised_third_party'
      | 'other_review_required',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [view, reqs] = await Promise.all([
      fetchPartnerOnboarding(),
      fetchOwnerPayoutRequirements(),
    ]);
    setOnboarding(view.data);
    setRequirements(reqs.data);
    const ready = deriveOwnerPayoutReadiness(view.data.payout);
    setEditing(ready === 'not_configured' || ready === 'needs_attention');
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await load();
        try {
          const consent = await fetchPriorConsentStatus();
          const payout = consent.data.purposes.find(
            (p) => p.purposeKey === 'owner_payout_and_financial_processing',
          );
          setNeedPayoutPriorConsent(payout?.validity !== 'CONSENT_STILL_VALID');
        } catch {
          setNeedPayoutPriorConsent(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : tOwner('loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [load, tOwner]);

  const readiness = deriveOwnerPayoutReadiness(onboarding?.payout);
  const payoutUi = partnerPayoutUiState(onboarding?.payout);
  const proofReq = requirements.find((r) => r.documentType === 'payout_proof') ?? requirements[0];

  async function handleSave() {
    setError(null);
    setOk(false);
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
    if (needPayoutPriorConsent && !payoutPriorConsent) {
      setError(t('transfer.priorConsentRequired'));
      return;
    }
    setSaving(true);
    try {
      if (needPayoutPriorConsent) {
        await grantPriorConsent({
          purposeKey: 'owner_payout_and_financial_processing',
          language: locale,
          explicitConsent: true,
          sourceSurface: 'owner.payout-setup',
        });
        setNeedPayoutPriorConsent(false);
      }
      const res = await putPartnerPayoutProfile({
        beneficiaryName: form.beneficiaryName.trim(),
        bankName: form.bankName.trim(),
        iban: form.iban.trim(),
        optionalNotes: form.optionalNotes.trim() || undefined,
        beneficiaryRelationship: form.beneficiaryRelationship,
        payoutCountry: 'JO',
      });
      setOnboarding(res.data);
      setForm({
        beneficiaryName: '',
        bankName: '',
        iban: '',
        optionalNotes: '',
        beneficiaryRelationship: 'operator_self',
      });
      setFieldErrors({});
      setEditing(false);
      setOk(true);
      const reqs = await fetchOwnerPayoutRequirements();
      setRequirements(reqs.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('submitError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file: File) {
    if (!proofReq) return;
    setError(null);
    const check = validatePartnerDocumentFile(file);
    if (check === 'type') {
      setError(t('docs.errors.type'));
      return;
    }
    if (check === 'size') {
      setError(t('docs.errors.size'));
      return;
    }
    setUploading(true);
    try {
      await uploadPartnerDocument(file, proofReq.id);
      const [view, reqs] = await Promise.all([
        fetchPartnerOnboarding(),
        fetchOwnerPayoutRequirements(),
      ]);
      setOnboarding(view.data);
      setRequirements(reqs.data);
      setOk(true);
    } catch (e) {
      const msg =
        e instanceof PartnerApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : t('submitError');
      setError(msg);
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20" data-testid="owner-payout-setup-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-xl space-y-6"
      data-testid="owner-payout-setup"
      data-payout-readiness={readiness}
    >
      <div>
        <p className="text-sm font-medium text-primary">{tOwner('payoutSetup.eyebrow')}</p>
        <h1 className="mt-1 text-2xl font-bold text-navy">{tOwner('payoutSetup.title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{tOwner('payoutSetup.subtitle')}</p>
      </div>

      <div
        className={cn(
          'rounded-2xl border px-4 py-3 text-sm',
          readiness === 'ready' && 'border-green-200 bg-green-50 text-green-900',
          readiness === 'pending_review' && 'border-primary/20 bg-primary/5 text-navy',
          readiness === 'needs_attention' && 'border-amber-200 bg-amber-50 text-amber-950',
          readiness === 'not_configured' && 'border-[#E5EAF1] bg-[#F8FBFF] text-[#53637A]',
        )}
        data-testid="owner-payout-readiness"
      >
        {tOwner(`payoutSetup.readiness.${readiness}`)}
        {payoutUi !== 'missing' ? (
          <span className="mt-1 block text-[12px] opacity-80">
            {t(`transfer.status.${payoutUi}`)}
          </span>
        ) : null}
      </div>

      {onboarding?.payout.complete && !editing ? (
        <div
          className="space-y-3 rounded-2xl border border-[#E5EAF1] bg-white p-5"
          data-testid="owner-payout-saved-summary"
        >
          <p className="text-sm text-[#53637A]">
            {t('beneficiaryName')}: {onboarding.payout.beneficiaryNameMasked ?? '••••'}
          </p>
          <p className="text-sm text-[#53637A]">
            {t('bankName')}: {onboarding.payout.bankNameMasked ?? '••••'}
          </p>
          <p className="text-sm font-medium text-navy" data-testid="owner-payout-iban-masked">
            {t('iban')}: {onboarding.payout.ibanMasked}
          </p>
          {onboarding.payout.reviewStatus === 'rejected' && onboarding.payout.reviewReason ? (
            <p className="text-[13px] text-amber-800" role="alert">
              {onboarding.payout.reviewReason}
            </p>
          ) : null}
          {readiness !== 'ready' ? (
            <Button
              type="button"
              variant="outline"
              data-testid="owner-payout-update"
              onClick={() => setEditing(true)}
            >
              {t('transfer.update')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {editing || !onboarding?.payout.complete ? (
        <div className="space-y-4 rounded-2xl border border-[#E5EAF1] bg-white p-5" data-testid="owner-payout-form">
          {needPayoutPriorConsent ? (
            <div
              className="rounded-xl border border-[#C5D4E8] bg-[#F8FBFF] px-3 py-3"
              data-testid="owner-payout-prior-consent"
            >
              <PriorConsentCheckbox
                purposeKey="owner_payout_and_financial_processing"
                checked={payoutPriorConsent}
                testId="owner-payout-prior-consent"
                onChange={setPayoutPriorConsent}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <label htmlFor="owner-payout-beneficiary" className="text-sm font-semibold text-navy">
              {t('beneficiaryName')}
            </label>
            <Input
              id="owner-payout-beneficiary"
              data-testid="owner-payout-beneficiary"
              value={form.beneficiaryName}
              aria-invalid={Boolean(fieldErrors.beneficiaryName)}
              onChange={(e) => setForm((f) => ({ ...f, beneficiaryName: e.target.value }))}
            />
            {fieldErrors.beneficiaryName ? (
              <p className="text-[12px] text-danger">{fieldErrors.beneficiaryName}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label htmlFor="owner-payout-bank" className="text-sm font-semibold text-navy">
              {t('bankName')}
            </label>
            <Input
              id="owner-payout-bank"
              data-testid="owner-payout-bank"
              value={form.bankName}
              aria-invalid={Boolean(fieldErrors.bankName)}
              onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="owner-payout-relationship" className="text-sm font-semibold text-navy">
              {t('transfer.relationshipLabel')}
            </label>
            <select
              id="owner-payout-relationship"
              data-testid="owner-payout-relationship"
              className="h-11 w-full rounded-xl border border-[#D7DEE8] bg-white px-3 text-sm text-navy"
              value={form.beneficiaryRelationship}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  beneficiaryRelationship: e.target.value as typeof f.beneficiaryRelationship,
                }))
              }
            >
              <option value="operator_self">{t('transfer.relationship.operator_self')}</option>
              <option value="operator_legal_entity">
                {t('transfer.relationship.operator_legal_entity')}
              </option>
              <option value="authorised_third_party">
                {t('transfer.relationship.authorised_third_party')}
              </option>
              <option value="other_review_required">
                {t('transfer.relationship.other_review_required')}
              </option>
            </select>
            <p className="text-[12px] text-muted">{t('transfer.relationshipHint')}</p>
            {fieldErrors.beneficiaryRelationship ? (
              <p className="text-[12px] text-danger">{t('transfer.errors.relationship')}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label htmlFor="owner-payout-iban" className="text-sm font-semibold text-navy">
              {t('iban')}
            </label>
            <Input
              id="owner-payout-iban"
              data-testid="owner-payout-iban"
              autoComplete="off"
              value={form.iban}
              aria-invalid={Boolean(fieldErrors.iban)}
              onChange={(e) => {
                if (looksLikeMaskedPayoutValue(e.target.value)) return;
                setForm((f) => ({ ...f, iban: e.target.value }));
              }}
            />
            {fieldErrors.iban ? <p className="text-[12px] text-danger">{fieldErrors.iban}</p> : null}
          </div>
          <div className="space-y-2">
            <label htmlFor="owner-payout-notes" className="text-sm font-semibold text-navy">
              {t('payoutNotes')}{' '}
              <span className="font-normal text-muted">({t('optional')})</span>
            </label>
            <Input
              id="owner-payout-notes"
              data-testid="owner-payout-notes"
              value={form.optionalNotes}
              onChange={(e) => setForm((f) => ({ ...f, optionalNotes: e.target.value }))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={saving}
              data-testid="owner-payout-save"
              onClick={() => void handleSave()}
            >
              {saving ? tOwner('payoutSetup.saving') : tOwner('payoutSetup.save')}
            </Button>
            {onboarding?.payout.complete ? (
              <Button
                type="button"
                variant="outline"
                data-testid="owner-payout-cancel-edit"
                onClick={() => {
                  setEditing(false);
                  setFieldErrors({});
                }}
              >
                {t('transfer.cancelUpdate')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {proofReq ? (
        <div
          className="space-y-3 rounded-2xl border border-[#E5EAF1] bg-white p-5"
          data-testid="owner-payout-proof"
        >
          <h2 className="text-[15px] font-bold text-navy">
            {locale === 'ar' ? proofReq.labelAr : proofReq.labelEn}
          </h2>
          <p className="text-[13px] text-muted">
            {cleanPartnerRequirementText(
              locale === 'ar' ? proofReq.descriptionAr : proofReq.descriptionEn,
            )}
          </p>
          {proofReq.currentDocument ? (
            <p className="text-[13px] text-navy" data-testid="owner-payout-proof-status">
              {t(`reqs.state.${partnerDocumentUiState(proofReq.currentDocument)}`)}
            </p>
          ) : (
            <p className="text-[13px] text-amber-800">{tOwner('payoutSetup.proofRequired')}</p>
          )}
          <label className="inline-flex cursor-pointer">
            <span className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary">
              {uploading ? t('uploading') : tOwner('payoutSetup.uploadProof')}
            </span>
            <input
              type="file"
              className="sr-only"
              data-testid="owner-payout-proof-input"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void handleUpload(file);
              }}
            />
          </label>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="text-sm text-green-700" data-testid="owner-payout-save-ok">
          {t('shell.saved')}
        </p>
      ) : null}

      <p className="text-[12px] text-muted">
        <Link href="/owner/payouts" className="font-semibold text-primary underline-offset-2 hover:underline">
          {tOwner('payoutSetup.viewHistory')}
        </Link>
      </p>
    </div>
  );
}
