import { redirect } from '@/i18n/navigation';
import { setRequestLocale } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function LoginRedirectPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const q = new URLSearchParams();
  q.set('mode', 'email');
  q.set('emailMode', 'login');
  const returnUrl = first(sp.returnUrl);
  const authError = first(sp.authError);
  if (returnUrl) q.set('returnUrl', returnUrl);
  if (authError) q.set('authError', authError);
  redirect({ href: `/auth?${q.toString()}`, locale });
}
