'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  fetchActiveLegalDocument,
  type PublicLegalDocument,
} from '@/lib/api-legal';
import { PriorConsentCheckbox } from '@/components/legal/prior-consent-checkbox';

export type LegalAcceptanceState = {
  ready: boolean;
  loading: boolean;
  error: string | null;
  termsAccepted: boolean;
  privacyAcknowledged: boolean;
  /** Phase 3C.4B.1.4 — Jordan Prior Consent for account processing (not Privacy ack). */
  priorConsentAccount: boolean;
  marketingEmail: boolean;
  acceptedTermsVersionId: string | null;
  acknowledgedPrivacyVersionId: string | null;
  termsMeta: Pick<PublicLegalDocument, 'id' | 'version' | 'effectiveAt'> | null;
  privacyMeta: Pick<PublicLegalDocument, 'id' | 'version' | 'effectiveAt'> | null;
  /** Required boxes checked and version IDs available (marketing never required). */
  isValid: boolean;
};

const EMPTY: LegalAcceptanceState = {
  ready: false,
  loading: true,
  error: null,
  termsAccepted: false,
  privacyAcknowledged: false,
  priorConsentAccount: false,
  marketingEmail: false,
  acceptedTermsVersionId: null,
  acknowledgedPrivacyVersionId: null,
  termsMeta: null,
  privacyMeta: null,
  isValid: false,
};

function buildState(
  partial: Omit<LegalAcceptanceState, 'isValid'>,
): LegalAcceptanceState {
  return {
    ...partial,
    isValid:
      partial.ready &&
      partial.termsAccepted &&
      partial.privacyAcknowledged &&
      partial.priorConsentAccount &&
      Boolean(partial.acceptedTermsVersionId) &&
      Boolean(partial.acknowledgedPrivacyVersionId),
  };
}

export function LegalAcceptanceCheckboxes({
  testIdPrefix,
  showMarketing = false,
  onChange,
  disabled = false,
}: {
  testIdPrefix: string;
  /** Optional marketing email consent — starts unchecked, never bundled with required boxes. */
  showMarketing?: boolean;
  onChange?: (state: LegalAcceptanceState) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('legal');
  const locale = useLocale();
  const lang = locale === 'en' ? 'en' : 'ar';
  const [state, setState] = useState<LegalAcceptanceState>(EMPTY);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    setState((prev) =>
      buildState({
        ...prev,
        loading: true,
        error: null,
        ready: false,
        acceptedTermsVersionId: null,
        acknowledgedPrivacyVersionId: null,
        termsMeta: null,
        privacyMeta: null,
      }),
    );

    void (async () => {
      try {
        const [terms, privacy] = await Promise.all([
          fetchActiveLegalDocument('terms_and_conditions', lang),
          fetchActiveLegalDocument('privacy_policy', lang),
        ]);
        if (cancelled) return;
        if (!terms?.id || !privacy?.id) {
          setState((prev) =>
            buildState({
              ...prev,
              loading: false,
              ready: false,
              error: t('acceptance.versionsUnavailable'),
              acceptedTermsVersionId: null,
              acknowledgedPrivacyVersionId: null,
              termsMeta: null,
              privacyMeta: null,
            }),
          );
          return;
        }
        setState((prev) =>
          buildState({
            ...prev,
            loading: false,
            ready: true,
            error: null,
            acceptedTermsVersionId: terms.id,
            acknowledgedPrivacyVersionId: privacy.id,
            termsMeta: {
              id: terms.id,
              version: terms.version,
              effectiveAt: terms.effectiveAt,
            },
            privacyMeta: {
              id: privacy.id,
              version: privacy.version,
              effectiveAt: privacy.effectiveAt,
            },
          }),
        );
      } catch {
        if (cancelled) return;
        setState((prev) =>
          buildState({
            ...prev,
            loading: false,
            ready: false,
            error: t('acceptance.versionsUnavailable'),
          }),
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lang, t]);

  useEffect(() => {
    onChangeRef.current?.(state);
  }, [state]);

  function patch(
    update: Partial<
      Pick<
        LegalAcceptanceState,
        'termsAccepted' | 'privacyAcknowledged' | 'priorConsentAccount' | 'marketingEmail'
      >
    >,
  ) {
    setState((prev) => buildState({ ...prev, ...update }));
  }

  return (
    <div
      className="space-y-3 rounded-[14px] border border-[#E0E8F3] bg-[#F8FBFF] px-3.5 py-3"
      data-testid={testIdPrefix}
    >
      {state.loading ? (
        <p className="text-xs text-[#8794A7]" data-testid={`${testIdPrefix}-loading`}>
          {t('acceptance.loading')}
        </p>
      ) : null}
      {state.error ? (
        <p
          className="text-xs text-danger"
          role="alert"
          data-testid={`${testIdPrefix}-error`}
        >
          {state.error}
        </p>
      ) : null}

      <label className="flex items-start gap-2.5 text-start text-xs leading-relaxed text-[#0D2046]">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#C5D4E8] text-primary focus:ring-primary"
          checked={state.termsAccepted}
          disabled={disabled || !state.ready}
          data-testid={`${testIdPrefix}-terms`}
          onChange={(e) => patch({ termsAccepted: e.target.checked })}
        />
        <span>
          {t('acceptance.agreeTermsPrefix')}{' '}
          <Link href="/terms" className="font-semibold text-primary hover:underline">
            {t('nav.terms')}
          </Link>
          {state.termsMeta?.version ? (
            <span className="text-[#8794A7]">
              {' '}
              ({t('acceptance.versionLabel', { version: state.termsMeta.version })})
            </span>
          ) : null}
          {t('acceptance.agreeTermsSuffix')}
        </span>
      </label>

      <label className="flex items-start gap-2.5 text-start text-xs leading-relaxed text-[#0D2046]">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#C5D4E8] text-primary focus:ring-primary"
          checked={state.privacyAcknowledged}
          disabled={disabled || !state.ready}
          data-testid={`${testIdPrefix}-privacy`}
          onChange={(e) => patch({ privacyAcknowledged: e.target.checked })}
        />
        <span>
          {t('acceptance.ackPrivacyPrefix')}{' '}
          <Link href="/privacy" className="font-semibold text-primary hover:underline">
            {t('nav.privacy')}
          </Link>
          {state.privacyMeta?.version ? (
            <span className="text-[#8794A7]">
              {' '}
              ({t('acceptance.versionLabel', { version: state.privacyMeta.version })})
            </span>
          ) : null}
          {t('acceptance.ackPrivacySuffix')}
        </span>
      </label>

      <PriorConsentCheckbox
        purposeKey="account_registration_and_authentication"
        checked={state.priorConsentAccount}
        disabled={disabled || !state.ready}
        testId={`${testIdPrefix}-prior-consent-account`}
        onChange={(v) => patch({ priorConsentAccount: v })}
      />

      {showMarketing ? (
        <label className="flex items-start gap-2.5 text-start text-xs leading-relaxed text-[#53637A]">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#C5D4E8] text-primary focus:ring-primary"
            checked={state.marketingEmail}
            disabled={disabled}
            data-testid={`${testIdPrefix}-marketing`}
            onChange={(e) => patch({ marketingEmail: e.target.checked })}
          />
          <span>{t('acceptance.marketingOptional')}</span>
        </label>
      ) : null}
    </div>
  );
}
