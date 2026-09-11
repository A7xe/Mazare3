'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

/** Compact language chip for immersive auth hero. */
export function AuthLocaleChip() {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const nextLocale = locale === 'ar' ? 'en' : 'ar';

  return (
    <button
      type="button"
      data-testid="auth-locale-chip"
      onClick={() => router.replace(pathname, { locale: nextLocale })}
      aria-label={nextLocale === 'en' ? t('switchToEn') : t('switchToAr')}
      className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1.5 text-sm font-semibold text-white backdrop-blur-sm ring-1 ring-white/25 transition hover:bg-black/35"
    >
      <span className="relative h-3.5 w-5 overflow-hidden rounded-[2px] ring-1 ring-white/40" aria-hidden>
        <span className="absolute inset-0 bg-black" />
        <span className="absolute inset-x-0 top-0 h-[35%] bg-white" />
        <span className="absolute inset-x-0 bottom-0 h-[35%] bg-[#007A3D]" />
        <span className="absolute start-0 top-0 h-full w-[28%] bg-[#CE1126]" />
      </span>
      <span className="uppercase tracking-wide">{locale === 'ar' ? 'AR' : 'EN'}</span>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className="opacity-90">
        <path
          d="M3 4.5L6 7.5L9 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
