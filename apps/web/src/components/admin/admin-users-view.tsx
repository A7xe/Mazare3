'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { AdminUserRow } from '@mazare3/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AdminApiError, fetchAdminUsers, patchAdminUserStatus } from '@/lib/api-admin';

export function AdminUsersView() {
  const t = useTranslations('admin');
  const locale = useLocale() as 'ar' | 'en';
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminUsers();
      setUsers(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleStatus(user: AdminUserRow) {
    const next = user.status === 'active' ? 'suspended' : 'active';
    setSavingId(user.id);
    setError(null);
    try {
      await patchAdminUserStatus(user.id, { status: next });
      await load();
    } catch (e) {
      if (e instanceof AdminApiError && e.code === 'LAST_ADMIN') {
        setError(t('lastAdminError'));
      } else {
        setError(e instanceof Error ? e.message : t('saveError'));
      }
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div data-testid="admin-users" className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div data-testid="admin-users" className="space-y-4">
      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">{error}</p>
      )}
      {users.length === 0 ? (
        <Card className="glass-panel rounded-2xl border-primary/12">
          <CardContent className="py-16 text-center text-muted">{t('usersEmpty')}</CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-primary/12 bg-surface shadow-card">
          <table className="w-full min-w-[640px] text-start text-sm">
            <thead>
              <tr className="border-b border-border bg-primary-soft/40 text-muted">
                <th className="px-4 py-3">{t('colName')}</th>
                <th className="px-4 py-3">{t('colEmail')}</th>
                <th className="px-4 py-3">{t('colRole')}</th>
                <th className="px-4 py-3">{t('colStatus')}</th>
                <th className="px-4 py-3">{t('colCreated')}</th>
                <th className="px-4 py-3">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium text-navy">{u.name ?? '—'}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{t(`role.${u.role}`)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.status === 'active' ? 'highlight' : 'muted'}>
                      {t(`userStatus.${u.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(u.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-JO' : 'en-GB')}
                  </td>
                  <td className="px-4 py-3">
                    {u.role !== 'admin' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={savingId === u.id}
                        onClick={() => void toggleStatus(u)}
                      >
                        {u.status === 'active' ? t('suspend') : t('activate')}
                      </Button>
                    )}
                    {u.role === 'admin' && u.status === 'active' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={savingId === u.id}
                        onClick={() => void toggleStatus(u)}
                      >
                        {t('suspend')}
                      </Button>
                    )}
                    {u.role === 'admin' && u.status !== 'active' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={savingId === u.id}
                        onClick={() => void toggleStatus(u)}
                      >
                        {t('activate')}
                      </Button>
                    )}
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
