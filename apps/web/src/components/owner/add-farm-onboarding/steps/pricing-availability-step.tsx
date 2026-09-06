'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarPlus, Loader2 } from 'lucide-react';
import {
  AVAILABILITY_PERIODS,
  TEST_DEFAULT_DEPOSIT_PERCENT,
  type AvailabilityPeriod,
  type AvailabilityRuleInput,
} from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchOwnerAvailabilityHealth,
  fetchOwnerAvailabilityRules,
  generateOwnerAvailability,
  putOwnerAvailabilityRules,
  OwnerApiError,
} from '@/lib/api-owner';
import { formatPrice } from '@/lib/property-helpers';
import type { AddFarmFormState } from '../add-farm-wizard';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Default local times aligned with existing Mazare3 owner/e2e schedule conventions. */
const PERIOD_DEFAULT_TIMES: Record<AvailabilityPeriod, { startTime: string; endTime: string }> = {
  morning: { startTime: '09:00', endTime: '13:00' },
  evening: { startTime: '16:00', endTime: '22:00' },
  full_day: { startTime: '08:00', endTime: '20:00' },
  overnight: { startTime: '18:00', endTime: '10:00' },
};

type PeriodDraft = {
  enabled: boolean;
  price: string;
};

export type AddFarmAvailabilitySummary = {
  enabledPeriodCount: number;
  rangeLabel: string | null;
  healthWarning: string | null;
};

type Props = {
  form: AddFarmFormState;
  errors: Record<string, string>;
  propertyId: string | null;
  locale: 'ar' | 'en';
  onChange: (patch: Partial<AddFarmFormState>) => void;
  /** Register Save/Next availability persistence (rules only; no silent generate). */
  registerPersist: (fn: (() => Promise<void>) | null) => void;
  onSummaryChange: (summary: AddFarmAvailabilitySummary) => void;
  disabled?: boolean;
};

function emptyPeriods(): Record<AvailabilityPeriod, PeriodDraft> {
  return {
    morning: { enabled: false, price: '' },
    evening: { enabled: false, price: '' },
    full_day: { enabled: false, price: '' },
    overnight: { enabled: false, price: '' },
  };
}

