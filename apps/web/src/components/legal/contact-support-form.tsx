'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SupportTicketSummary } from '@mazare3/shared';
import { getMe } from '@/lib/api-auth';
import { OperationsApiError, submitGeneralSupport } from '@/lib/api-operations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ContactSupportForm() {
  const t = useTranslations('support');
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<SupportTicketSummary | null>(null);

  useEffect(() => {
    void getMe()
      .then((res) => setAuthEmail(res.data.user.email))
      .catch(() => setAuthEmail(null));
  }, []);

  async function submit() {
    if (busy || created) return;
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    if (trimmedSubject.length < 4 || trimmedMessage.length < 10) {
      setError(t('validation'));
      return;
    }
    if (!authEmail && (name.trim().length < 2 || !email.includes('@'))) {
      setError(t('guestValidation'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await submitGeneralSupport({
        category: 'other',
        subject: trimmedSubject,
        message: trimmedMessage,
        ...(authEmail ? {} : { name: name.trim(), email: email.trim() }),
      });
      setCreated(res.data);
    } catch (err) {
      if (err instanceof OperationsApiError && err.code === 'SUPPORT_TICKET_DUPLICATE') {
        setError(t('duplicate'));
      } else {
        setError(err instanceof OperationsApiError ? err.message : t('error'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="mt-8 rounded-2xl border border-primary/15 bg-surface p-5 shadow-card"
      data-testid="contact-support-form"
    >
      <h2 className="text-lg font-semibold text-navy">{t('contactTitle')}</h2>
      <p className="mt-1 text-sm text-muted">{t('contactHint')}</p>

      {created ? (
        <div className="mt-4 rounded-xl bg-primary-soft/60 p-4" data-testid="contact-support-success">
          <p className="font-medium text-navy">{t('success')}</p>
          <p className="mt-1 text-sm text-muted">
            {t('reference')}: <span data-testid="contact-support-ref">{created.publicCode}</span>
          </p>
          <p className="mt-1 text-sm text-muted">{t(`status.${created.status}`)}</p>
          {authEmail ? <p className="mt-2 text-sm text-navy">{t('trackHint')}</p> : null}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {authEmail ? (
            <p className="text-sm text-navy" data-testid="contact-support-auth">
              {t('sendingAs', { email: authEmail })}
            </p>
          ) : (
            <>
              <Input
                data-testid="contact-support-name"
                placeholder={t('namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                type="email"
                data-testid="contact-support-email"
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </>
          )}
          <Input
            data-testid="contact-support-subject"
            placeholder={t('subjectPlaceholder')}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            data-testid="contact-support-message"
            className="min-h-28 w-full rounded-xl border border-border bg-surface px-4 py-2 text-sm"
            placeholder={t('messagePlaceholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="text-xs text-muted">{t('communicationOnly')}</p>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button data-testid="contact-support-submit" disabled={busy} onClick={() => void submit()}>
            {busy ? t('submitting') : t('submit')}
          </Button>
        </div>
      )}
    </div>
  );
}
