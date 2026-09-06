'use client';

import type { ReactNode } from 'react';
import { usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export function MainContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage =
    pathname.startsWith('/auth') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  return (
    <main
      className={cn(
        'flex-1',
        !isAuthPage && 'pb-[5.75rem] sm:pb-20 md:pb-8',
      )}
    >
      {children}
    </main>
  );
}
