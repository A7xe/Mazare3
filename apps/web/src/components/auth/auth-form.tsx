'use client';

import { useEffect, useId, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import {
  authHrefWithReturn,
  resolveSafeReturnUrl,
  sanitizeReturnUrl,
} from '@mazare3/shared';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthApiError, login, signup, type AuthUser } from '@/lib/api-auth';
import { useAuthSession } from '@/components/auth/auth-session';
import { LegalCommitmentNotice } from '@/components/legal/legal-commitment-notice';

type AuthMode = 'login' | 'signup';

interface AuthFormProps {
  mode: AuthMode;
}

function defaultDestination(user: AuthUser): string {
  if (user.role === 'admin') return '/admin';
  if (user.role === 'owner' && user.ownerProfileStatus === 'approved') return '/owner';
  return '/';
}

export function AuthForm({ mode }: AuthFormProps) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawReturn = searchParams.get('returnUrl');
  const safeReturn = sanitizeReturnUrl(rawReturn);
  const { user, ready, refresh } = useAuthSession();

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const errorId = useId();
  const emailHintId = useId();
  const passwordHintId = useId();
  const nameHintId = useId();

  useEffect(() => {
    if (!ready || !user) return;
    const dest = resolveSafeReturnUrl(rawReturn, defaultDestination(user));
    router.replace(dest);
  }, [ready, user, rawReturn, router]);

  if (ready && user) {
    return (
      <div
        data-testid="auth-redirecting"
        className="flex min-h-[240px] items-center justify-center rounded-3xl bg-white p-8 shadow-[0_12px_40px_rgba(13,32,70,0.08)]"
      >
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
        <span className="sr-only">{t('loading')}</span>
      </div>
    );
  }

  function mapServerError(err: unknown): string {
    if (err instanceof AuthApiError) {
      if (err.code === 'INVALID_CREDENTIALS' || err.status === 401) {
        return t('errorInvalidCredentials');
      }
      if (err.code === 'EMAIL_EXISTS' || err.status === 409) {
        return t('errorEmailExists');
      }
      if (err.code === 'ACCOUNT_SUSPENDED' || err.status === 403) {
        return t('errorAccountInactive');
      }
      if (err.code === 'RATE_LIMITED' || err.code === 'AUTH_RATE_LIMITED' || err.status === 429) {
        return t('errorRateLimited');
      }
      if (err.code === 'VALIDATION_ERROR') {
        return t('errorValidation');
      }
    }
    return t('errorGeneric');
  }

  function validateClient(form: FormData): Record<string, string> {
    const next: Record<string, string> = {};
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const name = form.get('name') ? String(form.get('name')).trim() : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = t('errorEmailInvalid');
    }
    if (mode === 'signup') {
      if (password.length < 8) next.password = t('errorPasswordMin');
      else if (password.length > 128) next.password = t('errorPasswordMax');
      if (name && name.length < 2) next.name = t('errorNameMin');
    } else if (!password) {
      next.password = t('errorPasswordRequired');
    }
    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const clientErrors = validateClient(form);
    setFieldErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setLoading(true);

    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const nameRaw = form.get('name') ? String(form.get('name')).trim() : '';
    const name = nameRaw || undefined;

    try {
      let authed: AuthUser;
      if (mode === 'signup') {
        const res = await signup({ email, password, name, locale });
        authed = res.data.user;
      } else {
        const res = await login({ email, password });
        authed = res.data.user;
      }
      await refresh();
      const dest = resolveSafeReturnUrl(rawReturn, defaultDestination(authed));
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(mapServerError(err));
    } finally {
      setLoading(false);
    }
  }

  const switchHref = authHrefWithReturn(mode === 'login' ? '/signup' : '/login', safeReturn);

  return (
    <section
      data-testid="auth-card"
      className="overflow-hidden rounded-[28px] border border-[#E7EEF6] bg-white shadow-[0_16px_48px_rgba(13,32,70,0.08)]"
    >
      <div className="px-5 pb-6 pt-7 sm:px-7 sm:pb-8 sm:pt-8">
        <div className="text-center sm:text-start">
          <h2 className="text-[1.65rem] font-heading leading-tight text-[#0D2046]">
            {mode === 'login' ? t('loginTitle') : t('signupTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#6B7A8D]">
            {mode === 'login' ? t('loginSubtitle') : t('signupSubtitle')}
          </p>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={handleSubmit}
          noValidate
          aria-busy={loading}
        >
          {mode === 'signup' ? (
            <div className="space-y-1.5">
              <Label htmlFor="name">{t('name')}</Label>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                disabled={loading}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? nameHintId : undefined}
                className="h-12 rounded-xl border-[#D8E3F0] bg-[#FAFCFF] text-base"
              />
              {fieldErrors.name ? (
                <p id={nameHintId} className="text-xs text-danger" role="alert">
                  {fieldErrors.name}
                </p>
              ) : null}
            </div>
          ) : null}

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
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? emailHintId : undefined}
              className="h-12 rounded-xl border-[#D8E3F0] bg-[#FAFCFF] text-base"
            />
            {fieldErrors.email ? (
              <p id={emailHintId} className="text-xs text-danger" role="alert">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password">{t('password')}</Label>
              {mode === 'login' ? (
                <Link
                  href="/forgot-password"
                  data-testid="auth-forgot-password"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {t('forgotLink')}
                </Link>
              ) : null}
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                data-testid="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'signup' ? 8 : 1}
                maxLength={128}
                disabled={loading}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={
                  fieldErrors.password
                    ? passwordHintId
                    : mode === 'signup'
                      ? passwordHintId
                      : undefined
                }
                className="h-12 rounded-xl border-[#D8E3F0] bg-[#FAFCFF] pe-12 text-base"
                dir="ltr"
              />
              <button
                type="button"
                data-testid="auth-password-toggle"
                className="absolute inset-e-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#53637A] transition-colors hover:bg-[#EEF3FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
            {fieldErrors.password ? (
              <p id={passwordHintId} className="text-xs text-danger" role="alert">
                {fieldErrors.password}
              </p>
            ) : mode === 'signup' ? (
              <p id={passwordHintId} className="text-xs text-[#8A96A8]">
                {t('passwordHint')}
              </p>
            ) : null}
          </div>

          {error ? (
            <div
              id={errorId}
              className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2.5 text-sm text-danger"
              role="alert"
              data-testid="auth-error"
            >
              <p>{error}</p>
              {mode === 'signup' && error === t('errorEmailExists') ? (
                <p className="mt-1.5">
                  <Link
                    href={authHrefWithReturn('/login', safeReturn)}
                    className="font-semibold underline underline-offset-2"
                  >
                    {t('loginTitle')}
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}

          <Button
            type="submit"
            data-testid="auth-submit"
            className="h-12 w-full rounded-xl text-base font-bold shadow-soft"
            size="lg"
            disabled={loading}
            aria-describedby={error ? errorId : undefined}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t('loading')}
              </span>
            ) : mode === 'login' ? (
              t('loginSubmit')
            ) : (
              t('signupSubmit')
            )}
          </Button>
        </form>

        {mode === 'signup' ? (
          <div className="mt-4">
            <LegalCommitmentNotice testId="signup-legal-notice" />
          </div>
        ) : null}

        <p className="mt-6 text-center text-sm text-[#6B7A8D]">
          {mode === 'login' ? t('noAccount') : t('hasAccount')}{' '}
          <Link
            href={switchHref}
            data-testid="auth-mode-switch"
            className="font-bold text-primary hover:text-royal hover:underline"
          >
            {mode === 'login' ? t('signupCtaLink') : t('loginCtaLink')}
          </Link>
        </p>
      </div>
    </section>
  );
}
