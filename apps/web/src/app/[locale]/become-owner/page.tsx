import { setRequestLocale } from 'next-intl/server';
import { BecomeOwnerView } from '@/components/become-owner/become-owner-view';

type Props = { params: Promise<{ locale: string }> };

export default async function BecomeOwnerPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BecomeOwnerView />;
}
