import { setRequestLocale } from 'next-intl/server';
import { AuthForm } from '@/components/auth/auth-form';

type Props = { params: Promise<{ locale: string }> };

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center px-4 py-16 sm:px-6">
      <AuthForm mode="login" />
    </div>
  );
}
