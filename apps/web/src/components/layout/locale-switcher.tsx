'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const nextLocale = locale === 'ar' ? 'en' : 'ar';

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.replace(pathname, { locale: nextLocale })}
      aria-label={`Switch to ${nextLocale}`}
    >
      {locale === 'ar' ? 'EN' : 'ع'}
    </Button>
  );
}
