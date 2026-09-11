'use client';

import { useTranslations } from 'next-intl';
import type { BookingQuote } from '@mazare3/shared';
import { formatPrice } from '@/lib/property-helpers';

type Props = {
  quote: BookingQuote | null;
  loading: boolean;
  locale: 'ar' | 'en';
  error?: string | null;
  onRetry?: () => void;
};

export function BookingQuoteBreakdown({ quote, loading, locale, error, onRetry }: Props) {
  const t = useTranslations('property');

  if (error) {
    return (
      <div
        className="rounded-[14px] border border-danger/20 bg-danger/5 px-3 py-2.5 text-[12px]"
        data-testid="booking-quote-error"
        role="alert"
      >
        <p className="text-danger">{error}</p>
        {onRetry ? (
          <button
            type="button"
            data-testid="booking-quote-retry"
            onClick={onRetry}
            className="mt-2 text-[12px] font-semibold text-[#2F6EF6] hover:underline"
          >
            {t('quoteRetry')}
          </button>
        ) : null}
      </div>
    );
  }

  if (loading || !quote) {
    return (
      <div
        className="space-y-2 rounded-[14px] border border-[#E7EEF8] bg-white/90 px-3 py-2.5"
        data-testid="booking-quote-skeleton"
        aria-busy="true"
      >
        <div className="h-3 w-24 animate-pulse rounded bg-[#EAF1FB]" />
        <div className="h-3 w-full animate-pulse rounded bg-[#EAF1FB]" />
        <div className="h-3 w-[80%] animate-pulse rounded bg-[#EAF1FB]" />
        <div className="h-4 w-full animate-pulse rounded bg-[#EAF1FB]" />
      </div>
    );
  }

  const currency = quote.currency;

  return (
    <div
      className="space-y-1.5 rounded-[14px] border border-[#E7EEF8] bg-white/90 px-3 py-2.5 text-[12px] text-[#5B6B7C] shadow-[0_4px_12px_rgba(47,110,246,.04)]"
      data-testid="booking-quote-breakdown"
      aria-live="polite"
    >
      <p className="text-[11px] font-bold text-[#0D2046]">{t('priceDetails')}</p>

      <div className="flex items-center justify-between gap-3" data-testid="booking-quote-base">
        <span>{t('quoteBookingPrice')}</span>
        <span className="tabular-nums font-medium text-[#0D2046]">
          {formatPrice(quote.baseAmount, currency, locale)}
        </span>
      </div>

      {quote.discountAmount > 0 ? (
        <div
          className="flex items-center justify-between gap-3"
          data-testid="booking-quote-discount"
        >
          <span>{t('summaryDiscount')}</span>
          <span className="tabular-nums text-[#16A34A]">
            −{formatPrice(quote.discountAmount, currency, locale)}
          </span>
        </div>
      ) : null}

      {quote.customerServiceFeeAmount > 0 ? (
        <div
          className="flex items-center justify-between gap-3"
          data-testid="booking-quote-service-fee"
        >
          <span>{t('quoteServiceFee')}</span>
          <span className="tabular-nums">
            {formatPrice(quote.customerServiceFeeAmount, currency, locale)}
          </span>
        </div>
      ) : null}

      <div
        className="flex items-center justify-between gap-3 border-t border-[#E7EEF8] pt-1.5 text-[13px] font-bold text-[#0D2046]"
        data-testid="booking-summary-price"
      >
        <span>{t('total')}</span>
        <span className="tabular-nums text-[15px]">
          {formatPrice(quote.customerPayableTotal, currency, locale)}
        </span>
      </div>

      <div
        className="mt-1 flex items-center justify-between gap-3 rounded-[10px] bg-[#F3F8FF] px-2 py-1.5"
        data-testid="booking-summary-deposit"
      >
        <span className="font-medium text-[#0D2046]">{t('quoteDepositDue')}</span>
        <span className="tabular-nums font-semibold text-[#2F6EF6]">
          {formatPrice(quote.depositDueAmount, currency, locale)}
        </span>
      </div>

      <div
        className="flex items-center justify-between gap-3 px-2"
        data-testid="booking-summary-remaining"
      >
        <span>{t('quoteRemainingLater')}</span>
        <span className="tabular-nums">
          {formatPrice(quote.remainingAmount, currency, locale)}
        </span>
      </div>

      <p className="px-0.5 pt-0.5 text-[10px] leading-relaxed text-[#8794A7]" data-testid="booking-quote-balance-note">
        {t('quoteBalanceDueNote')}
      </p>
      {quote.remainingAmount > 0 &&
      quote.depositDueAmount > 0 &&
      quote.depositDueAmount < quote.customerPayableTotal ? (
        <p
          className="px-0.5 text-[10px] leading-relaxed text-[#8794A7]"
          data-testid="booking-quote-full-choice-hint"
        >
          {t('quoteFullChoiceHint')}
        </p>
      ) : null}
    </div>
  );
}
