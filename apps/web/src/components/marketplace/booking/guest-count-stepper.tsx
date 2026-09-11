'use client';

import { Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  value: number;
  capacity: number;
  onChange: (next: number) => void;
  disabled?: boolean;
};

export function GuestCountStepper({ value, capacity, onChange, disabled }: Props) {
  const t = useTranslations('property');
  const min = 1;
  const max = Math.max(1, capacity);
  const safe = Math.min(Math.max(value, min), max);

  return (
    <div
      className="flex items-center justify-between gap-3"
      data-testid="booking-guest-stepper"
      role="group"
      aria-label={t('guestsCount')}
    >
      <button
        type="button"
        data-testid="booking-guests-decrease"
        aria-label={t('guestsDecrease')}
        disabled={disabled || safe <= min}
        onClick={() => onChange(Math.max(min, safe - 1))}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E1EAF6] bg-white text-[#0D2046] shadow-sm transition hover:bg-[#F7FAFF] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <div className="min-w-[3rem] text-center">
        <p
          className="text-[15px] font-bold tabular-nums text-[#0D2046]"
          data-testid="booking-guests-value"
          aria-live="polite"
        >
          {safe}
        </p>
        <p className="text-[10px] font-medium text-[#8794A7]">
          {t('guestsCapacityHint', { capacity: max })}
        </p>
      </div>
      <button
        type="button"
        data-testid="booking-guests-increase"
        aria-label={t('guestsIncrease')}
        disabled={disabled || safe >= max}
        onClick={() => onChange(Math.min(max, safe + 1))}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E1EAF6] bg-white text-[#0D2046] shadow-sm transition hover:bg-[#F7FAFF] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
      {/* Hidden field preserves discovery/e2e value assertions without native stepper UX */}
      <input
        id="booking-guests"
        data-testid="booking-guests"
        type="hidden"
        value={safe}
        readOnly
      />
    </div>
  );
}
