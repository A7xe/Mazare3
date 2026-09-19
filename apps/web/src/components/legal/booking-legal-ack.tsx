'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  fetchCustomerBookingLegalSet,
  type AcceptedDocumentVersionIds,
  type CustomerBookingLegalSet,
} from '@/lib/api-legal';
import {
  BALANCE_DUE_HOURS_BEFORE_START,
  CANCELLATION_CHARGE_30_UNTIL_HOURS,
  CANCELLATION_CHARGE_50_UNTIL_HOURS,
  CANCELLATION_CHARGE_PERCENT_TIER_100,
  CANCELLATION_CHARGE_PERCENT_TIER_30,
  CANCELLATION_CHARGE_PERCENT_TIER_50,
  CANCELLATION_FREE_UNTIL_HOURS,
  DEPOSIT_PERCENT,
} from '@mazare3/shared';

/** Concise financial/legal summary — pass server-truth values from parent. */
export type BookingLegalSummaryProps = {
  depositPercent?: number | null;
  freeCancelUntilHours?: number | null;
  balanceDueHoursBeforeStart?: number | null;
  amountDueNow?: number | null;
  remainingBalance?: number | null;
  balanceDueAtIso?: string | null;
  currency?: string | null;
  showCancelTiers?: boolean;
  showDepositDisclosure?: boolean;
  showFullPaymentDisclosure?: boolean;
  showOwnerApprovalDisclosure?: boolean;
  ownerApprovalMinutes?: number | null;
  currencyNote?: string | null;
};

export type BookingLegalAckState = {
  ready: boolean;
  loading: boolean;
  error: string | null;
  acknowledged: boolean;
  versionIds: AcceptedDocumentVersionIds;
  corpusReady: boolean;
  acceptancePresentationKey: string | null;
  isValid: boolean;
};

const EMPTY_IDS: AcceptedDocumentVersionIds = {};

function buildState(
  partial: Omit<BookingLegalAckState, 'isValid'>,
): BookingLegalAckState {
  const ids = partial.versionIds;
  const versionsOk = partial.corpusReady
    ? Boolean(ids.terms) && Boolean(ids.cancellation) && Boolean(ids.bookingTerms)
    : true;
  return {
    ...partial,
    isValid: partial.ready && partial.acknowledged && versionsOk && !partial.error,
  };
}

