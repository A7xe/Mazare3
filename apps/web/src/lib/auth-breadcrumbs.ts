export type AuthBreadcrumbItem = {
  href?: string;
  /** i18n key under `authHeader.crumbs.*` */
  key: string;
  /** Real entity title when known (never an internal id). */
  literal?: string;
};

export type AuthBreadcrumbExtras = {
  propertyTitle?: string | null;
  /** True when Explore is in textual search mode (`?q=`). */
  searchMode?: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function segments(pathname: string): string[] {
  const pathOnly = pathname.split('?')[0] ?? pathname;
  return pathOnly.split('/').filter(Boolean);
}

/**
 * Route-aware authenticated breadcrumbs. Labels are i18n keys, not raw slugs.
 */
export function resolveAuthBreadcrumbs(
  pathname: string,
  extras?: AuthBreadcrumbExtras,
): AuthBreadcrumbItem[] {
  const parts = segments(pathname);
  const home: AuthBreadcrumbItem = { href: '/', key: 'home' };
  const title = extras?.propertyTitle?.trim() || undefined;

  if (parts.length === 0) {
    return [{ key: 'home' }];
  }

  if (parts[0] === 'become-owner') {
    return [
      home,
      { href: '/account', key: 'account' },
      { key: 'partnerApplication' },
    ];
  }

  if (parts[0] === 'account') {
    const account: AuthBreadcrumbItem = { href: '/account', key: 'account' };
    if (!parts[1]) return [home, { key: 'account' }];
    if (parts[1] === 'bookings') return [home, account, { key: 'bookings' }];
    if (parts[1] === 'favorites') return [home, account, { key: 'favorites' }];
    if (parts[1] === 'notifications') return [home, account, { key: 'notifications' }];
    if (parts[1] === 'support') return [home, account, { key: 'support' }];
    return [home, { key: 'account' }];
  }

  if (parts[0] === 'owner') {
    const mgmt: AuthBreadcrumbItem = { href: '/owner', key: 'propertyManagement' };
    if (!parts[1]) return [home, { key: 'propertyManagement' }];

    if (parts[1] === 'properties') {
      const list: AuthBreadcrumbItem = { href: '/owner/properties', key: 'myProperties' };
      if (!parts[2]) return [home, mgmt, { key: 'myProperties' }];
      if (parts[2] === 'new') return [home, mgmt, { key: 'addProperty' }];
      if (UUID_RE.test(parts[2])) {
        const propertyCrumb: AuthBreadcrumbItem = title
          ? { href: `/owner/properties/${parts[2]}`, key: 'property', literal: title }
          : { href: `/owner/properties/${parts[2]}`, key: 'property' };
        if (parts[3] === 'edit') {
          return [home, mgmt, list, { ...propertyCrumb, href: `/owner/properties/${parts[2]}` }, { key: 'editProperty' }];
        }
        return [home, mgmt, list, { ...propertyCrumb, href: undefined }];
      }
      return [home, mgmt, { key: 'myProperties' }];
    }

    if (parts[1] === 'bookings') return [home, mgmt, { key: 'ownerBookings' }];
    if (parts[1] === 'payouts') return [home, mgmt, { key: 'ownerPayouts' }];
    if (parts[1] === 'reviews') return [home, mgmt, { key: 'ownerReviews' }];
    if (parts[1] === 'availability') return [home, mgmt, { key: 'ownerAvailability' }];
    return [home, { key: 'propertyManagement' }];
  }

  if (parts[0] === 'properties' && parts[1]) {
    const explore: AuthBreadcrumbItem = { href: '/search', key: 'explore' };
    const propertyCrumb: AuthBreadcrumbItem = title
      ? { key: 'property', literal: title }
      : { key: 'property' };
    return [home, explore, { ...propertyCrumb, href: undefined }];
  }

  if (parts[0] === 'search') {
    if (extras?.searchMode) {
      return [home, { key: 'searchResults' }];
    }
    return [home, { key: 'explore' }];
  }

  return [home];
}

/** Admin, auth, and checkout flows keep their focused shells — no authenticated marketplace header. */
export function isExcludedFromAuthenticatedHeader(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/checkout')
  );
}

/** Logged-in surfaces that receive AuthenticatedTopHeader (exclusion-based). */
export function shouldShowAuthenticatedHeader(pathname: string): boolean {
  return !isExcludedFromAuthenticatedHeader(pathname);
}

/** Account, partner, owner, and marketplace browsing routes (for breadcrumb/tests). */
export function isAuthenticatedAppPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/search') ||
    pathname.startsWith('/properties/') ||
    pathname === '/account' ||
    pathname.startsWith('/account/') ||
    pathname.startsWith('/become-owner') ||
    pathname.startsWith('/owner')
  );
}

export function isOwnerAppPath(pathname: string): boolean {
  return pathname.startsWith('/owner');
}

export function userInitials(name: string | null | undefined, email: string | null | undefined): string {
  const n = (name ?? '').trim();
  if (n) {
    const bits = n.split(/\s+/).filter(Boolean);
    if (bits.length >= 2) {
      return `${bits[0]!.slice(0, 1)}${bits[1]!.slice(0, 1)}`;
    }
    return n.slice(0, 2);
  }
  const e = (email ?? '').trim();
  if (!e) return '?';
  const local = e.split('@')[0] ?? e;
  return local.slice(0, 1).toUpperCase();
}
