'use client';

import { useId, useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthApiError, resetPassword } from '@/lib/api-auth';

export function ResetPasswordForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => (searchParams.get('token') ?? '').trim(), [searchParams]);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [invalidToken, setInvalidToken] = useState(!token);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const errorId = useId();
  const passwordHintId = useId();
  const confirmHintId = useId();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading || !token) return;
    setError(null);

    const form = new FormData(e.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirmPassword') ?? '');
    const next: Record<string, string> = {};
    if (password.length < 8) next.password = t('errorPasswordMin');
    else if (password.length > 128) next.password = t('errorPasswordMax');
    if (confirm !== password) next.confirmPassword = t('errorPasswordMismatch');
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await resetPassword({ token, password });
      setSuccess(true);
    } catch (err) {
      if (err instanceof AuthApiError && err.code === 'INVALID_RESET_TOKEN') {
        setInvalidToken(true);
      } else if (err instanceof AuthApiError && (err.code === 'RATE_LIMITED' || err.status === 429)) {
        setError(t('errorRateLimited'));
      } else if (err instanceof AuthApiError && err.code === 'VALIDATION_ERROR') {
        setError(t('errorValidation'));
      } else {
        setError(t('errorGeneric'));
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <section
        data-testid="auth-card"
        className="overflow-hidden rounded-[28px] border border-[#E7EEF6] bg-white shadow-[0_16px_48px_rgba(13,32,70,0.08)]"
      >
        <div className="px-5 pb-6 pt-7 text-center sm:px-7 sm:pb-8 sm:pt-8 sm:text-start">
          <h2 className="text-[1.65rem] font-heading leading-tight text-[#0D2046]">
            {t('resetSuccessTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#6B7A8D]" data-testid="reset-success">
            {t('resetSuccessBody')}
          </p>
          <Button
            className="mt-6 h-12 w-full rounded-xl text-base font-bold"
            size="lg"
            data-testid="auth-submit"
            onClick={() => router.push('/auth')}
          >
            {t('loginCtaLink')}
          </Button>
        </div>
      </section>
    );
  }

  if (invalidToken) {
    return (
      <section
        data-testid="auth-card"
        className="overflow-hidden rounded-[28px] border border-[#E7EEF6] bg-white shadow-[0_16px_48px_rgba(13,32,70,0.08)]"
      >
        <div className="px-5 pb-6 pt-7 text-center sm:px-7 sm:pb-8 sm:pt-8 sm:text-start">
          <h2 className="text-[1.65rem] font-heading leading-tight text-[#0D2046]">
            {t('resetInvalidTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#6B7A8D]" data-testid="reset-invalid">
            {t('resetInvalidBody')}
          </p>
          <Button
            className="mt-6 h-12 w-full rounded-xl text-base font-bold"
            size="lg"
            data-testid="auth-submit"
            asChild
          >
            <Link href="/forgot-password">{t('requestNewLink')}</Link>
          </Button>
          <p className="mt-4 text-center text-sm">
            <Link href="/auth" className="font-bold text-primary hover:underline">
              {t('backToLogin')}
            </Link>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      data-testid="auth-card"
      className="overflow-hidden rounded-[28px] border border-[#E7EEF6] bg-white shadow-[0_16px_48px_rgba(13,32,70,0.08)]"
    >
      <div className="px-5 pb-6 pt-7 sm:px-7 sm:pb-8 sm:pt-8">
        <div className="text-center sm:text-start">
          <h2 className="text-[1.65rem] font-heading leading-tight text-[#0D2046]">
            {t('resetTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#6B7A8D]">{t('resetSubtitle')}</p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate aria-busy={loading}>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t('newPassword')}</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                data-testid="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                disabled={loading}
                dir="ltr"
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={passwordHintId}
                className="h-12 rounded-xl border-[#D8E3F0] bg-[#FAFCFF] pe-12 text-base"
              />
              <button
                type="button"
                data-testid="auth-password-toggle"
                className="absolute inset-e-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#53637A] hover:bg-[#EEF3FA]"
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.password ? (
              <p id={passwordHintId} className="text-xs text-danger" role="alert">
                {fieldErrors.password}
              </p>
            ) : (
              <p id={passwordHintId} className="text-xs text-[#8A96A8]">
                {t('passwordHint')}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                data-testid="auth-password-confirm"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                disabled={loading}
                dir="ltr"
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                aria-describedby={fieldErrors.confirmPassword ? confirmHintId : undefined}
                className="h-12 rounded-xl border-[#D8E3F0] bg-[#FAFCFF] pe-12 text-base"
              />
              <button
                type="button"
                className="absolute inset-e-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#53637A] hover:bg-[#EEF3FA]"
                aria-label={showConfirm ? t('hidePassword') : t('showPassword')}
                aria-pressed={showConfirm}
                onClick={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.confirmPassword ? (
              <p id={confirmHintId} className="text-xs text-danger" role="alert">
                {fieldErrors.confirmPassword}
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
              t('resetSubmit')
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[#6B7A8D]">
          <Link href="/auth" className="font-bold text-primary hover:underline">
            {t('backToLogin')}
          </Link>
        </p>
      </div>
    </section>
  );
}
