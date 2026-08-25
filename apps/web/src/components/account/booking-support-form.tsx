'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Headphones } from 'lucide-react';
import type { SupportTicketCategory, SupportTicketSummary } from '@mazare3/shared';
import { SUPPORT_TICKET_CATEGORIES } from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createBookingSupport, OperationsApiError } from '@/lib/api-operations';

const BOOKING_CATEGORIES = SUPPORT_TICKET_CATEGORIES;

export function BookingSupportForm({
  bookingId,
  bookingPublicCode,
  tickets,
  onSubmitted,
}: {
  bookingId: string;
  bookingPublicCode: string;
  tickets: SupportTicketSummary[];
  onSubmitted: () => Promise<void> | void;
}) {
  const t = useTranslations('support');
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SupportTicketCategory>('booking_status');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<SupportTicketSummary | null>(null);

  const latest = created ?? tickets[0] ?? null;
  const hasOpen = tickets.some((ticket) => ticket.status === 'open' || ticket.status === 'in_progress');

  async function submit() {
    if (busy || created) return;
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    if (trimmedSubject.length < 4 || trimmedMessage.length < 10) {
      setError(t('validation'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await createBookingSupport(bookingId, {
        category,
        subject: trimmedSubject,
        message: trimmedMessage,
      });
      setCreated(res.data);
      void onSubmitted();
    } catch (err) {
      if (err instanceof OperationsApiError && err.code === 'SUPPORT_TICKET_OPEN') {
        setError(t('alreadyOpen'));
      } else {
        setError(err instanceof OperationsApiError ? err.message : t('error'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-2 rounded-xl border border-primary/10 p-3" data-testid={`booking-support-${bookingId}`}>
      <p className="text-xs font-medium text-navy">{t('bookingTitle', { code: bookingPublicCode })}</p>
      {latest ? (
        <div
          className="rounded-lg bg-primary-soft/50 px-3 py-2 text-sm"
          data-testid={`booking-support-status-${bookingId}`}
        >
          <p className="font-medium text-navy">
            {t('reference')}: <span data-testid={`booking-support-ref-${bookingId}`}>{latest.publicCode}</span>
          </p>
          <p className="text-muted">{t(`status.${latest.status}`)}</p>
          {latest.adminResponse ? (
            <p className="mt-2 text-navy" data-testid={`booking-support-reply-${bookingId}`}>
              {t('responseLabel')}: {latest.adminResponse}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted">{t('awaitingReply')}</p>
          )}
        </div>
      ) : null}

      {!hasOpen && !created ? (
        open ? (
          <div className="space-y-2" data-testid={`booking-support-form-${bookingId}`}>
            <select
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
              value={category}
              data-testid={`booking-support-category-${bookingId}`}
              onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
            >
              {BOOKING_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {t(`category.${item}`)}
                </option>
              ))}
            </select>
            <Input
              data-testid={`booking-support-subject-${bookingId}`}
              placeholder={t('subjectPlaceholder')}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <textarea
              data-testid={`booking-support-message-${bookingId}`}
              className="min-h-24 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
              placeholder={t('messagePlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="text-xs text-muted">{t('communicationOnly')}</p>
            {error ? <p className="text-xs text-danger">{error}</p> : null}
            <Button
              size="sm"
              data-testid={`booking-support-submit-${bookingId}`}
              disabled={busy}
              className="gap-1"
              onClick={() => void submit()}
            >
              <Headphones className="h-4 w-4" />
              {busy ? t('submitting') : t('submit')}
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            data-testid={`booking-support-open-${bookingId}`}
            className="gap-1"
            onClick={() => setOpen(true)}
          >
            <Headphones className="h-4 w-4" />
            {t('getHelp')}
          </Button>
        )
      ) : created ? (
        <p className="text-xs text-primary" data-testid={`booking-support-success-${bookingId}`}>
          {t('success')}
        </p>
      ) : null}
    </div>
  );
}
