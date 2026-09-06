'use client';

import { useAuthBreadcrumbPropertyTitle } from '@/components/layout/auth-breadcrumb-extras';

/** Publishes a public property title into AuthenticatedTopHeader breadcrumbs. */
export function PublicPropertyBreadcrumbTitle({ title }: { title: string }) {
  useAuthBreadcrumbPropertyTitle(title);
  return null;
}
