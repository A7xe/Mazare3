'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { AdminOwnerRow, PatchAdminOwnerStatusInput } from '@mazare3/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchAdminOwners, patchAdminOwnerStatus } from '@/lib/api-admin';

export function AdminOwnersView() {
  const t = useTranslations('admin');
  const locale = useLocale() as 'ar' | 'en';
  const [owners, setOwners] = useState<AdminOwnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminOwners();
      setOwners(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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

  if (loading) {
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
      {owners.length === 0 ? (
        <Card className="glass-panel rounded-2xl border-primary/12">
          <CardContent className="py-16 text-center text-muted">{t('ownersEmpty')}</CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-primary/12 bg-surface shadow-card">
          <table className="w-full min-w-[900px] text-start text-sm">
            <thead>
              <tr className="border-b border-border bg-primary-soft/40 text-muted">
                <th className="px-4 py-3">{t('colOwner')}</th>
                <th className="px-4 py-3">{t('colEmail')}</th>
                <th className="px-4 py-3">{t('colArea')}</th>
                <th className="px-4 py-3">{t('colOwnerStatus')}</th>
                <th className="px-4 py-3">{t('colProperties')}</th>
                <th className="px-4 py-3">{t('colJoined')}</th>
                <th className="px-4 py-3">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {owners.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-border/60"
                  data-testid={`admin-owner-row-${o.status}`}
                >
                  <td className="px-4 py-3 font-medium text-navy">
                    {o.displayName}
                    {o.businessName ? (
                      <span className="mt-0.5 block text-xs text-muted">{o.businessName}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{o.email}</td>
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
                  <td className="px-4 py-3">{o.propertiesCount}</td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(o.createdAt).toLocaleDateString(
                      locale === 'ar' ? 'ar-JO' : 'en-GB',
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
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
