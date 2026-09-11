'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SupportTicketCategory, SupportTicketSummary } from '@mazare3/shared';
import { SUPPORT_TICKET_CATEGORIES } from '@mazare3/shared';
import {
  ChevronDown,
  Mail,
  Pencil,
  Phone,
  Send,
  User,
} from 'lucide-react';
import { getMe } from '@/lib/api-auth';
import { OperationsApiError, submitGeneralSupport } from '@/lib/api-operations';
import { cn } from '@/lib/utils';

const fieldClass =
  'h-11 w-full rounded-xl border border-[#E4EAF3] bg-white pe-4 ps-10 text-sm text-[#0D2046] outline-none transition placeholder:text-[#9AA6B8] focus:border-[#2F6EF6]/45 focus:ring-2 focus:ring-[#2F6EF6]/12';

export function ContactSupportForm() {
  const t = useTranslations('support');
  const tc = useTranslations('contactPage');
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<SupportTicketCategory>('other');
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
    const trimmedSubject = subject.trim() || t(`category.${category}`);
    const phoneNote = phone.trim() ? `${tc('phoneLine')}: ${phone.trim()}\n\n` : '';
    const trimmedMessage = `${phoneNote}${message.trim()}`.trim();
    if (trimmedSubject.length < 4 || message.trim().length < 10) {
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
        category,
        subject: trimmedSubject.slice(0, 200),
        message: trimmedMessage.slice(0, 3000),
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
      className="rounded-2xl border border-[#E4EAF3] bg-white p-5 shadow-[0_4px_20px_rgba(35,72,120,.05)] sm:p-6"
      data-testid="contact-support-form"
    >
      <div className="flex items-center gap-2">
        <Pencil className="h-4 w-4 text-[#2F6EF6]" aria-hidden />
        <h2 className="text-base font-bold text-[#0D2046] sm:text-lg">{tc('formTitle')}</h2>
      </div>
      <p className="mt-1 text-[13px] text-[#7A879B]">{tc('formHint')}</p>

      {created ? (
        <div className="mt-5 rounded-xl bg-[#EAF2FF] p-4" data-testid="contact-support-success">
          <p className="font-medium text-[#0D2046]">{t('success')}</p>
          <p className="mt-1 text-sm text-[#7A879B]">
            {t('reference')}: <span data-testid="contact-support-ref">{created.publicCode}</span>
          </p>
          <p className="mt-1 text-sm text-[#7A879B]">{t(`status.${created.status}`)}</p>
          {authEmail ? <p className="mt-2 text-sm text-[#0D2046]">{t('trackHint')}</p> : null}
        </div>
      ) : (
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {authEmail ? (
            <p className="text-sm text-[#0D2046]" data-testid="contact-support-auth">
              {t('sendingAs', { email: authEmail })}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {!authEmail ? (
              <>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-[#0D2046]">
                    {tc('fullName')}
                    <span className="text-[#E11D48]">*</span>
                  </span>
                  <span className="relative block">
                    <User className="pointer-events-none absolute inset-y-0 inset-s-3 my-auto h-4 w-4 text-[#9AA6B8]" aria-hidden />
                    <input
                      data-testid="contact-support-name"
                      className={fieldClass}
                      placeholder={t('namePlaceholder')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-[#0D2046]">
                    {tc('email')}
                    <span className="text-[#E11D48]">*</span>
                  </span>
                  <span className="relative block">
                    <Mail className="pointer-events-none absolute inset-y-0 inset-s-3 my-auto h-4 w-4 text-[#9AA6B8]" aria-hidden />
                    <input
                      type="email"
                      data-testid="contact-support-email"
                      className={fieldClass}
                      placeholder={t('emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </span>
                </label>
              </>
            ) : null}

            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[#0D2046]">{tc('phone')}</span>
              <span className="relative block">
                <Phone className="pointer-events-none absolute inset-y-0 inset-s-3 my-auto h-4 w-4 text-[#9AA6B8]" aria-hidden />
                <input
                  type="tel"
                  data-testid="contact-support-phone"
                  className={fieldClass}
                  placeholder={tc('phonePlaceholder')}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  dir="ltr"
                  autoComplete="tel"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-[#0D2046]">
                {tc('issueType')}
                <span className="text-[#E11D48]">*</span>
              </span>
              <span className="relative block">
                <ChevronDown className="pointer-events-none absolute inset-y-0 inset-e-3 my-auto h-4 w-4 text-[#9AA6B8]" aria-hidden />
                <select
                  data-testid="contact-support-category"
                  className={cn(fieldClass, 'cursor-pointer appearance-none ps-4 pe-10')}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
                  required
                >
                  {SUPPORT_TICKET_CATEGORIES.map((key) => (
                    <option key={key} value={key}>
                      {t(`category.${key}`)}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[13px] font-semibold text-[#0D2046]">
                {tc('subject')}
              </span>
              <input
                data-testid="contact-support-subject"
                className={cn(fieldClass, 'ps-4')}
                placeholder={t('subjectPlaceholder')}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-[#0D2046]">
              {tc('message')}
              <span className="text-[#E11D48]">*</span>
            </span>
            <span className="relative block">
              <textarea
                data-testid="contact-support-message"
                className="min-h-[140px] w-full rounded-xl border border-[#E4EAF3] bg-white px-4 py-3 text-sm text-[#0D2046] outline-none transition placeholder:text-[#9AA6B8] focus:border-[#2F6EF6]/45 focus:ring-2 focus:ring-[#2F6EF6]/12"
                placeholder={tc('messagePlaceholder')}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                minLength={10}
              />
              <Pencil className="pointer-events-none absolute bottom-3 inset-e-3 h-4 w-4 text-[#C5CDD9]" aria-hidden />
            </span>
          </label>

          <p className="text-[12px] text-[#7A879B]">{t('communicationOnly')}</p>
          {error ? (
            <p className="text-sm text-[#E11D48]" role="alert" data-testid="contact-support-error">
              {error}
            </p>
          ) : null}

          <div className="flex justify-start">
            <button
              type="submit"
              data-testid="contact-support-submit"
              disabled={busy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2F6EF6] px-6 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(47,110,246,.32)] transition hover:bg-[#255FE0] disabled:opacity-60"
            >
              <Send className="h-4 w-4" aria-hidden />
              {busy ? t('submitting') : tc('sendMessage')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
