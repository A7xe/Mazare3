'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login, signup } from '@/lib/api-auth';
import { useAuthSession } from '@/components/auth/auth-session';
import { LegalCommitmentNotice } from '@/components/legal/legal-commitment-notice';

type AuthMode = 'login' | 'signup';

interface AuthFormProps {
  mode: AuthMode;
}

export function AuthForm({ mode }: AuthFormProps) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const { refresh } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const name = form.get('name') ? String(form.get('name')) : undefined;

    try {
      if (mode === 'signup') {
        await signup({ email, password, name, locale });
      } else {
        await login({ email, password });
      }
      await refresh();
      const dest = returnUrl && returnUrl.startsWith('/') ? returnUrl : '/';
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="glass-panel w-full max-w-md overflow-hidden rounded-3xl border-primary/12">
      <div className="gradient-primary h-1" />
      <CardHeader className="pb-2 text-center sm:text-start">
        <CardTitle className="text-2xl">
          {mode === 'login' ? t('loginTitle') : t('signupTitle')}
        </CardTitle>
        <p className="text-sm text-muted">{t('formSubtitle')}</p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')}</Label>
              <Input id="name" name="name" autoComplete="name" disabled={loading} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              name="email"
              data-testid="auth-email"
              type="email"
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('password')}</Label>
            <Input
              id="password"
              name="password"
              data-testid="auth-password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              disabled={loading}
            />
          </div>
          {error && (
            <p
              className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger"
              role="alert"
            >
              {error}
            </p>
          )}
          <Button
            type="submit"
            data-testid="auth-submit"
            className="w-full shadow-soft"
            size="lg"
            disabled={loading}
          >
            {loading
              ? t('loading')
              : mode === 'login'
                ? t('loginSubmit')
                : t('signupSubmit')}
          </Button>
        </form>
        {mode === 'signup' ? (
          <div className="mt-4">
            <LegalCommitmentNotice testId="signup-legal-notice" />
          </div>
        ) : null}
        <p className="mt-6 text-center text-sm text-muted sm:text-start">
          {mode === 'login' ? t('noAccount') : t('hasAccount')}{' '}
          <Link
            href={
              returnUrl
                ? `${mode === 'login' ? '/signup' : '/login'}?returnUrl=${encodeURIComponent(returnUrl)}`
                : mode === 'login'
                  ? '/signup'
                  : '/login'
            }
            className="font-semibold text-primary hover:text-royal hover:underline"
          >
            {mode === 'login' ? t('signupTitle') : t('loginTitle')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
