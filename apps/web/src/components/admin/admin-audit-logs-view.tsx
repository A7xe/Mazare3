'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { AdminAuditLogRow } from '@mazare3/shared';
import { Card, CardContent } from '@/components/ui/card';
import { fetchAdminAuditLogs } from '@/lib/api-admin';

export function AdminAuditLogsView() {
  const t = useTranslations('admin');
  const locale = useLocale() as 'ar' | 'en';
  const [logs, setLogs] = useState<AdminAuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchAdminAuditLogs(150);
        setLogs(res.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) {
    return (
      <div data-testid="admin-audit-logs" className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">{error}</p>
    );
  }

  if (logs.length === 0) {
    return (
      <Card className="glass-panel rounded-2xl border-primary/12">
        <CardContent className="py-16 text-center text-muted">{t('auditEmpty')}</CardContent>
      </Card>
    );
  }

  return (
    <div data-testid="admin-audit-logs" className="overflow-x-auto rounded-2xl border border-primary/12 bg-surface shadow-card">
      <table className="w-full min-w-[800px] text-start text-sm">
        <thead>
          <tr className="border-b border-border bg-primary-soft/40 text-muted">
            <th className="px-4 py-3">{t('auditAction')}</th>
            <th className="px-4 py-3">{t('auditActor')}</th>
            <th className="px-4 py-3">{t('auditEntity')}</th>
            <th className="px-4 py-3">{t('auditDate')}</th>
            <th className="px-4 py-3">{t('auditMeta')}</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-border/60 align-top">
              <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
              <td className="px-4 py-3">
                {log.actorName ?? log.actorEmail ?? '—'}
              </td>
              <td className="px-4 py-3 text-xs text-muted">
                {log.entityType ?? '—'}
                {log.entityId ? (
                  <span className="mt-0.5 block font-mono">{log.entityId.slice(0, 8)}…</span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-muted">
                {new Date(log.createdAt).toLocaleString(locale === 'ar' ? 'ar-JO' : 'en-GB')}
              </td>
              <td className="max-w-xs px-4 py-3">
                {log.metadata ? (
                  <pre className="whitespace-pre-wrap break-words text-xs text-muted">
                    {JSON.stringify(log.metadata, null, 0)}
                  </pre>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
