'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { AvailabilityPeriod, PublicAvailabilitySlot } from '@mazare3/shared';
import { AvailabilityCalendar } from '@/components/marketplace/booking/availability-calendar';
import { BookingPeriodSelector } from '@/components/marketplace/booking/booking-period-selector';
import { PriceDisplay } from '@/components/marketplace/price-display';
import {
  BookingApiError,
  previewReschedule,
  type ReschedulePreviewResult,
} from '@/lib/api-bookings';
import { OwnerApiError, previewOwnerReschedule } from '@/lib/api-owner';

export type RescheduleSlotSelection = {
  slotId: string;
  date: string;
  period: AvailabilityPeriod;
  price: number;
};

type Props = {
  bookingId: string;
  propertySlug: string;
  currentDate: string;
  currentPeriod: AvailabilityPeriod;
  currentMerchantValue: number;
  locale: 'ar' | 'en';
  initiatedBy: 'customer' | 'owner';
  currency?: string;
  /** When true, preview uses force-majeure equivalent/upgrade pricing. */
  forceMajeure?: boolean;
  voluntaryUpgrade?: boolean;
  onSelect: (selection: RescheduleSlotSelection) => void;
  testIdPrefix?: string;
};

export function RescheduleSlotPicker({
  bookingId,
  propertySlug,
  currentDate,
  currentPeriod,
  currentMerchantValue,
  locale,
  initiatedBy,
  currency = 'JOD',
  forceMajeure = false,
  voluntaryUpgrade = false,
  onSelect,
  testIdPrefix = 'reschedule-picker',
}: Props) {
  const t = useTranslations('bookings');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<AvailabilityPeriod | ''>('');
  const [monthSlots, setMonthSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [preview, setPreview] = useState<ReschedulePreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const daySlots = monthSlots.filter((s) => s.date === selectedDate);

  const loadPreview = useCallback(
    async (slotId: string, date: string, period: AvailabilityPeriod, price: number) => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const res =
          initiatedBy === 'owner'
            ? await previewOwnerReschedule(bookingId, slotId)
            : await previewReschedule(bookingId, slotId, {
                forceMajeure,
                voluntaryUpgrade,
              });
        setPreview(res.data);
        onSelect({ slotId, date, period, price });
      } catch (err) {
        setPreview(null);
        const message =
          err instanceof BookingApiError || err instanceof OwnerApiError
            ? err.message
            : t('reschedulePreviewError');
        setPreviewError(message);
      } finally {
        setPreviewLoading(false);
      }
    },
    [bookingId, initiatedBy, forceMajeure, voluntaryUpgrade, onSelect, t],
  );

  useEffect(() => {
    setSelectedPeriod('');
    setPreview(null);
    setPreviewError(null);
  }, [selectedDate]);

  async function handlePeriodSelect(period: AvailabilityPeriod) {
    setSelectedPeriod(period);
    const slot = daySlots.find((s) => s.period === period && s.bookable);
    if (!slot?.id) {
      setPreview(null);
      setPreviewError(t('rescheduleSlotIdMissing'));
      return;
    }
    await loadPreview(slot.id, selectedDate, period, slot.price);
  }

  const payableDelta = preview?.customerPayableDelta ?? 0;
  const paymentRequired = payableDelta > 0;
  const refundDue = payableDelta < 0;

  return (
    <div className="space-y-3" data-testid={testIdPrefix}>
      <AvailabilityCalendar
        propertySlug={propertySlug}
        locale={locale}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onMonthSlots={(slots) => setMonthSlots(slots)}
        onLoadingChange={setCalendarLoading}
      />
      <BookingPeriodSelector
        slots={daySlots}
        selectedPeriod={selectedPeriod}
        onSelect={(p) => void handlePeriodSelect(p)}
        locale={locale}
        loading={calendarLoading}
        hasDate={Boolean(selectedDate)}
      />

      {previewLoading && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('reschedulePreviewLoading')}
        </div>
      )}

      {previewError && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
          {previewError}
        </p>
      )}

      {preview && !previewLoading && (
        <div
          className="space-y-2 rounded-xl border border-primary/15 bg-primary-soft/20 px-3 py-3 text-xs text-navy"
          data-testid={`${testIdPrefix}-preview`}
        >
          <div className="grid gap-1 sm:grid-cols-2">
            <p>
              <span className="font-semibold">{t('rescheduleCurrent')}</span>{' '}
              {currentDate} · {t(`period.${currentPeriod}`)}
            </p>
            <p>
              <span className="font-semibold">{t('rescheduleProposed')}</span>{' '}
              {selectedDate} · {selectedPeriod ? t(`period.${selectedPeriod}`) : '—'}
            </p>
            <p>
              <span className="font-semibold">{t('rescheduleCurrentValue')}</span>{' '}
              <PriceDisplay amount={currentMerchantValue} currency={currency} locale={locale} />
            </p>
            <p>
              <span className="font-semibold">{t('rescheduleNewListValue')}</span>{' '}
              <PriceDisplay
                amount={preview.toListMerchantValue}
                currency={currency}
                locale={locale}
              />
            </p>
          </div>

          {paymentRequired && (
            <p className="font-semibold text-primary">
              {t('rescheduleCustomerPaysDelta')}:{' '}
              <PriceDisplay amount={payableDelta} currency={currency} locale={locale} />
            </p>
          )}
          {refundDue && (
            <p className="font-semibold text-primary">
              {t('rescheduleRefundDue')}:{' '}
              <PriceDisplay amount={Math.abs(payableDelta)} currency={currency} locale={locale} />
            </p>
          )}
          {!paymentRequired && !refundDue && (
            <p className="font-medium text-muted">{t('rescheduleNoMoneyMove')}</p>
          )}
          {preview.ownerAbsorbsAmount > 0 && (
            <p>
              {t('rescheduleOwnerAbsorbs')}:{' '}
              <PriceDisplay
                amount={preview.ownerAbsorbsAmount}
                currency={currency}
                locale={locale}
              />
            </p>
          )}
          {paymentRequired && (
            <p className="text-muted">{t('reschedulePaymentRequired')}</p>
          )}

          {initiatedBy === 'customer' && (
            <p className="rounded-lg bg-surface/80 px-2 py-1.5 text-[11px] text-muted">
              {t('rescheduleAntiAbuseWarning')}
            </p>
          )}
          {initiatedBy === 'owner' && (
            <div className="space-y-1 rounded-lg border border-amber-500/25 bg-amber-50/80 px-2 py-1.5 text-[11px] text-navy">
              <p>{t('rescheduleOwnerPriceFreezeEn')}</p>
              <p dir="rtl">{t('rescheduleOwnerPriceFreezeAr')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
