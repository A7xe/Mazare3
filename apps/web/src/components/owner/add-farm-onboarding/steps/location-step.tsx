'use client';

import { useLocale, useTranslations } from 'next-intl';
import { JORDAN_CITIES, MAX_ARRIVAL_INSTRUCTIONS_LENGTH } from '@mazare3/shared';
import { OwnerLocationPicker } from '@/components/maps/owner-location-picker';
import { Input } from '@/components/ui/input';
import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AddFarmFormState } from '../add-farm-wizard';

type Props = {
  form: AddFarmFormState;
  errors: Record<string, string>;
  onChange: (patch: Partial<AddFarmFormState>) => void;
};

/** Resolve stored city (key or legacy free-text) to select value. */
export function resolveCitySelectValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  const found = JORDAN_CITIES.find(
    (c) => c.key === lower || c.labelEn.toLowerCase() === lower || c.labelAr === trimmed,
  );
  return found?.key ?? trimmed;
}

export function jordanCityLabel(raw: string, locale: 'ar' | 'en'): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  const found = JORDAN_CITIES.find(
    (c) => c.key === lower || c.labelEn.toLowerCase() === lower || c.labelAr === trimmed,
  );
  if (!found) return trimmed;
  return locale === 'ar' ? found.labelAr : found.labelEn;
}

