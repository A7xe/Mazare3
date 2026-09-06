'use client';

import { useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthApiError, forgotPassword } from '@/lib/api-auth';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const errorId = useId();
  const emailHintId = useId();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setFieldError(null);

    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError(t('errorEmailInvalid'));
      return;
    }

    setLoading(true);
    try {
      await forgotPassword({ email });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof AuthApiError && (err.code === 'RATE_LIMITED' || err.status === 429)) {
        setError(t('errorRateLimited'));
      } else {
        // Still show generic confirmation for most failures to avoid enumeration.
        setSubmitted(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      data-testid="auth-card"
      className="overflow-hidden rounded-[28px] border border-[#E7EEF6] bg-white shadow-[0_16px_48px_rgba(13,32,70,0.08)]"
    >
      <div className="px-5 pb-6 pt-7 sm:px-7 sm:pb-8 sm:pt-8">
        <div className="text-center sm:text-start">
          <h2 className="text-[1.65rem] font-heading leading-tight text-[#0D2046]">
            {t('forgotTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#6B7A8D]">{t('forgotSubtitle')}</p>
        </div>

        {submitted ? (
          <div
            className="mt-6 rounded-xl border border-primary/15 bg-[#F3F7FF] px-4 py-4 text-sm leading-relaxed text-[#0D2046]"
            role="status"
            data-testid="forgot-password-confirmation"
          >
            {t('forgotConfirmation')}
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate aria-busy={loading}>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                name="email"
                data-testid="auth-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                dir="ltr"
                required
                disabled={loading}
                aria-invalid={Boolean(fieldError)}
                aria-describedby={fieldError ? emailHintId : undefined}
                className="h-12 rounded-xl border-[#D8E3F0] bg-[#FAFCFF] text-base"
              />
              {fieldError ? (
                <p id={emailHintId} className="text-xs text-danger" role="alert">
                  {fieldError}
                </p>
              ) : null}
            </div>

            {error ? (
              <p
                id={errorId}
                className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2.5 text-sm text-danger"
                role="alert"
                data-testid="auth-error"
              >
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              data-testid="auth-submit"
              className="h-12 w-full rounded-xl text-base font-bold shadow-soft"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {t('loading')}
                </span>
              ) : (
                t('forgotSubmit')
              )}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-[#6B7A8D]">
          <Link
            href="/auth"
            data-testid="auth-back-login"
            className="font-bold text-primary hover:text-royal hover:underline"
          >
            {t('backToLogin')}
          </Link>
        </p>
      </div>
    </section>
  );
}
