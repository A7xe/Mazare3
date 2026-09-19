'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  bootstrapAdminPropertyActivities,
  decideAdminRegulatoryRequirement,
  fetchAdminPropertyRegulatory,
  AdminApiError,
} from '@/lib/api-admin';
import { getApiBaseUrl } from '@/lib/api';

type AdminRegData = {
  layers?: Record<string, string | boolean | null>;
  readiness?: {
    readiness?: string;
    activities?: Array<{ activityCode: string }>;
    requirements?: Array<{
      id: string;
      requirementType: string;
      applicability: string;
      complianceStatus: string;
      evidence?: Array<{ id: string; originalFileName: string }>;
    }>;
    blockingReasons?: string[];
  };
  bookability?: {
    publication?: { eligible?: boolean; blockers?: string[] };
    newBooking?: { eligible?: boolean; blockers?: string[] };
    regulatoryAffectsExistingBookings?: {
      signal?: string;
      futureConfirmedCount?: number;
      bookings?: Array<{ id: string; bookingStartAt: string }>;
    } | null;
  };
  decisionEvents?: Array<{
    id: string;
    newApplicability: string;
    newComplianceStatus: string;
    reasonText?: string | null;
    createdAt: string;
  }>;
};

export function AdminPropertyRegulatoryPanel({ propertyId }: { propertyId: string }) {
  const t = useTranslations('admin.regulatory');
  const [data, setData] = useState<AdminRegData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [selectedReq, setSelectedReq] = useState<string>('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminPropertyRegulatory(propertyId);
      setData(res.data as AdminRegData);
      const first = (res.data as AdminRegData).readiness?.requirements?.[0]?.id;
      if (first) setSelectedReq(first);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [propertyId]);

  async function decide(input: Record<string, unknown>) {
    if (!selectedReq) return;
    setSaving(true);
    setError(null);
    try {
      const res = await decideAdminRegulatoryRequirement(propertyId, selectedReq, {
        ...input,
        reasonText: reason.trim() || undefined,
        reasonCategory: String(input.reasonCategory ?? 'admin_decision'),
      });
      setData(res.data as AdminRegData);
      setReason('');
    } catch (e) {
      setError(
        e instanceof AdminApiError ? e.message : e instanceof Error ? e.message : t('saveError'),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">{t('loading')}</p>;

  return (
    <section
      className="mt-6 space-y-3 rounded-xl border border-[#BFD7F2] bg-[#F3F8FF] p-4"
      data-testid="admin-property-regulatory"
    >
      <div>
        <h3 className="text-base font-semibold text-[#0D2046]">{t('title')}</h3>
        <p className="text-xs text-[#5C6578]">{t('subtitle')}</p>
      </div>

      {data?.layers ? (
        <dl className="grid gap-1 text-xs text-[#5C6578] sm:grid-cols-2">
          <div>
            {t('layerKyc')}: {data.layers.kyc ?? '—'}
          </div>
          <div>
            {t('layerAuthority')}: {data.layers.authority ?? '—'}
          </div>
          <div>
            {t('layerRegulatory')}: {data.layers.regulatoryReadiness ?? '—'}
          </div>
          <div>
            {t('layerPlatform')}: {data.layers.platformVerification ?? '—'} ({t('notFifteen')})
          </div>
        </dl>
      ) : null}

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <p className="text-sm text-[#0D2046]" data-testid="admin-regulatory-readiness">
        {t('readiness')}: {data?.readiness?.readiness ?? '—'}
      </p>

      {data?.bookability ? (
        <div className="space-y-1 text-sm text-[#0D2046]" data-testid="admin-bookability">
          <p>
            {t('publicationEligible')}:{' '}
            {data.bookability.publication?.eligible ? t('yes') : t('no')}
            {data.bookability.publication?.blockers?.length
              ? ` (${data.bookability.publication.blockers.join(', ')})`
              : ''}
          </p>
          <p>
            {t('newBookingEligible')}:{' '}
            {data.bookability.newBooking?.eligible ? t('yes') : t('no')}
            {data.bookability.newBooking?.blockers?.length
              ? ` (${data.bookability.newBooking.blockers.join(', ')})`
              : ''}
          </p>
          {data.bookability.regulatoryAffectsExistingBookings ? (
            <p className="text-amber-800" data-testid="admin-regulatory-existing-bookings">
              {t('affectsExistingBookings')}:{' '}
              {data.bookability.regulatoryAffectsExistingBookings.futureConfirmedCount ?? 0}{' '}
              ({data.bookability.regulatoryAffectsExistingBookings.signal})
            </p>
          ) : null}
        </div>
      ) : null}

      <Button
        type="button"
        variant="secondary"
        disabled={saving}
        onClick={() => void bootstrapAdminPropertyActivities(propertyId).then(() => load())}
      >
        {t('bootstrapActivities')}
      </Button>

      <label className="block text-sm">
        <span className="font-medium">{t('selectRequirement')}</span>
        <select
          className="mt-1 w-full rounded-md border border-[#D9D3C7] bg-white px-3 py-2"
          value={selectedReq}
          onChange={(e) => setSelectedReq(e.target.value)}
        >
          {(data?.readiness?.requirements ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.requirementType} · {r.applicability}/{r.complianceStatus}
            </option>
          ))}
        </select>
      </label>

      <ul className="text-xs text-[#5C6578]">
        {(data?.readiness?.requirements ?? []).map((r) => (
          <li key={r.id} className="mb-2">
            <strong>{r.requirementType}</strong>
            <ul>
              {(r.evidence ?? []).map((e) => (
                <li key={e.id}>
                  <a
                    className="text-[#2F6EF6] underline"
                    href={`${getApiBaseUrl()}/admin/properties/${propertyId}/regulatory/evidence/${e.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {e.originalFileName}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <textarea
        className="w-full rounded-md border border-[#D9D3C7] bg-white px-3 py-2 text-sm"
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('reasonPlaceholder')}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={saving || !selectedReq}
          onClick={() => void decide({ applicability: 'applicable', complianceStatus: 'verified' })}
        >
          {t('verify')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={saving || !selectedReq}
          onClick={() => void decide({ applicability: 'not_applicable_confirmed' })}
        >
          {t('markNa')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={saving || !selectedReq}
          onClick={() =>
            void decide({
              applicability: 'regulatory_confirmation_required',
              reasonCategory: 'counsel_hold',
            })
          }
        >
          {t('counselHold')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={saving || !selectedReq}
          onClick={() => void decide({ complianceStatus: 'action_required' })}
        >
          {t('requestAction')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving || !selectedReq}
          onClick={() => void decide({ complianceStatus: 'rejected' })}
        >
          {t('reject')}
        </Button>
      </div>
    </section>
  );
}
