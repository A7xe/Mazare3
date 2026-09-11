'use client';

import { useTranslations } from 'next-intl';
import type { AvailabilityPeriod, PublicAvailabilitySlot } from '@mazare3/shared';
import { formatPrice } from '@/lib/property-helpers';
import { orderPeriods } from '@/lib/booking-calendar';

type Props = {
  slots: PublicAvailabilitySlot[];
  selectedPeriod: AvailabilityPeriod | '';
  onSelect: (period: AvailabilityPeriod) => void;
  locale: 'ar' | 'en';
  loading?: boolean;
  hasDate: boolean;
};

export function BookingPeriodSelector({
  slots,
  selectedPeriod,
  onSelect,
  locale,
  loading,
  hasDate,
}: Props) {
  const t = useTranslations('property');
  const bookable = orderPeriods(slots.filter((s) => s.bookable));

  if (!hasDate) {
    return (
      <p
        className="px-1 text-[12px] font-medium text-[#8794A7]"
        data-testid="booking-period-empty-hint"
      >
        {t('selectDateForPeriods')}
      </p>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" data-testid="booking-period-loading">
        {[0, 1].map((i) => (
          <div key={i} className="h-[3.25rem] animate-pulse rounded-[12px] bg-[#EAF1FB]" />
        ))}
      </div>
    );
  }

  if (bookable.length === 0) {
    return (
      <p className="px-1 text-[12px] text-[#5B6B7C]" data-testid="booking-period-none">
        {t('noSlotsForDate')}
      </p>
    );
  }

  return (
    <div
      className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"
      role="radiogroup"
      aria-label={t('selectPeriod')}
      data-testid="booking-period-list"
    >
      {bookable.map((slot) => {
        const selected = selectedPeriod === slot.period;
        return (
          <button
            key={slot.period}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-pressed={selected}
            data-testid={`booking-period-${slot.period}`}
            onClick={() => onSelect(slot.period)}
            className={`rounded-[12px] border px-3 py-2.5 text-start transition-colors ${
              selected
                ? 'border-[#2F6EF6] bg-[#EEF4FF] ring-1 ring-[#2F6EF6]/25'
                : 'border-[#E7EEF8] bg-[#F8FBFF] hover:border-[#2F6EF6]/40'
            }`}
          >
            <span className="block text-[12px] font-bold text-[#0D2046]">
              {t(`period.${slot.period}`)}
            </span>
            {slot.startAtLocal && slot.endAtLocal ? (
              <span className="mt-0.5 block text-[10px] font-medium tabular-nums text-[#8794A7]">
                {slot.startAtLocal} – {slot.endAtLocal}
              </span>
            ) : null}
            <span className="mt-1 block text-[11px] font-semibold tabular-nums text-[#2F6EF6]">
              {formatPrice(slot.price, slot.currency, locale)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
