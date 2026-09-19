'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Loader2, Shield } from 'lucide-react';
import { sanitizeReturnUrl } from '@mazare3/shared';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { useAuthSession } from '@/components/auth/auth-session';
import {
  LegalAcceptanceCheckboxes,
  type LegalAcceptanceState,
} from '@/components/legal/legal-acceptance-checkboxes';
import {
  accountPriorConsentRequired,
  customerFirstRunLegalRequired,
  privacyAckRequired,
  termsReacceptanceRequired,
  useMyLegalStatus,
} from '@/components/legal/legal-reacceptance';
import { acceptLegalDocument, grantPrivacyConsent, grantPriorConsent } from '@/lib/api-legal';

export function AccountLegalAcceptView() {
  const t = useTranslations('legal');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawReturn = searchParams.get('returnUrl');
  const { user, ready } = useAuthSession();
  const { status, loading, refresh } = useMyLegalStatus(Boolean(ready && user));
  const [legalState, setLegalState] = useState<LegalAcceptanceState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsAction = customerFirstRunLegalRequired(status);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(`/auth?returnUrl=${encodeURIComponent('/account/legal-accept')}`);
      return;
    }
    if (!loading && status && !needsAction) {
      const dest = sanitizeReturnUrl(rawReturn) ?? '/account';
      router.replace(dest);
    }
  }, [ready, user, loading, status, needsAction, rawReturn, router]);

  const handleAccept = useCallback(async () => {
    if (
      !legalState?.isValid ||
      !legalState.acceptedTermsVersionId ||
      !legalState.acknowledgedPrivacyVersionId
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (termsReacceptanceRequired(status) || !status) {
        await acceptLegalDocument({
          documentVersionId: legalState.acceptedTermsVersionId,
          context: 'login_reacceptance',
          sourceSurface: 'account.legal-accept',
        });
      }
      if (privacyAckRequired(status) || !status) {
        await acceptLegalDocument({
          documentVersionId: legalState.acknowledgedPrivacyVersionId,
          context: 'login_reacceptance',
          sourceSurface: 'account.legal-accept',
        });
      }
      if (accountPriorConsentRequired(status) && legalState.priorConsentAccount) {
        await grantPriorConsent({
          purposeKey: 'account_registration_and_authentication',
          language: locale === 'en' ? 'en' : 'ar',
          explicitConsent: true,
          sourceSurface: 'account.legal-accept.prior_consent',
          privacyNoticeVersionId: legalState.acknowledgedPrivacyVersionId,
        });
      }
      if (legalState.marketingEmail) {
        await grantPrivacyConsent({
          purposeCode: 'marketing_email',
          consentVersion: 'v1',
          noticeVersionId: legalState.acknowledgedPrivacyVersionId,
          sourceSurface: 'account.legal-accept',
        });
      }
      const next = await refresh();
      if (!customerFirstRunLegalRequired(next)) {
        const dest = sanitizeReturnUrl(rawReturn) ?? '/account';
        router.replace(dest);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('firstRun.acceptError'));
    } finally {
      setBusy(false);
    }
  }, [legalState, refresh, rawReturn, router, t, status, locale]);

  if (!ready || !user || (loading && !status)) {
    return (
      <div className="flex justify-center py-20" data-testid="legal-accept-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!needsAction) {
    return (
      <div className="flex justify-center py-20" data-testid="legal-accept-redirecting">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6" data-testid="legal-accept-page" lang={locale}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E8F8EF] text-[#16A34A]">
          <Shield className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-heading font-bold text-[#0D2046]">
            {t('firstRun.pageTitle')}
          </h1>
          <p className="mt-1 text-sm text-[#7A879B]">{t('firstRun.pageBody')}</p>
        </div>
      </div>

      <LegalAcceptanceCheckboxes
        testIdPrefix="legal-accept"
        showMarketing
        disabled={busy}
        onChange={setLegalState}
      />

      {error ? (
        <p
          className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        className="w-full"
        disabled={!legalState?.isValid || busy}
        data-testid="legal-accept-submit"
        onClick={() => void handleAccept()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {t('firstRun.acceptCta')}
      </Button>
    </div>
  );
}
