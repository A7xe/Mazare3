'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Loader2, Shield } from 'lucide-react';
import {
  DATA_SUBJECT_REQUEST_TYPES,
  type DataSubjectRequestTypeCode,
} from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  createDataSubjectRequest,
  fetchMyLegalStatus,
  listDataSubjectRequests,
  listPrivacyConsents,
  withdrawPrivacyConsent,
  acceptLegalDocument,
  fetchActiveLegalDocument,
  type DataSubjectRequestRow,
  type MeLegalStatus,
  type PrivacyConsentRow,
} from '@/lib/api-legal';
import { useLocale } from 'next-intl';

export function AccountPrivacyView() {
  const t = useTranslations('accountPrivacy');
  const tLegal = useTranslations('legal');
  const locale = useLocale();
  const lang = locale === 'en' ? 'en' : 'ar';

  const [consents, setConsents] = useState<PrivacyConsentRow[]>([]);
  const [requests, setRequests] = useState<DataSubjectRequestRow[]>([]);
  const [legalStatus, setLegalStatus] = useState<MeLegalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [dsrType, setDsrType] = useState<DataSubjectRequestTypeCode>('access');
  const [dsrDescription, setDsrDescription] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, r, s] = await Promise.all([
        listPrivacyConsents(),
        listDataSubjectRequests(),
        fetchMyLegalStatus(),
      ]);
      setConsents(c.data);
      setRequests(r.data);
      setLegalStatus(s.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleWithdrawMarketing() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await withdrawPrivacyConsent('marketing_email');
      setSuccess(t('withdrawSuccess'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('actionError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitDsr(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await createDataSubjectRequest({
        type: dsrType,
        description: dsrDescription.trim() || undefined,
      });
      setDsrDescription('');
      setSuccess(
        dsrType === 'erasure' ? t('erasureSubmitted') : t('dsrSubmitted'),
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('actionError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleReacceptTerms() {
    setBusy(true);
    setError(null);
    try {
      const terms = await fetchActiveLegalDocument('terms_and_conditions', lang);
      if (!terms?.id) throw new Error(tLegal('acceptance.versionsUnavailable'));
      await acceptLegalDocument({
        documentVersionId: terms.id,
        context: 'login_reacceptance',
        sourceSurface: 'account.privacy',
      });
      setSuccess(t('reacceptSuccess'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('actionError'));
    } finally {
      setBusy(false);
    }
  }

  const marketingGranted = consents.some(
    (c) => c.purposeCode === 'marketing_email' && c.status === 'granted',
  );
  const termsNeedsAction =
    legalStatus?.byType.terms_and_conditions.status === 'reacceptance_required' ||
    legalStatus?.byType.terms_and_conditions.status === 'missing';

  if (loading) {
    return (
      <div className="flex justify-center py-20" data-testid="account-privacy-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6" data-testid="account-privacy">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E8F8EF] text-[#16A34A]">
          <Shield className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-heading font-bold text-[#0D2046]">{t('title')}</h1>
          <p className="mt-1 text-sm text-[#7A879B]">{t('subtitle')}</p>
        </div>
        <Link
          href="/account"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#F06A4D] hover:bg-[#FFF1EC]"
          aria-label={t('back')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      {error ? (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}

      {termsNeedsAction ? (
        <section className="rounded-[18px] border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-bold text-amber-950">{t('reacceptTitle')}</h2>
          <p className="mt-1 text-xs text-amber-900/80">{t('reacceptBody')}</p>
          <Button
            type="button"
            size="sm"
            className="mt-3"
            disabled={busy}
            data-testid="account-privacy-reaccept"
            onClick={() => void handleReacceptTerms()}
          >
            {t('reacceptCta')}
          </Button>
        </section>
      ) : null}

      <section className="rounded-[18px] border border-[#E4EAF3] bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-[#0D2046]">{t('consentsTitle')}</h2>
        <p className="mt-1 text-xs text-[#7A879B]">{t('consentsSubtitle')}</p>
        <ul className="mt-3 space-y-2">
          {consents.length === 0 ? (
            <li className="text-sm text-[#7A879B]">{t('consentsEmpty')}</li>
          ) : (
            consents.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[#E7EEF8] px-3 py-2 text-sm"
                data-testid={`consent-row-${c.purposeCode}`}
              >
                <div>
                  <p className="font-medium text-[#0D2046]">
                    {t(`purposes.${c.purposeCode}` as 'purposes.marketing_email')}
                  </p>
                  <p className="text-xs text-[#8794A7]">
                    {c.status} · {c.consentVersion}
                  </p>
                </div>
                {c.purposeCode === 'marketing_email' && c.status === 'granted' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    data-testid="withdraw-marketing"
                    onClick={() => void handleWithdrawMarketing()}
                  >
                    {t('withdraw')}
                  </Button>
                ) : null}
              </li>
            ))
          )}
        </ul>
        {!marketingGranted ? (
          <p className="mt-2 text-xs text-[#8794A7]">{t('noMarketingConsent')}</p>
        ) : null}
      </section>

      <section className="rounded-[18px] border border-[#E4EAF3] bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-[#0D2046]">{t('dsrTitle')}</h2>
        <p className="mt-1 text-xs text-[#7A879B]">{t('dsrSubtitle')}</p>
        <p className="mt-2 rounded-xl bg-[#F5F8FC] px-3 py-2 text-xs text-[#53637A]" data-testid="dsr-fulfillment-note">
          {t('dsrFulfillmentNote')}
        </p>
        <form className="mt-3 space-y-3" onSubmit={(e) => void handleSubmitDsr(e)}>
          <div>
            <Label htmlFor="dsr-type">{t('dsrType')}</Label>
            <select
              id="dsr-type"
              className="mt-1 w-full rounded-xl border border-[#E0E8F3] bg-white px-3 py-2 text-sm"
              value={dsrType}
              data-testid="dsr-type"
              onChange={(e) => setDsrType(e.target.value as DataSubjectRequestTypeCode)}
            >
              {DATA_SUBJECT_REQUEST_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`dsrTypes.${type}` as 'dsrTypes.access')}
                </option>
              ))}
            </select>
          </div>
          {dsrType === 'erasure' ? (
            <p className="rounded-xl bg-[#FFF8F0] px-3 py-2 text-xs text-[#9A6B2F]">
              {t('erasureNote')}
            </p>
          ) : null}
          <div>
            <Label htmlFor="dsr-desc">{t('dsrDescription')}</Label>
            <textarea
              id="dsr-desc"
              className="mt-1 min-h-[88px] w-full rounded-xl border border-[#E0E8F3] bg-white px-3 py-2 text-sm"
              value={dsrDescription}
              data-testid="dsr-description"
              onChange={(e) => setDsrDescription(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy} data-testid="dsr-submit">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('dsrSubmit')}
          </Button>
        </form>

        {requests.length > 0 ? (
          <ul className="mt-4 space-y-2 border-t border-[#E7EEF8] pt-4" data-testid="dsr-history">
            <li className="text-xs font-semibold uppercase tracking-wide text-[#8794A7]">
              {t('dsrHistoryTitle')}
            </li>
            {requests.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-[#E4EAF3] bg-[#F8FAFD] px-3 py-2 text-sm text-[#53637A]"
                data-testid={`dsr-row-${r.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-[#0D2046]">
                    {t(`dsrTypes.${r.type}` as 'dsrTypes.access')}
                  </span>
                  <span
                    className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#2F6EF6]"
                    data-testid={`dsr-status-${r.id}`}
                  >
                    {r.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#8794A7]">
                  {t('dsrSubmittedAt')}:{' '}
                  {new Date(r.createdAt).toLocaleString(locale === 'ar' ? 'ar-JO' : 'en-GB')}
                  {r.resolvedAt
                    ? ` · ${t('dsrResolvedAt')}: ${new Date(r.resolvedAt).toLocaleString(
                        locale === 'ar' ? 'ar-JO' : 'en-GB',
                      )}`
                    : null}
                </p>
                {r.rejectionReason ? (
                  <p className="mt-1 text-xs text-[#B45309]">
                    {t('dsrRejectionReason')}: {r.rejectionReason}
                  </p>
                ) : null}
                {r.adminNote ? (
                  <p className="mt-1 text-xs text-[#53637A]">
                    {t('dsrAdminNote')}: {r.adminNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-xs text-[#8794A7]" data-testid="dsr-history-empty">
            {t('dsrHistoryEmpty')}
          </p>
        )}
      </section>

      <p className="text-center text-xs text-[#8794A7]">
        <Link href="/privacy" className="font-medium text-primary hover:underline">
          {tLegal('nav.privacy')}
        </Link>
        {' · '}
        <Link href="/terms" className="font-medium text-primary hover:underline">
          {tLegal('nav.terms')}
        </Link>
      </p>
    </div>
  );
}
