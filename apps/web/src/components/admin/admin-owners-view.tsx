'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { PatchAdminOwnerStatusInput } from '@mazare3/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/navigation';
import {
  fetchAdminPartners,
  patchAdminOwnerStatus,
  type AdminPartnerListRow,
} from '@/lib/api-admin';

const VERIFICATION_FILTERS = [
  '',
  'draft',
  'submitted',
  'under_review',
  'changes_requested',
  'approved',
  'rejected',
  'suspended',
  'legacy_approved',
] as const;

function verificationVariant(status: string) {
  if (status === 'approved' || status === 'legacy_approved') return 'highlight' as const;
  if (status === 'rejected' || status === 'suspended') return 'muted' as const;
  return 'default' as const;
}

export function AdminOwnersView() {
  const t = useTranslations('admin');
  const locale = useLocale() as 'ar' | 'en';
  const [owners, setOwners] = useState<AdminPartnerListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminPartners({
        verificationStatus: verificationStatus || undefined,
      });
      setOwners(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t, verificationStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(
    ownerId: string,
    status: PatchAdminOwnerStatusInput['status'],
    rejectionReason?: string,
  ) {
    setSavingId(ownerId);
    setError(null);
    try {
      await patchAdminOwnerStatus(ownerId, { status, rejectionReason });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setSavingId(null);
    }
  }

  const filtered = q.trim()
    ? owners.filter((o) =>
        `${o.displayName} ${o.businessName ?? ''} ${o.email ?? ''}`
          .toLowerCase()
          .includes(q.trim().toLowerCase()),
      )
    : owners;

  if (loading && owners.length === 0) {
    return (
      <div data-testid="admin-owners" className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div data-testid="admin-owners" className="space-y-4">
      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchOwners')}
          className="sm:max-w-xs"
        />
        <select
          aria-label={t('filterVerification')}
          value={verificationStatus}
          onChange={(e) => setVerificationStatus(e.target.value)}
          className="h-11 rounded-xl border border-border bg-surface px-3 text-sm"
        >
          {VERIFICATION_FILTERS.map((value) => (
            <option key={value || 'all'} value={value}>
              {value ? t(`partnerVerification.${value}`) : t('filterAll')}
            </option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <Card className="glass-panel rounded-2xl border-primary/12">
          <CardContent className="py-16 text-center text-muted">{t('ownersEmpty')}</CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-primary/12 bg-surface shadow-card">
          <table className="w-full min-w-[980px] text-start text-sm">
            <thead>
              <tr className="border-b border-border bg-primary-soft/40 text-muted">
                <th className="px-4 py-3">{t('colOwner')}</th>
                <th className="px-4 py-3">{t('colEmail')}</th>
                <th className="px-4 py-3">{t('colArea')}</th>
                <th className="px-4 py-3">{t('colOwnerStatus')}</th>
                <th className="px-4 py-3">{t('colVerificationStatus')}</th>
                <th className="px-4 py-3">{t('colProperties')}</th>
                <th className="px-4 py-3">{t('colJoined')}</th>
                <th className="px-4 py-3">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-border/60"
                  data-testid={`admin-owner-row-${o.status}`}
                >
                  <td className="px-4 py-3 font-medium text-navy">
                    <Link href={`/admin/owners/${o.id}`} className="hover:text-primary">
                      {o.displayName}
                    </Link>
                    {o.businessName ? (
                      <span className="mt-0.5 block text-xs text-muted">{o.businessName}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{o.email ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">
                    {o.city && o.area ? `${o.area} — ${o.city}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        o.status === 'approved'
                          ? 'highlight'
                          : o.status === 'pending'
                            ? 'default'
                            : 'muted'
                      }
                    >
                      {t(`ownerStatus.${o.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant={verificationVariant(o.verificationStatus)}>
                        {t(`partnerVerification.${o.verificationStatus}`)}
                      </Badge>
                      {o.legacyApproved ? (
                        <Badge variant="highlight">{t('legacyBadge')}</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">{o.propertiesCount}</td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(o.createdAt).toLocaleDateString(
                      locale === 'ar' ? 'ar-JO' : 'en-GB',
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/admin/owners/${o.id}`}>{t('viewPartner')}</Link>
                      </Button>
                      {o.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            className="shadow-soft"
                            disabled={savingId === o.id}
                            data-testid={`admin-owner-approve-${o.id}`}
                            onClick={() => void setStatus(o.id, 'approved')}
                          >
                            {t('approveOwner')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savingId === o.id}
                            onClick={() =>
                              void setStatus(o.id, 'rejected', t('defaultRejectReason'))
                            }
                          >
                            {t('rejectOwner')}
                          </Button>
                        </>
                      )}
                      {o.status === 'approved' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingId === o.id}
                          onClick={() => void setStatus(o.id, 'suspended')}
                        >
                          {t('suspendOwner')}
                        </Button>
                      )}
                      {(o.status === 'suspended' || o.status === 'rejected') && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingId === o.id}
                          onClick={() => void setStatus(o.id, 'approved')}
                        >
                          {t('reactivateOwner')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
