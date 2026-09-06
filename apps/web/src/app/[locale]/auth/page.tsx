import { Suspense } from 'react';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { UnifiedAuthView } from '@/components/auth/unified-auth-view';

type Props = { params: Promise<{ locale: string }> };

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'Account',
};

export default async function AuthPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <AuthShell mode="unified">
      <Suspense>
        <UnifiedAuthView />
      </Suspense>
    </AuthShell>
  );
}
