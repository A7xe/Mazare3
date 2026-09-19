'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  POOL_SAFETY_ATTESTATION_CORPUS_VERSION,
  POOL_WATER_FEATURE_KINDS,
  POOL_SEASONALITIES,
} from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import {
  fetchPropertyPoolSafety,
  putPropertyPoolSafety,
  attestPropertyPoolSafety,
  OwnerApiError,
} from '@/lib/api-owner';

type PoolPkg = {
  offersSwimmingPool?: boolean;
  hasSwimmingPoolActivity?: boolean;
  consistency?: string[];
  attestation?: { currentVersionAccepted?: boolean; corpusVersion?: string };
  profile?: {
    waterFeatureKind?: string;
    isIndoor?: boolean | null;
    isOutdoor?: boolean | null;
    minDepthMeters?: number | null;
    maxDepthMeters?: number | null;
    childrenAllowed?: boolean | null;
    childrenRequireAdultSupervision?: boolean | null;
    seasonality?: string;
    accessRestrictionsAr?: string | null;
    accessRestrictionsEn?: string | null;
    otherWarningsAr?: string | null;
    otherWarningsEn?: string | null;
    profileComplete?: boolean;
  } | null;
};

export function PropertyPoolSafetyPanel({ propertyId }: { propertyId: string }) {
  const t = useTranslations('addFarm.poolSafety');
  const [pkg, setPkg] = useState<PoolPkg | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attest, setAttest] = useState(false);
  const [form, setForm] = useState({
    waterFeatureKind: 'swimming_pool',
    isIndoor: false,
    isOutdoor: true,
    minDepthMeters: '',
    maxDepthMeters: '',
    childrenAllowed: true,
    childrenRequireAdultSupervision: true,
    seasonality: 'unknown',
    accessRestrictionsAr: '',
    accessRestrictionsEn: '',
    otherWarningsAr: '',
    otherWarningsEn: '',
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPropertyPoolSafety(propertyId);
      const data = res.data as PoolPkg;
      setPkg(data);
      if (data.profile) {
        setForm({
          waterFeatureKind: data.profile.waterFeatureKind ?? 'swimming_pool',
          isIndoor: Boolean(data.profile.isIndoor),
          isOutdoor: data.profile.isOutdoor !== false,
          minDepthMeters:
            data.profile.minDepthMeters != null ? String(data.profile.minDepthMeters) : '',
          maxDepthMeters:
            data.profile.maxDepthMeters != null ? String(data.profile.maxDepthMeters) : '',
          childrenAllowed: data.profile.childrenAllowed !== false,
          childrenRequireAdultSupervision:
            data.profile.childrenRequireAdultSupervision !== false,
          seasonality: data.profile.seasonality ?? 'unknown',
          accessRestrictionsAr: data.profile.accessRestrictionsAr ?? '',
          accessRestrictionsEn: data.profile.accessRestrictionsEn ?? '',
          otherWarningsAr: data.profile.otherWarningsAr ?? '',
          otherWarningsEn: data.profile.otherWarningsEn ?? '',
        });
      }
      setAttest(Boolean(data.attestation?.currentVersionAccepted));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [propertyId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await putPropertyPoolSafety(propertyId, {
        waterFeatureKind: form.waterFeatureKind,
        isIndoor: form.isIndoor,
        isOutdoor: form.isOutdoor,
        minDepthMeters: form.minDepthMeters ? Number(form.minDepthMeters) : null,
        maxDepthMeters: form.maxDepthMeters ? Number(form.maxDepthMeters) : null,
        childrenAllowed: form.childrenAllowed,
        childrenRequireAdultSupervision: form.childrenRequireAdultSupervision,
        seasonality: form.seasonality,
        accessRestrictionsAr: form.accessRestrictionsAr || null,
        accessRestrictionsEn: form.accessRestrictionsEn || null,
        otherWarningsAr: form.otherWarningsAr || null,
        otherWarningsEn: form.otherWarningsEn || null,
      });
      setPkg(res.data as PoolPkg);
      setAttest(false);
    } catch (e) {
      setError(e instanceof OwnerApiError ? e.message : e instanceof Error ? e.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function onAttest(checked: boolean) {
    if (!checked) return;
    setSaving(true);
    setError(null);
    try {
      const res = await attestPropertyPoolSafety(propertyId);
      setPkg(res.data as PoolPkg);
      setAttest(true);
    } catch (e) {
      setAttest(false);
      setError(e instanceof OwnerApiError ? e.message : e instanceof Error ? e.message : t('attestError'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">{t('loading')}</p>;
  if (!pkg?.offersSwimmingPool && !pkg?.hasSwimmingPoolActivity) {
    return (
      <p className="mt-4 text-xs text-[#8A8490]" data-testid="pool-safety-not-applicable">
        {t('notRequired')}
      </p>
    );
  }

  return (
    <section
      className="mt-6 space-y-3 rounded-xl border border-[#D6E4F5] bg-[#F7FAFF] p-4"
      data-testid="property-pool-safety-panel"
    >
      <div>
        <h3 className="text-base font-semibold text-[#0D2046]">{t('title')}</h3>
        <p className="mt-1 text-sm text-[#5C6578]">{t('subtitle')}</p>
        <p className="mt-1 text-xs text-[#8A8490]">{t('notWarranty')}</p>
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {pkg.consistency && !pkg.consistency.includes('ok') ? (
        <ul className="list-disc ps-5 text-xs text-amber-800" data-testid="pool-consistency">
          {pkg.consistency.map((c) => (
            <li key={c}>{t(`consistency.${c}` as 'consistency.profile_incomplete')}</li>
          ))}
        </ul>
      ) : null}

      <label className="block text-sm">
        <span className="font-medium">{t('waterFeatureKind')}</span>
        <select
          className="mt-1 w-full rounded-md border border-[#D9D3C7] bg-white px-3 py-2"
          value={form.waterFeatureKind}
          onChange={(e) => setForm((f) => ({ ...f, waterFeatureKind: e.target.value }))}
          data-testid="pool-water-feature-kind"
        >
          {POOL_WATER_FEATURE_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`kind.${k}`)}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.isIndoor}
            onChange={(e) => setForm((f) => ({ ...f, isIndoor: e.target.checked }))}
          />
          {t('indoor')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.isOutdoor}
            onChange={(e) => setForm((f) => ({ ...f, isOutdoor: e.target.checked }))}
          />
          {t('outdoor')}
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">{t('minDepth')}</span>
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="15"
            className="mt-1 w-full rounded-md border border-[#D9D3C7] bg-white px-3 py-2"
            value={form.minDepthMeters}
            onChange={(e) => setForm((f) => ({ ...f, minDepthMeters: e.target.value }))}
            data-testid="pool-min-depth"
          />
          <span className="text-xs text-[#8A8490]">{t('depthOwnerProvided')}</span>
        </label>
        <label className="text-sm">
          <span className="font-medium">{t('maxDepth')}</span>
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="15"
            className="mt-1 w-full rounded-md border border-[#D9D3C7] bg-white px-3 py-2"
            value={form.maxDepthMeters}
            onChange={(e) => setForm((f) => ({ ...f, maxDepthMeters: e.target.value }))}
            data-testid="pool-max-depth"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.childrenAllowed}
          onChange={(e) => setForm((f) => ({ ...f, childrenAllowed: e.target.checked }))}
        />
        {t('childrenAllowed')}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.childrenRequireAdultSupervision}
          onChange={(e) =>
            setForm((f) => ({ ...f, childrenRequireAdultSupervision: e.target.checked }))
          }
          data-testid="pool-adult-supervision"
        />
        {t('adultSupervision')}
      </label>

      <label className="block text-sm">
        <span className="font-medium">{t('seasonality')}</span>
        <select
          className="mt-1 w-full rounded-md border border-[#D9D3C7] bg-white px-3 py-2"
          value={form.seasonality}
          onChange={(e) => setForm((f) => ({ ...f, seasonality: e.target.value }))}
        >
          {POOL_SEASONALITIES.map((s) => (
            <option key={s} value={s}>
              {t(`season.${s}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="font-medium">{t('accessAr')}</span>
        <textarea
          className="mt-1 w-full rounded-md border border-[#D9D3C7] bg-white px-3 py-2 text-sm"
          rows={2}
          value={form.accessRestrictionsAr}
          onChange={(e) => setForm((f) => ({ ...f, accessRestrictionsAr: e.target.value }))}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">{t('warningsAr')}</span>
        <textarea
          className="mt-1 w-full rounded-md border border-[#D9D3C7] bg-white px-3 py-2 text-sm"
          rows={2}
          value={form.otherWarningsAr}
          onChange={(e) => setForm((f) => ({ ...f, otherWarningsAr: e.target.value }))}
        />
      </label>

      <Button type="button" variant="secondary" disabled={saving} onClick={() => void save()}>
        {t('save')}
      </Button>

      <label className="flex items-start gap-2 text-sm text-[#0D2046]" data-testid="pool-safety-attestation">
        <input
          type="checkbox"
          className="mt-1"
          checked={attest}
          disabled={saving}
          onChange={(e) => void onAttest(e.target.checked)}
        />
        <span>
          {t('attestation')}
          <span className="mt-1 block text-xs text-[#8A8490]">
            {t('attestationVersion', { version: POOL_SAFETY_ATTESTATION_CORPUS_VERSION })}
          </span>
        </span>
      </label>
    </section>
  );
}
