'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import {
  acceptLegalDocument,
  fetchActiveLegalDocument,
  fetchMyLegalStatus,
  type MeLegalStatus,
} from '@/lib/api-legal';
import { useAuthSession } from '@/components/auth/auth-session';
import { sanitizeReturnUrl } from '@mazare3/shared';

export function termsReacceptanceRequired(status: MeLegalStatus | null): boolean {
  if (!status) return false;
  const terms = status.byType.terms_and_conditions;
  return terms.status === 'reacceptance_required' || terms.status === 'missing';
}

export function privacyAckRequired(status: MeLegalStatus | null): boolean {
  if (!status) return false;
  const privacy = status.byType.privacy_policy;
  return privacy.status === 'reacceptance_required' || privacy.status === 'missing';
}

/** True when Jordan Prior Consent for account processing is missing / needs re-consent. */
export function accountPriorConsentRequired(status: MeLegalStatus | null): boolean {
  if (!status) return false;
  const account = status.priorConsent?.purposes?.find(
    (p) => p.purposeKey === 'account_registration_and_authentication',
  );
  if (!account) return true;
  return account.validity !== 'CONSENT_STILL_VALID';
}

/** True when contractual actions (checkout/book) should be gated. */
export function contractualActionsBlocked(status: MeLegalStatus | null): boolean {
  if (!status) return false;
  return (
    termsReacceptanceRequired(status) ||
    privacyAckRequired(status) ||
    accountPriorConsentRequired(status)
  );
}

/** True when first-run / reacceptance gate should block until Terms + Privacy + account Prior Consent. */
export function customerFirstRunLegalRequired(status: MeLegalStatus | null): boolean {
  return (
    termsReacceptanceRequired(status) ||
    privacyAckRequired(status) ||
    accountPriorConsentRequired(status)
  );
}

export function legalAcceptHref(returnUrl?: string | null): string {
  const safe = sanitizeReturnUrl(returnUrl);
  if (!safe || safe === '/account/legal-accept' || safe.startsWith('/account/legal-accept')) {
    return '/account/legal-accept';
  }
  return `/account/legal-accept?returnUrl=${encodeURIComponent(safe)}`;
}

export function useMyLegalStatus(enabled = true) {
  const { user } = useAuthSession();
  const [status, setStatus] = useState<MeLegalStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !user) {
      setStatus(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMyLegalStatus();
      setStatus(res.data);
      return res.data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load legal status');
      setStatus(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, loading, error, refresh };
}

/**
 * Non-blocking browse banner when reacceptance is required.
 * Does not lock the app — parents should gate checkout/book separately.
 */
export function LegalReacceptanceBanner({
  status,
  onAcceptClick,
}: {
  status: MeLegalStatus | null;
  onAcceptClick?: () => void;
}) {
  const t = useTranslations('legal');
  const [dismissed, setDismissed] = useState(false);

  if (!status?.customer.requiresAction || dismissed) return null;

  return (
    <div
      className="flex items-start gap-3 border-b border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      data-testid="legal-reacceptance-banner"
      role="status"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t('reacceptance.bannerTitle')}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-amber-900/80">
          {t('reacceptance.bannerBody')}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            data-testid="legal-reacceptance-open"
            onClick={onAcceptClick}
          >
            {t('reacceptance.reviewCta')}
          </Button>
          <Link
            href="/account/privacy"
            className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-semibold text-amber-900 underline-offset-2 hover:underline"
          >
            {t('reacceptance.privacyLink')}
          </Link>
        </div>
      </div>
      <button
        type="button"
        className="rounded-lg p-1 text-amber-700/70 hover:bg-amber-100 hover:text-amber-950"
        aria-label={t('reacceptance.dismiss')}
        onClick={() => setDismissed(true)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Modal to re-accept Terms (and acknowledge Privacy if needed) before contractual actions.
 */
export function LegalReacceptanceModal({
  open,
  status,
  onClose,
  onAccepted,
}: {
  open: boolean;
  status: MeLegalStatus | null;
  onClose: () => void;
  onAccepted: () => void;
}) {
  const t = useTranslations('legal');
  const locale = useLocale();
  const lang = locale === 'en' ? 'en' : 'ar';
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needTerms = termsReacceptanceRequired(status);
  const needPrivacy = privacyAckRequired(status);

  useEffect(() => {
    if (open) {
      setTermsChecked(false);
      setPrivacyChecked(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleAccept() {
    if (needTerms && !termsChecked) return;
    if (needPrivacy && !privacyChecked) return;
    setBusy(true);
    setError(null);
    try {
      if (needTerms) {
        const terms = await fetchActiveLegalDocument('terms_and_conditions', lang);
        if (!terms?.id) throw new Error(t('acceptance.versionsUnavailable'));
        await acceptLegalDocument({
          documentVersionId: terms.id,
          context: 'login_reacceptance',
          sourceSurface: 'legal.reacceptance-modal',
        });
      }
      if (needPrivacy) {
        const privacy = await fetchActiveLegalDocument('privacy_policy', lang);
        if (!privacy?.id) throw new Error(t('acceptance.versionsUnavailable'));
        await acceptLegalDocument({
          documentVersionId: privacy.id,
          context: 'login_reacceptance',
          sourceSurface: 'legal.reacceptance-modal',
        });
      }
      onAccepted();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('reacceptance.acceptError'));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    (!needTerms || termsChecked) && (!needPrivacy || privacyChecked) && !busy;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      data-testid="legal-reacceptance-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-reacceptance-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#E0E8F3] bg-white p-5 shadow-xl">
        <h2
          id="legal-reacceptance-title"
          className="text-lg font-heading font-bold text-[#0D2046]"
        >
          {t('reacceptance.modalTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#53637A]">
          {t('reacceptance.modalBody')}
        </p>

        <div className="mt-4 space-y-3">
          {needTerms ? (
            <label className="flex items-start gap-2.5 text-xs leading-relaxed text-[#0D2046]">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#C5D4E8] text-primary"
                checked={termsChecked}
                data-testid="legal-reaccept-terms"
                onChange={(e) => setTermsChecked(e.target.checked)}
              />
              <span>
                {t('acceptance.agreeTermsPrefix')}{' '}
                <Link href="/terms" className="font-semibold text-primary hover:underline">
                  {t('nav.terms')}
                </Link>
                {t('acceptance.agreeTermsSuffix')}
              </span>
            </label>
          ) : null}
          {needPrivacy ? (
            <label className="flex items-start gap-2.5 text-xs leading-relaxed text-[#0D2046]">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#C5D4E8] text-primary"
                checked={privacyChecked}
                data-testid="legal-reaccept-privacy"
                onChange={(e) => setPrivacyChecked(e.target.checked)}
              />
              <span>
                {t('acceptance.ackPrivacyPrefix')}{' '}
                <Link href="/privacy" className="font-semibold text-primary hover:underline">
                  {t('nav.privacy')}
                </Link>
                {t('acceptance.ackPrivacySuffix')}
              </span>
            </label>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            className="flex-1"
            disabled={!canSubmit}
            data-testid="legal-reaccept-submit"
            onClick={() => void handleAccept()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('reacceptance.acceptCta')}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {t('reacceptance.later')}
          </Button>
        </div>
      </div>
    </div>
  );
}
