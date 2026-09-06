import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Canonical marketplace/customer page frame.
 * Source of truth: approved Homepage outer wrapper (`/[locale]`).
 *
 * - mobile:  px-0
 * - sm+:     px-0.5
 * - lg+:     px-1
 * - max-width: 1420px, centered
 */
export const marketplacePageShellClass =
  'mx-auto w-full max-w-[1420px] px-0 sm:px-0.5 lg:px-1';

type MarketplacePageShellProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
} & Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'>;

export function MarketplacePageShell({
  children,
  className,
  as: Comp = 'div',
  ...rest
}: MarketplacePageShellProps) {
  return (
    <Comp className={cn(marketplacePageShellClass, className)} {...rest}>
      {children}
    </Comp>
  );
}
