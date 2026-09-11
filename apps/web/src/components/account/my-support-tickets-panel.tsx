'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { SupportTicketSummary } from '@mazare3/shared';
import { fetchMySupportTickets } from '@/lib/api-operations';
import { getMe } from '@/lib/api-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/** Signed-in ticket inbox shown under the Help Center knowledge UI. */
export function MySupportTicketsPanel() {
  const t = useTranslations('support');
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await getMe();
      setAuthed(true);
      const res = await fetchMySupportTickets();
      setTickets(res.data);
    } catch {
      setAuthed(false);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div data-testid="my-support" className="flex justify-center py-10">
        <Loader2 className="h-7 w-7 animate-spin text-[#2F6EF6]" />
      </div>
    );
  }

  if (!authed) {
    return <div data-testid="my-support" className="sr-only" aria-hidden />;
  }

  return (
    <section data-testid="my-support" className="space-y-3">
      <div>
        <h3 className="text-base font-bold text-[#0D2046]">{t('myTitle')}</h3>
        <p className="mt-1 text-[13px] text-[#7A879B]">{t('mySubtitle')}</p>
      </div>
      {tickets.length === 0 ? (
        <Card className="rounded-2xl border-[#E8EEF6] bg-white shadow-[0_2px_10px_rgba(35,72,120,.03)]">
          <CardContent className="py-10 text-center text-sm text-[#7A879B]">{t('empty')}</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card
              key={ticket.id}
              className="rounded-2xl border-[#E8EEF6] bg-white shadow-[0_2px_10px_rgba(35,72,120,.03)]"
              data-testid={`my-support-ticket-${ticket.id}`}
            >
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p
                      className="font-mono font-semibold text-[#0D2046]"
                      data-testid={`my-support-ref-${ticket.id}`}
                    >
                      {ticket.publicCode}
                    </p>
                    <p className="text-sm text-[#0D2046]">{ticket.subject}</p>
                    {ticket.bookingPublicCode ? (
                      <p className="text-xs text-[#7A879B]">
                        {t('bookingRef')}: {ticket.bookingPublicCode}
                      </p>
                    ) : (
                      <p className="text-xs text-[#7A879B]">{t('source.general')}</p>
                    )}
                  </div>
                  <Badge variant="highlight">{t(`status.${ticket.status}`)}</Badge>
                </div>
                <p className="text-sm text-[#7A879B]">{ticket.message}</p>
                {ticket.adminResponse ? (
                  <p
                    className="rounded-lg bg-[#EAF2FF] px-3 py-2 text-sm text-[#0D2046]"
                    data-testid={`my-support-reply-${ticket.id}`}
                  >
                    {t('responseLabel')}: {ticket.adminResponse}
                  </p>
                ) : (
                  <p className="text-xs text-[#7A879B]">{t('awaitingReply')}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
