'use client';

import type { ComponentProps, ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { useAddFarmEntry } from '@/lib/use-add-farm-entry';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & {
  /** When omitted, uses the shared dynamic partner/Add Farm label. */
  children?: ReactNode;
};

/**
 * Status-aware Add Farm CTA: approved owners → wizard; everyone else → partner entry.
 * Label follows `resolveAddFarmLabelKey` (destinations unchanged).
 */
export function AddFarmLink({ children, ...rest }: Props) {
  const { href, label, labelKey } = useAddFarmEntry();
  return (
    <Link
      href={href}
      data-add-farm-entry={href}
      data-add-farm-label={labelKey}
      {...rest}
    >
      {children ?? label}
    </Link>
  );
}
