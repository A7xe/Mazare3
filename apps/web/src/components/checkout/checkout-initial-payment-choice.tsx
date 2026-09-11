'use client';

import { useTranslations, useLocale } from 'next-intl';
import type { InitialPaymentChoice, InitialPaymentOption } from '@mazare3/shared';
import { formatPrice } from '@/lib/property-helpers';

type Props = {
  options: InitialPaymentOption[];
  value: InitialPaymentChoice;
  locked: boolean;
  currency: string;
  onChange: (choice: InitialPaymentChoice) => void;
};

export function CheckoutInitialPaymentChoice({
  options,
  value,
  locked,
  currency,
  onChange,
}: Props) {
  const t = useTranslations('checkout');
  const locale = useLocale() as 'ar' | 'en';
  const money = (n: number) => formatPrice(n, currency, locale);

  return (
    <section
      data-testid="checkout-initial-payment-choice"
      className="space-y-2.5 rounded-[18px] border border-[#E0E8F3] bg-white px-3.5 py-3 shadow-[0_6px_18px_rgba(47,90,150,.06)] sm:px-4"
      aria-labelledby="checkout-amount-choice-heading"
    >
      <h2
        id="checkout-amount-choice-heading"
        className="text-[13px] font-bold text-[#0D2046]"
      >
        {t('initialAmountChoiceTitle')}
      </h2>
      {locked ? (
        <p
          className="rounded-[10px] bg-[#F3F8FF] px-2.5 py-2 text-[11px] text-[#53637A]"
          data-testid="checkout-amount-choice-locked"
          role="status"
        >
          {t('verifyingPayment')}
        </p>
      ) : null}

      <div
        role="radiogroup"
        aria-labelledby="checkout-amount-choice-heading"
        className="grid gap-2"
      >
        {options.map((opt) => {
          const selected = value === opt.choice;
          const isDeposit = opt.choice === 'deposit';
          const title = isDeposit ? t('payDepositNowTitle') : t('payFullNowTitle');
          const helper = isDeposit
            ? t('payDepositNowHelper', { amount: money(opt.remainingAfterPayment) })
            : t('payFullNowHelper');
          const descriptionId = `checkout-amount-${opt.choice}-desc`;

          return (
            <label
              key={opt.choice}
              data-testid={`checkout-amount-option-${opt.choice}`}
              data-selected={selected ? 'true' : 'false'}
              className={[
                'flex cursor-pointer items-start gap-3 rounded-[14px] border px-3 py-2.5 transition-colors',
                selected
                  ? 'border-[#2F6EF6] bg-[#F3F8FF] ring-1 ring-[#2F6EF6]/40'
                  : 'border-[#E0E8F3] bg-[#FCFDFF] hover:border-[#C5D4EA]',
                locked ? 'cursor-not-allowed opacity-70' : '',
              ].join(' ')}
            >
              <input
                type="radio"
                name="initialPaymentChoice"
                value={opt.choice}
                checked={selected}
                disabled={locked}
                onChange={() => onChange(opt.choice)}
                className="mt-1 h-4 w-4 shrink-0 accent-[#2F6EF6]"
                aria-describedby={descriptionId}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#0D2046]">{title}</span>
                  <span className="text-[14px] font-bold tabular-nums text-[#0D2046]">
                    {money(opt.dueNowAmount)}
                  </span>
                </span>
                <span
                  id={descriptionId}
                  className="mt-0.5 block text-[11px] leading-relaxed text-[#53637A]"
                >
                  {helper}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
