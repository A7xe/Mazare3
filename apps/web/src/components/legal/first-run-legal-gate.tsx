'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Shield } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { useAuthSession } from '@/components/auth/auth-session';
import {
  LegalAcceptanceCheckboxes,
  type LegalAcceptanceState,
} from '@/components/legal/legal-acceptance-checkboxes';
import {
  customerFirstRunLegalRequired,
  legalAcceptHref,
  privacyAckRequired,
  accountPriorConsentRequired,
  termsReacceptanceRequired,
  useMyLegalStatus,
} from '@/components/legal/legal-reacceptance';
import {
  acceptLegalDocument,
  grantPrivacyConsent,
  grantPriorConsent,
} from '@/lib/api-legal';

/**
 * On authenticated session: if Terms/Privacy/account Prior Consent is missing, show a
 * non-dismissible modal (or redirect to /account/legal-accept) before
 * book / checkout / owner-apply surfaces proceed.
 * Google OAuth must not bypass this gate. Does not invent acceptances.
 */
export function FirstRunLegalGate({
  mode = 'modal',
  enforceOnPaths,
}: {
  mode?: 'modal' | 'redirect';
  /** When set, only gate these path prefixes (e.g. checkout, book, become-owner). */
  enforceOnPaths?: string[];
}) {
  const t = useTranslations('legal');
  const locale = useLocale();
  const lang = locale === 'en' ? 'en' : 'ar';
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready } = useAuthSession();
  const { status, loading, refresh } = useMyLegalStatus(Boolean(ready && user));
  const [legalState, setLegalState] = useState<LegalAcceptanceState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onGatedPath =
    !enforceOnPaths?.length ||
    enforceOnPaths.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.includes(p),
    );

  const required = Boolean(user && customerFirstRunLegalRequired(status));
  const shouldBlock = required && onGatedPath && !pathname.includes('/account/legal-accept');

  useEffect(() => {
    if (!shouldBlock || mode !== 'redirect' || loading) return;
    router.replace(legalAcceptHref(pathname));
  }, [shouldBlock, mode, loading, pathname, router]);

  async function handleAccept() {
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
      if (termsReacceptanceRequired(status)) {
        await acceptLegalDocument({
          documentVersionId: legalState.acceptedTermsVersionId,
          context: 'login_reacceptance',
          sourceSurface: 'legal.first-run-gate',
        });
      }
      if (privacyAckRequired(status)) {
        await acceptLegalDocument({
          documentVersionId: legalState.acknowledgedPrivacyVersionId,
          context: 'login_reacceptance',
          sourceSurface: 'legal.first-run-gate',
        });
      }
      if (accountPriorConsentRequired(status) && legalState.priorConsentAccount) {
        await grantPriorConsent({
          purposeKey: 'account_registration_and_authentication',
          language: lang,
          explicitConsent: true,
          sourceSurface: 'legal.first-run-gate.prior_consent',
          privacyNoticeVersionId: legalState.acknowledgedPrivacyVersionId,
        });
      }
      if (legalState.marketingEmail) {
        await grantPrivacyConsent({
          purposeCode: 'marketing_email',
          consentVersion: 'v1',
          noticeVersionId: legalState.acknowledgedPrivacyVersionId,
          sourceSurface: 'legal.first-run-gate',
        });
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('firstRun.acceptError'));
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !user || !shouldBlock || mode === 'redirect') {
    return null;
  }

  if (loading && !status) {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
        data-testid="first-run-legal-loading"
        role="status"
      >
        <Loader2 className="h-8 w-8 animate-spin text-white" aria-hidden />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      data-testid="first-run-legal-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-run-legal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#E0E8F3] bg-white p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F8EF] text-[#16A34A]">
            <Shield className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="first-run-legal-title"
              className="text-lg font-heading font-bold text-[#0D2046]"
            >
              {t('firstRun.title')}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[#53637A]">{t('firstRun.body')}</p>
            <p className="mt-2 text-xs leading-relaxed text-[#8794A7]" data-testid="google-oauth-pre-consent-note">
              {t('firstRun.oauthPreConsentNote')}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <LegalAcceptanceCheckboxes
            testIdPrefix="first-run-legal"
            showMarketing
            disabled={busy}
            onChange={setLegalState}
          />
        </div>

        {error ? (
          <p className="mt-3 text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          <Button
            type="button"
            className="w-full"
            disabled={!legalState?.isValid || busy}
            data-testid="first-run-legal-submit"
            onClick={() => void handleAccept()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('firstRun.acceptCta')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            data-testid="first-run-legal-open-page"
            onClick={() => router.push(legalAcceptHref(pathname))}
          >
            {t('firstRun.openFullPage')}
          </Button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[#8794A7]" lang={lang}>
          {t('firstRun.cannotDismiss')}
        </p>
      </div>
    </div>
  );
}
