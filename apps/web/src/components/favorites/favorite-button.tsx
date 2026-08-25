'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useFavorites } from './favorites-context';

type Props = {
  propertyId: string;
  variant?: 'overlay' | 'inline';
};

export function FavoriteButton({ propertyId, variant = 'overlay' }: Props) {
  const t = useTranslations('favorites');
  const pathname = usePathname();
  const { ready, isCustomer, role, isFavorited, toggle } = useFavorites();
  const [busy, setBusy] = useState(false);

  if (role === 'owner' || role === 'admin') return null;

  const favorited = isFavorited(propertyId);
  const className = cn(
    'inline-flex h-9 w-9 items-center justify-center border transition-colors',
    variant === 'overlay'
      ? 'rounded-[10px] border-white/90 bg-white text-[#0D2046] shadow-[0_4px_12px_rgba(15,35,70,.12)] hover:bg-white'
      : 'rounded-full border-border bg-surface text-navy hover:border-primary/40',
    favorited && 'border-primary/30 text-primary',
  );

  if (!ready) {
    return (
      <span className={cn(className, 'opacity-60')} aria-hidden>
        <Heart className="h-4 w-4" />
      </span>
    );
  }

  if (!isCustomer) {
    const returnUrl = encodeURIComponent(pathname || '/');
    return (
      <Link
        href={`/login?returnUrl=${returnUrl}`}
        data-testid="favorite-toggle"
        aria-label={t('add')}
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        <Heart className="h-4 w-4" />
      </Link>
    );
  }

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await toggle(propertyId);
    } catch {
      /* rollback in context */
    } finally {
      setBusy(false);
    }
  }

  const label = favorited ? t('remove') : t('add');

  return (
    <button
      type="button"
      data-testid="favorite-toggle"
      aria-label={label}
      aria-pressed={favorited}
      disabled={busy}
      className={className}
      onClick={(e) => void onClick(e)}
    >
      <Heart className={cn('h-4 w-4', favorited && 'fill-primary text-primary')} />
    </button>
  );
}
