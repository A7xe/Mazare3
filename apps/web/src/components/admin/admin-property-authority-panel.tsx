'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  decideAdminPropertyAuthority,
  fetchAdminPropertyAuthority,
  AdminApiError,
} from '@/lib/api-admin';
import { getApiBaseUrl } from '@/lib/api';

type AuthorityData = {
  accountHolder?: {
    email?: string | null;
    name?: string | null;
    displayName?: string;
    accountHolderRelation?: string | null;
    partnerKycStatus?: string | null;
  };
  contractingOperator?: { legalName?: string; entityKind?: string } | null;
  declaredPropertyOwnerRelation?: string | null;
  declaredPropertyOwner?: { legalName?: string } | null;
  authorityBasis?: string | null;
  authorityReviewStatus?: string;
  authorityReviewReason?: string | null;
  authorityAttestedAt?: string | null;
  platformVerificationStatus?: string;
  evidence?: Array<{
    id: string;
    documentType: string;
    originalFileName: string;
  }>;
  reviewEvents?: Array<{
    id: string;
    previousStatus: string;
    newStatus: string;
    reasonText?: string | null;
    createdAt: string;
  }>;
};

export function AdminPropertyAuthorityPanel({ propertyId }: { propertyId: string }) {
  const t = useTranslations('admin.authority');
  const [data, setData] = useState<AuthorityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminPropertyAuthority(propertyId);
      setData(res.data as AuthorityData);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [propertyId]);

  async function decide(decision: 'approve' | 'request_changes' | 'reject') {
    setSaving(true);
    setError(null);
    try {
      const res = await decideAdminPropertyAuthority(propertyId, {
        decision,
        reasonCategory: decision,
        reasonText: reason.trim() || undefined,
      });
      setData(res.data as AuthorityData);
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
      className="mt-6 space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4"
      data-testid="admin-property-authority"
    >
      <div>
        <h3 className="text-base font-semibold text-[#0D2046]">{t('title')}</h3>
        <p className="text-xs text-[#5C6578]">{t('subtitle')}</p>
      </div>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {data ? (
        <dl className="grid gap-2 text-sm text-[#0D2046] sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[#8A8490]">{t('accountHolder')}</dt>
            <dd>
              {data.accountHolder?.displayName || data.accountHolder?.name || '—'}
              <span className="block text-xs text-[#5C6578]">
                {data.accountHolder?.email} · KYC: {data.accountHolder?.partnerKycStatus ?? '—'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#8A8490]">{t('contractingOperator')}</dt>
            <dd>
              {data.contractingOperator?.legalName ?? '—'} ({data.contractingOperator?.entityKind ?? '—'})
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#8A8490]">{t('declaredOwner')}</dt>
            <dd>
              {data.declaredPropertyOwnerRelation ?? '—'}
              {data.declaredPropertyOwner?.legalName
                ? ` · ${data.declaredPropertyOwner.legalName}`
                : ''}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#8A8490]">{t('basis')}</dt>
            <dd>{data.authorityBasis ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#8A8490]">{t('authorityStatus')}</dt>
            <dd data-testid="admin-authority-status">{data.authorityReviewStatus ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#8A8490]">{t('platformVerification')}</dt>
            <dd>{data.platformVerificationStatus ?? '—'} ({t('notLinkedToCommission')})</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-[#8A8490]">{t('evidence')}</dt>
            <dd>
              <ul className="mt-1 space-y-1">
                {(data.evidence ?? []).map((d) => (
                  <li key={d.id}>
                    <a
                      className="text-[#2F6EF6] underline"
                      href={`${getApiBaseUrl()}/admin/properties/${propertyId}/authority/documents/${d.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {d.documentType}: {d.originalFileName}
                    </a>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      ) : null}

      <textarea
        className="w-full rounded-md border border-[#D9D3C7] bg-white px-3 py-2 text-sm"
        rows={2}
        placeholder={t('reasonPlaceholder')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={saving} onClick={() => void decide('approve')}>
          {t('approve')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={saving}
          onClick={() => void decide('request_changes')}
        >
          {t('requestChanges')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => void decide('reject')}
        >
          {t('reject')}
        </Button>
      </div>
      {data?.reviewEvents?.length ? (
        <ul className="text-xs text-[#5C6578]">
          {data.reviewEvents.slice(0, 5).map((e) => (
            <li key={e.id}>
              {e.createdAt}: {e.previousStatus} → {e.newStatus}
              {e.reasonText ? ` — ${e.reasonText}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
