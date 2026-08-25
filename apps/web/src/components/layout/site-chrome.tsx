'use client';

import { usePathname } from '@/i18n/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { MarketplaceBottomNav } from '@/components/layout/marketplace-bottom-nav';

export function isOperationalChromePath(pathname: string) {
  return (
    pathname.startsWith('/owner') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/checkout')
  );
}

export function SiteChrome() {
  const pathname = usePathname();
  if (isOperationalChromePath(pathname)) {
    return <SiteHeader />;
  }
  return <MarketplaceBottomNav />;
}