export function PricingAvailabilityStep({
  form,
  errors,
  propertyId,
  locale,
  onChange,
  registerPersist,
  onSummaryChange,
  disabled,
}: Props) {
  const t = useTranslations('addFarm');
  const tProp = useTranslations('ownerProperty');
  const tOwner = useTranslations('owner');

  const [periods, setPeriods] = useState<Record<AvailabilityPeriod, PeriodDraft>>(emptyPeriods);
  const [loadingRules, setLoadingRules] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genNote, setGenNote] = useState<string | null>(null);
  const [rangeLabel, setRangeLabel] = useState<string | null>(null);
  const [healthWarning, setHealthWarning] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const basePriceNum = Number(form.basePrice);
  const hasValidBase =
    Number.isFinite(basePriceNum) && basePriceNum > 0;

  const visiblePeriods = useMemo(
    () =>
      AVAILABILITY_PERIODS.filter(
        (p) => p !== 'overnight' || form.allowsOvernight,
      ),
    [form.allowsOvernight],
  );

  const enabledPeriodCount = visiblePeriods.filter((p) => periods[p].enabled).length;

  const loadRules = useCallback(async () => {
    if (!propertyId) return;
    setLoadingRules(true);
    setAvailError(null);
    try {
      const [rulesRes, healthRes] = await Promise.all([
        fetchOwnerAvailabilityRules(propertyId),
        fetchOwnerAvailabilityHealth(propertyId),
      ]);
      const next = emptyPeriods();
      for (const rule of rulesRes.data) {
        if (!rule.enabled) continue;
        if (rule.period === 'overnight' && !form.allowsOvernight) continue;
        const existing = next[rule.period];
        // Collapse weekday×period rules into one onboarding period card (same price).
        if (!existing.enabled) {
          next[rule.period] = {
            enabled: true,
            price: String(rule.price),
          };
        }
      }
      setPeriods(next);
      setDirty(false);
      const h = healthRes.data;
      setHealthWarning(h.warning);
      if (h.earliestAvailableDate && h.latestAvailableDate) {
        setRangeLabel(`${h.earliestAvailableDate} → ${h.latestAvailableDate}`);
      } else {
        setRangeLabel(null);
      }
    } catch (e) {
      setAvailError(e instanceof OwnerApiError ? e.message : t('errors.availabilityLoadFailed'));
    } finally {
      setLoadingRules(false);
    }
  }, [propertyId, form.allowsOvernight, t]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  useEffect(() => {
    onSummaryChange({
      enabledPeriodCount,
      rangeLabel,
      healthWarning,
    });
  }, [enabledPeriodCount, rangeLabel, healthWarning, onSummaryChange]);

  const persistRules = useCallback(async () => {
    if (!propertyId || !dirty) return;

    const rules: AvailabilityRuleInput[] = [];
    for (const period of visiblePeriods) {
      const row = periods[period];
      if (!row.enabled) continue;
      const price = Number(row.price);
      if (!Number.isFinite(price) || price < 0) {
        throw new Error(t('errors.periodPriceInvalid'));
      }
      const times = PERIOD_DEFAULT_TIMES[period];
      for (const weekday of WEEKDAYS) {
        rules.push({
          weekday,
          period,
          enabled: true,
          startTime: times.startTime,
          endTime: times.endTime,
          price,
        });
      }
    }

    // Empty enabled set still PUTs [] so deselection persists (replace-all API).
    await putOwnerAvailabilityRules(propertyId, rules);
    setDirty(false);
    const healthRes = await fetchOwnerAvailabilityHealth(propertyId);
    const h = healthRes.data;
    setHealthWarning(h.warning);
    if (h.earliestAvailableDate && h.latestAvailableDate) {
      setRangeLabel(`${h.earliestAvailableDate} → ${h.latestAvailableDate}`);
    }
  }, [propertyId, dirty, visiblePeriods, periods, t]);

  useEffect(() => {
    registerPersist(() => persistRules());
    return () => registerPersist(null);
  }, [registerPersist, persistRules]);

  function updatePeriod(period: AvailabilityPeriod, patch: Partial<PeriodDraft>) {
    setPeriods((prev) => {
      const current = prev[period];
      let nextPrice = patch.price ?? current.price;
      if (patch.enabled === true && !current.enabled && !nextPrice && hasValidBase) {
        nextPrice = String(basePriceNum);
      }
      return {
        ...prev,
        [period]: { ...current, ...patch, price: nextPrice },
      };
    });
    setDirty(true);
    setGenNote(null);
  }

  function applyBaseToEnabled() {
    if (!hasValidBase) return;
    setPeriods((prev) => {
      const next = { ...prev };
      for (const p of visiblePeriods) {
        if (next[p].enabled) {
          next[p] = { ...next[p], price: String(basePriceNum) };
        }
      }
      return next;
    });
    setDirty(true);
  }

  async function handleGenerate() {
    if (!propertyId || generating || disabled) return;
    setGenerating(true);
    setAvailError(null);
    setGenNote(null);
    try {
      if (dirty || enabledPeriodCount > 0) {
        await persistRules();
      }
      const result = await generateOwnerAvailability(propertyId);
      setGenNote(
        t('generateResult', {
          created: result.data.created,
          existing: result.data.alreadyExisting,
        }),
      );
      setRangeLabel(`${result.data.from} → ${result.data.to}`);
      const healthRes = await fetchOwnerAvailabilityHealth(propertyId);
      setHealthWarning(healthRes.data.warning);
    } catch (e) {
      setAvailError(e instanceof OwnerApiError ? e.message : t('errors.availabilityGenerateFailed'));
    } finally {
      setGenerating(false);
    }
  }

  const previewPriceLabel =
    hasValidBase ? formatPrice(basePriceNum, 'JOD', locale) : null;

  return (
    <div className="space-y-6 text-start" data-testid="add-farm-step-pricing-panel">
      <div>
        <h2 className="text-[17px] font-bold text-[#0D2046]">{t('pricingHeading')}</h2>
        <p className="mt-1 text-[12px] text-[#64748B]">{t('pricingHint')}</p>
      </div>

      {/* A. Base pricing */}
      <section className="space-y-3" data-testid="add-farm-base-pricing">
        <h3 className="text-[14px] font-bold text-[#0D2046]">{t('basePriceSection')}</h3>
        <div className="space-y-2">
          <label htmlFor="add-farm-base-price" className="text-sm font-semibold text-[#0D2046]">
            {t('basePriceLabel')}
          </label>
          <p className="text-[12px] text-[#64748B]">{t('basePriceMeaning')}</p>
          <div className="flex items-center gap-2">
            <Input
              id="add-farm-base-price"
              type="number"
              min={1}
              step={1}
              inputMode="decimal"
              required
              aria-invalid={Boolean(errors.basePrice)}
              aria-describedby="add-farm-base-price-hint"
              value={form.basePrice}
              onChange={(e) => onChange({ basePrice: e.target.value })}
              disabled={disabled}
              data-testid="add-farm-base-price"
              className="max-w-[12rem]"
            />
            <span className="text-sm font-semibold text-[#0D2046]" aria-hidden>
              {t('currencyJod')}
            </span>
          </div>
          <p id="add-farm-base-price-hint" className="text-[11px] text-[#8A96A8]">
            {t('basePriceBrowseHint')}
          </p>
          {errors.basePrice ? (
            <p className="text-xs text-danger" role="alert">
              {errors.basePrice}
            </p>
          ) : null}
          {previewPriceLabel ? (
            <p className="text-[12px] font-medium text-[#0D2046]" data-testid="add-farm-price-from-preview">
              {t('previewFromPrice', { price: previewPriceLabel })}
            </p>
          ) : null}
        </div>

        <fieldset className="space-y-2 rounded-2xl border border-primary/15 bg-primary-soft/20 p-4">
          <legend className="px-1 text-sm font-semibold text-navy">{tProp('bookingMode')}</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="add-farm-booking-mode"
              checked={form.instantBookingEnabled}
              onChange={() => onChange({ instantBookingEnabled: true })}
              disabled={disabled}
            />
            {tProp('instantBooking')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="add-farm-booking-mode"
              checked={!form.instantBookingEnabled}
              onChange={() => onChange({ instantBookingEnabled: false })}
              disabled={disabled}
            />
            {tProp('ownerApprovalRequired')}
          </label>
        </fieldset>

        <div
          className="rounded-[14px] border border-[#E5EAF1] bg-[#F8FBFF] px-3.5 py-3 text-[12px] text-[#53637A]"
          data-testid="add-farm-deposit-note"
        >
          <p className="font-semibold text-[#0D2046]">{t('depositTitle')}</p>
          <p className="mt-1">{t('depositBody', { percent: TEST_DEFAULT_DEPOSIT_PERCENT })}</p>
        </div>
      </section>

      {/* B. Booking periods */}
      <section className="space-y-3" data-testid="add-farm-period-setup">
        <div>
          <h3 className="text-[14px] font-bold text-[#0D2046]">{t('periodsHeading')}</h3>
          <p className="mt-1 text-[12px] text-[#64748B]">{t('periodsHint')}</p>
        </div>

        {!propertyId ? (
          <p
            role="status"
            className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/10 px-4 py-5 text-center text-sm text-navy"
            data-testid="add-farm-pricing-need-draft"
          >
            {t('pricingNeedDraft')}
          </p>
        ) : loadingRules ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
            <span className="sr-only">{t('loading')}</span>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || !hasValidBase || enabledPeriodCount === 0}
                onClick={applyBaseToEnabled}
                data-testid="add-farm-use-base-price"
              >
                {t('useBasePrice')}
              </Button>
              <p className="text-[11px] text-[#8A96A8]">{t('periodPriceHint')}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {visiblePeriods.map((period) => {
                const row = periods[period];
                return (
                  <div
                    key={period}
                    className={`rounded-[14px] border p-3 ${
                      row.enabled
                        ? 'border-primary bg-primary-soft/40'
                        : 'border-[#E5EAF1] bg-white'
                    }`}
                    data-testid={`add-farm-period-${period}`}
                  >
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={row.enabled}
                        aria-checked={row.enabled}
                        disabled={disabled}
                        onChange={(e) => updatePeriod(period, { enabled: e.target.checked })}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-[#0D2046]">
                          {tOwner(`period.${period}`)}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-[#8A96A8]">
                          {PERIOD_DEFAULT_TIMES[period].startTime} –{' '}
                          {PERIOD_DEFAULT_TIMES[period].endTime}
                        </span>
                      </span>
                    </label>
                    {row.enabled ? (
                      <div className="mt-2 flex items-center gap-2 ps-6">
                        <label className="sr-only" htmlFor={`add-farm-period-price-${period}`}>
                          {t('periodPriceLabel', { period: tOwner(`period.${period}`) })}
                        </label>
                        <Input
                          id={`add-farm-period-price-${period}`}
                          type="number"
                          min={0}
                          step={1}
                          inputMode="decimal"
                          value={row.price}
                          disabled={disabled}
                          onChange={(e) => updatePeriod(period, { price: e.target.value })}
                          data-testid={`add-farm-period-price-${period}`}
                          className="max-w-[8rem]"
                        />
                        <span className="text-xs font-medium text-[#53637A]">{t('currencyJod')}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {!form.allowsOvernight ? (
              <p className="text-[12px] text-[#8A96A8]" data-testid="add-farm-overnight-locked">
                {t('overnightDisabledHint')}
              </p>
            ) : null}

            <p className="text-[12px] font-medium text-[#53637A]" data-testid="add-farm-periods-count">
              {t('periodsSelected', { count: enabledPeriodCount })}
            </p>

            {/* C. Generate + advanced link */}
            <div className="space-y-2 rounded-[14px] border border-[#E5EAF1] bg-[#F8FBFF] p-4">
              <p className="text-[12px] font-semibold text-[#0D2046]">{t('generateHeading')}</p>
              <p className="text-[12px] text-[#53637A]">{t('generateHint')}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || generating || enabledPeriodCount === 0}
                onClick={() => void handleGenerate()}
                data-testid="add-farm-generate-availability"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CalendarPlus className="h-4 w-4" />
                )}
                {generating ? t('generating') : t('generateCta')}
              </Button>
              {genNote ? (
                <p className="text-[12px] text-[#15803D]" data-testid="add-farm-generate-result">
                  {genNote}
                </p>
              ) : null}
              {rangeLabel ? (
                <p className="text-[12px] text-[#53637A]" data-testid="add-farm-availability-range">
                  {t('availabilityRange', { range: rangeLabel })}
                </p>
              ) : null}
              {healthWarning ? (
                <p className="text-[12px] text-amber-700" data-testid="add-farm-availability-warning">
                  {tOwner(`availabilityWarning.${healthWarning}`)}
                </p>
              ) : null}
              <Link
                href="/owner/availability"
                className="inline-block text-[12px] font-semibold text-[#2F6EF6] hover:underline"
              >
                {t('availabilityAdvancedCta')}
              </Link>
            </div>
          </>
        )}

        {availError ? (
          <p role="alert" className="text-sm text-danger" data-testid="add-farm-availability-error">
            {availError}
          </p>
        ) : null}
      </section>
    </div>
  );
}
