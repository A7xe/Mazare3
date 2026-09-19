'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PROPERTY_ACTIVITY_CODES } from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import {
  fetchPropertyRegulatory,
  putPropertyActivities,
  uploadRegulatoryEvidenceFile,
  OwnerApiError,
} from '@/lib/api-owner';

type ReqPkg = {
  readiness?: string;
  blockingReasons?: string[];
  activities?: Array<{ activityCode: string; otherDescription?: string | null; active?: boolean }>;
  bookability?: {
    canBook?: boolean;
    canPublish?: boolean;
    blockers?: string[];
  };
  requirements?: Array<{
    id: string;
    requirementType: string;
    applicability: string;
    complianceStatus: string;
    reviewReason?: string | null;
    expiresAt?: string | null;
    evidenceExpiringSoon?: boolean;
    evidenceExpired?: boolean;
    evidence?: Array<{ id: string; originalFileName: string; expiresAt?: string | null }>;
  }>;
};

export function PropertyRegulatoryPanel({ propertyId }: { propertyId: string }) {
  const t = useTranslations('addFarm.regulatory');
  const [pkg, setPkg] = useState<ReqPkg | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [otherDesc, setOtherDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPropertyRegulatory(propertyId);
      const data = res.data as ReqPkg;
      setPkg(data);
      setSelected((data.activities ?? []).map((a) => a.activityCode));
      setOtherDesc(
        data.activities?.find((a) => a.activityCode === 'other')?.otherDescription ?? '',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [propertyId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveActivities() {
    setSaving(true);
    setError(null);
    try {
      const activities = selected.map((activityCode) => ({
        activityCode,
        otherDescription: activityCode === 'other' ? otherDesc : null,
        active: true,
      }));
      const res = await putPropertyActivities(propertyId, activities);
      setPkg(res.data as ReqPkg);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function onUpload(requirementId: string, file: File | null) {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const res = await uploadRegulatoryEvidenceFile(propertyId, requirementId, file);
      setPkg(res.data as ReqPkg);
    } catch (e) {
      setError(
        e instanceof OwnerApiError ? e.message : e instanceof Error ? e.message : t('uploadError'),
      );
    } finally {
      setSaving(false);
    }
  }

  function toggle(code: string) {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  if (loading) return <p className="text-sm text-muted">{t('loading')}</p>;

  return (
    <section
      className="mt-6 space-y-4 rounded-xl border border-[#D6E4F5] bg-[#F7FAFF] p-4"
      data-testid="property-regulatory-panel"
    >
      <div>
        <h3 className="text-base font-semibold text-[#0D2046]">{t('title')}</h3>
        <p className="mt-1 text-sm text-[#5C6578]">{t('subtitle')}</p>
        <p className="mt-1 text-xs text-[#8A8490]">{t('notLicence')}</p>
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <p className="text-sm font-medium text-[#0D2046]">{t('activities')}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {PROPERTY_ACTIVITY_CODES.map((code) => (
            <label key={code} className="flex items-center gap-2 text-sm text-[#0D2046]">
              <input
                type="checkbox"
                checked={selected.includes(code)}
                onChange={() => toggle(code)}
                data-testid={`activity-${code}`}
              />
              {t(`activity.${code}`)}
            </label>
          ))}
        </div>
        {selected.includes('other') ? (
          <input
            className="mt-2 w-full rounded-md border border-[#D9D3C7] bg-white px-3 py-2 text-sm"
            value={otherDesc}
            onChange={(e) => setOtherDesc(e.target.value)}
            placeholder={t('otherPlaceholder')}
          />
        ) : null}
        <Button
          type="button"
          className="mt-3"
          variant="secondary"
          disabled={saving || selected.length === 0}
          onClick={() => void saveActivities()}
        >
          {t('saveActivities')}
        </Button>
      </div>

      <div data-testid="regulatory-readiness">
        <p className="text-sm font-medium text-[#0D2046]">
          {t('readiness')}: {pkg?.readiness ? t(`readinessValue.${pkg.readiness}`) : '—'}
        </p>
        <p className="text-xs text-[#8A8490]">{t('readinessHint')}</p>
        {pkg?.bookability?.blockers?.length ? (
          <ul className="mt-2 list-disc ps-5 text-xs text-amber-800" data-testid="owner-bookability-blockers">
            {pkg.bookability.blockers.map((b) => {
              const key = `blocker.${b}` as Parameters<typeof t>[0];
              let label = b;
              try {
                label = t(key);
              } catch {
                label = b;
              }
              return <li key={b}>{label}</li>;
            })}
          </ul>
        ) : null}
      </div>

      <ul className="space-y-3">
        {(pkg?.requirements ?? []).map((r) => (
          <li
            key={r.id}
            className="rounded-lg border border-[#E5EAF1] bg-white p-3 text-sm"
            data-testid={`regulatory-req-${r.requirementType}`}
          >
            <p className="font-medium text-[#0D2046]">{t(`requirement.${r.requirementType}`)}</p>
            <p className="text-xs text-[#5C6578]">
              {t('applicability')}: {t(`applicabilityValue.${r.applicability}`)} · {t('status')}:{' '}
              {t(`complianceValue.${r.complianceStatus}`)}
            </p>
            {r.reviewReason ? <p className="mt-1 text-xs text-amber-800">{r.reviewReason}</p> : null}
            {r.evidenceExpired ? (
              <p className="text-xs text-danger">{t('expired')}</p>
            ) : r.evidenceExpiringSoon ? (
              <p className="text-xs text-amber-700">{t('expiringSoon')}</p>
            ) : null}
            <ul className="mt-1 text-xs text-[#5C6578]">
              {(r.evidence ?? []).map((e) => (
                <li key={e.id}>
                  {e.originalFileName}
                  {e.expiresAt ? ` · ${t('expiresOn')} ${e.expiresAt.slice(0, 10)}` : ''}
                </li>
              ))}
            </ul>
            <input
              type="file"
              className="mt-2 block text-xs"
              accept=".pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => void onUpload(r.id, e.target.files?.[0] ?? null)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
