'use client';

import { useTranslations, useLocale } from 'next-intl';
import type { CheckoutBookingView } from '@mazare3/shared';
import { formatPrice } from '@/lib/property-helpers';
import { formatPlatformDateTime } from '@/lib/format-platform-time';
import { Badge } from '@/components/ui/badge';

export function CheckoutPaymentSummary({
  booking,
  selectedInitialChoice,
}: {
  booking: CheckoutBookingView;
  /** CB-6 — local Deposit/Full selection; does not mutate server until Pay. */
  selectedInitialChoice?: 'deposit' | 'full' | null;
}) {
  const t = useTranslations('checkout');
  const tBookings = useTranslations('bookings');
  const locale = useLocale() as 'ar' | 'en';

  const isFullyPaid = booking.isFullyPaid === true;
  const choiceOpt =
    selectedInitialChoice && booking.initialPaymentOptions
      ? booking.initialPaymentOptions.find((o) => o.choice === selectedInitialChoice)
      : null;
  const displayDuePurpose =
    choiceOpt?.choice === 'full'
      ? 'full'
      : choiceOpt?.choice === 'deposit'
        ? 'deposit'
        : booking.duePurpose;
  const displayDueNow = choiceOpt?.dueNowAmount ?? booking.dueNowAmount;
  const displayRemaining =
    choiceOpt != null ? choiceOpt.remainingAfterPayment : booking.remainingAmount;

  const awaitingPay = Boolean(displayDuePurpose) && !isFullyPaid;
  const isDeposit = displayDuePurpose === 'deposit';
  const isBalance = displayDuePurpose === 'balance';
  const isFull =
    displayDuePurpose === 'full' ||
    (booking.paymentCollectionMode === 'full' && !choiceOpt);
  const serviceFee = booking.pricing.customerServiceFeeAmount;
  const discount =
    (booking.promotionDiscountAmount ?? 0) +
    (booking.couponDiscountAmount ?? 0) +
    (booking.platformDiscountAmount ?? 0);
  const baseAmount =
    booking.originalSlotPrice != null && booking.originalSlotPrice > 0
      ? booking.originalSlotPrice
      : booking.pricing.bookingTotalAmount;
  const paidDeposit = booking.depositPaidAmount ?? 0;
  const money = (n: number) => formatPrice(n, booking.currency, locale);

  return (
    <section
      data-testid="checkout-payment-summary"
      className="space-y-3 rounded-[18px] border border-[#E0E8F3] bg-white px-3.5 py-3 shadow-[0_6px_18px_rgba(47,90,150,.06)] sm:px-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-bold text-[#0D2046]">{t('paymentSummaryTitle')}</h2>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="muted">{t(`bookingStatus.${booking.status}`)}</Badge>
          {isDeposit && (
            <Badge variant="highlight" data-testid="checkout-deposit-badge">
              {t('depositBadge')}
            </Badge>
          )}
          {isBalance && (
            <Badge variant="highlight" data-testid="checkout-balance-badge">
              {t('balanceBadge')}
            </Badge>
          )}
          {(isFull || selectedInitialChoice === 'full') && (
            <Badge variant="highlight" data-testid="checkout-full-payment-badge">
              {t('fullPaymentBadge')}
            </Badge>
          )}
          {booking.paymentState && (
            <Badge variant={isFullyPaid ? 'highlight' : 'default'}>
              {tBookings(`paymentState.${booking.paymentState}`)}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-2.5 rounded-[14px] border border-[#E7EEF8] bg-[#F7FAFF] p-3">
        <div className="flex items-center justify-between gap-2 text-[12px]">
          <span className="text-[#53637A]">{t('quoteBookingPrice')}</span>
          <span className="tabular-nums font-semibold text-[#0D2046]">{money(baseAmount)}</span>
        </div>
        {discount > 0 ? (
          <div
            className="flex items-center justify-between gap-2 text-[12px]"
            data-testid="checkout-discount"
          >
            <span className="text-[#53637A]">
              {t('discount')}
              {booking.couponCodeSnapshot ? ` (${booking.couponCodeSnapshot})` : ''}
            </span>
            <span className="tabular-nums font-semibold text-[#16A34A]">−{money(discount)}</span>
          </div>
        ) : null}
        {serviceFee > 0 ? (
          <div className="flex items-center justify-between gap-2 text-[12px]">
            <span className="text-[#53637A]">{t('serviceFee')}</span>
            <span className="tabular-nums font-semibold text-[#0D2046]">{money(serviceFee)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2 border-t border-[#E0E8F3] pt-2">
          <span className="text-[13px] font-bold text-[#0D2046]">{t('bookingTotal')}</span>
          <span className="tabular-nums text-[15px] font-bold text-[#0D2046]">
            {money(booking.pricing.customerPayableAmount)}
          </span>
        </div>

        {isBalance && paidDeposit > 0 ? (
          <div
            className="flex items-center justify-between gap-2 text-[12px]"
            data-testid="checkout-already-paid"
          >
            <span className="text-[#53637A]">{t('alreadyPaid')}</span>
            <span className="tabular-nums font-semibold text-[#0D2046]">{money(paidDeposit)}</span>
          </div>
        ) : null}

        {booking.depositAmount != null &&
        selectedInitialChoice !== 'full' &&
        booking.paymentCollectionMode !== 'full' &&
        !isBalance ? (
          <div className="flex items-center justify-between gap-2 text-[12px]">
            <span className="text-[#53637A]">
              {t('depositLabel')}
              {booking.depositPercent != null ? ` (${booking.depositPercent}%)` : ''}
            </span>
            <span className="tabular-nums font-semibold text-[#0D2046]">
              {money(booking.depositAmount)}
            </span>
          </div>
        ) : null}

        {displayRemaining != null &&
        displayRemaining > 0 &&
        selectedInitialChoice !== 'full' &&
        booking.paymentCollectionMode !== 'full' &&
        !isBalance ? (
          <div className="flex items-center justify-between gap-2 text-[12px]">
            <span className="text-[#53637A]">{t('remainingBalance')}</span>
            <span className="tabular-nums font-semibold text-[#0D2046]">
              {money(displayRemaining)}
            </span>
          </div>
        ) : null}

        {selectedInitialChoice === 'full' || (isFull && displayRemaining === 0) ? (
          <div
            className="flex items-center justify-between gap-2 text-[12px]"
            data-testid="checkout-remaining-zero"
          >
            <span className="text-[#53637A]">{t('remainingBalance')}</span>
            <span className="tabular-nums font-semibold text-[#0D2046]">{money(0)}</span>
          </div>
        ) : null}

        {booking.balanceDueAt &&
        selectedInitialChoice !== 'full' &&
        booking.paymentCollectionMode !== 'full' &&
        !isBalance ? (
          <p className="text-[10px] text-[#8794A7]" data-testid="checkout-balance-due-at">
            {t('balanceDueAt')}:{' '}
            {formatPlatformDateTime(booking.balanceDueAt, locale, booking.timeZone)}
          </p>
        ) : null}

        {awaitingPay ? (
          <div
            className="flex items-center justify-between gap-2 rounded-[12px] bg-[#2F6EF6] px-3 py-2.5 text-white"
            data-testid="checkout-due-now"
          >
            <span className="text-[12px] font-semibold">
              {isDeposit
                ? t('payNowDeposit')
                : isBalance
                  ? t('payNowBalance')
                  : t('payNowFull')}
            </span>
            <span className="text-[18px] font-bold tabular-nums">{money(displayDueNow)}</span>
          </div>
        ) : null}
        {isDeposit ? <p className="text-[10px] text-[#8794A7]">{t('depositNote')}</p> : null}
        {selectedInitialChoice === 'full' || displayDuePurpose === 'full' ? (
          <p className="text-[10px] text-[#8794A7]" data-testid="checkout-full-helper">
            {t('payFullNowHelper')}
          </p>
        ) : null}
      </div>
    </section>
  );
}
