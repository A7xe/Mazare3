'use client';

import { usePathname } from '@/i18n/navigation';
import { useAuthSession } from '@/components/auth/auth-session';
import { AuthenticatedTopHeader } from '@/components/layout/authenticated-top-header';
import { SiteHeader } from '@/components/layout/site-header';
import { MarketplaceBottomNav } from '@/components/layout/marketplace-bottom-nav';
import { shouldShowAuthenticatedHeader, isOwnerAppPath } from '@/lib/auth-breadcrumbs';

/** Focused auth pages own their chrome inside AuthShell. */
export function isAuthPagePath(pathname: string) {
  return (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')
  );
}

/** Dedicated booking configuration: /properties/:slug/book */
export function isBookingConfigPath(pathname: string) {
  return /^\/properties\/[^/]+\/book\/?$/.test(pathname);
}

/** Admin, checkout, and booking-config keep operational SiteHeader (no marketplace dock). */
export function isAdminOrCheckout(pathname: string) {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/checkout') ||
    isBookingConfigPath(pathname)
  );
}

/** Admin, auth, and checkout flows — excludes marketplace chrome. */
export function isAdminOrAuthOrCheckout(pathname: string) {
  return isAuthPagePath(pathname) || isAdminOrCheckout(pathname);
}

/** @deprecated Prefer `isAdminOrAuthOrCheckout` for chrome gating. */
export function isOperationalChromePath(pathname: string) {
  return isAdminOrAuthOrCheckout(pathname) || pathname.startsWith('/owner');
}

export function SiteChrome() {
  const pathname = usePathname();
  const { user, ready } = useAuthSession();
  const owner = isOwnerAppPath(pathname);
  const showAuthHeader = ready && Boolean(user) && shouldShowAuthenticatedHeader(pathname);

  if (isAuthPagePath(pathname)) {
    // Marketplace dock stays available on auth (home / explore / account entry).
    return <MarketplaceBottomNav />;
  }

  if (isAdminOrCheckout(pathname)) {
    return <SiteHeader />;
  }

  return (
    <>
      {showAuthHeader ? <AuthenticatedTopHeader sticky={owner} /> : null}
      {!owner ? <MarketplaceBottomNav /> : null}
    </>
  );
}