export function BookingLegalAck({
  testIdPrefix,
  summary,
  onChange,
  disabled = false,
}: {
  testIdPrefix: string;
  summary?: BookingLegalSummaryProps;
  onChange?: (state: BookingLegalAckState) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('legal');
  const locale = useLocale();
  const lang = locale === 'en' ? 'en' : 'ar';
  const [state, setState] = useState<BookingLegalAckState>(() =>
    buildState({
      ready: false,
      loading: true,
      error: null,
      acknowledged: false,
      versionIds: EMPTY_IDS,
      corpusReady: false,
      acceptancePresentationKey: null,
    }),
  );
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
        versionIds: EMPTY_IDS,
        corpusReady: false,
      }),
    );

    void (async () => {
      try {
        const set: CustomerBookingLegalSet = await fetchCustomerBookingLegalSet(lang);
        if (cancelled) return;
        if (set.corpusReady) {
          const terms = set.documents.terms?.versionId;
          const cancellation = set.documents.cancellation?.versionId;
          const bookingTerms = set.documents.bookingTerms?.versionId;
          if (!terms || !cancellation || !bookingTerms) {
            setState((prev) =>
              buildState({
                ...prev,
                loading: false,
                ready: false,
                corpusReady: false,
                error: t('acceptance.versionsUnavailable'),
                versionIds: EMPTY_IDS,
                acceptancePresentationKey: set.acceptancePresentationKey,
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
              corpusReady: true,
              acceptancePresentationKey: set.acceptancePresentationKey,
              versionIds: {
                terms,
                cancellation,
                bookingTerms,
                ...(set.documents.privacy?.versionId
                  ? { privacy: set.documents.privacy.versionId }
                  : {}),
              },
            }),
          );
          return;
        }
        // Local/dev without ACTIVE corpus: allow acknowledgement UX without inventing DRAFT ids.
        if (set.enforcementStrict) {
          setState((prev) =>
            buildState({
              ...prev,
              loading: false,
              ready: false,
              corpusReady: false,
              error: t('acceptance.versionsUnavailable'),
              versionIds: EMPTY_IDS,
              acceptancePresentationKey: set.acceptancePresentationKey,
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
            corpusReady: false,
            versionIds: EMPTY_IDS,
            acceptancePresentationKey: set.acceptancePresentationKey,
          }),
        );
      } catch {
        if (cancelled) return;
        setState((prev) =>
          buildState({
            ...prev,
            loading: false,
            ready: false,
            corpusReady: false,
            error: t('acceptance.versionsUnavailable'),
            versionIds: EMPTY_IDS,
            acceptancePresentationKey: null,
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

  const depositPct = summary?.depositPercent ?? DEPOSIT_PERCENT;
  const balanceHours = summary?.balanceDueHoursBeforeStart ?? BALANCE_DUE_HOURS_BEFORE_START;
  const freeHours = summary?.freeCancelUntilHours ?? CANCELLATION_FREE_UNTIL_HOURS;
  const ownerMins = summary?.ownerApprovalMinutes ?? 60;

  const hasSummary =
    summary &&
    (summary.depositPercent != null ||
      summary.freeCancelUntilHours != null ||
      summary.balanceDueHoursBeforeStart != null ||
      summary.amountDueNow != null ||
      summary.remainingBalance != null ||
      summary.showCancelTiers ||
      summary.showDepositDisclosure ||
      summary.showFullPaymentDisclosure ||
      summary.showOwnerApprovalDisclosure ||
      Boolean(summary.currencyNote));

  return (
    <div
      className="space-y-2.5 rounded-[14px] border border-[#E0E8F3] bg-white px-3.5 py-3"
      data-testid={testIdPrefix}
      data-corpus-ready={state.corpusReady ? 'true' : 'false'}
      data-acceptance-presentation={state.acceptancePresentationKey ?? ''}
    >
      {hasSummary ? (
        <ul
          className="space-y-1 text-[11px] leading-relaxed text-[#53637A]"
          data-testid={`${testIdPrefix}-summary`}
        >
          {summary?.amountDueNow != null ? (
            <li>
              {t('bookingAck.amountDueNowSummary', {
                amount: summary.amountDueNow,
                currency: summary.currency ?? 'JOD',
              })}
            </li>
          ) : null}
          {summary?.showDepositDisclosure ? (
            <li data-testid={`${testIdPrefix}-deposit-disclosure`}>
              {t('bookingAck.depositDisclosure', {
                percent: depositPct,
                hours: balanceHours,
              })}
            </li>
          ) : summary?.depositPercent != null ? (
            <li>{t('bookingAck.depositSummary', { percent: summary.depositPercent })}</li>
          ) : null}
          {summary?.remainingBalance != null ? (
            <li>
              {t('bookingAck.remainingBalanceSummary', {
                amount: summary.remainingBalance,
                currency: summary.currency ?? 'JOD',
              })}
            </li>
          ) : null}
          {summary?.balanceDueAtIso ? (
            <li>
              {t('bookingAck.balanceDueAtSummary', {
                when: new Date(summary.balanceDueAtIso).toLocaleString(locale),
              })}
            </li>
          ) : summary?.balanceDueHoursBeforeStart != null ? (
            <li>
              {t('bookingAck.balanceDueSummary', {
                hours: summary.balanceDueHoursBeforeStart,
              })}
            </li>
          ) : null}
          {summary?.showFullPaymentDisclosure ? (
            <li data-testid={`${testIdPrefix}-full-payment-disclosure`}>
              {t('bookingAck.fullPaymentDisclosure')}
            </li>
          ) : null}
          {summary?.showOwnerApprovalDisclosure ? (
            <li data-testid={`${testIdPrefix}-owner-approval-disclosure`}>
              {t('bookingAck.ownerApprovalDisclosure', { minutes: ownerMins })}
            </li>
          ) : null}
          {summary?.showCancelTiers ? (
            <li data-testid={`${testIdPrefix}-cancel-tiers`}>
              {t('bookingAck.cancelTiersSummarySsot', {
                freeHours,
                tier30: CANCELLATION_CHARGE_PERCENT_TIER_30,
                hours30: CANCELLATION_CHARGE_30_UNTIL_HOURS,
                tier50: CANCELLATION_CHARGE_PERCENT_TIER_50,
                hours50: CANCELLATION_CHARGE_50_UNTIL_HOURS,
                tier100: CANCELLATION_CHARGE_PERCENT_TIER_100,
              })}
            </li>
          ) : null}
          {summary?.freeCancelUntilHours != null && !summary?.showCancelTiers ? (
            <li>
              {t('bookingAck.freeCancelSummary', { hours: summary.freeCancelUntilHours })}
            </li>
          ) : null}
          {summary?.currencyNote ? <li>{summary.currencyNote}</li> : null}
          <li>{t('bookingAck.retainCapturedOnlyNote')}</li>
        </ul>
      ) : null}

      <p className="text-[11px] leading-relaxed text-[#8794A7]">
        {t('bookingAck.reviewLead')}{' '}
        <Link href="/terms" className="font-medium text-primary hover:underline">
          {t('nav.terms')}
        </Link>
        {t('commitmentComma')}
        <Link href="/cancellation-refund" className="font-medium text-primary hover:underline">
          {t('nav.cancellation-refund')}
        </Link>
        {t('commitmentAnd')}
        <Link href="/booking-payment" className="font-medium text-primary hover:underline">
          {t('nav.booking-payment')}
        </Link>
        {t('commitmentEnd')}
      </p>

      {state.loading ? (
        <p className="text-xs text-[#8794A7]">{t('acceptance.loading')}</p>
      ) : null}
      {state.error ? (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : null}

      <label className="flex items-start gap-2.5 text-start text-xs leading-relaxed text-[#0D2046]">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#C5D4E8] text-primary focus:ring-primary"
          checked={state.acknowledged}
          disabled={disabled || !state.ready}
          data-testid={`${testIdPrefix}-ack`}
          onChange={(e) =>
            setState((prev) => buildState({ ...prev, acknowledged: e.target.checked }))
          }
        />
        <span>{t('bookingAck.ackCheckbox')}</span>
      </label>
    </div>
  );
}
