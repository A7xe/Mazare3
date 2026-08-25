'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AdminSupportTicketRow, SupportTicketSource, SupportTicketStatus } from '@mazare3/shared';
import { SUPPORT_TICKET_SOURCES, SUPPORT_TICKET_STATUSES } from '@mazare3/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchAdminSupportTickets, patchAdminSupportTicket } from '@/lib/api-admin';

export function AdminSupportView() {
  const t = useTranslations('admin');
  const tSupport = useTranslations('support');
  const tBookings = useTranslations('bookings');
  const [rows, setRows] = useState<AdminSupportTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [responseDraft, setResponseDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminSupportTickets({
        status: statusFilter || undefined,
        source: sourceFilter || undefined,
      });
      setRows(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(id: string, status?: SupportTicketStatus) {
    setBusy(id);
    setError(null);
    try {
      const adminResponse = responseDraft[id]?.trim();
      await patchAdminSupportTicket(id, {
        ...(status ? { status } : {}),
        ...(adminResponse ? { adminResponse } : {}),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setBusy(null);
    }
  }

  if (loading && rows.length === 0) {
    return (
      <div data-testid="admin-support" className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div data-testid="admin-support" className="space-y-4">
      <p className="text-sm text-muted">{t('supportSubtitle')}</p>
      <div className="flex flex-wrap gap-2">
        <select
          data-testid="admin-support-filter-status"
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{t('supportFilterAllStatus')}</option>
          {SUPPORT_TICKET_STATUSES.map((status) => (
            <option key={status} value={status}>
              {tSupport(`status.${status}`)}
            </option>
          ))}
        </select>
        <select
          data-testid="admin-support-filter-source"
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as SupportTicketSource | '')}
        >
          <option value="">{t('supportFilterAllSource')}</option>
          {SUPPORT_TICKET_SOURCES.map((source) => (
            <option key={source} value={source}>
              {tSupport(`source.${source}`)}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">{error}</p>
      ) : null}
      {rows.length === 0 ? (
        <Card className="glass-panel rounded-2xl border-primary/12">
          <CardContent className="py-16 text-center text-muted">{t('supportEmpty')}</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const expanded = openId === row.id;
            const contactName = row.customerName ?? row.guestName;
            const contactEmail = row.customerEmail ?? row.guestEmail;
            return (
              <Card
                key={row.id}
                className="glass-panel rounded-2xl border-primary/12"
                data-testid={`admin-support-row-${row.publicCode}`}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <button
                      type="button"
                      className="text-start"
                      data-testid={`admin-support-open-${row.id}`}
                      onClick={() => setOpenId(expanded ? null : row.id)}
                    >
                      <p className="font-mono font-semibold text-navy">{row.publicCode}</p>
                      <p className="text-sm text-navy">{row.subject}</p>
                      <p className="text-xs text-muted">
                        {contactName ?? tSupport('anonymous')} · {contactEmail ?? '—'} · {tSupport(`source.${row.source}`)}
                      </p>
                    </button>
                    <Badge variant="highlight">{tSupport(`status.${row.status}`)}</Badge>
                  </div>
                  {expanded ? (
                    <div className="space-y-3" data-testid={`admin-support-detail-${row.id}`}>
                      <p className="text-sm text-muted">{row.message}</p>
                      <p className="text-xs text-muted">{tSupport(`category.${row.category}`)}</p>
                      {row.bookingPublicCode ? (
                        <p className="text-sm">
                          {tSupport('bookingRef')}:{' '}
                          <Link
                            href="/admin/bookings"
                            className="font-medium text-primary hover:underline"
                            data-testid={`admin-support-booking-link-${row.id}`}
                          >
                            {row.bookingPublicCode}
                          </Link>
                          {row.bookingStatus || row.bookingPaymentState ? (
                            <span className="ms-2 text-xs text-muted">
                              {[
                                row.bookingStatus
                                  ? t(`bookingStatus.${row.bookingStatus}`)
                                  : null,
                                row.bookingPaymentState
                                  ? tBookings(`paymentState.${row.bookingPaymentState}`)
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                      <p className="rounded-lg border border-primary/15 bg-primary-soft/40 px-3 py-2 text-xs text-muted">
                        {t('supportFinancialNote')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Link href="/admin/payments" className="text-sm font-medium text-primary hover:underline">
                          {t('nav.payments')}
                        </Link>
                        <Link href="/admin/refunds" className="text-sm font-medium text-primary hover:underline">
                          {t('nav.refunds')}
                        </Link>
                      </div>
                      <textarea
                        data-testid={`admin-support-response-${row.id}`}
                        className="min-h-24 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                        placeholder={t('supportResponsePlaceholder')}
                        value={responseDraft[row.id] ?? row.adminResponse ?? ''}
                        onChange={(e) =>
                          setResponseDraft((current) => ({ ...current, [row.id]: e.target.value }))
                        }
                      />
                      <div className="flex flex-wrap gap-2">
                        {row.status === 'open' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === row.id}
                            onClick={() => void save(row.id, 'in_progress')}
                          >
                            {t('supportMarkInProgress')}
                          </Button>
                        ) : null}
                        {row.status !== 'resolved' && row.status !== 'closed' ? (
                          <Button
                            size="sm"
                            data-testid={`admin-support-resolve-${row.id}`}
                            disabled={busy === row.id}
                            onClick={() => void save(row.id, 'resolved')}
                          >
                            {t('supportMarkResolved')}
                          </Button>
                        ) : null}
                        {row.status !== 'closed' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === row.id}
                            onClick={() => void save(row.id, 'closed')}
                          >
                            {t('supportMarkClosed')}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`admin-support-save-${row.id}`}
                          disabled={busy === row.id}
                          onClick={() => void save(row.id)}
                        >
                          {t('supportSendResponse')}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
