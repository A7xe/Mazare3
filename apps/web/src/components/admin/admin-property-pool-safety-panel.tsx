'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { fetchAdminPropertyPoolSafety, AdminApiError } from '@/lib/api-admin';

type AdminPoolData = {
  offersSwimmingPool?: boolean;
  consistency?: string[];
  attestation?: { attestedAt?: string | null; currentVersionAccepted?: boolean };
  profile?: Record<string, unknown> | null;
  poolRegulatoryRequirement?: {
    applicability?: string;
    complianceStatus?: string;
    reassessmentRequired?: boolean;
    reviewReason?: string | null;
    evidenceCount?: number;
  } | null;
  layers?: Record<string, string | null>;
  safetyDisclosures?: Array<{ category: string; descriptionAr: string }>;
};

export function AdminPropertyPoolSafetyPanel({ propertyId }: { propertyId: string }) {
  const t = useTranslations('admin.poolSafety');
  const [data, setData] = useState<AdminPoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchAdminPropertyPoolSafety(propertyId);
        if (!cancelled) setData(res.data as AdminPoolData);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof AdminApiError ? e.message : e instanceof Error ? e.message : t('loadError'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId, t]);

  if (loading) return <p className="text-sm text-muted">{t('loading')}</p>;

  return (
    <section
      className="mt-6 space-y-2 rounded-xl border border-[#C5D9F0] bg-[#F5F9FF] p-4"
      data-testid="admin-property-pool-safety"
    >
      <h3 className="text-base font-semibold text-[#0D2046]">{t('title')}</h3>
      <p className="text-xs text-[#5C6578]">{t('subtitle')}</p>
      <p className="text-xs text-[#8A8490]">{t('notWarranty')}</p>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {data?.layers ? (
        <dl className="grid gap-1 text-xs text-[#5C6578] sm:grid-cols-2">
          <div>
            {t('layerDisclosure')}: {data.layers.poolSafetyDisclosure ?? '—'}
          </div>
          <div>
            {t('layerRegulatory')}: {data.layers.poolRegulatory ?? '—'}
          </div>
          <div>
            {t('layerPlatform')}: {data.layers.platformVerification ?? '—'}
          </div>
        </dl>
      ) : null}

      {data?.consistency && !data.consistency.includes('ok') ? (
        <p className="text-xs text-amber-800" data-testid="admin-pool-consistency">
          {t('consistency')}: {data.consistency.join(', ')}
        </p>
      ) : null}

      {data?.poolRegulatoryRequirement ? (
        <p className="text-sm text-[#0D2046]" data-testid="admin-pool-regulatory">
          {t('poolRequirement')}: {data.poolRegulatoryRequirement.applicability}/
          {data.poolRegulatoryRequirement.complianceStatus}
          {data.poolRegulatoryRequirement.reassessmentRequired ? ` · ${t('reassessment')}` : ''}
          {` · ${t('evidence')}: ${data.poolRegulatoryRequirement.evidenceCount ?? 0}`}
        </p>
      ) : (
        <p className="text-sm text-[#5C6578]">{t('noPoolRequirement')}</p>
      )}

      {data?.attestation ? (
        <p className="text-xs text-[#5C6578]">
          {t('attestation')}:{' '}
          {data.attestation.currentVersionAccepted ? t('attested') : t('notAttested')}
        </p>
      ) : null}

      {data?.profile ? (
        <pre className="overflow-auto rounded-md bg-white p-2 text-xs text-[#0D2046]">
          {JSON.stringify(data.profile, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
