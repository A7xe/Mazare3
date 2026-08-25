'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { SupportTicketSummary } from '@mazare3/shared';
import { fetchMySupportTickets } from '@/lib/api-operations';
import { getMe } from '@/lib/api-auth';
import { useRouter } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AccountSubnav } from '@/components/account/account-subnav';

export function MySupportView() {
  const t = useTranslations('support');
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await getMe();
      const res = await fetchMySupportTickets();
      setTickets(res.data);
    } catch {
      router.push('/login?returnUrl=' + encodeURIComponent('/account/support'));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div data-testid="my-support" className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div data-testid="my-support">
      <AccountSubnav />
      <h1 className="text-2xl font-bold text-navy">{t('myTitle')}</h1>
      <p className="mt-1 text-sm text-muted">{t('mySubtitle')}</p>
      {tickets.length === 0 ? (
        <Card className="mt-6 glass-panel rounded-2xl border-primary/12">
          <CardContent className="py-16 text-center text-muted">{t('empty')}</CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {tickets.map((ticket) => (
            <Card
              key={ticket.id}
              className="glass-panel rounded-2xl border-primary/12"
              data-testid={`my-support-ticket-${ticket.id}`}
            >
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-semibold text-navy" data-testid={`my-support-ref-${ticket.id}`}>
                      {ticket.publicCode}
                    </p>
                    <p className="text-sm text-navy">{ticket.subject}</p>
                    {ticket.bookingPublicCode ? (
                      <p className="text-xs text-muted">
                        {t('bookingRef')}: {ticket.bookingPublicCode}
                      </p>
                    ) : (
                      <p className="text-xs text-muted">{t('source.general')}</p>
                    )}
                  </div>
                  <Badge variant="highlight">{t(`status.${ticket.status}`)}</Badge>
                </div>
                <p className="text-sm text-muted">{ticket.message}</p>
                {ticket.adminResponse ? (
                  <p className="rounded-lg bg-primary-soft/50 px-3 py-2 text-sm text-navy" data-testid={`my-support-reply-${ticket.id}`}>
                    {t('responseLabel')}: {ticket.adminResponse}
                  </p>
                ) : (
                  <p className="text-xs text-muted">{t('awaitingReply')}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