export function LocationStep({ form, errors, onChange }: Props) {
  const t = useTranslations('addFarm');
  const tProp = useTranslations('ownerProperty');
  const locale = useLocale() as 'ar' | 'en';
  const cityValue = resolveCitySelectValue(form.city);
  const knownCity = JORDAN_CITIES.some((c) => c.key === cityValue);

  return (
    <div className="space-y-6 text-start" data-testid="add-farm-step-location-panel">
      <div>
        <h2 className="text-[17px] font-bold text-[#0D2046]">{t('steps.location')}</h2>
        <p className="mt-1 text-[12px] text-[#64748B]">{t('locationHint')}</p>
      </div>

      <section
        className="space-y-4 rounded-[16px] border border-[#E5EAF1] bg-[#F8FBFF] p-4"
        aria-labelledby="add-farm-public-location-heading"
      >
        <div>
          <h3 id="add-farm-public-location-heading" className="text-[14px] font-bold text-[#0D2046]">
            {t('publicLocationTitle')}
          </h3>
          <p className="mt-0.5 text-[11px] text-[#64748B]">{t('publicLocationHint')}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="add-farm-city" className="text-sm font-semibold text-[#0D2046]">
              {t('fields.city')}
            </label>
            <select
              id="add-farm-city"
              required
              aria-invalid={Boolean(errors.city)}
              aria-describedby={errors.city ? 'err-city' : undefined}
              className={cn(
                'h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-[#0D2046]',
                !cityValue && 'text-[#8A96A8]',
              )}
              value={knownCity ? cityValue : ''}
              onChange={(e) => onChange({ city: e.target.value })}
              data-testid="add-farm-city"
            >
              <option value="" disabled>
                {t('fields.cityPlaceholder')}
              </option>
              {JORDAN_CITIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {locale === 'ar' ? c.labelAr : c.labelEn}
                </option>
              ))}
            </select>
            {!knownCity && form.city.trim() ? (
              <p className="text-[11px] text-[#8A96A8]">
                {t('fields.cityLegacy', { value: form.city.trim() })}
              </p>
            ) : null}
            {errors.city ? (
              <p id="err-city" className="text-xs text-danger">
                {errors.city}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="add-farm-area" className="text-sm font-semibold text-[#0D2046]">
              {t('fields.area')}
            </label>
            <Input
              id="add-farm-area"
              required
              aria-invalid={Boolean(errors.area)}
              placeholder={t('fields.areaPlaceholder')}
              value={form.area}
              onChange={(e) => onChange({ area: e.target.value })}
              data-testid="add-farm-area"
            />
            {errors.area ? <p className="text-xs text-danger">{errors.area}</p> : null}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="add-farm-approx" className="text-sm font-semibold text-[#0D2046]">
              {t('fields.approximateAddress')}
            </label>
            <Input
              id="add-farm-approx"
              required
              aria-invalid={Boolean(errors.approximateAddress)}
              placeholder={t('fields.approximateAddressPlaceholder')}
              value={form.approximateAddress}
              onChange={(e) => onChange({ approximateAddress: e.target.value })}
              data-testid="add-farm-approx-address"
            />
            {errors.approximateAddress ? (
              <p className="text-xs text-danger">{errors.approximateAddress}</p>
            ) : (
              <p className="text-[11px] text-[#8A96A8]">{t('fields.approximateAddressHint')}</p>
            )}
          </div>
        </div>
      </section>

      <section
        className="space-y-4 rounded-[16px] border border-[#E5EAF1] bg-white p-4"
        aria-labelledby="add-farm-private-location-heading"
      >
        <div>
          <h3 id="add-farm-private-location-heading" className="text-[14px] font-bold text-[#0D2046]">
            {t('privateLocationTitle')}
          </h3>
          <p className="mt-0.5 text-[11px] text-[#64748B]">{t('privateLocationHint')}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="add-farm-exact" className="text-sm font-semibold text-[#0D2046]">
            {t('fields.exactAddress')}
          </label>
          <Input
            id="add-farm-exact"
            required
            aria-invalid={Boolean(errors.exactAddress)}
            placeholder={t('fields.exactAddressPlaceholder')}
            value={form.exactAddress}
            onChange={(e) => onChange({ exactAddress: e.target.value })}
            data-testid="add-farm-exact-address"
          />
          {errors.exactAddress ? (
            <p className="text-xs text-danger">{errors.exactAddress}</p>
          ) : (
            <p className="text-[11px] text-[#8A96A8]">{t('fields.exactAddressHint')}</p>
          )}
        </div>

        <OwnerLocationPicker
          latitudeExact={form.latitudeExact}
          longitudeExact={form.longitudeExact}
          latitudeApprox={form.latitudeApprox}
          longitudeApprox={form.longitudeApprox}
          onChange={(patch) => onChange(patch)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="add-farm-lat-approx" className="text-sm font-semibold text-[#0D2046]">
              {tProp('latitudeApprox')}
            </label>
            <Input
              id="add-farm-lat-approx"
              inputMode="decimal"
              value={form.latitudeApprox}
              onChange={(e) => onChange({ latitudeApprox: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="add-farm-lng-approx" className="text-sm font-semibold text-[#0D2046]">
              {tProp('longitudeApprox')}
            </label>
            <Input
              id="add-farm-lng-approx"
              inputMode="decimal"
              value={form.longitudeApprox}
              onChange={(e) => onChange({ longitudeApprox: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="add-farm-lat-exact" className="text-sm font-semibold text-[#0D2046]">
              {tProp('latitudeExact')}
            </label>
            <Input
              id="add-farm-lat-exact"
              inputMode="decimal"
              value={form.latitudeExact}
              onChange={(e) => onChange({ latitudeExact: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="add-farm-lng-exact" className="text-sm font-semibold text-[#0D2046]">
              {tProp('longitudeExact')}
            </label>
            <Input
              id="add-farm-lng-exact"
              inputMode="decimal"
              value={form.longitudeExact}
              onChange={(e) => onChange({ longitudeExact: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="add-farm-arrival-ar" className="text-sm font-semibold text-[#0D2046]">
            {tProp('arrivalInstructionsAr')}
          </label>
          <textarea
            id="add-farm-arrival-ar"
            rows={3}
            maxLength={MAX_ARRIVAL_INSTRUCTIONS_LENGTH}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
            value={form.arrivalInstructionsAr}
            onChange={(e) => onChange({ arrivalInstructionsAr: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="add-farm-arrival-en" className="text-sm font-semibold text-[#0D2046]">
            {tProp('arrivalInstructionsEn')}
          </label>
          <textarea
            id="add-farm-arrival-en"
            rows={3}
            maxLength={MAX_ARRIVAL_INSTRUCTIONS_LENGTH}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
            value={form.arrivalInstructionsEn}
            onChange={(e) => onChange({ arrivalInstructionsEn: e.target.value })}
          />
        </div>
      </section>

      <aside
        className="flex gap-3 rounded-[16px] border border-[#C7DBFF] bg-[#EEF4FF] p-4"
        data-testid="add-farm-location-privacy"
      >
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-[#2F6EF6]" aria-hidden />
        <div className="min-w-0 space-y-1 text-start">
          <p className="text-[13px] font-bold text-[#0D2046]">{t('privacyTitle')}</p>
          <p className="text-[12px] leading-relaxed text-[#53637A]">{t('privacyBody')}</p>
        </div>
      </aside>
    </div>
  );
}
