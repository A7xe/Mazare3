import { setRequestLocale } from 'next-intl/server';
import { AccountHomeView } from '@/components/account/account-home-view';

type Props = { params: Promise<{ locale: string }> };

export default async function AccountHomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <AccountHomeView />
    </div>
  );
}
