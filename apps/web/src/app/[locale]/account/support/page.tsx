import { setRequestLocale } from 'next-intl/server';
import { MySupportView } from '@/components/account/my-support-view';

type Props = { params: Promise<{ locale: string }> };

export default async function AccountSupportPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <MySupportView />
    </div>
  );
}
