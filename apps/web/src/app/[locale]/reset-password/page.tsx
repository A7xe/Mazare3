import { Suspense } from 'react';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

type Props = { params: Promise<{ locale: string }> };

export const metadata: Metadata = {
  referrer: 'no-referrer',
};

export default async function ResetPasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <AuthShell mode="reset">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
