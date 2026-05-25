import { setRequestLocale } from 'next-intl/server';
import { OwnerShell } from '@/components/owner/owner-shell';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function OwnerLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OwnerShell>{children}</OwnerShell>;
}
