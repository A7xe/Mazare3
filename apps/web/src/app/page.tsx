import { redirect } from 'next/navigation';
import { DEFAULT_LOCALE } from '@mazare3/shared';

export default function RootPage() {
  redirect(`/${DEFAULT_LOCALE}`);
}
