import { redirect } from '@/i18n/navigation';
import { setRequestLocale } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SignupRedirectPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const q = new URLSearchParams();
  q.set('mode', 'email');
  q.set('emailMode', 'signup');
  const returnUrl = first(sp.returnUrl);
  if (returnUrl) q.set('returnUrl', returnUrl);
  redirect({ href: `/auth?${q.toString()}`, locale });
}
