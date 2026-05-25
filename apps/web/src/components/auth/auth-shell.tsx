import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Waves, ShieldCheck } from 'lucide-react';

interface AuthShellProps {
  children: ReactNode;
}

export async function AuthShell({ children }: AuthShellProps) {
  const t = await getTranslations('common');
  const tAuth = await getTranslations('auth');

  return (
    <div className="gradient-auth relative min-h-[70vh] overflow-hidden px-4 py-12 sm:px-6 sm:py-16">
      <div className="pointer-events-none absolute -end-20 top-10 h-64 w-64 rounded-full bg-primary/6 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -start-10 h-56 w-56 rounded-full bg-royal/5 blur-3xl" />

      <div className="relative mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="hidden text-start lg:block">
          <div className="glass-surface mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-navy">
            <Waves className="h-4 w-4 text-primary" />
            {t('brand')}
          </div>
          <h1 className="text-3xl font-bold leading-tight text-navy">{tAuth('shellTitle')}</h1>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">{tAuth('shellSubtitle')}</p>
          <ul className="mt-8 space-y-3 text-sm text-muted">
            {[tAuth('shellPoint1'), tAuth('shellPoint2'), tAuth('shellPoint3')].map((point) => (
              <li key={point} className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
