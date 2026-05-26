'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { AdminDisputeRow, DisputeStatus } from '@mazare3/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchAdminDisputes, patchAdminDispute } from '@/lib/api-admin';

export function AdminDisputesView() {
  const t = useTranslations('admin');
  const [rows, setRows] = useState<AdminDisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminDisputes();
      setRows(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, status: DisputeStatus) {
    setBusy(id);
    try {
      await patchAdminDispute(id, {
        status,
        adminNote: notes[id]?.trim() || undefined,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div data-testid="admin-disputes" className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div data-testid="admin-disputes" className="space-y-4">
      <p className="text-sm text-muted">{t('disputesSubtitle')}</p>
      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">{error}</p>
      )}
      {rows.length === 0 ? (
        <Card className="glass-panel rounded-2xl border-primary/12">
          <CardContent className="py-16 text-center text-muted">{t('disputesEmpty')}</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((d) => (
            <Card key={d.id} className="glass-panel rounded-2xl border-primary/12">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-mono font-semibold text-navy">{d.publicCode}</p>
                    <p className="text-sm text-muted">
                      {d.customerEmail} · {d.ownerDisplayName}
                    </p>
                  </div>
                  <Badge variant="highlight">{t(`disputeStatus.${d.status}`)}</Badge>
                </div>
                <p className="text-sm">
                  <span className="font-medium text-navy">{t(`disputeType.${d.type}`)}</span>
                </p>
                <p className="text-sm text-muted">{d.description}</p>
                <Input
                  placeholder={t('adminNotePlaceholder')}
                  value={notes[d.id] ?? d.adminNote ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [d.id]: e.target.value }))}
                />
                {(d.status === 'open' || d.status === 'under_review') && (
                  <div className="flex flex-wrap gap-2">
                    {d.status === 'open' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === d.id}
                        onClick={() => void updateStatus(d.id, 'under_review')}
                      >
                        {t('disputeUnderReview')}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      data-testid={`dispute-resolve-${d.id}`}
                      disabled={busy === d.id}
                      onClick={() => void updateStatus(d.id, 'resolved')}
                    >
                      {t('disputeResolve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === d.id}
                      onClick={() => void updateStatus(d.id, 'rejected')}
                    >
                      {t('disputeReject')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
